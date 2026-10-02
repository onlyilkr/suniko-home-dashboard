(function () {
  'use strict';

  var CONFIG = window.CONFIG || {};
  if (!(CONFIG.demo === true || /[?&]demo\b/.test(location.search))) return;
  window.TVDemo = true;

  var HOUR = 3600 * 1000, MIN = 60 * 1000;
  var NAMES = {
    en: { home: 'Maple Street', living: 'Living room', kitchen: 'Kitchen', bedroom: 'Bedroom', hall: 'Hallway',
      climate: 'Climate sensor', door: 'Front door', leak: 'Leak sensor', phone: 'Alex', motion: 'Hallway motion',
      floor: 'Floor lamp', ceiling: 'Ceiling light', pendant: 'Pendant', bedside: 'Bedside lamp', hallLight: 'Hallway light',
      coffee: 'Coffee machine', fan: 'Desk fan', morning: 'Good morning', movie: 'Movie night', night: 'Good night' },
    tr: { home: 'Evim', living: 'Oturma odası', kitchen: 'Mutfak', bedroom: 'Yatak odası', hall: 'Koridor',
      climate: 'Sıcaklık sensörü', door: 'Kapı', leak: 'Sızıntı sensörü', phone: 'Deniz', motion: 'Koridor hareket',
      floor: 'Lambader', ceiling: 'Tavan ışığı', pendant: 'Sarkıt lamba', bedside: 'Komodin lambası', hallLight: 'Koridor ışığı',
      coffee: 'Kahve makinesi', fan: 'Masa vantilatörü', morning: 'Günaydın', movie: 'Film gecesi', night: 'İyi geceler' }
  };
  var WEATHER = { clear: 0, partly: 2, overcast: 3, fog: 45, rain: 61, snow: 71, storm: 95 };
  var pick = /[?&]demo=(\w+)/.exec(location.search), NOW_CODE = pick && WEATHER[pick[1]] != null ? WEATHER[pick[1]] : 2;
  var SHIFT = NOW_CODE === 71 ? -22 : 0;
  var ISTANBUL = { lat: 41.0082, lon: 28.9784, name: 'Istanbul', region: 'İstanbul', country: 'TR' };

  var model = null, listeners = [];
  function build() {
    var n = NAMES[window.I18N && I18N.lang() === 'tr' ? 'tr' : 'en'], now = Date.now();
    function dev(id, label, room, kind, o) {
      var d = { id: id, label: label, roomId: room, kind: kind, online: true, temp: null, tempAt: 0, hum: null, battery: null,
        on: false, level: null, power: null, contact: null, water: null, motion: null, presence: null };
      for (var k in o) d[k] = o[k];
      return d;
    }
    return {
      phase: 'ok', error: '', stale: false, updatedAt: now, locationName: n.home, coords: { lat: ISTANBUL.lat, lon: ISTANBUL.lon },
      mode: 'Home', rooms: { r1: n.living, r2: n.kitchen, r3: n.bedroom, r4: n.hall },
      scenes: [{ id: 's1', name: n.morning }, { id: 's2', name: n.movie }, { id: 's3', name: n.night }],
      devices: [
        dev('climate', n.climate, 'r1', 'climate', { temp: 22.6, tempAt: now - 4 * MIN, hum: 48, battery: 87 }),
        dev('door', n.door, 'r4', 'contact', { contact: 'closed', battery: 92 }),
        dev('leak', n.leak, 'r2', 'water', { water: 'dry', battery: 78 }),
        dev('phone', n.phone, '', 'presence', { presence: 'present' }),
        dev('motion', n.motion, 'r4', 'motion', { motion: 'inactive' }),
        dev('floor', n.floor, 'r1', 'light', { on: true, level: 70 }),
        dev('ceiling', n.ceiling, 'r1', 'light', {}),
        dev('pendant', n.pendant, 'r2', 'light', { on: true, level: 100 }),
        dev('coffee', n.coffee, 'r2', 'plug', { power: 0 }),
        dev('bedside', n.bedside, 'r3', 'light', {}),
        dev('fan', n.fan, 'r3', 'plug', { power: 0 }),
        dev('hall', n.hallLight, 'r4', 'light', {})
      ]
    };
  }
  function snapshot() {
    if (!model) model = build();
    var s = {}; for (var k in model) s[k] = model[k];
    s.devices = model.devices.slice(); s.scenes = model.scenes.slice();
    return s;
  }
  function emit() { var s = snapshot(); listeners.forEach(function (fn) { fn(s); }); }
  function find(id) { for (var i = 0; i < model.devices.length; i++) if (model.devices[i].id === id) return model.devices[i]; return null; }

  window.STHome = {
    enabled: true,
    get: snapshot,
    onChange: function (fn) { listeners.push(fn); },
    start: function () { model = build(); emit(); },
    setFast: function () {},
    refresh: function () { emit(); },
    toggle: function (id, cb) {
      var d = find(id);
      if (!d) { (cb || function () {})(new Error('no device')); return; }
      d.on = !d.on; emit();
      (cb || function () {})(null, d.on);
    },
    runScene: function (id, cb) { setTimeout(function () { (cb || function () {})(null); }, 300); }
  };

  function forecast() {
    var now = new Date(), day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var sunrise = day0 + 7 * HOUR + 2 * MIN, sunset = day0 + 18 * HOUR + 41 * MIN;
    function isDay(ms) { var t = ms - new Date(ms).setHours(0, 0, 0, 0); return t >= 7 * HOUR + 2 * MIN && t < 18 * HOUR + 41 * MIN; }
    var hourCodes = NOW_CODE === 2 ? [2, 2, 1, 1, 0, 0] : [NOW_CODE, NOW_CODE, NOW_CODE, 2, 2, 1], hourTemps = [21, 22, 22, 21, 20, 19], hours = [];
    for (var i = 0; i < 6; i++) {
      var at = new Date(now.getTime() + (i + 1) * HOUR);
      hours.push({ hour: at.getHours(), temp: hourTemps[i] + SHIFT, code: hourCodes[i], isDay: isDay(at.getTime()), pop: [10, 10, 5, 5, 0, 0][i] });
    }
    var codes = [NOW_CODE, 3, 61, 80, 1, 0, 2], lo = [15, 14, 13, 12, 13, 15, 16], hi = [22, 20, 18, 17, 21, 23, 24], pop = [10, 30, 80, 70, 10, 0, 10], days = [];
    for (var j = 0; j < 7; j++) days.push({ date: day0 + j * 24 * HOUR, code: codes[j], lo: lo[j] + SHIFT, hi: hi[j] + SHIFT, pop: pop[j] });
    return { name: ISTANBUL.name, src: 'demo', loc: ISTANBUL, temp: 21 + SHIFT, code: NOW_CODE, isDay: isDay(now.getTime()), days: days,
      hi: hi[0] + SHIFT, lo: lo[0] + SHIFT, sunrise: sunrise, sunset: sunset, hours: hours, rainSoon: null, at: Date.now() };
  }
  window.TVWeather = {
    start: function (fn) { fn(forecast()); setInterval(function () { fn(forecast()); }, 15 * MIN); },
    setHomeCoords: function () {}
  };
})();
