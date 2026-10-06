# -*- coding: utf-8 -*-
"""Download the full fonts needed by the poster render sources into src/.
All fonts are SIL Open Font License and free to redistribute/embed."""
from urllib.request import urlopen, Request
import re

UA = {"User-Agent": "curl/8.0"}
MIRROR = "https://fonts.loli.net/css2"

# (Google Fonts family, weights, output filename pattern)
FAMILIES = [
    ("Ma Shan Zheng", "400"),
    ("Noto Serif SC", "400;700"),
    ("Great Vibes", "400"),
    ("Cormorant Garamond", "400;500;600;700"),
]

for fam, wts in FAMILIES:
    q = fam.replace(" ", "+")
    css = urlopen(Request(f"{MIRROR}?family={q}:wght@{wts}", headers=UA), timeout=30).read().decode("utf-8")
    blocks = re.findall(r"font-style:\s*(\w+);\s*font-weight:\s*(\d+);[\s\S]*?url\((https?://[^)]+)\)", css)
    seen = {}
    for style, wt, u in blocks:
        seen[(style, wt)] = u
    for (style, wt), u in sorted(seen.items()):
        fn = f"{fam.replace(' ', '')}-{wt}{'-Italic' if style == 'italic' else ''}.ttf"
        data = urlopen(Request(u, headers=UA), timeout=90).read()
        open(fn, "wb").write(data)
        print(fn, f"{len(data)//1024} KB")
