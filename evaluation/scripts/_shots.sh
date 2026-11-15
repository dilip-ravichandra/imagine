#!/usr/bin/env bash
# usage: _shots.sh outdir route1 route2 ...   (needs the site on :8000)
CH="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"; OUT="$1"; shift
mkdir -p "$OUT"
for r in "$@"; do
  n=$(echo "$r" | tr '/' '_'); [ -z "$n" ] && n=_home
  d=$(mktemp -d)
  timeout 90 "$CH" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$d" --window-size=${WIN:-1366,900} --virtual-time-budget=9000 --screenshot="$OUT/$n.png" "http://localhost:8000$r" >/dev/null 2>&1
  rm -rf "$d"
done
ls "$OUT"
