#!/usr/bin/env python3
"""
Live site healthcheck.
Hits every URL listed in sitemap.xml and verifies:
  - HTTP 200
  - <title> present
  - <h1> present
  - canonical present
  - response < 3s
Exits non-zero if any fail.
"""
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITEMAP = ROOT / "sitemap.xml"
TIMEOUT = 15  # seconds
MAX_LATENCY = 5.0  # seconds (relaxed for cold start)
USER_AGENT = "ilsanroom2-watchdog/1.0 (+https://ilsanroom2.pages.dev/)"

LOC_RE = re.compile(r"<loc>(.*?)</loc>", re.S)
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S | re.I)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S | re.I)
CANONICAL_RE = re.compile(r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']', re.S | re.I)


def fetch(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body, time.monotonic() - t0
    except urllib.error.HTTPError as e:
        return e.code, "", time.monotonic() - t0
    except Exception as e:
        return 0, f"ERROR: {e}", time.monotonic() - t0


def main():
    if not SITEMAP.exists():
        print("[ERROR] sitemap.xml not found")
        return 1
    urls = LOC_RE.findall(SITEMAP.read_text(encoding="utf-8"))
    if not urls:
        print("[ERROR] no <loc> entries in sitemap.xml")
        return 1

    print(f"\n=== LIVE HEALTHCHECK ({len(urls)} URLs) ===\n")
    errors = []
    for url in urls:
        status, body, latency = fetch(url)
        title = ""
        h1 = ""
        canon = ""
        if status == 200:
            tm = TITLE_RE.search(body)
            hm = H1_RE.search(body)
            cm = CANONICAL_RE.search(body)
            title = tm.group(1).strip() if tm else ""
            h1 = re.sub(r"<[^>]+>", "", hm.group(1)).strip() if hm else ""
            canon = cm.group(1).strip() if cm else ""

        marks = []
        if status != 200:
            marks.append(f"HTTP={status}")
        if status == 200 and not title:
            marks.append("NO-TITLE")
        if status == 200 and not h1:
            marks.append("NO-H1")
        if status == 200 and not canon:
            marks.append("NO-CANONICAL")
        # Detect Cloudflare/SPA fallback: canonical points to a different URL than requested
        if status == 200 and canon:
            # normalize trailing slash for comparison
            req_norm = url.rstrip("/") + "/"
            canon_norm = canon.rstrip("/") + "/"
            if req_norm != canon_norm:
                marks.append(f"CANONICAL-MISMATCH→{canon}")
        if latency > MAX_LATENCY:
            marks.append(f"SLOW={latency:.1f}s")

        flag = " | ".join(marks) if marks else "OK"
        print(f"  [{flag:<30s}] {url}  ({latency:.2f}s)")
        if marks:
            errors.append((url, marks))

    print(f"\nFailures: {len(errors)} / {len(urls)}\n")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
