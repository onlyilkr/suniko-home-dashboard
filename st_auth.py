#!/usr/bin/env python3
import base64, json, os, sys, time, urllib.parse, urllib.request, urllib.error

USAGE = """usage:
  python3 st_auth.py url [tv|dev]
  python3 st_auth.py code tv  '<code or httpbin address>'
  python3 st_auth.py code dev '<code or httpbin address>'
  python3 st_auth.py status"""

ROOT = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(ROOT, 'secrets', 'smartthings_oauth.json')
CREATED = os.path.join(ROOT, 'secrets', 'st-app-created.json')
CREATED_DEV = os.path.join(ROOT, 'secrets', 'st-app-dev-created.json')
AUTHORIZE = 'https://api.smartthings.com/oauth/authorize'
TOKEN = 'https://api.smartthings.com/oauth/token'
REDIRECT = 'https://httpbin.org/get'
SCOPES = ['r:devices:*', 'x:devices:*', 'r:locations:*', 'r:scenes:*', 'x:scenes:*']


def load():
    if os.path.exists(STORE):
        d = json.load(open(STORE, encoding='utf-8'))
    else:
        if not os.path.exists(CREATED):
            sys.exit('secrets/st-app-created.json not found: create the SmartThings OAuth app first (see docs/SETUP.md §6).')
        c = json.load(open(CREATED, encoding='utf-8'))
        d = {'client_id': c['oauthClientId'], 'client_secret': c['oauthClientSecret'], 'redirect_uri': REDIRECT}
    if 'dev_client' not in d and os.path.exists(CREATED_DEV):
        c = json.load(open(CREATED_DEV, encoding='utf-8'))
        d['dev_client'] = {'client_id': c['oauthClientId'], 'client_secret': c['oauthClientSecret']}
    return d


def client(d, which):
    if which == 'tv':
        return {'client_id': d['client_id'], 'client_secret': d['client_secret']}
    if not d.get('dev_client'):
        raise RuntimeError('the desktop preview has no OAuth app of its own (secrets/st-app-dev-created.json), see docs/SETUP.md §6. '
                           'Do not authorize it with the TV app: SmartThings returns the same token pair and the TV gets logged out.')
    return d['dev_client']


def other(which):
    return 'dev' if which == 'tv' else 'tv'


def save(d):
    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    tmp = STORE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, STORE)


def token_request(c, form):
    basic = base64.b64encode((c['client_id'] + ':' + c['client_secret']).encode()).decode()
    req = urllib.request.Request(TOKEN, data=urllib.parse.urlencode(form).encode(), method='POST', headers={
        'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError('token request rejected: http %d %s' % (e.code, e.read()[:300].decode('utf-8', 'replace')))


def lineage(j):
    now = int(time.time() * 1000)
    return {'access_token': j['access_token'], 'refresh_token': j['refresh_token'],
            'expires_at': now + int(j.get('expires_in', 86400)) * 1000, 'issued_at': now}


def refresh(which):
    d = load()
    t = d.get(which)
    if not t:
        raise RuntimeError('no "%s" authorization: run python3 st_auth.py url %s' % (which, which))
    o = d.get(other(which))
    if o and o.get('refresh_token') == t['refresh_token']:
        raise RuntimeError('"%s" and "%s" hold the same token pair, so it was not renewed. Authorize %s again with its own OAuth app.'
                           % (which, other(which), which))
    if t['expires_at'] - time.time() * 1000 > 5 * 60 * 1000:
        return t['access_token']
    c = client(d, which)
    j = token_request(c, {'grant_type': 'refresh_token', 'refresh_token': t['refresh_token'], 'client_id': c['client_id']})
    if 'refresh_token' not in j:
        j['refresh_token'] = t['refresh_token']
    d[which] = lineage(j)
    save(d)
    return d[which]['access_token']


def main(argv):
    if len(argv) < 2 or argv[1] not in ('url', 'code', 'status'):
        sys.exit(USAGE)
    d = load()
    if argv[1] == 'url':
        which = argv[2] if len(argv) > 2 else 'tv'
        if which not in ('tv', 'dev'):
            sys.exit('usage: python3 st_auth.py url [tv|dev]')
        try:
            c = client(d, which)
        except RuntimeError as e:
            sys.exit(str(e))
        save(d)
        print(AUTHORIZE + '?' + urllib.parse.urlencode({'client_id': c['client_id'], 'response_type': 'code',
                                                         'redirect_uri': d['redirect_uri'], 'scope': ' '.join(SCOPES)}))
    elif argv[1] == 'code':
        if len(argv) < 4 or argv[2] not in ('tv', 'dev'):
            sys.exit('usage: python3 st_auth.py code <tv|dev> <code or address>')
        raw = argv[3].strip()
        code = urllib.parse.parse_qs(urllib.parse.urlparse(raw).query).get('code', [raw])[0] if '://' in raw else raw
        try:
            c = client(d, argv[2])
        except RuntimeError as e:
            sys.exit(str(e))
        j = token_request(c, {'grant_type': 'authorization_code', 'code': code, 'client_id': c['client_id'], 'redirect_uri': d['redirect_uri']})
        o = d.get(other(argv[2]))
        if o and (j.get('refresh_token') == o.get('refresh_token') or j.get('access_token') == o.get('access_token')):
            sys.exit('WARNING: SmartThings returned the SAME token pair for "%s" as for "%s"; not saved (when both renew it, '
                     'one gets logged out). This client needs its own OAuth app (see docs/SETUP.md §6).' % (argv[2], other(argv[2])))
        d[argv[2]] = lineage(j)
        save(d)
        print('%s authorization saved; access token valid until %s.' % (argv[2], time.strftime('%Y-%m-%d %H:%M', time.localtime(d[argv[2]]['expires_at'] / 1000))))
    else:
        for w in ('tv', 'dev'):
            t = d.get(w)
            print(w, '- none' if not t else 'access token valid until %s' % time.strftime('%Y-%m-%d %H:%M', time.localtime(t['expires_at'] / 1000)))


if __name__ == '__main__':
    main(sys.argv)
