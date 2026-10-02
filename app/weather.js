(function () {
  'use strict';

  var CONFIG = window.CONFIG || {};
  var FB = CONFIG.fallbackLocation;
  var FALLBACK = FB && FB.lat != null && FB.lon != null ? { lat: FB.lat, lon: FB.lon, name: FB.name || '', region: FB.region || '', country: FB.country || '', src: 'fallback' } : null;
  var LOC_KEY = 'tvloc_v1', WX_KEY = 'tvwx_v1';
  var LOC_MAX_AGE = 24 * 60 * 60 * 1000;
  var REFRESH = 15 * 60 * 1000;

  var loc = null, home = null, onUpdate = function () {}, last = null;

  function getJSON(url, cb) {
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
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  function nearFallback(lat, lon) {
    if (!FALLBACK) return false;
    var dy = (lat - FALLBACK.lat) * 111, dx = (lon - FALLBACK.lon) * 111 * Math.cos(lat * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) < 25;
  }

  function resolveLocation(cb) {
    var c = CONFIG.location;
    if (c && c.lat != null && c.lon != null) { cb({ lat: c.lat, lon: c.lon, name: c.name || '', region: c.region || '', country: c.country || '', src: 'config' }); return; }
    var cached = load(LOC_KEY);
    if (cached && cached.src === 'ip' && cached.country && Date.now() - cached.at < LOC_MAX_AGE) { cb(cached); return; }
    getJSON('https://ipwho.is/?fields=success,city,region,country_code,latitude,longitude', function (err, j) {
      if (!err && j && j.success && j.latitude != null) {
        var l = { lat: j.latitude, lon: j.longitude, name: j.city || '', region: j.region || '', country: j.country_code || '', src: 'ip', at: Date.now() };
        store(LOC_KEY, l); cb(l); return;
      }
      if (cached && cached.src === 'ip') { cb(cached); return; }
      if (home) { cb(home); return; }
      cb(FALLBACK);
    });
  }

  function localMs(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : 0;
  }
  function parse(d, l) {
    var cur = d.current, h = d.hourly, dl = d.daily;
    var nowH = String(cur.time).slice(0, 13), start = 0;
    for (var i = 0; i < h.time.length; i++) if (h.time[i].slice(0, 13) === nowH) { start = i; break; }
    var hours = [];
    for (var k = start + 1; k < h.time.length && hours.length < 6; k++) {
      hours.push({ hour: parseInt(h.time[k].slice(11, 13), 10), temp: h.temperature_2m[k], code: h.weather_code[k], isDay: h.is_day[k] === 1, pop: h.precipitation_probability[k] });
    }
    var rainSoon = null;
    if (!(cur.weather_code >= 51)) {
      for (var r = 0; r < Math.min(3, hours.length); r++) if (hours[r].pop >= 60) { rainSoon = { hour: hours[r].hour, pop: hours[r].pop }; break; }
    }
    var days = [];
    for (var j = 0; j < dl.time.length && j < 7; j++) {
      var dd = dl.time[j].split('-');
      days.push({ date: new Date(+dd[0], +dd[1] - 1, +dd[2]).getTime(), code: dl.weather_code[j],
        lo: dl.temperature_2m_min[j], hi: dl.temperature_2m_max[j], pop: dl.precipitation_probability_max[j] });
    }
    return {
      name: l.name, src: l.src, loc: { lat: l.lat, lon: l.lon, name: l.name, region: l.region || '', country: l.country || '' }, temp: cur.temperature_2m, code: cur.weather_code, isDay: cur.is_day === 1, days: days,
      hi: dl.temperature_2m_max[0], lo: dl.temperature_2m_min[0],
      sunrise: localMs(dl.sunrise[0]), sunset: localMs(dl.sunset[0]),
      hours: hours, rainSoon: rainSoon, at: Date.now()
    };
  }
  function refresh() {
    resolveLocation(function (l) {
      if (!l) { onUpdate(last ? Object.assign({}, last, { stale: true }) : { error: true }); return; }
      loc = l;
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + l.lat + '&longitude=' + l.lon +
        '&current=temperature_2m,weather_code,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&forecast_days=7&timezone=auto';
      getJSON(url, function (err, d) {
        if (!err) {
          try { last = parse(d, l); store(WX_KEY, last); onUpdate(last); return; } catch (e) { err = e; }
        }
        console.warn('[weather] ' + err.message);
        onUpdate(last ? Object.assign({}, last, { stale: true }) : { error: true });
      });
    });
  }

  window.TVWeather = {
    start: function (fn) {
      onUpdate = fn || onUpdate;
      last = load(WX_KEY);
      if (last) onUpdate(Object.assign({}, last, { stale: true }));
      refresh();
      setInterval(refresh, REFRESH);
    },
    setHomeCoords: function (lat, lon, name) {
      var first = !home;
      var near = nearFallback(lat, lon);
      home = { lat: lat, lon: lon, name: near ? FALLBACK.name : (name || ''), region: near ? FALLBACK.region : '', country: near ? FALLBACK.country : '', src: 'home' };
      if (first && (!loc || loc.src === 'fallback')) refresh();
    }
  };
})();
