(function () {
  'use strict';

  var THEMES = [
    { id: 'sky' },
    { id: 'daylight' },
    { id: 'weather' },
    { id: 'dark' },
    { id: 'autumn', q: 'autumn landscape' },
    { id: 'forest', q: 'forest' },
    { id: 'sea', q: 'sea coast' },
    { id: 'mountains', q: 'mountains' },
    { id: 'winter', q: 'winter snow landscape' },
    { id: 'city', q: 'city skyline night' },
    { id: 'stars', q: 'milky way' },
    { id: 'space', q: 'nebula' }
  ];
  var CACHE = 'tvtheme_v2_';
  var MAX_AGE = 3 * 24 * 60 * 60 * 1000;
  var API = 'https://commons.wikimedia.org/w/api.php';

  function find(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return null; }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function plain(html) {
    try { return (new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; }
  }
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
  function query(obj) {
    var out = [];
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) out.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
    return out.join('&');
  }

  var pending = {};
  function photos(id, cb) {
    var t = find(id);
    if (!t || !t.q) { cb(null, []); return; }
    var c = load(CACHE + id);
    if (c && c.items && c.items.length && Date.now() - c.at < MAX_AGE) { cb(null, c.items); return; }
    if (pending[id]) { pending[id].push(cb); return; }
    pending[id] = [cb];
    function done(err, items) { var q = pending[id]; delete pending[id]; q.forEach(function (f) { f(err, items); }); }
    getJSON(API + '?' + query({
      action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: 6, gsrlimit: 40,
      gsrsearch: t.q + ' incategory:Featured_pictures_on_Wikimedia_Commons filetype:bitmap',
      prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: 1920, iiextmetadatafilter: 'Artist|LicenseShortName'
    }), function (err, j) {
      if (err) { done(err, (c && c.items) || []); return; }
      var pages = (j.query && j.query.pages) || {}, items = [];
      for (var k in pages) {
        var ii = pages[k].imageinfo && pages[k].imageinfo[0];
        if (!ii || !ii.thumburl || ii.width < 1920 || ii.width < ii.height * 1.4) continue;
        var md = ii.extmetadata || {}, artist = plain(md.Artist && md.Artist.value).slice(0, 60), lic = plain(md.LicenseShortName && md.LicenseShortName.value);
        items.push({ url: ii.thumburl, thumb: ii.thumburl.replace(/\/1920px-/, '/500px-'), artist: artist, license: lic });
      }
      if (items.length) store(CACHE + id, { at: Date.now(), items: items });
      done(null, items.length ? items : ((c && c.items) || []));
    });
  }

  window.TVThemes = {
    all: function () { return THEMES.slice(); },
    find: find,
    isPhoto: function (id) { var t = find(id); return !!(t && t.q); },
    photos: photos
  };
})();
