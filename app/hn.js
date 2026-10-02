(function () {
  'use strict';

  var TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
  var ITEM = 'https://hacker-news.firebaseio.com/v0/item/';
  var FRONT = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50';
  var COUNT = 30, REFRESH = 5 * 60 * 1000, CACHE = 'tvdev_hn_v1';
  var COMMENT_TTL = 10 * 60 * 1000, COMMENT_KEEP = 30, COMMENT_KIDS = 5, COMMENT_SHOW = 3;

  var state = { items: [], at: 0, error: null };
  var listeners = [], timer = null, running = false, busy = false, failNet = false, comm = {};

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

  function fromHit(h) {
    var job = (h._tags || []).indexOf('job') >= 0 || h.points == null;
    return { id: +h.objectID, title: h.title || '', url: h.url || '', points: job ? null : h.points,
      comments: h.num_comments || 0, time: h.created_at_i || 0, by: h.author || '', job: job };
  }
  function fromItem(it) {
    var job = it.type === 'job';
    return { id: it.id, title: it.title || '', url: it.url || '', points: job ? null : (it.score || 0),
      comments: it.descendants || 0, time: it.time || 0, by: it.by || '', job: job };
  }
  function merge(ids, hits) {
    var map = {}, list = (ids || []).slice(0, COUNT), items = [], missing = [];
    (hits || []).forEach(function (h) { map[+h.objectID] = h; });
    list.forEach(function (id) {
      if (map[id]) items.push(fromHit(map[id])); else { items.push(null); missing.push(id); }
    });
    return { ids: list, items: items, missing: missing };
  }
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function entity(m, e) {
    if (e.charAt(0) === '#') {
      var n = e.charAt(1) === 'x' || e.charAt(1) === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    var v = ENT[e.toLowerCase()];
    return v == null ? m : v;
  }
  function text(html) {
    return String(html || '')
      .replace(/<p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, entity)
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');
  }
  function host(url) {
    var m = /^https?:\/\/(?:www\.)?([^\/:?#]+)/i.exec(url || '');
    return m ? m[1].toLowerCase() : 'news.ycombinator.com';
  }

  function compact(items) { return items.filter(function (x) { return !!x; }); }
  function load() {
    if (busy) return;
    busy = true;
    getJSON(TOP, function (err, ids) {
      if (err || !ids || !ids.length) { done(err || new Error('empty')); return; }
      getJSON(FRONT, function (err2, res) {
        var m = merge(ids, !err2 && res ? res.hits : []), left = m.missing.length;
        if (!left) { done(null, compact(m.items)); return; }
        m.missing.forEach(function (id) {
          getJSON(ITEM + id + '.json', function (e3, it) {
            if (!e3 && it && !it.deleted && !it.dead) m.items[m.ids.indexOf(id)] = fromItem(it);
            if (--left === 0) done(null, compact(m.items));
          });
        });
      });
    });
  }
  function done(err, items) {
    busy = false;
    if (!err && items && items.length) { state = { items: items, at: Date.now(), error: null }; save(); }
    else state = { items: state.items, at: state.at, error: String((err && err.message) || 'empty') };
    emit();
    schedule(REFRESH);
  }
  function schedule(ms) { clearTimeout(timer); timer = running ? setTimeout(load, ms) : null; }
  function start() {
    if (running) return;
    running = true;
    var age = Date.now() - state.at;
    if (age >= REFRESH) load(); else schedule(REFRESH - age);
  }
  function stop() { running = false; clearTimeout(timer); timer = null; }
  function emit() { listeners.forEach(function (fn) { fn(state); }); }
  function save() { try { localStorage.setItem(CACHE, JSON.stringify({ at: state.at, items: state.items })); } catch (e) { } }
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cached && cached.items && cached.items.length) state = { items: cached.items, at: cached.at || 0, error: null };
  } catch (e) { }

  function comments(id, cb) {
    var c = comm[id];
    if (c && Date.now() - c.at < COMMENT_TTL) { cb(null, c.list); return; }
    getJSON(ITEM + id + '.json', function (err, it) {
      if (err || !it) { cb(err || new Error('empty')); return; }
      var kids = (it.kids || []).slice(0, COMMENT_KIDS), got = [], left = kids.length, errs = 0;
      if (!left) { keep(id, []); cb(null, []); return; }
      kids.forEach(function (k, i) {
        getJSON(ITEM + k + '.json', function (e2, ci) {
          if (e2) errs++;
          else if (ci && !ci.deleted && !ci.dead && ci.text) got[i] = { by: ci.by || '', time: ci.time || 0, text: text(ci.text) };
          if (--left) return;
          if (errs === kids.length) { cb(new Error('network')); return; }
          var list = compact(got).slice(0, COMMENT_SHOW);
          keep(id, list);
          cb(null, list);
        });
      });
    });
  }
  function keep(id, list) {
    comm[id] = { at: Date.now(), list: list };
    var ks = Object.keys(comm);
    if (ks.length > COMMENT_KEEP) { ks.sort(function (a, b) { return comm[a].at - comm[b].at; }); delete comm[ks[0]]; }
  }

  window.TVHN = {
    start: start, stop: stop, refresh: load, comments: comments,
    get: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    setFail: function (on) { failNet = !!on; },
    merge: merge, fromItem: fromItem, text: text, host: host
  };
})();
