#!/usr/bin/env python3
"""After login, go back to the page that asked for it (e.g. a scanned QR).

NextAuth sends logged-out visitors to /login?callbackUrl=<page>. The login
page always went to "/", so a phone that scanned the Delegation QR lost the
form. This makes the success redirect use callbackUrl when it points to this
same site (anything else still goes to "/").

Usage:  python3 login-return.py src/app/login/page.tsx
Writes nothing unless the redirect line is found. Safe to run twice.
"""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
if "callbackUrl" in s:
    print("ALREADY PATCHED - nothing to do")
    sys.exit(0)

old = 'router.push("/");'
if s.count(old) != 1:
    print(f'NOT CHANGED - expected one {old} line, found {s.count(old)}')
    sys.exit(1)

new = (
    "router.push((() => {\n"
    "          // Back to the page that needed login (e.g. the Delegation QR), same site only.\n"
    "          try {\n"
    '            const cb = new URLSearchParams(window.location.search).get("callbackUrl");\n'
    "            const u = new URL(cb || \"/\", window.location.origin);\n"
    "            return u.origin === window.location.origin ? u.pathname + u.search : \"/\";\n"
    "          } catch {\n"
    '            return "/";\n'
    "          }\n"
    "        })());"
)
open(path, "w", encoding="utf-8").write(s.replace(old, new))
print("PATCHED OK")
