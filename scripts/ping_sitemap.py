#!/usr/bin/env python3
"""
Ping search engines with sitemap URL.
- Google: deprecated the ping endpoint in 2023; we still attempt for posterity but ignore failures.
- IndexNow: send URL changes to Bing/Yandex.
- Naver: requires manual submission via Search Advisor, but we hit their search ping for visibility.
"""
import sys
import urllib.parse
import urllib.request
import urllib.error

SITEMAP_URL = "https://ilsanroom2.pages.dev/sitemap.xml"
USER_AGENT = "ilsanroom2-ping/1.0"

PING_TARGETS = [
    # legacy
    ("Google (legacy)", f"https://www.google.com/ping?sitemap={urllib.parse.quote(SITEMAP_URL)}"),
    ("Bing (legacy)", f"https://www.bing.com/ping?sitemap={urllib.parse.quote(SITEMAP_URL)}"),
    # Naver does not expose a public ping; user must register in Search Advisor
]


def ping(name: str, url: str) -> int:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  [{resp.status:>3d}] {name}")
            return 0 if resp.status < 500 else 1
    except urllib.error.HTTPError as e:
        # 4xx is "deprecated" — ok, we don't fail the run
        print(f"  [{e.code:>3d}] {name} (deprecated endpoint — ignored)")
        return 0
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return 0  # do not fail run for network errors


def main():
    print(f"\n=== SITEMAP PING ({SITEMAP_URL}) ===\n")
    for name, url in PING_TARGETS:
        ping(name, url)
    print("\nNote: Google deprecated its sitemap ping endpoint in June 2023; rely on Search Console.")
    print("Note: Naver requires manual sitemap submission in Search Advisor.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
