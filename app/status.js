(function () {
  'use strict';

  var SOURCES = [
    { id: 'claude', name: 'Claude', url: 'https://status.claude.com/api/v2/summary.json', pin: ['claude.ai', 'API', 'Claude Code'] },
    { id: 'github', name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/summary.json', pin: ['Git Operations', 'Actions', 'Copilot'] }
  ];
  var LEVEL = { operational: 0, degraded_performance: 1, under_maintenance: 1, partial_outage: 2, major_outage: 2 };
  var PHASES = ['investigating', 'identified', 'monitoring'];
  var REFRESH = 2 * 60 * 1000, CACHE = 'tvdev_status_v1', EXTRA = 3;

  var state = { at: 0, sources: {} }, live = {};
  var listeners = [], transitions = [], timer = null, running = false, failNet = false;

  function getJSON(url, cb) {
    if (failNet) { setTimeout(function () { cb(new Error('debug')); }, 0); return; }
    var x = new XMLHttpRequest();
    try {
      x.open('GET', url, true);
      x.timeout = 12000;
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) { cb(new Error('http ' + x.status)); return; }
        try { cb(null, JSON.parse(x.responseText)); } catch (e) { cb(e); }
      };
      x.onerror = function () { cb(new Error('network')); };
      x.ontimeout = function () { cb(new Error('timeout')); };
      x.send();
    } catch (e) { cb(e); }
  }

  function shortName(n) {
    n = String(n || '').replace(/\s*\([^)]*\)\s*$/, '');
    return n === 'Claude API' ? 'API' : n === 'Claude Console' ? 'Console' : n;
  }
  function components(src, summary) {
    var comps = ((summary && summary.components) || []).filter(function (c) { return !c.group && !/^Visit /.test(c.name || ''); })
      .map(function (c) {
        var st = LEVEL[c.status] == null ? 'degraded_performance' : c.status, n = shortName(c.name);
        return { name: n, status: st, level: LEVEL[st], pinned: src.pin.indexOf(n) >= 0 };
      });
    var open = ((summary && summary.incidents) || []).filter(function (i) { return i.status !== 'resolved' && i.status !== 'postmortem'; });
    var active = open.filter(function (i) { return i.status !== 'monitoring'; }), pick = (active.length ? active : open)[0];
    return { comps: comps, incident: pick ? pick.name : null,
      phase: pick ? (PHASES.indexOf(pick.status) >= 0 ? pick.status : 'investigating') : null };
  }
  function find(parsed, n) { for (var i = 0; i < parsed.comps.length; i++) if (parsed.comps[i].name === n) return parsed.comps[i]; return null; }
  function strip(src, parsed) {
    var list = [], extra = [];
    src.pin.forEach(function (n) { var c = find(parsed, n); if (c) list.push(c); });
    parsed.comps.forEach(function (c) { if (!c.pinned && c.level > 0) extra.push(c); });
    return { list: list.concat(extra.slice(0, EXTRA)), more: Math.max(0, extra.length - EXTRA) };
  }
  function diff(src, prev, cur) {
    if (!prev || !cur) return [];
    var out = [];
    src.pin.forEach(function (n) {
      var a = find(prev, n), b = find(cur, n);
      if (a && b && a.level !== b.level) out.push({ source: src.name, name: n, from: a.status, to: b.status, level: b.level, incident: cur.incident });
    });
    return out;
  }

  function fire(events) { events.forEach(function (ev) { transitions.forEach(function (fn) { fn(ev); }); }); }
  function emit() { listeners.forEach(function (fn) { fn(state); }); }
  function load() {
    var left = SOURCES.length, next = {};
    SOURCES.forEach(function (src) {
      getJSON(src.url, function (err, summary) {
        next[src.id] = err ? null : components(src, summary);
        if (--left) return;
        var events = [], any = false;
        SOURCES.forEach(function (s) {
          var cur = next[s.id];
          if (!cur) return;
          any = true;
          events = events.concat(diff(s, live[s.id], cur));
          live[s.id] = cur;
        });
        state = { at: any ? Date.now() : state.at, sources: next };
        if (any) save();
        emit();
        fire(events);
        clearTimeout(timer); timer = running ? setTimeout(load, REFRESH) : null;
      });
    });
  }
  function start() { if (running) return; running = true; load(); }
  function stop() { running = false; clearTimeout(timer); timer = null; live = {}; }
  function save() { try { localStorage.setItem(CACHE, JSON.stringify(state)); } catch (e) { } }
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cached && cached.sources) state = { at: cached.at || 0, sources: cached.sources };
  } catch (e) { }

  function simulate(name, st) {
    if (LEVEL[st] == null) return;
    SOURCES.forEach(function (s) {
      var cur = state.sources[s.id];
      if (!cur || !find(cur, name)) return;
      var next = { incident: LEVEL[st] ? 'Test: ' + name : null, phase: LEVEL[st] ? 'investigating' : null, comps: cur.comps.map(function (c) {
        return c.name === name ? { name: c.name, status: st, level: LEVEL[st], pinned: c.pinned } : c;
      }) };
      var events = diff(s, live[s.id] || cur, next);
      live[s.id] = next; state.sources[s.id] = next;
      emit();
      fire(events);
    });
  }

  window.TVStatus = {
    SOURCES: SOURCES, start: start, stop: stop, refresh: load, simulate: simulate,
    get: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    onTransition: function (fn) { transitions.push(fn); },
    setFail: function (on) { failNet = !!on; },
    shortName: shortName, components: components, strip: strip, diff: diff
  };
})();
