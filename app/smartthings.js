(function () {
  'use strict';

  var TIZEN = typeof window.tizen !== 'undefined' && !!window.tizen.application;
  var BASE = TIZEN ? 'https://api.smartthings.com/v1' : '/st';
  var CONFIG = window.CONFIG || {};
  var STC = CONFIG.smartthings || {};
  var S = window.SECRETS || {};
  var AUTH_MODE = S.ST_PROXY_AUTH ? 'proxy' : (S.ST_CLIENT_ID && S.ST_TOKENS) ? 'oauth' : S.SMARTTHINGS_TOKEN ? 'pat' : '';
  var enabled = !!AUTH_MODE;
  var TOKEN_URL = 'https://api.smartthings.com/oauth/token';
  var AUTH_KEY = 'st_oauth_v1';

  var POLL_FAST = 12000;
  var POLL_SLOW = 20000;
  var META_EVERY = 10 * 60 * 1000;
  var PENDING_MS = 8000;
  var CACHE_KEY = 'tvcache_st';

  var model = { phase: 'loading', error: '', stale: false, updatedAt: 0, locationName: '', coords: null, mode: '', rooms: {}, scenes: [], devices: [] };
  var listeners = [], fast = false, pollTimer = null, metaAt = 0, inflight = false, started = false;
  var pending = {};

  var auth = null, refreshing = null;
  if (AUTH_MODE === 'oauth') {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { stored = null; }
    auth = stored && stored.refresh_token && stored.issued_at >= S.ST_TOKENS.issued_at ? stored : S.ST_TOKENS;
  }
  function refreshToken(cb) {
    if (refreshing) { refreshing.push(cb); return; }
    refreshing = [cb];
    function finish(err, tok) { var q = refreshing; refreshing = null; q.forEach(function (f) { f(err, tok); }); }
    var x = new XMLHttpRequest();
    try {
      x.open('POST', TOKEN_URL, true);
      x.setRequestHeader('Authorization', 'Basic ' + btoa(S.ST_CLIENT_ID + ':' + S.ST_CLIENT_SECRET));
      x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      x.timeout = 15000;
      x.onload = function () {
        var j = null;
        try { j = JSON.parse(x.responseText); } catch (e) { j = null; }
        if (x.status >= 200 && x.status < 300 && j && j.access_token) {
          var now = Date.now();
          auth = { access_token: j.access_token, refresh_token: j.refresh_token || auth.refresh_token, expires_at: now + (j.expires_in || 86400) * 1000, issued_at: now };
          try { localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch (e2) { }
          finish(null, auth.access_token);
        } else {
          var er = new Error('token refresh failed (http ' + x.status + ')');
          if (x.status >= 400 && x.status < 500) er.status = 401;
          finish(er);
        }
      };
      x.onerror = function () { finish(new Error('network')); };
      x.ontimeout = function () { finish(new Error('timeout')); };
      x.send('grant_type=refresh_token&client_id=' + encodeURIComponent(S.ST_CLIENT_ID) + '&refresh_token=' + encodeURIComponent(auth.refresh_token));
    } catch (e) { finish(e); }
  }
  function withToken(force, cb) {
    if (AUTH_MODE === 'proxy') { cb(null, null); return; }
    if (AUTH_MODE === 'pat') { cb(null, S.SMARTTHINGS_TOKEN); return; }
    if (!force && auth.expires_at - Date.now() > 10 * 60 * 1000) { cb(null, auth.access_token); return; }
    refreshToken(cb);
  }

  function req(method, path, body, cb, retried) {
    withToken(false, function (terr, tok) {
      if (terr) { cb(terr); return; }
      send(method, path, body, tok, function (err, j) {
        if (err && err.status === 401 && AUTH_MODE === 'oauth' && !retried) {
          withToken(true, function (e2) { if (e2) cb(e2); else req(method, path, body, cb, true); });
          return;
        }
        cb(err, j);
      });
    });
  }
  function send(method, path, body, tok, cb) {
    var x = new XMLHttpRequest();
    try {
      x.open(method, BASE + path, true);
      if (tok) x.setRequestHeader('Authorization', 'Bearer ' + tok);
      if (body) x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 15000;
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) {
          var j = {};
          try { if (x.responseText) j = JSON.parse(x.responseText); } catch (e) { cb(new Error('json')); return; }
          cb(null, j);
        } else { var er = new Error('http ' + x.status); er.status = x.status; cb(er); }
      };
      x.onerror = function () { cb(new Error('network')); };
      x.ontimeout = function () { cb(new Error('timeout')); };
      x.send(body ? JSON.stringify(body) : null);
    } catch (e) { cb(e); }
  }

  function mainComp(d) {
    var comps = d.components || [];
    for (var i = 0; i < comps.length; i++) if (comps[i].id === 'main') return comps[i];
    return comps[0] || {};
  }
  function capMap(comp) {
    var out = {};
    (comp.capabilities || []).forEach(function (c) { out[c.id] = c.status || {}; });
    return out;
  }
  function attr(caps, cap, name) { var c = caps[cap], a = c && c[name]; return a ? a : null; }
  function val(caps, cap, name) { var a = attr(caps, cap, name); return a ? a.value : null; }
  function hidden(d) {
    var h = STC.hide || [];
    return h.indexOf(d.deviceId) >= 0 || h.indexOf(d.label) >= 0;
  }
  function kindOf(d, comp, caps) {
    var cat = ((comp.categories || [])[0] || {}).name;
    if (d.type === 'HUB' || cat === 'Television' || cat === 'Camera' || caps.webrtc) return null;
    if (caps.temperatureMeasurement) return 'climate';
    if (caps.contactSensor) return 'contact';
    if (caps.waterSensor) return 'water';
    if (caps.motionSensor) return 'motion';
    if (caps.presenceSensor) return 'presence';
    if (caps['switch']) {
      if (caps.switchLevel || caps.colorControl || caps.colorTemperature) return 'light';
      if (caps.powerMeter || caps.powerConsumptionReport || caps.energyMeter) return 'plug';
      return 'switch';
    }
    return null;
  }
  function normalize(items) {
    var now = Date.now(), out = [];
    items.forEach(function (d) {
      if (hidden(d)) return;
      var comp = mainComp(d), caps = capMap(comp), kind = kindOf(d, comp, caps);
      if (!kind) return;
      var t = attr(caps, 'temperatureMeasurement', 'temperature');
      var sw = val(caps, 'switch', 'switch');
      var dev = {
        id: d.deviceId, label: d.label || d.name || I18N.t('dev.unnamed'), roomId: d.roomId || '', kind: kind,
        online: !d.healthState || d.healthState.state !== 'OFFLINE',
        temp: t && t.value != null ? (t.unit === 'F' ? (t.value - 32) * 5 / 9 : t.value) : null, tempAt: t && t.timestamp ? Date.parse(t.timestamp) : 0,
        hum: val(caps, 'relativeHumidityMeasurement', 'humidity'),
        battery: val(caps, 'battery', 'battery'),
        on: sw === 'on', level: val(caps, 'switchLevel', 'level'), power: val(caps, 'powerMeter', 'power'),
        contact: val(caps, 'contactSensor', 'contact'), water: val(caps, 'waterSensor', 'water'),
        motion: val(caps, 'motionSensor', 'motion'), presence: val(caps, 'presenceSensor', 'presence')
      };
      var p = pending[dev.id];
      if (p) { if (now < p.until) dev.on = p.on; else delete pending[dev.id]; }
      out.push(dev);
    });
    return out;
  }

  function snapshot() {
    return { phase: model.phase, error: model.error, stale: model.stale, updatedAt: model.updatedAt,
      locationName: model.locationName, coords: model.coords, mode: model.mode, rooms: model.rooms, scenes: model.scenes.slice(), devices: model.devices.slice() };
  }
  function emit() { var s = snapshot(); listeners.forEach(function (fn) { try { fn(s); } catch (e) { console.error('[smartthings] onChange', e); } }); }
  function cacheSave() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ locationName: model.locationName, coords: model.coords, mode: model.mode, rooms: model.rooms, scenes: model.scenes, devices: model.devices, updatedAt: model.updatedAt })); } catch (e) { }
  }
  function cacheLoad() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!c || !c.devices) return;
      model.locationName = c.locationName || ''; model.coords = c.coords || null; model.mode = c.mode || ''; model.rooms = c.rooms || {};
      model.scenes = c.scenes || []; model.devices = c.devices; model.updatedAt = c.updatedAt || 0;
      model.phase = 'ok'; model.stale = true;
    } catch (e) { }
  }

  function loadMeta(cb) {
    req('GET', '/locations', null, function (err, j) {
      var locs = (!err && j.items) || [];
      var loc = null;
      for (var i = 0; i < locs.length; i++) if (!STC.locationId || locs[i].locationId === STC.locationId) { loc = locs[i]; break; }
      if (!loc) { cb(); return; }
      model.locationName = loc.name || '';
      var left = 4;
      function done() { if (--left === 0) { metaAt = Date.now(); cb(); } }
      req('GET', '/locations/' + loc.locationId, null, function (e1, detail) {
        if (!e1 && detail && detail.latitude != null) model.coords = { lat: detail.latitude, lon: detail.longitude };
        done();
      });
      req('GET', '/locations/' + loc.locationId + '/rooms', null, function (e2, r) {
        if (!e2 && r.items) { var rooms = {}; r.items.forEach(function (rm) { rooms[rm.roomId] = rm.name; }); model.rooms = rooms; }
        done();
      });
      req('GET', '/locations/' + loc.locationId + '/modes/current', null, function (e3, m) {
        if (!e3 && m) model.mode = m.label || m.name || '';
        done();
      });
      req('GET', '/scenes?locationId=' + loc.locationId, null, function (e4, s) {
        if (!e4 && s.items) model.scenes = s.items.map(function (sc) { return { id: sc.sceneId, name: sc.sceneName }; });
        done();
      });
    });
  }
  function schedule(ms) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, ms != null ? ms : (fast ? POLL_FAST : POLL_SLOW));
  }
  function poll() {
    pollTimer = null;
    if (!enabled) return;
    if (inflight) return;
    if (document.hidden) { schedule(); return; }
    inflight = true;
    var go = function () {
      req('GET', '/devices?includeStatus=true&includeHealth=true', null, function (err, j) {
        inflight = false;
        if (err) {
          if (err.status === 401 || err.status === 403) { model.phase = 'auth'; model.error = err.message; }
          else if (model.devices.length) { model.stale = true; model.error = err.message; }
          else { model.phase = 'error'; model.error = err.message; }
          console.warn('[smartthings] poll failed: ' + err.message);
        } else {
          model.devices = normalize(j.items || []);
          model.phase = 'ok'; model.error = ''; model.stale = false; model.updatedAt = Date.now();
          cacheSave();
        }
        emit();
        schedule();
      });
    };
    if (Date.now() - metaAt > META_EVERY) loadMeta(go); else go();
  }

  function find(id) { for (var i = 0; i < model.devices.length; i++) if (model.devices[i].id === id) return model.devices[i]; return null; }
  function toggle(id, cb) {
    cb = cb || function () {};
    var d = find(id); if (!d) { cb(new Error('no device')); return; }
    var next = !d.on;
    d.on = next; pending[id] = { on: next, until: Date.now() + PENDING_MS }; emit();
    req('POST', '/devices/' + id + '/commands', { commands: [{ component: 'main', capability: 'switch', command: next ? 'on' : 'off' }] }, function (err) {
      if (err) {
        delete pending[id];
        var d2 = find(id); if (d2) d2.on = !next;
        emit(); cb(err); return;
      }
      cb(null, next);
      schedule(3000);
    });
  }
  function runScene(id, cb) {
    cb = cb || function () {};
    req('POST', '/scenes/' + id + '/execute', null, function (err) {
      cb(err || null);
      if (!err) schedule(3000);
    });
  }

  function start() {
    if (!enabled || started) return;
    started = true;
    poll();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - model.updatedAt > POLL_FAST) schedule(0);
    });
  }
  function setFast(on) {
    var was = fast; fast = !!on;
    if (fast && !was && started) schedule(Date.now() - model.updatedAt > POLL_FAST ? 0 : POLL_FAST);
  }

  if (enabled) cacheLoad();

  window.STHome = {
    enabled: enabled,
    get: snapshot,
    onChange: function (fn) { listeners.push(fn); },
    start: start,
    setFast: setFast,
    refresh: function () { schedule(0); },
    toggle: toggle,
    runScene: runScene
  };
})();
