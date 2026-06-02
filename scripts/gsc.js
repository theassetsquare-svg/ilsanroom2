#!/usr/bin/env node
/**
 * gsc.js — Google Search Console client (zero external deps, Node 18+).
 *
 * Signs a service-account JWT with crypto.createSign (RS256), exchanges it for
 * an access token, then calls the Search Console API.
 *
 * Usage:
 *   node scripts/gsc.js sites                       # list verified properties
 *   node scripts/gsc.js query [days] [property]     # top queries + pages
 *   node scripts/gsc.js inspect <url> [property]    # URL inspection
 *
 * Credentials: .secrets/theasset-gsc.json  (or $GOOGLE_APPLICATION_CREDENTIALS)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CRED_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(ROOT, '.secrets', 'theasset-gsc.json');
// Read-write scope: covers search analytics + URL inspection (read) AND
// sitemap submission (write). Service account is siteOwner.
const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const DEFAULT_PROPERTY =
  process.env.GSC_PROPERTY || 'https://ilsanroom2.pages.dev/';

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const cred = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: cred.client_email,
      scope: SCOPE,
      aud: cred.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(cred.private_key));
  const assertion = `${header}.${claim}.${sig}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(cred.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Token error: ' + JSON.stringify(json));
  }
  return json.access_token;
}

async function api(token, url, method = 'GET', payload) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function listSites(token) {
  const json = await api(
    token,
    'https://www.googleapis.com/webmasters/v3/sites'
  );
  return json.siteEntry || [];
}

async function searchAnalytics(token, property, days, dimensions) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property
  )}/searchAnalytics/query`;
  return api(token, url, 'POST', {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions,
    rowLimit: 50,
  });
}

function table(rows, dimName) {
  if (!rows || !rows.length) {
    console.log('  (no data yet — site may be newly indexed)');
    return;
  }
  console.log(
    `  ${dimName.padEnd(34)} ${'clicks'.padStart(7)} ${'impr'.padStart(
      7
    )} ${'ctr'.padStart(7)} ${'pos'.padStart(6)}`
  );
  for (const r of rows) {
    const key = (r.keys[0] || '').slice(0, 34);
    console.log(
      `  ${key.padEnd(34)} ${String(r.clicks).padStart(7)} ${String(
        r.impressions
      ).padStart(7)} ${(r.ctr * 100).toFixed(1).padStart(6)}% ${r.position
        .toFixed(1)
        .padStart(6)}`
    );
  }
}

async function main() {
  const [cmd = 'query', arg1, arg2] = process.argv.slice(2);
  const token = await getAccessToken();

  if (cmd === 'sites') {
    const sites = await listSites(token);
    console.log('=== Verified Search Console properties ===');
    if (!sites.length) console.log('  (none — service account not added yet)');
    for (const s of sites)
      console.log(`  ${s.permissionLevel.padEnd(20)} ${s.siteUrl}`);
    return;
  }

  if (cmd === 'query') {
    const days = parseInt(arg1, 10) || 28;
    const property = arg2 || DEFAULT_PROPERTY;
    console.log(`=== GSC Search Analytics — ${property} (last ${days}d) ===\n`);
    console.log('TOP QUERIES (keywords):');
    table((await searchAnalytics(token, property, days, ['query'])).rows, 'query');
    console.log('\nTOP PAGES:');
    table((await searchAnalytics(token, property, days, ['page'])).rows, 'page');
    console.log('\nQUERY × PAGE (cannibalization check):');
    const qp = await searchAnalytics(token, property, days, ['query', 'page']);
    const byQuery = {};
    for (const r of qp.rows || []) {
      (byQuery[r.keys[0]] ||= []).push(r.keys[1]);
    }
    let cannibal = 0;
    for (const [q, pages] of Object.entries(byQuery)) {
      const uniq = [...new Set(pages)];
      if (uniq.length > 1) {
        cannibal++;
        console.log(`  ⚠ "${q}" → ${uniq.length} pages competing:`);
        uniq.forEach((p) => console.log(`      ${p}`));
      }
    }
    if (!cannibal) console.log('  ✅ No keyword cannibalization detected.');
    return;
  }

  if (cmd === 'submit-sitemap') {
    const property = arg2 || DEFAULT_PROPERTY;
    const sitemap = arg1 || property.replace(/\/$/, '/') + 'sitemap.xml';
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      property
    )}/sitemaps/${encodeURIComponent(sitemap)}`;
    await api(token, url, 'PUT');
    console.log(`✅ Sitemap submitted: ${sitemap}`);
    // Show status back
    const status = await api(
      token,
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps`
    );
    for (const s of status.sitemap || []) {
      console.log(`   ${s.path} — lastSubmitted: ${s.lastSubmitted || 'n/a'}, errors: ${s.errors || 0}, warnings: ${s.warnings || 0}`);
    }
    return;
  }

  if (cmd === 'inspect') {
    const inspectUrl = arg1;
    const property = arg2 || DEFAULT_PROPERTY;
    const json = await api(
      token,
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      'POST',
      { inspectionUrl: inspectUrl, siteUrl: property }
    );
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  console.log('Unknown command. Use: sites | query [days] [property] | inspect <url>');
}

module.exports = {
  getAccessToken,
  api,
  listSites,
  searchAnalytics,
  DEFAULT_PROPERTY,
};

if (require.main === module) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
