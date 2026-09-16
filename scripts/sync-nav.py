#!/usr/bin/env python3
"""One place to edit the Game-Bid PBL nav; every page picks it up.

Why this exists: adding one page used to mean hand-editing the chip row in
every sibling page, and a missed page silently strands a section. Edit CHIPS
below, run this, commit. The `here` chip is set per page automatically.

    python3 scripts/sync-nav.py          # rewrite the nav in every PBL page
    python3 scripts/sync-nav.py --check  # exit 1 if any page is out of date

Output is plain static HTML — the site has no build step and `.nojekyll` is
deliberately in place, so what is committed is exactly what is served.
"""
import glob, os, re, sys

# --- the canonical nav: add a page here and every sibling gets the chip ------
CHIPS = [
    ("./",           "Hub"),
    ("email.html",   "Email like a pro"),
    ("library.html", "Game library"),
    ("crew.html",    "Crews &amp; contracts"),
    ("rfp.html",     "The RFP \U0001F4DC"),
    ("design.html",  "Design ✏️"),
    ("sprint.html",  "Sprint \U0001F4D0"),
]
SECTION = "class/game-bid-pbl"
NAV_RE = re.compile(r'<nav class="pbl">.*?</nav>', re.S)


def nav_for(page_basename):
    """The chip row as it should appear on one page."""
    here = "./" if page_basename == "index.html" else page_basename
    out = ['<nav class="pbl">']
    for href, label in CHIPS:
        cls = ' class="here"' if href == here else ""
        out.append(f'  <a{cls} href="{href}">{label}</a>')
    out.append("</nav>")
    return "\n".join(out)


def main():
    check = "--check" in sys.argv
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pages = sorted(glob.glob(os.path.join(root, SECTION, "*.html")))
    if not pages:
        sys.exit(f"no pages found under {SECTION}/")

    stale, written = [], []
    for path in pages:
        html = open(path, encoding="utf-8").read()
        if not NAV_RE.search(html):
            sys.exit(f"{os.path.relpath(path, root)}: no <nav class=\"pbl\"> block to sync")
        new = NAV_RE.sub(lambda _: nav_for(os.path.basename(path)), html, count=1)
        if new == html:
            continue
        stale.append(os.path.relpath(path, root))
        if not check:
            open(path, "w", encoding="utf-8").write(new)
            written.append(os.path.relpath(path, root))

    if check:
        if stale:
            print("nav out of date in:", *stale, sep="\n  ")
            sys.exit(1)
        print(f"nav current in all {len(pages)} pages ({len(CHIPS)} chips)")
        return
    print(f"{len(pages)} pages checked, {len(written)} rewritten"
          + (": " + ", ".join(written) if written else " (all already current)"))


if __name__ == "__main__":
    main()
