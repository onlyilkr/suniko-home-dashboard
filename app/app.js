(function () {
  'use strict';

  var CONFIG = window.CONFIG || {};
  var ST = window.STHome && window.STHome.enabled ? window.STHome : null;
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, ESC: 27, BACKSPACE: 8, BACK: 10009 };
  var t = I18N.t;
  var PANEL_IDLE = 30000;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fahrenheit() { return prefs.unit === 'f' || (prefs.unit === 'auto' && I18N.usesFahrenheit()); }
  function unitVal(c) { return fahrenheit() ? c * 9 / 5 + 32 : c; }
  function deg(v) { return v == null ? '—' : Math.round(unitVal(v)) + '°'; }
  function deg1(v) { return v == null ? '—' : I18N.num(unitVal(v), 1) + '°'; }
  function pct(n) { return t('pct', { n: Math.round(n) }); }
  function ago(ms) {
    var m = Math.round((Date.now() - ms) / 60000);
    if (m < 60) return t('ago.min', { n: m });
    var h = Math.round(m / 60);
    return h < 24 ? t('ago.hour', { n: h }) : t('ago.day', { n: Math.round(h / 24) });
  }

  var ICON = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>',
    partlyDay: '<path d="M8.5 2.8v1.4M2.8 8.5h1.4M4.5 4.5l1 1M12.5 4.5l-1 1"/><path d="M5.3 11.2a3.4 3.4 0 1 1 6-2.9"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1A3 3 0 0 0 8 20z"/>',
    partlyNight: '<path d="M15.2 2.8a4.3 4.3 0 1 0 5.6 5.9 3.4 3.4 0 0 1-5.6-5.9z"/><path d="M7 20.5h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1A3 3 0 0 0 7 20.5z"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11.5a3.5 3.5 0 0 0 1 7z"/>',
    fog: '<path d="M7 13.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 6.5a3.5 3.5 0 0 0 1 7z"/><path d="M4 17.5h16M7 21h10"/>',
    rain: '<path d="M7 14.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5a3.5 3.5 0 0 0 1 7z"/><path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3"/>',
    snow: '<path d="M7 14.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5a3.5 3.5 0 0 0 1 7z"/><path d="M8 18h.01M12 19.5h.01M16 18h.01M10 21.5h.01M14 21.5h.01"/>',
    storm: '<path d="M7 14.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 7.5a3.5 3.5 0 0 0 1 7z"/><path d="M12.5 15.5l-2.5 3.5h3.5l-2.5 3.5"/>',
    bulb: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1.1 1.3 1.1 2.1V16h5.8v-.2c0-.8.4-1.5 1.1-2.1A6.5 6.5 0 0 0 12 2.5z"/>',
    plug: '<path d="M9 7.5V3M15 7.5V3M12 17.5V21.5"/><path d="M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0z"/>',
    power: '<path d="M12 3v8.5"/><path d="M17.7 6.6a8 8 0 1 1-11.4 0"/>',
    door: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17"/><path d="M14.5 12.5v.01"/>',
    drop: '<path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4-6.5-12.5-6.5-12.5S5.5 11 5.5 15a6.5 6.5 0 0 0 6.5 6.5z"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    sparkle: '<path d="M12 3l1.9 5.3L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.7z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    alert: '<path d="M10.3 3.8L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17h.01"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3M6 10.5v3"/>',
    home: '<path d="M3.5 11L12 3.5l8.5 7.5"/><path d="M5.5 9.5V20.5h13V9.5"/>',
    chevL: '<path d="M14.5 5l-7 7 7 7"/>',
    chevR: '<path d="M9.5 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  function svg(name, size, sw) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }

  function wxIcon(code, isDay) {
    if (code === 0) return isDay ? 'sun' : 'moon';
    if (code === 1 || code === 2) return isDay ? 'partlyDay' : 'partlyNight';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    if (code >= 51) return 'rain';
    return isDay ? 'sun' : 'moon';
  }
  function wxName(code) {
    var k = code === 0 ? 'clear' : code === 1 ? 'mostlyClear' : code === 2 ? 'partly' : code === 3 ? 'overcast' :
      (code === 45 || code === 48) ? 'fog' : (code >= 51 && code <= 57) ? 'drizzle' : (code >= 61 && code <= 65) ? 'rain' :
      (code === 66 || code === 67) ? 'freezingRain' : (code >= 71 && code <= 77) ? 'snow' : (code >= 80 && code <= 82) ? 'showers' :
      (code === 85 || code === 86) ? 'snowShowers' : code >= 95 ? 'storm' : '';
    return k ? t('wx.' + k) : '';
  }
  function overcastOf(code) {
    if (code == null || code === 0 || code === 1) return 0;
    if (code === 2) return 0.3;
    if (code === 3 || code === 45 || code === 48) return 0.7;
    return 0.82;
  }

  var SKY = {
    night: ['#070b24', '#141b44', '#2a2658'],
    dawn: ['#2b3a78', '#a86e8c', '#f0ad7c'],
    day: ['#2461ab', '#3f7fc4', '#7fb0df'],
    dusk: ['#1a1f55', '#74497c', '#e2875f']
  };
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, alpha) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (alpha == null ? 1 : alpha) + ')'; }
  function palette(name) { return SKY[name].map(rgb); }
  function blend(p, q, t) { return [mix(p[0], q[0], t), mix(p[1], q[1], t), mix(p[2], q[2], t)]; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function skyAt(now, rise, set) {
    var m = 60000;
    var seq = [[rise - 75 * m, 'night'], [rise, 'dawn'], [rise + 90 * m, 'day'], [set - 90 * m, 'day'], [set, 'dusk'], [set + 75 * m, 'night']];
    if (now <= seq[0][0] || now >= seq[5][0]) return palette('night');
    for (var i = 0; i < seq.length - 1; i++) {
      if (now >= seq[i][0] && now < seq[i + 1][0]) return blend(palette(seq[i][1]), palette(seq[i + 1][1]), (now - seq[i][0]) / (seq[i + 1][0] - seq[i][0]));
    }
    return palette('day');
  }
  var weather = null, skyLayer = 0, skyLast = '';
  function skyBackground(at) {
    var now = at || Date.now(), d = new Date(now);
    var rise = weather && weather.sunrise, set = weather && weather.sunset;
    if (!rise || !set) {
      rise = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 45).getTime();
      set = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 45).getTime();
    }
    var stops = skyAt(now, rise, set), oc = overcastOf(weather && weather.code);
    if (oc) {
      stops = stops.map(function (c) {
        var l = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) * 0.92;
        return mix(c, [l, l * 1.02, l * 1.08], oc);
      });
    }
    var glow;
    var f = (now - rise) / (set - rise);
    if (f > -0.06 && f < 1.06) {
      var t = clamp01(f), x = 8 + 84 * t, y = 86 - Math.sin(Math.PI * t) * 70;
      var c = mix(rgb('#ffa061'), rgb('#fff0c8'), Math.sin(Math.PI * t));
      glow = 'radial-gradient(1100px 1000px at ' + x.toFixed(1) + '% ' + y.toFixed(1) + '%, ' + css(c, 0.55 * (1 - oc * 0.65)) + ', ' + css(c, 0) + ' 60%)';
    } else {
      var mc = rgb('#c3d0ff');
      glow = 'radial-gradient(900px 900px at 78% 16%, ' + css(mc, 0.2 * (1 - oc * 0.7)) + ', ' + css(mc, 0) + ' 58%)';
    }
    return { bg: glow + ', linear-gradient(180deg, ' + css(stops[0]) + ' 0%, ' + css(stops[1]) + ' 58%, ' + css(stops[2]) + ' 100%)', mid: stops[1] };
  }
  function paintSky(at) {
    if (prefs.theme !== 'sky' && !at) return;
    var sky = skyBackground(at);
    setBackground(sky.bg, css(mix(sky.mid.map(function (v) { return v * 0.84; }), [255, 255, 255], 0.14), 0.94));
  }
  function setBackground(bg, glassSolid) {
    if (glassSolid) document.documentElement.style.setProperty('--glass-solid', glassSolid);
    if (bg === skyLast) return;
    skyLast = bg;
    var next = skyLayer === 0 ? $('skyB') : $('skyA'), cur = skyLayer === 0 ? $('skyA') : $('skyB');
    next.style.background = bg;
    next.classList.add('show'); cur.classList.remove('show');
    skyLayer = 1 - skyLayer;
  }

  var DARK_BG = 'radial-gradient(1200px 900px at 20% 10%, rgba(70,80,120,.28), rgba(70,80,120,0) 60%), linear-gradient(180deg, #11141d 0%, #0a0c12 100%)';
  var PHOTO_GLASS = 'rgba(34,36,48,.92)';
  var DAY_KEYS = [
    [0, ['#1b1650', '#3a1d6e', '#0c2459']],
    [5.5, ['#2c2468', '#5a2f7e', '#3a2f6a']],
    [7, ['#c9605a', '#d98a52', '#4a5fa8']],
    [8.5, ['#d9824f', '#c9a04a', '#4f7fc0']],
    [10.5, ['#2f86c8', '#2aa39a', '#5a78c8']],
    [14, ['#2a78c0', '#23968a', '#3f6fb8']],
    [17, ['#d0803a', '#b85a6a', '#4a5fa8']],
    [19, ['#d45a4a', '#a8387a', '#4a2f8a']],
    [21, ['#4a2a86', '#822f78', '#1f2f78']],
    [24, ['#1b1650', '#3a1d6e', '#0c2459']]
  ];
  function toHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, sat = 0;
    if (d) {
      sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, sat, l];
  }
  function fromHsl(x) {
    var h = x[0] / 360, sat = x[1], l = x[2];
    if (!sat) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    function f(t) { t = t < 0 ? t + 1 : t > 1 ? t - 1 : t; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  function mixHsl(a, b, t) {
    var x = toHsl(a), y = toHsl(b), dh = y[0] - x[0];
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    return fromHsl([(x[0] + dh * t + 360) % 360, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function dayBackground(at) {
    var d = new Date(at || Date.now()), h = d.getHours() + d.getMinutes() / 60, a = DAY_KEYS[0], b = DAY_KEYS[1];
    for (var i = 0; i < DAY_KEYS.length - 1; i++) if (h >= DAY_KEYS[i][0] && h < DAY_KEYS[i + 1][0]) { a = DAY_KEYS[i]; b = DAY_KEYS[i + 1]; break; }
    var t = (h - a[0]) / (b[0] - a[0]), c = [0, 1, 2].map(function (k) { return mixHsl(rgb(a[1][k]), rgb(b[1][k]), t); });
    var base = mix(mix(c[0], c[1], 0.5), c[2], 0.4).map(function (v) { return v * 0.42; });
    return { bg: 'radial-gradient(1300px 1050px at 10% 12%, ' + css(c[0], 0.95) + ', ' + css(c[0], 0) + ' 62%), ' +
      'radial-gradient(1200px 1000px at 92% 22%, ' + css(c[1], 0.9) + ', ' + css(c[1], 0) + ' 60%), ' +
      'radial-gradient(1600px 900px at 45% 112%, ' + css(c[2], 0.95) + ', ' + css(c[2], 0) + ' 64%), ' +
      'linear-gradient(180deg, ' + css(base) + ', ' + css(base.map(function (v) { return v * 0.7; })) + ')', base: base };
  }
  function paintDaylight(at) {
    if (prefs.theme !== 'daylight' && !at) return;
    var day = dayBackground(at);
    setBackground(day.bg, css(mix(day.base.map(function (v) { return v * 1.6; }), [255, 255, 255], 0.14), 0.94));
  }
  var PHOTO_EVERY = 10 * 60 * 1000;
  var photoTimer = null, photoList = [], photoIdx = 0, shownPhoto = null;
  function renderCredit() {
    if (!shownPhoto || !document.body.classList.contains('photo')) return;
    $('credit').textContent = t('photo.credit', { credit: (shownPhoto.artist || t('photo.unknown')) + (shownPhoto.license ? ', ' + shownPhoto.license : '') });
    $('credit').hidden = false;
  }
  function sceneInput(at, force) {
    var now = at || Date.now(), d = new Date(now), rise = weather && weather.sunrise, set = weather && weather.sunset;
    if (!rise || !set) {
      rise = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 45).getTime();
      set = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 45).getTime();
    }
    var f = (now - rise) / (set - rise), t = clamp01(f);
    return { code: weather && weather.code, force: force, isDay: f > -0.02 && f < 1.02, sky: skyAt(now, rise, set), sunX: 8 + 84 * t, sunY: 86 - Math.sin(Math.PI * t) * 70 };
  }
  function paintScene(at, force) {
    if (!window.TVScene || (prefs.theme !== 'weather' && !force)) return;
    var r = TVScene.update(sceneInput(at, force));
    setBackground(r.bg, r.glass);
  }
  function applyTheme() {
    var t = prefs.theme, isPhoto = window.TVThemes && TVThemes.isPhoto(t);
    clearInterval(photoTimer); photoTimer = null;
    document.body.classList.toggle('photo', !!isPhoto);
    if (!isPhoto) $('credit').hidden = true;
    var scene = t === 'weather' && !!window.TVScene;
    if (window.TVScene) TVScene.show(scene);
    if (scene) { paintScene(); return; }
    if (t === 'dark') { setBackground(DARK_BG, PHOTO_GLASS); return; }
    if (t === 'daylight') { paintDaylight(); return; }
    if (!isPhoto) { skyLast = ''; paintSky(); return; }
    TVThemes.photos(t, function (err, items) {
      if (prefs.theme !== t) return;
      if (!items.length) {
        notify({ tone: 'warn', icon: 'alert', app: t('app.theme'), title: t('note.themeFailed'), text: t('note.themeFailedText') });
        document.body.classList.remove('photo'); skyLast = ''; var sky = skyBackground(); setBackground(sky.bg);
        return;
      }
      photoList = items; photoIdx = Math.floor(Math.random() * items.length);
      showPhoto(t, 0);
      photoTimer = setInterval(function () { photoIdx++; showPhoto(t, 0); }, PHOTO_EVERY);
    });
  }
  function showPhoto(t, tries) {
    var it = photoList[photoIdx % photoList.length], img = new Image();
    img.onload = function () {
      if (prefs.theme !== t) return;
      setBackground('url("' + it.url.replace(/["\\\n]/g, encodeURIComponent) + '") center/cover no-repeat, #111', PHOTO_GLASS);
      shownPhoto = it; renderCredit();
    };
    img.onerror = function () { if (tries < 3 && prefs.theme === t) { photoIdx++; showPhoto(t, tries + 1); } };
    img.src = it.url;
  }

  var PREF_GROUPS = [['look', 'prefs.group.look'], ['screen', 'prefs.group.screen'], ['prayer', 'prefs.group.prayer'], ['locale', 'prefs.group.locale']];
  var PREFS = [
    { key: 'theme', group: 'look', modal: true, def: 'weather', options: (window.TVThemes ? TVThemes.all() : [{ id: 'sky' }]).map(function (x) { return [x.id, 'theme.' + x.id]; }) },
    { key: 'clock', group: 'look', target: 'left', options: [['digital'], ['classic'], ['minimal']] },
    { key: 'weather', group: 'screen', target: 'right', options: [['full'], ['hourly'], ['weekly'], ['now']] },
    { key: 'home', group: 'screen', target: 'left', when: function () { return !!ST; }, options: [['full'], ['climate'], ['off']] },
    { key: 'devhub', group: 'screen', when: function () { return !!window.TVHub; }, options: [['on'], ['off']] },
    { key: 'prayer', group: 'prayer', label: 'prefs.row.prayer', target: 'right', when: function () { return !!window.TVPrayer; }, options: [['off'], ['on']] },
    { key: 'prayerLoc', group: 'prayer', label: 'prefs.row.prayerLoc', target: 'right', modal: true, when: function () { return !!window.TVPrayer; }, show: function () { return prefs.prayer === 'on'; }, options: [['auto'], ['manual']] },
    { key: 'prayerNote', group: 'prayer', label: 'prefs.row.prayerNote', target: 'right', when: function () { return !!window.TVPrayer; }, show: function () { return prefs.prayer === 'on'; }, options: [['both'], ['at'], ['off']] },
    { key: 'lang', group: 'locale', options: [['auto'], ['tr', '=Türkçe'], ['en', '=English']] },
    { key: 'unit', group: 'locale', options: [['auto'], ['c'], ['f']] }
  ].filter(function (p) { return !p.when || p.when(); });
  function optionLabel(p, o) {
    if (p.key === 'prayerLoc') {
      var m = window.TVPrayer && TVPrayer.manualPlace();
      return o[0] === 'manual' && m ? m.districtName + ', ' + m.cityName : t('pref.prayerLoc.auto', { place: window.TVPrayer ? TVPrayer.get().autoLabel : '' });
    }
    var k = o[1] || ('pref.' + p.key + '.' + o[0]); return k.charAt(0) === '=' ? k.slice(1) : t(k);
  }
  var PREFS_KEY = 'tv_prefs_v1';
  var prefs = (function () {
    var out = {}, saved = {}, cfg = CONFIG.display || {};
    try { saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    PREFS.forEach(function (p) {
      var ok = function (v) { return p.options.some(function (o) { return o[0] === v; }); };
      out[p.key] = ok(saved[p.key]) ? saved[p.key] : ok(cfg[p.key]) ? cfg[p.key] : ok(p.def) ? p.def : p.options[0][0];
    });
    return out;
  })();
  if (window.TVPrayer) prefs.prayerLoc = TVPrayer.manualPlace() ? 'manual' : 'auto';
  try {
    if (!localStorage.getItem('tv_prefs_mig_weather')) {
      localStorage.setItem('tv_prefs_mig_weather', '1');
      if (prefs.theme === 'sky' && !(CONFIG.display && CONFIG.display.theme === 'sky')) { prefs.theme = 'weather'; localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    }
  } catch (e) { }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { } }

  function analogSvg(style, size) {
    var o = ['<svg width="' + size + '" height="' + size + '" viewBox="0 0 400 400" aria-hidden="true"><circle class="face" cx="200" cy="200" r="194"/>'];
    for (var i = 0; i < 60; i++) {
      var hour = i % 5 === 0, a = i * Math.PI / 30, sn = Math.sin(a), cs = Math.cos(a);
      var r1 = hour ? (style === 'minimal' ? 146 : 164) : 176, r2 = 184;
      o.push('<line class="tick' + (hour ? ' h' : '') + '" x1="' + (200 + r1 * sn).toFixed(1) + '" y1="' + (200 - r1 * cs).toFixed(1) + '" x2="' + (200 + r2 * sn).toFixed(1) + '" y2="' + (200 - r2 * cs).toFixed(1) + '"/>');
    }
    if (style === 'classic') {
      for (var n = 1; n <= 12; n++) {
        var b = n * Math.PI / 6;
        o.push('<text class="num" x="' + (200 + 128 * Math.sin(b)).toFixed(1) + '" y="' + (200 - 128 * Math.cos(b)).toFixed(1) + '">' + n + '</text>');
      }
    }
    o.push('<g class="hh"><line class="hand" x1="200" y1="222" x2="200" y2="' + (style === 'minimal' ? 92 : 104) + '"/></g>');
    o.push('<g class="mh"><line class="hand" x1="200" y1="228" x2="200" y2="' + (style === 'minimal' ? 34 : 44) + '"/></g>');
    o.push('<circle class="hub" cx="200" cy="200" r="13"/></svg>');
    return o.join('');
  }
  function setHands(root, d) {
    if (!root) return;
    var h = d.getHours() % 12, m = d.getMinutes(), hh = root.querySelector('.hh'), mh = root.querySelector('.mh');
    if (hh) hh.setAttribute('transform', 'rotate(' + ((h + m / 60) * 30).toFixed(1) + ' 200 200)');
    if (mh) mh.setAttribute('transform', 'rotate(' + ((m + d.getSeconds() / 60) * 6).toFixed(1) + ' 200 200)');
  }
  var clockLast = '', clockStyle = '';
  function applyClock() {
    var analog = prefs.clock !== 'digital';
    $('clock').hidden = analog; $('clock-analog').hidden = !analog;
    if (analog && clockStyle !== prefs.clock) $('clock-analog').innerHTML = analogSvg(prefs.clock, 460);
    clockStyle = prefs.clock; clockLast = '';
    tick();
  }
  function tick() {
    var d = new Date(), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (prefs.clock !== 'digital') setHands($('clock-analog'), d);
    if (hm === clockLast) return;
    clockLast = hm;
    var hh = d.getHours();
    if (I18N.hour12()) $('clock').innerHTML = ((hh % 12) || 12) + ':' + pad(d.getMinutes()) + '<span class="ampm">' + esc(t(hh < 12 ? 'time.am' : 'time.pm')) + '</span>';
    else $('clock').textContent = hm;
    $('clock-analog').setAttribute('aria-label', hm);
    $('date').textContent = t('date.long', { date: d });
    if (window.TVPrayer && prefs.prayer === 'on') renderPrayer();
  }

  var rainNotified = '';
  var TEMP_STOPS = [[-5, '#8aa8ff'], [5, '#7cc9ff'], [12, '#7fe0d0'], [18, '#b7e37f'], [24, '#ffd36b'], [30, '#ff9a5a'], [36, '#ff6a5c']];
  function tempColor(t) {
    if (t <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
    for (var i = 1; i < TEMP_STOPS.length; i++) {
      if (t <= TEMP_STOPS[i][0]) {
        var a = TEMP_STOPS[i - 1], b = TEMP_STOPS[i];
        return css(mix(rgb(a[1]), rgb(b[1]), (t - a[0]) / (b[0] - a[0])));
      }
    }
    return TEMP_STOPS[TEMP_STOPS.length - 1][1];
  }
  function applyWeatherPrefs() {
    var m = prefs.weather;
    $('wx-hours').hidden = !$('wx-hours').innerHTML || !(m === 'full' || m === 'hourly');
    $('wx-week').hidden = !$('wx-week').innerHTML || !(m === 'full' || m === 'weekly');
  }
  function renderWeather(w) {
    if (w.error) {
      $('wx-icon').innerHTML = '';
      $('wx-temp').textContent = '—';
      $('wx-cond').textContent = t('wx.error');
      $('wx-range').textContent = t('wx.errorHint');
      $('wx-week').hidden = true;
      $('wx-hours').hidden = true;
      return;
    }
    weather = w;
    $('wx-icon').innerHTML = svg(wxIcon(w.code, w.isDay), 72, 1.6);
    $('wx-temp').textContent = deg(w.temp);
    $('wx-cond').textContent = wxName(w.code);
    $('wx-range').textContent = t('wx.range', { city: w.name || t('loc.fallback'), lo: deg(w.lo), hi: deg(w.hi) });
    var hours = '';
    (w.hours || []).forEach(function (h) {
      hours += '<li><span class="h">' + esc(I18N.hourLabel(h.hour)) + '</span>' + svg(wxIcon(h.code, h.isDay), 36) +
        '<span class="t">' + deg(h.temp) + '</span><span class="p">' + (h.pop >= 30 ? pct(h.pop) : '') + '</span></li>';
    });
    $('wx-hours').innerHTML = hours;
    var days = w.days || [], lo = Infinity, hi = -Infinity;
    days.forEach(function (d) { if (d.lo < lo) lo = d.lo; if (d.hi > hi) hi = d.hi; });
    var span = Math.max(1, hi - lo), today = new Date().toDateString(), html = '';
    var TOP = 30, H = 66;
    days.forEach(function (d) {
      var isToday = new Date(d.date).toDateString() === today;
      var y = TOP + (hi - d.hi) / span * H, h = Math.max(12, (d.hi - d.lo) / span * H);
      var dot = '';
      if (isToday && w.temp != null) dot = '<i class="wk-dot" style="top:' + (TOP + Math.min(H, Math.max(0, (hi - w.temp) / span * H))).toFixed(1) + 'px"></i>';
      html += '<div class="wk' + (isToday ? ' today' : '') + '"><div class="wk-plot">' +
        '<span class="wk-hi" style="top:' + (y - 30).toFixed(1) + 'px">' + deg(d.hi) + '</span>' +
        '<span class="wk-bar" style="top:' + y.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;background:linear-gradient(180deg,' + tempColor(d.hi) + ',' + tempColor(d.lo) + ')"></span>' + dot +
        '<span class="wk-lo" style="top:' + (y + h + 2).toFixed(1) + 'px">' + deg(d.lo) + '</span>' +
        '</div><div class="wk-i">' + svg(wxIcon(d.code, true), 32) + '</div>' +
        '<div class="wk-n">' + esc(isToday ? t('day.today') : t('day.short', { day: new Date(d.date).getDay() })) + '</div></div>';
    });
    $('wx-week').innerHTML = html;
    applyWeatherPrefs();
    paintSky();
    paintScene();
    if (w.rainSoon && !w.stale) {
      var k = new Date().toDateString() + '-' + w.rainSoon.hour;
      if (k !== rainNotified) {
        rainNotified = k;
        notify({ app: t('app.weather'), tone: 'info', icon: 'rain', title: t('wx.rainTitle'), text: t('wx.rainText', { time: I18N.hourLabel(w.rainSoon.hour), pct: pct(w.rainSoon.pop) }) });
      }
    }
  }

  var home = null;
  function nounOf(label) { return String(label || '').replace(/\s*sens[öo]r[üu]?\s*$/i, '').trim() || label; }
  function roomOf(s, d) { return (s.rooms && s.rooms[d.roomId]) || ''; }
  function climateDevice(s) {
    var want = (CONFIG.smartthings || {}).climateDeviceId, first = null;
    for (var i = 0; i < s.devices.length; i++) {
      var d = s.devices[i];
      if (d.kind !== 'climate' || d.temp == null) continue;
      if (d.id === want) return d;
      if (!first) first = d;
    }
    return first;
  }
  function chipsFor(s) {
    var out = [], seen = {}, lights = 0, hasLights = false, wet = false, hasWater = false;
    function add(tone, text) { if (seen[text]) return; seen[text] = 1; out.push({ tone: tone, text: text }); }
    s.devices.forEach(function (d) {
      if (d.kind === 'contact' && d.contact) add(d.contact === 'open' ? 'alert' : 'ok', t(d.contact === 'open' ? 'chip.open' : 'chip.closed', { name: nounOf(d.label) }));
      if (d.kind === 'water') { hasWater = true; if (d.water === 'wet') wet = true; }
      if (d.kind === 'light') { hasLights = true; if (d.on && d.online) lights++; }
      if (d.kind === 'presence' && d.presence) add('', t(d.presence === 'present' ? 'chip.home' : 'chip.away', { name: d.label }));
      if (d.battery != null && d.battery < 20) add('warn', t('chip.battery', { name: nounOf(d.label), pct: pct(d.battery) }));
    });
    if (hasWater) add(wet ? 'alert' : 'ok', t(wet ? 'chip.leak' : 'chip.noLeak'));
    if (hasLights) add(lights ? 'warm' : '', lights ? t('chip.lightsOn', { n: lights }) : t('chip.lightsOff'));
    var rank = { alert: 0, warn: 1, warm: 2, ok: 3, '': 4 };
    out.sort(function (a, b) { return rank[a.tone] - rank[b.tone]; });
    return out;
  }
  function applyHomePrefs() {
    $('indoor').hidden = !ST || prefs.home === 'off';
    $('in-chips').hidden = prefs.home === 'climate';
  }
  function showIndoorMsg(title, text) {
    $('in-data').hidden = true; $('in-msg').hidden = false;
    $('in-msg-title').textContent = title; $('in-msg-text').textContent = text;
  }
  function renderIndoor(s) {
    applyHomePrefs();
    if (s.phase === 'auth') { showIndoorMsg(t('home.authTitle'), t('home.authText')); return; }
    if (!s.devices.length) {
      if (s.phase === 'error') showIndoorMsg(t('home.unreachableTitle'), t('home.unreachableText'));
      else showIndoorMsg(t('home.loadingTitle'), '');
      return;
    }
    $('in-data').hidden = false; $('in-msg').hidden = true;
    var c = climateDevice(s);
    $('in-temp').textContent = c ? deg1(c.temp) : '—';
    $('in-hum').textContent = c && c.hum != null ? t('home.humidity', { n: Math.round(c.hum) }) : '';
    $('in-room').textContent = c ? (roomOf(s, c) || c.label) : t('home.noSensor');
    var old = c && c.tempAt && Date.now() - c.tempAt > 45 * 60000;
    $('in-age').hidden = !old;
    if (old) $('in-age').textContent = t('home.lastReading', { ago: ago(c.tempAt) });
    $('in-chips').innerHTML = chipsFor(s).map(function (ch) { return '<li class="chip ' + ch.tone + '"><i></i>' + esc(ch.text) + '</li>'; }).join('');
  }

  var panel = null, sheetHtml = '', lastKeyAt = 0;
  function controls(s) {
    return s.devices.filter(function (d) { return d.kind === 'light' || d.kind === 'plug' || d.kind === 'switch'; });
  }
  function tileHtml(s, d) {
    var sub = !d.online ? t('dev.offline') : !d.on ? t('dev.off') : (d.kind === 'light' && d.level != null ? t('dev.onLevel', { pct: pct(d.level) }) : t('dev.on'));
    return '<div class="tile k-' + d.kind + (d.on && d.online ? ' on' : '') + (d.online ? '' : ' offline') + '" data-nav tabindex="0" data-key="dev-' + esc(d.id) + '" data-act="toggle" data-id="' + esc(d.id) + '">' +
      '<span class="tile-icon">' + svg(d.kind === 'light' ? 'bulb' : d.kind === 'plug' ? 'plug' : 'power', 32) + '</span>' +
      '<span class="tile-text"><span class="tile-name">' + esc(d.label) + '</span><span class="tile-sub">' + esc(sub) + '</span></span></div>';
  }
  function roomGroups(s) {
    var by = {}, order = [];
    controls(s).forEach(function (d) {
      var k = d.roomId || '_';
      if (!by[k]) { by[k] = { name: roomOf(s, d) || t('sheet.other'), list: [], online: 0 }; order.push(k); }
      by[k].list.push(d); if (d.online) by[k].online++;
    });
    return order.map(function (k) {
      by[k].list.sort(function (a, b) { return a.online !== b.online ? (a.online ? -1 : 1) : a.label.localeCompare(b.label, 'tr'); });
      return by[k];
    }).sort(function (a, b) { return (b.online - a.online) || (b.list.length - a.list.length) || a.name.localeCompare(b.name, 'tr'); });
  }
  function buildSheet(s) {
    if (s.phase === 'auth') return '<div class="empty">' + esc(t('sheet.authEmpty')) + '</div>';
    if (!s.devices.length) return '<div class="empty">' + esc(s.phase === 'error' ? t('home.unreachableTitle') + '. ' + t('home.unreachableText') : t('sheet.loading')) + '</div>';
    var html = '';
    if (s.scenes.length) {
      html += '<div class="sec">' + esc(t('sheet.scenes')) + '</div><div class="scenes">';
      s.scenes.forEach(function (sc) {
        html += '<div class="scene" data-nav tabindex="0" data-key="scene-' + esc(sc.id) + '" data-act="scene" data-id="' + esc(sc.id) + '">' + svg('sparkle', 30) + '<span>' + esc(sc.name) + '</span></div>';
      });
      html += '</div>';
    }
    var groups = roomGroups(s);
    if (!groups.length) return html + '<div class="empty">' + esc(t('sheet.noDevices')) + '</div>';
    html += '<div class="rooms">';
    groups.forEach(function (g) {
      html += '<section class="room"><div class="room-name">' + esc(g.name) + '</div><div class="room-tiles">' +
        g.list.map(function (d) { return tileHtml(s, d); }).join('') + '</div></section>';
    });
    return html + '</div>';
  }
  function renderSheet(s) {
    var mode = s.mode ? (t('mode.' + s.mode) === 'mode.' + s.mode ? s.mode : t('mode.' + s.mode)) : '';
    $('sheet-title').textContent = t('sheet.title', { name: s.locationName || t('sheet.defaultName'), mode: mode });
    var html = buildSheet(s);
    if (html === sheetHtml) return;
    var body = $('sheet-body'), a = document.activeElement, key = a && a.getAttribute ? a.getAttribute('data-key') : null;
    if (sheetHtml && sameShape(html, sheetHtml)) {
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      var fresh = tmp.querySelectorAll('[data-key]'), live = body.querySelectorAll('[data-key]');
      for (var i = 0; i < fresh.length; i++) {
        live[i].className = fresh[i].className;
        var sub = fresh[i].querySelector('.tile-sub');
        if (sub) live[i].querySelector('.tile-sub').textContent = sub.textContent;
      }
    } else {
      body.innerHTML = html;
      if (panel === 'sheet') {
        var back = key ? body.querySelector('[data-key="' + key + '"]') : null;
        focusEl(back || body.querySelector('[data-nav]'));
      }
    }
    sheetHtml = html;
  }
  function sameShape(a, b) {
    var ka = a.match(/data-key="[^"]*"/g) || [], kb = b.match(/data-key="[^"]*"/g) || [];
    return ka.join() === kb.join() && a.replace(/class="[^"]*"|<span class="tile-sub">[^<]*<\/span>/g, '') === b.replace(/class="[^"]*"|<span class="tile-sub">[^<]*<\/span>/g, '');
  }
  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  function prefValueIndex(p) { for (var i = 0; i < p.options.length; i++) if (p.options[i][0] === prefs[p.key]) return i; return 0; }
  function themeThumb(id, el) {
    if (id === 'sky') { el.style.background = skyBackground().bg; return; }
    if (id === 'dark') { el.style.background = DARK_BG; return; }
    if (id === 'daylight') { el.style.background = dayBackground().bg; return; }
    if (id === 'weather' && window.TVScene) {
      var si = sceneInput();
      el.style.background = TVScene.preview(si);
      el.innerHTML = '<span class="thumb-icon">' + svg(wxIcon(si.code == null ? 0 : si.code, si.isDay), 56, 1.6) + '</span>';
      return;
    }
    if (!window.TVThemes) return;
    TVThemes.photos(id, function (err, items) {
      if (items.length) el.style.backgroundImage = 'url("' + items[0].thumb.replace(/["\\\n]/g, encodeURIComponent) + '")';
    });
  }
  function prefInner(p) {
    return '<span class="pref-label">' + esc(t(p.label || ('pref.' + p.key))) + '</span>' +
      '<span class="pref-value">' + svg('chevL', 24, 2.4) + '<span>' + esc(optionLabel(p, p.options[prefValueIndex(p)])) + '</span>' + svg('chevR', 24, 2.4) + '</span>';
  }
  function renderPrefs() {
    var visible = PREFS.filter(function (p) { return !p.show || p.show(); });
    $('prefs-body').innerHTML = PREF_GROUPS.map(function (g) {
      var rows = visible.filter(function (p) { return p.group === g[0]; });
      if (!rows.length) return '';
      return '<section class="pref-group"><div class="pref-gtitle">' + esc(t(g[1])) + '</div>' + rows.map(function (p) {
        return '<div class="pref" data-nav tabindex="0" data-key="pref-' + p.key + '" data-pref="' + p.key + '">' + prefInner(p) + '</div>';
      }).join('') + '</section>';
    }).join('');
  }
  function fillThumbs(root) {
    var list = root.querySelectorAll('[data-thumb]');
    for (var i = 0; i < list.length; i++) themeThumb(list[i].getAttribute('data-thumb'), list[i]);
  }
  function stepPref(el, dir) {
    var key = el && el.getAttribute && el.getAttribute('data-pref'); if (!key) return;
    var p = null; PREFS.forEach(function (x) { if (x.key === key) p = x; });
    if (key === 'prayerLoc') {
      if (prefs.prayerLoc === 'auto') { openPlaces(); return; }
      TVPrayer.setManual(null); prefs.prayerLoc = 'auto'; savePrefs(); el.innerHTML = prefInner(p); return;
    }
    var n = p.options.length, idx = (prefValueIndex(p) + dir + n) % n;
    prefs[key] = p.options[idx][0];
    savePrefs();
    el.innerHTML = prefInner(p);
    if (key === 'clock') applyClock();
    if (key === 'weather') applyWeatherPrefs();
    if (key === 'home') applyHomePrefs();
    if (key === 'devhub') applyDevhub();
    if (key === 'theme') applyTheme();
    if (key === 'lang' || key === 'unit') { applyLocale(); renderPrefs(); focusEl($('prefs-body').querySelector('[data-pref="' + key + '"]')); }
    if (key === 'prayer') { applyPrayer(); renderPrefs(); focusEl($('prefs-body').querySelector('[data-pref="prayer"]')); }
    if (key === 'prayerNote') renderPrayer();
  }

  function renderThemes() {
    $('themes-body').innerHTML = (window.TVThemes ? TVThemes.all() : []).map(function (x) {
      return '<div class="theme-card" data-nav tabindex="0" data-key="theme-' + esc(x.id) + '" data-theme="' + esc(x.id) + '">' +
        '<div class="theme-thumb" data-thumb="' + esc(x.id) + '"></div>' +
        '<div class="theme-name"><span>' + esc(t('theme.' + x.id)) + '</span>' + (x.id === prefs.theme ? svg('check', 30, 2.6) : '') + '</div></div>';
    }).join('');
    fillThumbs($('themes-body'));
  }
  function openThemes() { closePanel(); openPanel('themes'); }
  function backToPrefs(key) { closePanel(); prefsFocus = 'pref-' + (key || 'theme'); openPanel('prefs'); }
  function chooseTheme(el) {
    var id = el && el.getAttribute && el.getAttribute('data-theme'); if (!id) return;
    prefs.theme = id; savePrefs(); applyTheme();
    backToPrefs();
  }

  var placesView = 'cities', placesCity = null, placesFocus = null;
  function renderPlaces(view, city) {
    placesView = view; placesCity = city || null;
    var body = $('places-body'), m = TVPrayer.manualPlace();
    $('places-hint').textContent = view === 'cities' ? t('places.hintCities') : t('places.hintDistricts', { city: city.name });
    body.innerHTML = '<div class="empty">' + esc(t('places.loading')) + '</div>';
    var load = view === 'cities' ? TVPrayer.cities : function (cb) { TVPrayer.districts(city.id, cb); };
    load(function (err, items) {
      if (panel !== 'places' || placesView !== view) return;
      if (!items.length) { body.innerHTML = '<div class="empty">' + esc(t('places.error')) + '</div>'; return; }
      var html = view === 'cities' ? '<div class="place auto' + (m ? '' : ' sel') + '" data-nav tabindex="0" data-key="place-auto" data-place="auto">' +
        esc(t('pref.prayerLoc.auto', { place: TVPrayer.get().autoLabel })) + '</div>' : '';
      items.forEach(function (it) {
        var sel = m && (view === 'cities' ? m.cityId === it.id : m.districtId === it.id);
        html += '<div class="place' + (sel ? ' sel' : '') + '" data-nav tabindex="0" data-key="place-' + esc(it.id) + '" data-place="' + esc(it.id) + '" data-name="' + esc(it.name) + '">' + esc(it.name) + '</div>';
      });
      body.innerHTML = html;
      var target = (placesFocus && body.querySelector('[data-place="' + placesFocus + '"]')) || body.querySelector('.place.sel') || body.querySelector('[data-nav]');
      placesFocus = null;
      if (document.body.classList.contains('settled')) focusEl(target);
    });
  }
  function openPlaces() { closePanel(); openPanel('places'); }
  function choosePlace(el) {
    var id = el && el.getAttribute && el.getAttribute('data-place'); if (!id) return;
    if (id === 'auto') { TVPrayer.setManual(null); prefs.prayerLoc = 'auto'; savePrefs(); backToPrefs('prayerLoc'); return; }
    if (placesView === 'cities') { renderPlaces('districts', { id: id, name: el.getAttribute('data-name') }); return; }
    TVPrayer.setManual({ cityId: placesCity.id, cityName: placesCity.name, districtId: id, districtName: el.getAttribute('data-name') });
    prefs.prayerLoc = 'manual'; savePrefs();
    backToPrefs('prayerLoc');
  }
  function placesBack() {
    if (placesView === 'districts') { placesFocus = placesCity.id; renderPlaces('cities'); }
    else backToPrefs('prayerLoc');
  }

  var prefsDock = 'left';
  function dockFor(key) {
    for (var i = 0; i < PREFS.length; i++) if (PREFS[i].key === key) return PREFS[i].target ? (PREFS[i].target === 'left' ? 'right' : 'left') : null;
    return null;
  }
  function setPrefsDock(side, animate) {
    if (side === prefsDock) return;
    prefsDock = side;
    var el = $('prefs');
    if (animate) {
      if (window.TVScene) TVScene.hold(700);
      el.classList.add('moving');
      afterSlide(el, function () { if (panel === 'prefs') el.classList.remove('moving'); });
    } else {
      el.style.transition = 'none';
    }
    el.classList.toggle('dock-right', side === 'right');
    document.body.classList.toggle('prefs-right', side === 'right');
    if (!animate) { void el.offsetWidth; el.style.transition = ''; }
  }
  function syncPrefsDock() {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-pref');
    var side = key && dockFor(key);
    if (side) setPrefsDock(side, true);
  }

  var PANELS = {
    sheet: { el: 'sheet', body: 'sheet-body', cls: 'sheet-open',
      open: function () { renderSheet(home || ST.get()); ST.setFast(true); }, close: function () { ST.setFast(false); } },
    prefs: { el: 'prefs', body: 'prefs-body', cls: 'prefs-open', close: function () {},
      open: function () {
        renderPrefs();
        var side = dockFor(prefsFocus ? prefsFocus.replace('pref-', '') : PREFS[0].key);
        if (side) setPrefsDock(side, false);
      },
      focus: function () { var k = prefsFocus; prefsFocus = null; return k ? $('prefs-body').querySelector('[data-key="' + k + '"]') : null; } },
    places: { el: 'places', body: 'places-body', cls: 'places-open', open: function () { renderPlaces('cities'); }, close: function () {},
      focus: function () { var b = $('places-body'); return b.querySelector('.place.sel') || b.querySelector('[data-nav]'); } },
    themes: { el: 'themes', body: 'themes-body', cls: 'themes-open', open: renderThemes, close: function () {},
      focus: function () { return $('themes-body').querySelector('[data-theme="' + prefs.theme + '"]'); } }
  };
  var prefsFocus = null;
  var slideTimer = null;
  function afterSlide(el, fn) {
    var done = false;
    function end(e) { if (e && (e.target !== el || e.propertyName !== 'transform')) return; if (done) return; done = true; el.removeEventListener('transitionend', end); clearTimeout(slideTimer); fn(); }
    el.addEventListener('transitionend', end);
    clearTimeout(slideTimer); slideTimer = setTimeout(end, 700);
  }
  function syncScenePause() {
    if (window.TVScene) TVScene.pause(!!panel || (window.TVScreens ? TVScreens.current() !== 'home' : false));
  }
  function openPanel(name) {
    if (panel || (name === 'sheet' && (!ST || prefs.home === 'off'))) return;
    var P = PANELS[name], el = $(P.el);
    panel = name; lastKeyAt = Date.now();
    syncScenePause();
    P.open();
    el.classList.add('moving');
    document.body.classList.add(P.cls);
    afterSlide(el, function () {
      if (panel !== name) return;
      el.classList.remove('moving');
      document.body.classList.add('settled');
      focusEl((P.focus && P.focus()) || $(P.body).querySelector('[data-nav]'));
    });
  }
  function closePanel() {
    if (!panel) return;
    var P = PANELS[panel];
    panel = null;
    if (window.TVScene) TVScene.hold(600);
    syncScenePause();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $(P.el).classList.add('moving');
    document.body.classList.remove('settled');
    document.body.classList.remove(P.cls);
    P.close();
  }
  function findDevice(id) {
    var list = (home && home.devices) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function act(el) {
    var what = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (what === 'toggle') {
      var d = findDevice(id); if (!d) return;
      if (!d.online) { notify({ tone: 'warn', icon: 'alert', title: t('note.offlineTitle', { name: d.label }), text: t('note.offlineText') }); return; }
      var want = !d.on;
      ST.toggle(id, function (err) {
        if (err) notify({ tone: 'alert', icon: 'alert', title: t(want ? 'note.turnOnFailed' : 'note.turnOffFailed', { name: d.label }), text: t('note.commandFailedText', { err: err.message }) });
      });
    } else if (what === 'scene') {
      if (el.classList.contains('busy')) return;
      var name = el.textContent;
      el.classList.add('busy');
      ST.runScene(id, function (err) {
        el.classList.remove('busy');
        if (err) notify({ tone: 'alert', icon: 'alert', title: t('note.sceneFailed', { name: name }), text: t('note.sceneFailedText', { err: err.message }) });
        else notify({ tone: 'ok', icon: 'sparkle', title: t('note.sceneDone', { name: name }), text: t('note.sceneDoneText') });
      });
    }
  }

  function diffNotify(prev, cur) {
    if (cur.phase === 'auth' && (!prev || prev.phase !== 'auth')) {
      notify({ tone: 'alert', icon: 'alert', title: t('home.authTitle'), text: t('note.authText'), ms: 20000 });
      return;
    }
    if (!prev || prev.stale || prev.phase !== 'ok' || cur.phase !== 'ok' || cur.stale) return;
    var before = {};
    prev.devices.forEach(function (d) { before[d.id] = d; });
    cur.devices.forEach(function (d) {
      var p = before[d.id]; if (!p) return;
      var room = roomOf(cur, d);
      if (d.kind === 'contact' && d.contact && p.contact && d.contact !== p.contact) {
        notify({ tone: d.contact === 'open' ? 'warn' : 'ok', icon: 'door', title: t(d.contact === 'open' ? 'note.opened' : 'note.closed', { name: nounOf(d.label) }), text: room || d.label });
      }
      if (d.kind === 'water' && d.water !== p.water) {
        if (d.water === 'wet') notify({ tone: 'alert', icon: 'drop', title: t('note.leak'), text: room ? room + ' (' + d.label + ')' : d.label, ms: 60000 });
        else if (p.water === 'wet') notify({ tone: 'ok', icon: 'drop', title: t('note.leakEnded'), text: room || d.label });
      }
      if (d.kind === 'presence' && d.presence && p.presence && d.presence !== p.presence) {
        notify({ tone: 'info', icon: 'person', title: t(d.presence === 'present' ? 'note.arrived' : 'note.left', { name: d.label }), text: cur.locationName || t('sheet.defaultName') });
      }
      if (d.battery != null && d.battery < 20 && (p.battery == null || p.battery >= 20)) {
        notify({ tone: 'warn', icon: 'battery', title: t('note.batteryLow', { name: nounOf(d.label) }), text: t('note.batteryText', { pct: pct(d.battery) }) + (room ? ', ' + room : '') });
      }
    });
  }

  var MAX_NOTES = 3, scale = 1;
  function notify(o) {
    var box = $('notes'), el = document.createElement('div');
    el.className = 'note glass moving tone-' + (o.tone || 'info');
    el.innerHTML = '<div class="note-icon">' + svg(o.icon || 'home', 34, 2) + '</div>' +
      '<div class="note-body"><div class="note-head"><span>' + esc(o.app || t('app.home')) + '</span><span>' + esc(t('time.now')) + '</span></div>' +
      '<div class="note-title">' + esc(o.title) + '</div>' + (o.text ? '<div class="note-text">' + esc(o.text) + '</div>' : '') + '</div>';
    var olds = Array.prototype.slice.call(box.children), tops = olds.map(function (n) { return n.getBoundingClientRect().top; });
    box.insertBefore(el, box.firstChild);
    olds.forEach(function (n, i) {
      var dy = (tops[i] - n.getBoundingClientRect().top) / scale;
      if (!dy) return;
      n.style.transition = 'none'; n.style.transform = 'translateY(' + dy + 'px)';
      void n.offsetHeight;
      n.style.transition = ''; n.style.transform = '';
    });
    void el.offsetHeight;
    el.classList.add('in');
    setTimeout(function () { if (!el.classList.contains('out')) el.classList.remove('moving'); }, 800);
    var live = box.querySelectorAll('.note:not(.out)');
    for (var i = MAX_NOTES; i < live.length; i++) dismiss(live[i]);
    setTimeout(function () { dismiss(el); }, o.ms || 7000);
  }
  function dismiss(el) {
    if (!el.parentNode || el.classList.contains('out')) return;
    el.classList.add('moving'); el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
  }

  function move(kc, container) {
    var nodes = Array.prototype.slice.call($(container).querySelectorAll('[data-nav]')), cur = document.activeElement;
    if (nodes.indexOf(cur) < 0) { focusEl(nodes[0]); return; }
    var r = cur.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, best = null, bs = Infinity;
    nodes.forEach(function (n) {
      if (n === cur) return;
      var b = n.getBoundingClientRect(), bx = (b.left + b.right) / 2, by = (b.top + b.bottom) / 2, p, o;
      if (kc === KEY.RIGHT) { if (bx <= cx + 4) return; if (b.bottom <= r.top || b.top >= r.bottom) return; p = b.left - r.right; o = Math.abs(by - cy); }
      else if (kc === KEY.LEFT) { if (bx >= cx - 4) return; if (b.bottom <= r.top || b.top >= r.bottom) return; p = r.left - b.right; o = Math.abs(by - cy); }
      else if (kc === KEY.DOWN) { if (by <= cy + 4) return; p = b.top - r.bottom; o = Math.abs(bx - cx); }
      else { if (by >= cy - 4) return; p = r.top - b.bottom; o = Math.abs(bx - cx); }
      var sc = Math.max(0, p) + o * 2.2;
      if (sc < bs) { bs = sc; best = n; }
    });
    if (best) focusEl(best);
  }
  window.addEventListener('keydown', function (e) {
    var kc = e.keyCode, isArrow = kc >= KEY.LEFT && kc <= KEY.DOWN, isEnter = kc === KEY.ENTER;
    var isBack = kc === KEY.ESC || kc === KEY.BACKSPACE || kc === KEY.BACK;
    lastKeyAt = Date.now();
    if (!panel) {
      var scr = window.TVScreens;
      if (scr && scr.menuActive()) { e.preventDefault(); scr.menuKey(kc); return; }
      if (scr && scr.current() !== 'home') {
        e.preventDefault();
        if (scr.screenKey(kc)) return;
        if (kc === KEY.UP) scr.openMenu(); else if (isBack) scr.go('home');
        return;
      }
      if (kc === KEY.UP && scr) { e.preventDefault(); scr.openMenu(); return; }
      if (kc === KEY.LEFT) { e.preventDefault(); openPanel('prefs'); return; }
      if (ST && (isEnter || isArrow)) { e.preventDefault(); openPanel('sheet'); }
      return;
    }
    if (panel === 'themes') {
      e.preventDefault();
      if (isBack) backToPrefs();
      else if (isEnter) chooseTheme(document.activeElement);
      else if (isArrow) move(kc, 'themes-body');
      return;
    }
    if (panel === 'places') {
      e.preventDefault();
      if (isBack) placesBack();
      else if (isEnter) choosePlace(document.activeElement);
      else if (isArrow) move(kc, 'places-body');
      return;
    }
    if (isBack) { e.preventDefault(); closePanel(); return; }
    if (panel === 'prefs') {
      e.preventDefault();
      var row = document.activeElement, rk = row && row.getAttribute && row.getAttribute('data-pref');
      if (kc === KEY.UP || kc === KEY.DOWN) { move(kc, 'prefs-body'); syncPrefsDock(); }
      else if (isEnter && rk === 'theme') openThemes();
      else if (isEnter && rk === 'prayerLoc') openPlaces();
      else if (kc === KEY.LEFT || kc === KEY.RIGHT || isEnter) stepPref(row, kc === KEY.LEFT ? -1 : 1);
      return;
    }
    if (isEnter) { e.preventDefault(); var a = document.activeElement; if (a && a.hasAttribute('data-nav')) act(a); return; }
    if (isArrow) { e.preventDefault(); move(kc, 'sheet-body'); }
  });
  $('indoor').addEventListener('click', function () { openPanel('sheet'); });
  $('scrim').addEventListener('click', function () { if (panel === 'themes') backToPrefs(); else if (panel === 'places') backToPrefs('prayerLoc'); else closePanel(); });
  $('sheet-body').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-nav]') : null;
    if (el) { focusEl(el); act(el); }
  });
  $('prefs-body').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-pref]') : null;
    if (!el) return;
    focusEl(el); syncPrefsDock();
    if (el.getAttribute('data-pref') === 'theme') openThemes(); else stepPref(el, 1);
  });
  $('places-body').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-place]') : null;
    if (el) choosePlace(el);
  });
  $('themes-body').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-theme]') : null;
    if (el) chooseTheme(el);
  });

  var prayerStarted = false, prayerNoted = {}, weatherLoc = null;
  function fmtClock(ms) { var d = new Date(ms), h = d.getHours(); return (I18N.hour12() ? ((h % 12) || 12) : pad(h)) + ':' + pad(d.getMinutes()); }
  function applyPrayer() {
    var on = !!window.TVPrayer && prefs.prayer === 'on';
    if (on && !prayerStarted) { prayerStarted = true; if (weatherLoc) TVPrayer.setAuto(weatherLoc); TVPrayer.start(function () { renderPrayer(); }); }
    renderPrayer();
  }
  function renderPrayer(atMs) {
    var card = $('prayer'), on = !!window.TVPrayer && prefs.prayer === 'on';
    card.hidden = !on;
    if (!on) return;
    var s = TVPrayer.get(), now = atMs || Date.now(), day = TVPrayer.today(now);
    if (!day || !day.next) {
      $('pr-label').textContent = t(s.phase === 'error' ? 'prayer.error' : 'prayer.loading');
      $('pr-src').textContent = ''; $('pr-left').textContent = ''; $('pr-times').innerHTML = ''; $('pr-bar').hidden = true;
      return;
    }
    var n = day.next, mins = Math.max(1, Math.ceil((n.at - now) / 60000));
    var tmr = n.tomorrow ? TVPrayer.today(new Date(now).setHours(24, 0, 1, 0)) : null;
    var list = tmr ? tmr.times : day.times;
    $('pr-bar').hidden = false;
    $('pr-label').textContent = t('prayer.until.' + n.key);
    $('pr-left').textContent = t('prayer.left', { h: Math.floor(mins / 60), m: mins % 60 });
    $('pr-fill').style.width = (clamp01((now - day.prev) / (n.at - day.prev)) * 100).toFixed(1) + '%';
    $('pr-src').textContent = s.label ? t(s.source === 'diyanet' ? 'prayer.source.diyanet' : 'prayer.source.calc', { place: s.label }) : '';
    $('pr-times').innerHTML = list.map(function (x) {
      var isNext = x.key === n.key && x.at === n.at;
      return '<div class="pr-t' + (isNext ? ' next' : x.at <= now ? ' past' : '') + '"><b>' + esc(t('prayer.' + x.key)) + '</b><span>' + fmtClock(x.at) + '</span></div>';
    }).join('');
    if (!atMs) prayerNotify(day, now, s.label);
  }
  function prayerNotify(day, now, place) {
    var mode = prefs.prayerNote, n = day.next;
    if (mode === 'off') return;
    var soon = new Date(n.at).toDateString() + n.key + 'soon', left = n.at - now;
    if (mode === 'both' && left <= 15 * 60000 && left > 14 * 60000 && !prayerNoted[soon]) {
      prayerNoted[soon] = 1;
      notify({ app: t('app.prayer'), tone: 'info', icon: 'moon', title: t('note.prayerSoon', { until: t('prayer.until.' + n.key) }), text: (place ? place + ' ' : '') + fmtClock(n.at) });
    }
    day.times.forEach(function (x) {
      var k = new Date(x.at).toDateString() + x.key + 'now';
      if (now - x.at >= 0 && now - x.at < 60000 && !prayerNoted[k]) {
        prayerNoted[k] = 1;
        notify({ app: t('app.prayer'), tone: 'info', icon: x.key === 'gunes' ? 'sun' : 'moon', title: t('note.prayerNow.' + x.key), text: (place ? place + ' ' : '') + fmtClock(x.at), ms: 12000 });
      }
    });
  }

  var homeOffTimer = null;
  function applyDevhub() {
    if (window.TVStatus) { if (prefs.devhub === 'on') TVStatus.start(); else TVStatus.stop(); }
    if (window.TVScreens) TVScreens.refresh();
  }
  function statusNote(ev) {
    var ok = ev.level === 0;
    notify({ app: t('hub.statusApp'), icon: ok ? 'check' : 'alert', tone: ok ? 'ok' : ev.level === 2 ? 'alert' : 'warn',
      title: ok ? t('note.statusOk', { name: ev.name }) : t('note.statusIssue', { name: ev.name, state: t('status.' + ev.to) }),
      text: ev.incident || t('hub.statusFrom', { provider: ev.source }) });
  }
  function setupScreens() {
    if (!window.TVScreens) return;
    TVScreens.register('home', {
      show: function () { clearTimeout(homeOffTimer); document.body.classList.remove('home-off'); syncScenePause(); },
      hide: function () {
        syncScenePause();
        clearTimeout(homeOffTimer);
        homeOffTimer = setTimeout(function () { if (TVScreens.current() !== 'home') document.body.classList.add('home-off'); }, 300);
      }
    });
    if (window.TVHub) {
      TVHub.mount();
      TVScreens.register('dev', { show: TVHub.show, hide: TVHub.hide, onKey: TVHub.onKey, enabled: function () { return prefs.devhub === 'on'; } });
    }
    TVScreens.setSettingsHandler(function () { openPanel('prefs'); });
    if (window.TVStatus) TVStatus.onTransition(statusNote);
    applyDevhub();
  }

  function applyLocale() {
    I18N.resolve(prefs.lang);
    I18N.applyStatic(document);
    clockLast = ''; tick();
    if (weather) renderWeather(weather); else if (!$('wx-range').textContent) $('wx-cond').textContent = t('wx.loading');
    if (ST && home) { renderIndoor(home); sheetHtml = ''; renderSheet(home); }
    renderCredit();
    renderPrayer();
    if (window.TVHub) TVHub.applyLocale();
  }

  function fit() {
    var o = $('outer');
    scale = Math.min(o.clientWidth / 1920, o.clientHeight / 1080) || 1;
    $('stage').style.transform = 'scale(' + scale + ')';
  }
  window.addEventListener('resize', fit);

  fit();
  I18N.resolve(prefs.lang);
  I18N.applyStatic(document);
  $('wx-cond').textContent = t('wx.loading');
  applyClock();
  if (window.TVScene) TVScene.mount($('scene'));
  applyTheme();
  setInterval(tick, 1000);
  setInterval(function () { paintSky(); paintDaylight(); paintScene(); }, 2 * 60 * 1000);
  setInterval(function () { if (panel && Date.now() - lastKeyAt > PANEL_IDLE) closePanel(); }, 5000);

  if (window.TVWeather) TVWeather.start(function (w) {
    renderWeather(w);
    if (w && w.loc) { weatherLoc = w.loc; if (prayerStarted) TVPrayer.setAuto(w.loc); }
  });
  applyPrayer();
  setupScreens();

  if (ST) {
    home = ST.get();
    renderIndoor(home);
    renderSheet(home);
    ST.onChange(function (s) {
      diffNotify(home, s);
      home = s;
      renderIndoor(s);
      renderSheet(s);
      if (s.coords && window.TVWeather) TVWeather.setHomeCoords(s.coords.lat, s.coords.lon, s.locationName);
    });
    ST.start();
  }

  window.TVDebug = { notify: notify, open: openPanel, close: closePanel,
    sky: function (hour) { var d = new Date(); if (hour != null) d.setHours(hour, 0, 0, 0); paintSky(hour == null ? 0 : d.getTime()); },
    prayer: function (h, m) { var d = new Date(); d.setHours(h, m || 0, 0, 0); renderPrayer(d.getTime()); },
    prayerNotify: function (h, m) { var d = new Date(); d.setHours(h, m || 0, 0, 0); var day = TVPrayer.today(d.getTime()); if (day) prayerNotify(day, d.getTime(), TVPrayer.get().label); },
    scene: function (cond, hour) { var d = new Date(); if (hour != null) d.setHours(hour, 0, 0, 0); if (window.TVScene) TVScene.show(true); paintScene(d.getTime(), cond || 'rain'); },
    screen: function (id) { if (window.TVScreens) TVScreens.go(id || 'dev'); },
    status: function (name, st) { if (window.TVStatus) TVStatus.simulate(name, st); },
    hubFail: function (on) { [window.TVHN, window.TVGitHub, window.TVStatus].forEach(function (m) { if (m) { m.setFail(on); m.refresh(); } }); },
    daylight: function (hour) { var d = new Date(); d.setHours(hour, 0, 0, 0); paintDaylight(d.getTime()); } };
})();
