(function () {
  'use strict';

  var DIYANET = 'https://ezanvakti.emushaf.net';
  var ALADHAN = 'https://api.aladhan.com/v1';
  var KEYS = ['imsak', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];
  var CACHE = 'tvprayer_v1';
  var PLACE = 'tvprayer_place_v1';
  var LISTS = 'tvprayer_lists_v1_';
  var LIST_AGE = 30 * 24 * 60 * 60 * 1000;

  var auto = null, manual = load(PLACE), state = { phase: 'loading', label: '', source: '', days: {} }, listeners = [], busy = false, again = false;

  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function getJSON(url, cb) {
    var x = new XMLHttpRequest();
    try {
      x.open('GET', url, true);
      x.timeout = 15000;
      x.onload = function () {
        if (x.status < 200 || x.status >= 300) { cb(new Error('http ' + x.status)); return; }
        try { cb(null, JSON.parse(x.responseText)); } catch (e) { cb(e); }
      };
      x.onerror = function () { cb(new Error('network')); };
      x.ontimeout = function () { cb(new Error('timeout')); };
      x.send();
    } catch (e) { cb(e); }
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function norm(s) {
    var map = { 'İ': 'I', 'I': 'I', 'Ş': 'S', 'Ğ': 'G', 'Ü': 'U', 'Ö': 'O', 'Ç': 'C', 'Â': 'A', 'Î': 'I', 'Û': 'U' };
    return String(s || '').toLocaleUpperCase('tr').replace(/[İIŞĞÜÖÇÂÎÛ]/g, function (c) { return map[c]; })
      .replace(/\s+(PROVINCE|ILI|İLİ)$/, '').replace(/[^A-Z0-9 ]/g, '').trim();
  }
  function title(s) {
    return String(s || '').toLocaleLowerCase('tr').replace(/(^|[\s-])(\S)/g, function (m, a, b) { return a + b.toLocaleUpperCase('tr'); });
  }
  function emit() { var s = snapshot(); listeners.forEach(function (fn) { try { fn(s); } catch (e) { console.error('[prayer]', e); } }); }
  function snapshot() { return { phase: state.phase, label: state.label, source: state.source, days: state.days, manual: !!manual, autoLabel: auto ? (auto.name || '') : '' }; }

  function list(path, key, cb) {
    var c = load(LISTS + key);
    if (c && c.items && Date.now() - c.at < LIST_AGE) { cb(null, c.items); return; }
    getJSON(DIYANET + path, function (err, j) {
      if (err || !j || !j.length) { cb(err || new Error('empty'), (c && c.items) || []); return; }
      store(LISTS + key, { at: Date.now(), items: j });
      cb(null, j);
    });
  }
  function cities(cb) {
    list('/sehirler/2', 'tr', function (err, items) {
      cb(err, items.map(function (c) { return { id: c.SehirID, name: title(c.SehirAdi), key: norm(c.SehirAdiEn || c.SehirAdi) }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); }));
    });
  }
  function districts(cityId, cb) {
    list('/ilceler/' + cityId, 'c' + cityId, function (err, items) {
      cb(err, items.map(function (d) { return { id: d.IlceID, name: title(d.IlceAdi), key: norm(d.IlceAdiEn || d.IlceAdi) }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); }));
    });
  }

  function resolve(cb) {
    if (manual && manual.districtId) { cb({ kind: 'diyanet', districtId: manual.districtId, label: manual.districtName }); return; }
    if (!auto) { cb(null); return; }
    var calc = { kind: 'calc', lat: auto.lat, lon: auto.lon, method: auto.country === 'TR' ? 13 : null, label: auto.name || '' };
    if (auto.country !== 'TR' || !auto.region) { cb(calc); return; }
    cities(function (err, cs) {
      var want = norm(auto.region), city = null;
      cs.forEach(function (c) { if (c.key === want) city = c; });
      if (!city) { cb(calc); return; }
      districts(city.id, function (err2, ds) {
        var name = norm(auto.name), pick = null, center = null;
        ds.forEach(function (d) { if (d.key === name) pick = d; if (d.key === city.key) center = d; });
        pick = pick || center || ds[0];
        cb(pick ? { kind: 'diyanet', districtId: pick.id, label: pick.name } : calc);
      });
    });
  }

  function fromDiyanet(id, cb) {
    getJSON(DIYANET + '/vakitler/' + id, function (err, j) {
      if (err || !j || !j.length) { cb(err || new Error('empty')); return; }
      var days = {};
      j.forEach(function (d) {
        var p = String(d.MiladiTarihKisa || '').split('.');
        if (p.length === 3) days[p[2] + '-' + p[1] + '-' + p[0]] = [d.Imsak, d.Gunes, d.Ogle, d.Ikindi, d.Aksam, d.Yatsi];
      });
      cb(null, days);
    });
  }
  function fromAladhan(lat, lon, method, cb) {
    var now = new Date(), months = [[now.getFullYear(), now.getMonth() + 1]], nx = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    months.push([nx.getFullYear(), nx.getMonth() + 1]);
    var days = {}, left = months.length, failed = null;
    months.forEach(function (ym) {
      getJSON(ALADHAN + '/calendar/' + ym[0] + '/' + ym[1] + '?latitude=' + lat + '&longitude=' + lon + (method ? '&method=' + method : ''), function (err, j) {
        if (err || !j || !j.data) failed = err || new Error('empty');
        else j.data.forEach(function (d) {
          var p = d.date.gregorian.date.split('-'), t = d.timings;
          days[p[2] + '-' + p[1] + '-' + p[0]] = [t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha].map(function (v) { return String(v).slice(0, 5); });
        });
        if (--left === 0) { if (Object.keys(days).length) cb(null, days); else cb(failed); }
      });
    });
  }
  function hasDays(days) {
    var t = new Date(), tm = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    return !!(days && days[dayKey(t)] && days[dayKey(tm)]);
  }
  function idle() { busy = false; if (again) { again = false; refresh(false); } }
  function refresh(force) {
    if (busy) { again = true; return; }
    busy = true;
    resolve(function (place) {
      if (!place) { idle(); return; }
      var key = place.kind === 'diyanet' ? 'd' + place.districtId : 'c' + place.lat.toFixed(2) + ',' + place.lon.toFixed(2);
      var c = load(CACHE);
      if (!force && c && c.key === key && hasDays(c.days)) {
        state = { phase: 'ok', label: c.label, source: c.source, days: c.days }; emit(); idle(); return;
      }
      function done(err, days, source, label) {
        if (err) {
          if (c && c.key === key && c.days[dayKey(new Date())]) state = { phase: 'ok', label: c.label, source: c.source, days: c.days };
          else state = { phase: 'error', label: place.label, source: '', days: {} };
          emit(); idle(); return;
        }
        store(CACHE, { key: key, source: source, label: label, days: days, at: Date.now() });
        state = { phase: 'ok', label: label, source: source, days: days };
        emit(); idle();
      }
      if (place.kind === 'diyanet') {
        fromDiyanet(place.districtId, function (err, days) {
          if (!err) { done(null, days, 'diyanet', place.label); return; }
          if (!auto) { done(err); return; }
          fromAladhan(auto.lat, auto.lon, 13, function (e2, d2) { done(e2, d2, 'calc', place.label); });
        });
      } else {
        fromAladhan(place.lat, place.lon, place.method, function (err, days) { done(err, days, 'calc', place.label); });
      }
    });
  }

  function at(dateKey, hhmm) {
    var p = dateKey.split('-'), h = String(hhmm || '').split(':');
    if (h.length < 2) return null;
    return new Date(+p[0], +p[1] - 1, +p[2], +h[0], +h[1]).getTime();
  }
  function today(nowMs) {
    var now = new Date(nowMs || Date.now()), k = dayKey(now), d = state.days && state.days[k];
    if (!d) return null;
    var times = KEYS.map(function (key, i) { return { key: key, at: at(k, d[i]) }; }), t = now.getTime(), next = null, prev = null;
    for (var i = 0; i < times.length; i++) if (times[i].at > t) { next = { key: times[i].key, at: times[i].at, tomorrow: false }; prev = i ? times[i - 1].at : null; break; }
    if (!next) {
      var tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), dt = state.days[dayKey(tm)];
      if (dt) next = { key: 'imsak', at: at(dayKey(tm), dt[0]), tomorrow: true };
      prev = times[5].at;
    }
    if (prev == null) {
      var yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), dy = state.days[dayKey(yd)];
      prev = dy ? at(dayKey(yd), dy[5]) : t - 6 * 3600000;
    }
    return { times: times, next: next, prev: prev };
  }

  window.TVPrayer = {
    KEYS: KEYS,
    start: function (fn) {
      if (fn) listeners.push(fn);
      var c = load(CACHE);
      if (c && c.days && c.days[dayKey(new Date())]) { state = { phase: 'ok', label: c.label, source: c.source, days: c.days }; emit(); }
      refresh(false);
      setInterval(function () { refresh(false); }, 60 * 60 * 1000);
    },
    get: snapshot,
    today: today,
    setAuto: function (loc) {
      var key = loc ? [loc.lat, loc.lon, loc.name, loc.region, loc.country].join('|') : '', old = auto ? [auto.lat, auto.lon, auto.name, auto.region, auto.country].join('|') : '';
      auto = loc || null;
      if (key !== old && !manual) refresh(false);
      else if (key !== old) emit();
    },
    setManual: function (place) { manual = place || null; store(PLACE, manual); refresh(false); },
    manualPlace: function () { return manual; },
    cities: cities,
    districts: districts
  };
})();
