#!/usr/bin/env python3
import http.server, json, threading, urllib.error, urllib.request, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import st_auth
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app')
ST_API = 'https://api.smartthings.com/v1'
ST_WRITE = os.environ.get('ST_WRITE') == '1'
LOCK = threading.Lock()
HOSTS = {'127.0.0.1:%d' % PORT, 'localhost:%d' % PORT}
ORIGINS = {'http://' + h for h in HOSTS}
SECRETS_JS = os.path.join(ROOT, 'secrets.js')

def dev_token():
    try:
        if not st_auth.load().get('dev'): return None
    except SystemExit:
        return None
    with LOCK:
        return st_auth.refresh('dev')

def preview_secrets():
    try:
        if st_auth.load().get('dev'): return {'ST_PROXY_AUTH': True}
    except SystemExit:
        pass
    pat = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'secrets', 'smartthings.json')
    if os.path.exists(pat): return {'SMARTTHINGS_TOKEN': json.load(open(pat, encoding='utf-8'))['token'].strip()}
    return {}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def _gate(self):
        site, mode = self.headers.get('Sec-Fetch-Site'), self.headers.get('Sec-Fetch-Mode')
        if self.headers.get('Host', '').lower() not in HOSTS: reason = 'unknown host'
        elif site in ('cross-site', 'same-site') and mode != 'navigate': reason = 'cross-site request'
        else: return True
        self.send_error(403, reason)
        return False
    def _is_secrets(self):
        p = self.translate_path(self.path).rstrip('/' + os.sep)
        if os.path.basename(p).lower() == 'secrets.js': return True
        try: return os.path.samefile(p, SECRETS_JS)
        except OSError: return False
    def send_head(self):
        if self._is_secrets(): self.send_error(404); return None
        return super().send_head()
    def list_directory(self, path):
        self.send_error(404)
        return None
    def _st(self, method):
        path = self.path[len('/st'):]
        if not path.startswith('/') or path.startswith('//'): self.send_error(400, 'invalid path'); return
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n) if n else None
        headers = {'Accept': 'application/json'}
        try:
            tok = dev_token()
        except Exception as e:
            tok = None; print('could not renew the dev token:', e)
        if tok: headers['Authorization'] = 'Bearer ' + tok
        elif self.headers.get('Authorization'): headers['Authorization'] = self.headers['Authorization']
        if body is not None: headers['Content-Type'] = self.headers.get('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(urllib.request.Request(ST_API + path, data=body, headers=headers, method=method), timeout=20) as r:
                status, ct, data = r.status, r.headers.get('Content-Type', 'application/json'), r.read()
        except urllib.error.HTTPError as e:
            status, ct, data = e.code, e.headers.get('Content-Type', 'application/json'), e.read()
        except Exception as e:
            status, ct, data = 502, 'text/plain; charset=utf-8', str(e).encode()
        self.send_response(status); self.send_header('Content-Type', ct); self.end_headers(); self.wfile.write(data)
    def do_HEAD(self):
        if self._gate(): super().do_HEAD()
    def do_GET(self):
        if not self._gate(): return
        if self.path.startswith('/st/'): return self._st('GET')
        if self._is_secrets():
            body = ('window.SECRETS = ' + json.dumps(preview_secrets()) + ';\n').encode()
            self.send_response(200); self.send_header('Content-Type', 'application/javascript'); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        if not self._gate(): return
        if self.headers.get('Origin') not in ORIGINS: self.send_error(403, 'cross-origin request'); return
        if self.path.startswith('/st/'):
            if not ST_WRITE:
                body = json.dumps({'error': 'Device commands are blocked in the preview (set ST_WRITE=1 to allow)'}).encode()
                self.send_response(403); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body); return
            return self._st('POST')
        self.send_error(405)
    def log_message(self, *a): pass

print('Preview: http://127.0.0.1:%d/  (demo: /?demo; device commands %s)' % (PORT, 'ON' if ST_WRITE else 'blocked, set ST_WRITE=1 to allow'))
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
