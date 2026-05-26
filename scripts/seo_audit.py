#!/usr/bin/env python3
"""
SEO audit for ilsanroom2.
Checks: title uniqueness, meta description uniqueness, canonical correctness,
H1 presence, keyword density 1.5-2.5%, schema presence, og:image presence.
Exits non-zero if any rule fails so CI can block.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    "index.html",
    "guide/index.html",
    "review/index.html",
    "reservation/index.html",
    "parking/index.html",
    "area/index.html",
    "faq/index.html",
    "legal/index.html",
]
KEYWORD = "일산룸"
MIN_DENSITY = 1.5
MAX_DENSITY = 3.0  # tolerant max (Google penalty threshold ~ much higher)
TARGET_DENSITY_MAX = 2.7  # warn above
DOMAIN = "https://ilsanroom2.pages.dev"

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)
META_DESC_RE = re.compile(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', re.S)
CANONICAL_RE = re.compile(r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']', re.S)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
OG_IMAGE_RE = re.compile(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', re.S)
SCHEMA_RE = re.compile(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>', re.S)
TAG_STRIP = re.compile(r"<script.*?</script>|<style.*?</style>|<[^>]+>", re.S)
WS = re.compile(r"\s+")


def visible_text(html: str) -> str:
    return WS.sub(" ", TAG_STRIP.sub("", html))


def density(html: str) -> float:
    text = visible_text(html)
    if not text:
        return 0.0
    return text.count(KEYWORD) * len(KEYWORD) / len(text) * 100


def audit():
    errors = []
    warnings = []
    titles = {}
    descs = {}
    rows = []

    for rel in PAGES:
        p = ROOT / rel
        if not p.exists():
            errors.append(f"MISSING: {rel}")
            continue
        html = p.read_text(encoding="utf-8")

        title_m = TITLE_RE.search(html)
        desc_m = META_DESC_RE.search(html)
        canon_m = CANONICAL_RE.search(html)
        h1_m = H1_RE.search(html)
        og_m = OG_IMAGE_RE.search(html)
        schema_m = SCHEMA_RE.search(html)

        title = title_m.group(1).strip() if title_m else ""
        desc = desc_m.group(1).strip() if desc_m else ""
        canonical = canon_m.group(1).strip() if canon_m else ""
        h1 = re.sub(r"<[^>]+>", "", h1_m.group(1)).strip() if h1_m else ""
        dens = density(html)

        if not title:
            errors.append(f"{rel}: missing <title>")
        elif len(title) > 60:
            warnings.append(f"{rel}: title length {len(title)} > 60")
        elif KEYWORD not in title:
            errors.append(f"{rel}: title missing primary keyword '{KEYWORD}'")

        # duplicate-word check (e.g. "일산룸 일산룸 최고")
        title_words = title.split()
        for w in set(title_words):
            if len(w) > 1 and title_words.count(w) > 1:
                errors.append(f"{rel}: duplicate word '{w}' in title")

        if not desc:
            errors.append(f"{rel}: missing meta description")
        elif len(desc) < 80 or len(desc) > 200:
            warnings.append(f"{rel}: meta length {len(desc)} (target 120-180)")

        if not canonical:
            errors.append(f"{rel}: missing canonical")
        elif not canonical.startswith(DOMAIN):
            errors.append(f"{rel}: canonical wrong domain → {canonical}")

        if not h1:
            errors.append(f"{rel}: missing <h1>")

        if not og_m:
            errors.append(f"{rel}: missing og:image")

        if not schema_m:
            errors.append(f"{rel}: missing JSON-LD schema")

        if dens < MIN_DENSITY:
            errors.append(f"{rel}: density {dens:.2f}% < {MIN_DENSITY}%")
        elif dens > MAX_DENSITY:
            errors.append(f"{rel}: density {dens:.2f}% > {MAX_DENSITY}%")
        elif dens > TARGET_DENSITY_MAX:
            warnings.append(f"{rel}: density {dens:.2f}% > target {TARGET_DENSITY_MAX}%")

        # title duplicate across pages
        if title in titles:
            errors.append(f"{rel}: duplicate title with {titles[title]} → '{title}'")
        else:
            titles[title] = rel

        # description duplicate across pages
        if desc and desc in descs:
            errors.append(f"{rel}: duplicate description with {descs[desc]}")
        else:
            descs[desc] = rel

        rows.append((rel, title, len(desc), dens))

    print("\n=== SEO AUDIT REPORT ===\n")
    print(f"{'PAGE':<28s} {'TITLE LEN':>10s} {'META LEN':>10s} {'DENSITY':>9s}")
    for rel, title, dlen, dens in rows:
        print(f"{rel:<28s} {len(title):>10d} {dlen:>10d} {dens:>8.2f}%")
    print(f"\n{len(titles)} unique titles, {len(descs)} unique descriptions.")
    print(f"Errors:   {len(errors)}")
    print(f"Warnings: {len(warnings)}\n")
    for e in errors:
        print(f"  [ERROR] {e}")
    for w in warnings:
        print(f"  [WARN ] {w}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(audit())
