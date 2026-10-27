#!/usr/bin/env python3
"""Add a "Why did the score drop?" link next to the Score page title.

Usage:  python3 add-score-why-link.py "src/app/(dashboard)/score/page.tsx"
Writes nothing unless the title is found. Safe to run twice.
"""
import re
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
if 'href="/score/why"' in s:
    print("ALREADY ADDED - nothing to do")
    sys.exit(0)

link = (
    '\n          <a href="/score/why" className="inline-flex items-center gap-1 mt-1 px-3 py-1.5 rounded-lg '
    'bg-red-50 text-red-700 border border-red-200 text-[13px] font-semibold hover:bg-red-100 print:hidden">'
    "Why did the score drop? →</a>"
)
new, n = re.subn(r"(>\s*Performance Score\s*</h1>)", r"\1" + link, s, count=1)
if n != 1:
    print('NOT CHANGED - could not find the "Performance Score" title')
    sys.exit(1)
open(path, "w", encoding="utf-8").write(new)
print("LINK ADDED")
