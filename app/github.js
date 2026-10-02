(function () {
  'use strict';

  var API = 'https://api.github.com/search/repositories';
  var REFRESH = 60 * 60 * 1000, CACHE = 'tvdev_gh_v1', DAY = 24 * 60 * 60 * 1000;
  var state = { items: [], at: 0, error: null };
  var listeners = [], timer = null, running = false, busy = false, failNet = false, blockedUntil = 0;

  function query(now) {
    var since = new Date(now - 7 * DAY).toISOString().slice(0, 10);
    return API + '?q=' + encodeURIComponent('created:>' + since) + '&sort=stars&order=desc&per_page=10';
  }
  function parse(res) {
    return ((res && res.items) || []).map(function (r) {
      return { name: r.full_name || '', desc: r.description || '', lang: r.language || '', stars: r.stargazers_count || 0,
        forks: r.forks_count || 0, topics: (r.topics || []).slice(0, 4), created: Date.parse(r.created_at) || 0, url: r.html_url || '' };
    });
  }

  function load() {
    if (busy) return;
    if (Date.now() < blockedUntil) { schedule(blockedUntil - Date.now()); return; }
    if (failNet) { done(new Error('debug')); return; }
    busy = true;
    var x = new XMLHttpRequest();
    try {
      x.open('GET', query(Date.now()), true);
      x.timeout = 12000;
      x.onload = function () {
        if (x.status === 403 || x.status === 429) {
          var reset = +x.getResponseHeader('X-RateLimit-Reset') || 0;
          blockedUntil = reset ? reset * 1000 : Date.now() + 15 * 60 * 1000;
          done(new Error('rate limit'));
          return;
        }
        if (x.status < 200 || x.status >= 300) { done(new Error('http ' + x.status)); return; }
        try { done(null, parse(JSON.parse(x.responseText))); } catch (e) { done(e); }
      };
      x.onerror = function () { done(new Error('network')); };
      x.ontimeout = function () { done(new Error('timeout')); };
      x.send();
    } catch (e) { done(e); }
  }
  function done(err, items) {
    busy = false;
    if (!err && items && items.length) { state = { items: items, at: Date.now(), error: null }; save(); }
    else state = { items: state.items, at: state.at, error: String((err && err.message) || 'empty') };
    listeners.forEach(function (fn) { fn(state); });
    schedule(Math.max(REFRESH, blockedUntil - Date.now()));
  }
  function schedule(ms) { clearTimeout(timer); timer = running ? setTimeout(load, ms) : null; }
  function start() {
    if (running) return;
    running = true;
    var age = Date.now() - state.at;
    if (age >= REFRESH) load(); else schedule(REFRESH - age);
  }
  function stop() { running = false; clearTimeout(timer); timer = null; }
  function save() { try { localStorage.setItem(CACHE, JSON.stringify({ at: state.at, items: state.items })); } catch (e) { } }
  try {
    var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cached && cached.items && cached.items.length) state = { items: cached.items, at: cached.at || 0, error: null };
  } catch (e) { }

  window.TVGitHub = {
    start: start, stop: stop, refresh: load,
    get: function () { return state; },
    onChange: function (fn) { listeners.push(fn); },
    setFail: function (on) { failNet = !!on; },
    query: query, parse: parse
  };
})();
