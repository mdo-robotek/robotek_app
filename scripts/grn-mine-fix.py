#!/usr/bin/env python3
"""GRN page: show a doer their steps whatever way their login name is written.

The non-admin filter compared the step's doer list ("Rajesh, Akhilesh") with
session.user.name only. Now it matches any of the login's name, username or
email id, ignoring case and spaces, and also a matching first name.

Usage:  python3 grn-mine-fix.py "src/app/(dashboard)/grn/page.tsx"
Writes nothing unless both spots are found. Safe to run twice.
"""
import re
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
if "myNames" in s:
    print("ALREADY PATCHED - nothing to do")
    sys.exit(0)

decl = re.search(r'\n(\s*)const currentUser = session\?\.user\?\.name \|\| "User";\n', s)
filt = re.search(r'return !!stepConfig\[st - 1\]\?\.responsible_person\?\.split\(","\)[^\n]*', s)
if not decl or not filt:
    print("NOT CHANGED - could not find:", ", ".join(n for n, m in (("currentUser line", decl), ("filter line", filt)) if not m))
    sys.exit(1)

ind = decl.group(1)
names = (
    f"{ind}// Every way this login can be written (name / username / email id), lower-case.\n"
    f"{ind}const myNames = [session?.user?.name, (session?.user as any)?.username, session?.user?.email?.split(\"@\")[0]]\n"
    f"{ind}  .map((v) => String(v || \"\").trim().toLowerCase().replace(/\\s+/g, \" \")).filter(Boolean);\n"
)
s = s[: decl.end()] + names + s[decl.end():]

filt = re.search(r'return !!stepConfig\[st - 1\]\?\.responsible_person\?\.split\(","\)[^\n]*', s)
new_filter = (
    'return String(stepConfig[st - 1]?.responsible_person || "").split(",")\n'
    '      .map((x: string) => x.trim().toLowerCase().replace(/\\s+/g, " ")).filter(Boolean)\n'
    '      .some((d: string) => myNames.some((m) => m === d || m.split(" ")[0] === d.split(" ")[0]));'
)
s = s[: filt.start()] + new_filter + s[filt.end():]
open(path, "w", encoding="utf-8").write(s)
print("PATCHED OK")
