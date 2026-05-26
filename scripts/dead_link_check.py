#!/usr/bin/env python3
"""
Scan all HTML files for internal links and verify each resolves to an existing file.
External links (http/https) are skipped to avoid false negatives.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_FILES = list(ROOT.glob("*.html")) + list(ROOT.glob("*/index.html"))
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)


def resolve(base: Path, href: str) -> Path:
    # strip fragment + query
    href = href.split("#", 1)[0].split("?", 1)[0]
    if not href:
        return base  # fragment-only link, treat as same file
    if href.startswith("tel:") or href.startswith("mailto:") or href.startswith("//"):
        return None  # skip
    if href.startswith("http://") or href.startswith("https://"):
        return None  # external — skip
    if href.startswith("/"):
        target = ROOT / href.lstrip("/")
    else:
        target = (base.parent / href).resolve()
    return target


def main():
    print(f"\n=== DEAD LINK SCAN ({len(HTML_FILES)} HTML files) ===\n")
    broken = []
    checked = 0
    for f in HTML_FILES:
        html = f.read_text(encoding="utf-8", errors="ignore")
        for href in HREF_RE.findall(html):
            target = resolve(f, href)
            if target is None:
                continue
            checked += 1
            # if directory, look for index.html
            if target.is_dir():
                target = target / "index.html"
            elif not target.suffix:
                # path like "/legal/" → already handled above
                # path like "/some-page" → treat as page itself
                target = target.with_suffix(target.suffix or "")
            if not target.exists():
                broken.append((str(f.relative_to(ROOT)), href, str(target)))
                print(f"  [BROKEN] {f.relative_to(ROOT)} → {href}")

    print(f"\nChecked {checked} internal links across {len(HTML_FILES)} files.")
    print(f"Broken: {len(broken)}")
    return 0 if not broken else 1


if __name__ == "__main__":
    sys.exit(main())
