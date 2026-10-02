#!/usr/bin/env python3
import http.server, json, threading, urllib.error, urllib.request, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import st_auth
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app')
ST_API = 'https://api.smartthings.com/v1'
ST_WRITE = os.environ.get('ST_WRITE') == '1'
LOCK = threading.Lock()

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
    def do_GET(self):
        if self.path.startswith('/st/'): return self._st('GET')
        if self.path.split('?')[0] == '/secrets.js':
            body = ('window.SECRETS = ' + json.dumps(preview_secrets()) + ';\n').encode()
            self.send_response(200); self.send_header('Content-Type', 'application/javascript'); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith('/st/'):
            if not ST_WRITE:
                body = json.dumps({'error': 'Device commands are blocked in the preview (set ST_WRITE=1 to allow)'}).encode()
                self.send_response(403); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body); return
            return self._st('POST')
        self.send_error(405)
    def log_message(self, *a): pass

print('Preview: http://127.0.0.1:%d/  (demo: /?demo; device commands %s)' % (PORT, 'ON' if ST_WRITE else 'blocked, set ST_WRITE=1 to allow'))
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
