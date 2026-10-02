#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/app/secrets.js"
python3 - "$ROOT" "$OUT" <<'PY'
import json, os, sys
root, out = sys.argv[1:3]
oauth = os.path.join(root, 'secrets', 'smartthings_oauth.json')
pat = os.path.join(root, 'secrets', 'smartthings.json')
sec = None
if os.path.exists(oauth):
    d = json.load(open(oauth, encoding='utf-8'))
    if d.get('tv'):
        t = d['tv']
        sec = {'ST_CLIENT_ID': d['client_id'], 'ST_CLIENT_SECRET': d['client_secret'],
               'ST_TOKENS': {k: t[k] for k in ('access_token', 'refresh_token', 'expires_at', 'issued_at')}}
        print('gen-secrets: wrote app/secrets.js (SmartThings OAuth, tv authorization).')
if sec is None and os.path.exists(pat):
    sec = {'SMARTTHINGS_TOKEN': json.load(open(pat, encoding='utf-8'))['token'].strip()}
    print('gen-secrets: wrote app/secrets.js (SmartThings personal access token, valid for 24 hours).')
if sec is None:
    if os.path.exists(out): os.remove(out)
    print('gen-secrets: warning: no SmartThings credentials, the smart home panel stays off.', file=sys.stderr)
else:
    with open(out, 'w', encoding='utf-8') as f:
        f.write('window.SECRETS = ' + json.dumps(sec) + ';\n')
PY
