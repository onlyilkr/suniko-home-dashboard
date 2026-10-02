#!/bin/bash
set -euo pipefail
usage() { echo "usage: TV_IP=<ip> CERT_PROFILE=<profile> ./build.sh  (or ./build.sh <ip>)" >&2; exit 2; }
TV_IP="${1:-${TV_IP:-}}"
[ -n "$TV_IP" ] || usage
CERT_PROFILE="${CERT_PROFILE:-}"
[ -n "$CERT_PROFILE" ] || usage
ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/app"
TS="${TIZEN_STUDIO:-$HOME/tizen-studio}"
SDB="$TS/tools/sdb"; TIZEN="$TS/tools/ide/bin/tizen"
APPID="$(sed -n 's/.*<tizen:application id="\([^"]*\)".*/\1/p' "$APP/config.xml")"
[ -n "$APPID" ] || { echo "build: no tizen:application id in app/config.xml" >&2; exit 1; }

[ -f "$APP/config.js" ] || echo "build: app/config.js not found, config.example.js defaults will be used (see README)" >&2

"$ROOT/gen-secrets.sh"
rm -f "$APP"/*.wgt "$APP/.manifest.tmp"
( cd "$HOME" && "$TIZEN" package -t wgt -s "$CERT_PROFILE" -- "$APP" | tail -2 )
WGT="$(ls "$APP"/*.wgt | head -1)"; mv "$WGT" "$APP/SunikoHome.wgt"
"$SDB" connect "$TV_IP" >/dev/null 2>&1 || true
"$SDB" -s "$TV_IP:26101" push "$APP/SunikoHome.wgt" /home/owner/share/tmp/sdk_tools/SunikoHome.wgt | tail -1
"$SDB" -s "$TV_IP:26101" shell 0 vd_appinstall "$APPID" /home/owner/share/tmp/sdk_tools/SunikoHome.wgt | tail -2
"$SDB" -s "$TV_IP:26101" shell 0 was_execute "$APPID" | tail -1
