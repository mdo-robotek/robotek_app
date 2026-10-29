"""One paste, straight to live (Sahil, 2026-10-28: 'seedha live do').
Embeds the changed files, checks live is what we expect (else stops, nothing changed),
backs up, copies, builds, restarts; on a failed build puts the old code back."""
import base64, hashlib, os
S=os.environ["S"]; NAME=os.environ["NAME"]; TITLE=os.environ["TITLE"]
MF=os.environ["MARK_FILE"]; MT=os.environ["MARK_TEXT"]
EXTRA=open(os.environ["EXTRA"]).read() if os.environ.get("EXTRA") else ""
OUT="/mnt/user-data/outputs"
data=open(f"{S}/pkg.tgz","rb").read(); md5=hashlib.md5(data).hexdigest()
b64=base64.encodebytes(data).decode().rstrip("\n")
stop = """stop_preview() {
  if command -v ss >/dev/null 2>&1; then
    for pid in $(ss -ltnp 'sport = :3002' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null; done
  fi
  for d in /proc/[0-9]*; do
    pid=${d#/proc/}
    case "$(cat "$d/comm" 2>/dev/null)" in node|next-server*|npm*) ;; *) continue ;; esac
    case "$(readlink "$d/cwd" 2>/dev/null)" in "$HOME/robotek_preview"*) kill "$pid" 2>/dev/null ;; esac
  done
  sleep 3
}"""
block=f'''### {NAME}-LIVE — {TITLE}
### Ek hi block: poora paste karein. Aakhir mein "HO GAYA" aana chahiye (3-6 minute).
### Agar live par kisi ne yahi files badli hon to ye ruk jayega aur kuch nahi badlega.
### Build fail hui to purana code apne aap wapas aa jayega.
cd ~
OK=1
P=~/.{NAME}pkg
rm -rf $P && mkdir -p $P
base64 -d > $P/pkg.tgz << 'B64EOF'
{b64}
B64EOF
if [ "$(md5sum $P/pkg.tgz | cut -d' ' -f1)" = "{md5}" ]; then echo "Package sahi utra"; else echo "RUKO: block poora paste nahi hua. Dobara paste karein. Kuch nahi badla."; OK=0; fi
if [ "$OK" = 1 ]; then
  tar -xzf $P/pkg.tgz -C $P
  cd ~/robotek_app; GOOD=0; BAD=""
  while read -r WANT HEAD F; do
    if [ -f "$F" ]; then L=$(md5sum "$F" | cut -d' ' -f1); else L=NEW; fi
    case "|$WANT|$HEAD|" in *"|$L|"*) GOOD=$((GOOD+1));; *) BAD="$BAD\\n  $F";; esac
  done < $P/expect.txt
  echo "Files theek: $GOOD / $(grep -c '' $P/expect.txt)"
  if [ -n "$BAD" ]; then printf "RUKO: live par ye files kisi aur ne badli hain — Claude ko screenshot bhejein (kuch nahi badla):$BAD\\n"; OK=0; fi
fi
if [ "$OK" = 1 ]; then
  STAMP=$(date +%Y%m%d-%H%M); BK=~/erp_backup_$STAMP
  mkdir -p "$BK" && cp -a ~/robotek_app/src ~/robotek_app/public ~/robotek_app/next.config.ts "$BK"/ && echo "BACKUP OK: $BK"
  [ -d "$BK/src" ] && [ -f "$BK/next.config.ts" ] || {{ echo "RUKO: backup nahi bana. Kuch nahi badla."; OK=0; }}
fi
if [ "$OK" = 1 ]; then
{stop}
  stop_preview
  cd ~/robotek_app
  while read -r WANT HEAD F; do mkdir -p "$(dirname "$F")"; cp "$P/head/$F" "$F"; done < $P/expect.txt
  echo "$(grep -c '' $P/expect.txt) files lag gayi. Build chal raha hai (3-6 minute, kuch na likhein)..."
  nice -n 10 npm run build > /tmp/live-build.log 2>&1
  if grep -q "Compiled successfully" /tmp/live-build.log; then
    sudo systemctl restart robotek
    sleep 15
{EXTRA}
    echo "=================== REPORT ==================="
    echo "ERP service:   $(systemctl is-active robotek)  (active chahiye)"
    curl -s -o /dev/null -w "Login page:    %{{http_code}}  (200 chahiye)\\n" --max-time 30 http://127.0.0.1:3000/login
    echo "Naya code:     $(grep -c '{MT}' ~/robotek_app/'{MF}')  (0 nahi hona chahiye)"
    echo "Backup:        $BK"
    echo "### HO GAYA. Kholen: https://srv1934622.hstgr.cloud  (Cmd+Shift+R se refresh karein)"
  else
    echo "BUILD FAILED — purana code wapas daal raha hoon..."
    rm -rf ~/robotek_app/src ~/robotek_app/public && cp -a "$BK/src" ~/robotek_app/src && cp -a "$BK/public" ~/robotek_app/public && cp -a "$BK/next.config.ts" ~/robotek_app/next.config.ts
    nice -n 10 npm run build > /tmp/live-build-rollback.log 2>&1; sudo systemctl restart robotek; sleep 10
    echo "Purana code wapas: $(diff -rq "$BK/src" ~/robotek_app/src | wc -l) farak (0 chahiye) · ERP: $(systemctl is-active robotek)"
    echo "Ye lines Claude ko bhejein:"; grep -iE "error|failed" /tmp/live-build.log | head -15
  fi
fi
'''
open(f"{OUT}/{NAME}-LIVE.txt","w").write(block)
print(NAME, len(block))
