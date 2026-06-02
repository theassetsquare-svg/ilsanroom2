#!/usr/bin/env node
/**
 * gsc_monitor.js — daily Search Console health monitor for ilsanroom2.
 *
 * Detects, for EVERY page:
 *   - "Crawled - currently not indexed" / not-indexed pages
 *   - keyword cannibalization (one query → multiple competing pages)
 *   - ranking drops vs the last snapshot (.gsc_cache/last.json)
 *   - low-CTR high-impression pages (title/meta tuning opportunities)
 *
 * Writes a human report to stdout and a machine snapshot to .gsc_cache/last.json.
 * Exits non-zero when an ACTIONABLE problem is found, so CI / the scheduled
 * agent can alert theassetsquare@gmail.com.
 *
 * Credentials: .secrets/theasset-gsc.json or $GOOGLE_APPLICATION_CREDENTIALS.
 */
const fs = require('fs');
const path = require('path');
const { getAccessToken, api, searchAnalytics, DEFAULT_PROPERTY } = require('./gsc');

const ROOT = path.resolve(__dirname, '..');
const PROPERTY = process.env.GSC_PROPERTY || DEFAULT_PROPERTY;
const CACHE_DIR = path.join(ROOT, '.gsc_cache');
const CACHE_FILE = path.join(CACHE_DIR, 'last.json');

const PAGES = [
  '',
  'guide/',
  'review/',
  'reservation/',
  'parking/',
  'area/',
  'faq/',
  'legal/',
].map((p) => PROPERTY.replace(/\/$/, '/') + p);

async function inspect(token, url) {
  try {
    const json = await api(
      token,
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      'POST',
      { inspectionUrl: url, siteUrl: PROPERTY }
    );
    return json.inspectionResult?.indexStatusResult || {};
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  const problems = [];
  const info = [];
  const token = await getAccessToken();

  // 1) Index coverage per page
  info.push('── INDEX COVERAGE ──');
  const snapshot = { date: new Date().toISOString().slice(0, 10), pages: {} };
  for (const url of PAGES) {
    const r = await inspect(token, url);
    const state = r.coverageState || r.error || 'UNKNOWN';
    snapshot.pages[url] = { coverageState: state, verdict: r.verdict };
    const indexed = /Submitted and indexed|URL is on Google/i.test(state);
    info.push(`  ${indexed ? '✅' : '⚠️ '} ${url} → ${state}`);
    if (!indexed) {
      problems.push(`NOT INDEXED: ${url} → "${state}"`);
    }
  }

  // 2) Rankings + cannibalization (28d)
  const qp = await searchAnalytics(token, PROPERTY, 28, ['query', 'page']);
  const byQuery = {};
  for (const row of qp.rows || []) {
    (byQuery[row.keys[0]] ||= []).push({ page: row.keys[1], ...row });
  }
  info.push('\n── KEYWORDS (28d) ──');
  const queryRows = (await searchAnalytics(token, PROPERTY, 28, ['query'])).rows || [];
  snapshot.queries = {};
  if (!queryRows.length) info.push('  (no query data yet — site still gaining impressions)');
  for (const r of queryRows.slice(0, 25)) {
    const q = r.keys[0];
    snapshot.queries[q] = Number(r.position.toFixed(1));
    info.push(
      `  "${q}"  pos ${r.position.toFixed(1)}  impr ${r.impressions}  clicks ${r.clicks}  ctr ${(r.ctr * 100).toFixed(1)}%`
    );
  }

  info.push('\n── CANNIBALIZATION ──');
  let cannibal = 0;
  for (const [q, rows] of Object.entries(byQuery)) {
    const pages = [...new Set(rows.map((r) => r.page))];
    if (pages.length > 1) {
      cannibal++;
      problems.push(`CANNIBALIZATION: "${q}" split across ${pages.length} pages: ${pages.join(' | ')}`);
    }
  }
  if (!cannibal) info.push('  ✅ none');

  // 3) Low-CTR opportunities (high impressions, low ctr, decent position)
  info.push('\n── CTR OPPORTUNITIES (tune title/meta) ──');
  let opp = 0;
  for (const r of queryRows) {
    if (r.impressions >= 30 && r.position <= 15 && r.ctr < 0.02) {
      opp++;
      info.push(`  "${r.keys[0]}" impr ${r.impressions} pos ${r.position.toFixed(1)} ctr ${(r.ctr * 100).toFixed(1)}% → improve snippet`);
    }
  }
  if (!opp) info.push('  ✅ none flagged');

  // 4) Ranking drops vs last snapshot
  info.push('\n── RANKING CHANGES vs last run ──');
  if (fs.existsSync(CACHE_FILE)) {
    const prev = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    let changed = 0;
    for (const [q, pos] of Object.entries(snapshot.queries || {})) {
      const old = prev.queries?.[q];
      if (old != null) {
        const delta = pos - old; // positive = worse (higher position number)
        if (Math.abs(delta) >= 2) {
          changed++;
          const arrow = delta > 0 ? '🔻 dropped' : '🔺 improved';
          info.push(`  "${q}" ${old} → ${pos} (${arrow} ${Math.abs(delta).toFixed(1)})`);
          if (delta >= 3) problems.push(`RANK DROP: "${q}" ${old} → ${pos}`);
        }
      }
    }
    if (!changed) info.push('  (no significant change)');
  } else {
    info.push('  (no prior snapshot — baseline saved)');
  }

  // Persist snapshot
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(snapshot, null, 2));

  // Report
  console.log(`=== GSC MONITOR — ${PROPERTY} — ${snapshot.date} ===\n`);
  console.log(info.join('\n'));
  console.log('\n=== PROBLEMS ===');
  if (!problems.length) {
    console.log('  ✅ No actionable problems.');
  } else {
    problems.forEach((p) => console.log(`  ❌ ${p}`));
  }

  // Emit a compact JSON block for the alerting layer to parse
  console.log('\n<<<JSON>>>' + JSON.stringify({ date: snapshot.date, property: PROPERTY, problems }) + '<<<END>>>');

  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => {
  console.error('MONITOR ERROR:', e.message);
  console.log('\n<<<JSON>>>' + JSON.stringify({ error: e.message }) + '<<<END>>>');
  process.exit(2);
});
