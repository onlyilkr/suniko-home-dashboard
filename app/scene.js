(function () {
  'use strict';

  var root = null, precip = null, pctx = null, stars = null, starCv = null, flashEl = null;
  var CPAD = 90, CW = 2720 + 2 * CPAD, CH = 860 + CPAD, CS = 0.5, CBLUR = 28;
  var shown = false, paused = false, held = 0, raf = 0, lastT = 0, parts = [], kind = null, rate = 0, flashAt = 0, dim = false;
  var sig = '';
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function classify(code) {
    if (code == null) return { cond: 'clear', clouds: 3 };
    if (code === 0) return { cond: 'clear', clouds: 1 };
    if (code === 1) return { cond: 'clear', clouds: 4 };
    if (code === 2) return { cond: 'partly', clouds: 8 };
    if (code === 3) return { cond: 'overcast', clouds: 16 };
    if (code === 45 || code === 48) return { cond: 'fog', clouds: 5 };
    if (code >= 51 && code <= 57) return { cond: 'rain', clouds: 14, precip: 'rain', rate: 150, light: true };
    if (code >= 61 && code <= 67) return { cond: 'rain', clouds: 16, precip: 'rain', rate: code === 65 || code === 67 ? 460 : 320 };
    if (code >= 80 && code <= 82) return { cond: 'rain', clouds: 15, precip: 'rain', rate: code === 82 ? 520 : 400 };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { cond: 'snow', clouds: 14, precip: 'snow', rate: code === 75 || code === 86 ? 340 : 230 };
    if (code >= 95) return { cond: 'storm', clouds: 18, precip: 'rain', rate: 520, flash: true };
    return { cond: 'overcast', clouds: 12 };
  }
  var FORCE = { clear: 0, partly: 2, overcast: 3, fog: 45, drizzle: 51, rain: 63, showers: 81, snow: 73, storm: 95 };

  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  function lum(c) { return (c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722) / 255; }
  function cap(c, max) { var l = lum(c); return l > max ? c.map(function (v) { return v * max / l; }) : c; }
  var TINT = { clear: null, partly: null, overcast: ['#6f7c8b', 0.6], fog: ['#9aa3ab', 0.75], rain: ['#56647a', 0.72], snow: ['#9aa8ba', 0.7], storm: ['#262c3c', 0.82] };

  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function mount(container) {
    root = container;
    root.innerHTML = '<div class="sc-sun"><div class="sc-rays"></div><div class="sc-disc"></div></div><div class="sc-moon"></div>' +
      '<div class="sc-stars"></div><canvas class="sc-clouds a"></canvas><canvas class="sc-clouds b"></canvas>' +
      '<div class="sc-hills"></div><div class="sc-fog"></div><canvas class="sc-precip" width="1920" height="1080"></canvas><div class="sc-flash"></div>';
    precip = root.querySelector('.sc-precip'); pctx = precip.getContext('2d');
    stars = root.querySelector('.sc-stars'); flashEl = root.querySelector('.sc-flash');
    var cvs = root.querySelectorAll('.sc-clouds');
    for (var i = 0; i < cvs.length; i++) { cvs[i].width = Math.ceil(CW * CS); cvs[i].height = Math.ceil(CH * CS); }
    document.addEventListener('visibilitychange', loop);
  }

  function clouds(cv, n, color, seed) {
    var r = rng(seed), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(CS, 0, 0, CS, CPAD * CS, CPAD * CS);
    c.filter = 'blur(' + (CBLUR * CS) + 'px)';
    c.fillStyle = color;
    for (var i = 0; i < n; i++) {
      var w = 260 + r() * 420, x = r() * 2600, y = r() * 380, hh = w * (0.35 + r() * 0.2);
      c.beginPath(); c.ellipse(x + w / 2, y + hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2); c.fill();
    }
    c.filter = 'none';
  }
  function hills(c) {
    var r = rng(7);
    function path(base, amp, freq, ph) {
      var d = 'M0 1080 L0 ' + base;
      for (var x = 0; x <= 1920; x += 40) d += ' L' + x + ' ' + (base - Math.sin(x / freq + ph) * amp - Math.sin(x / (freq * 0.37) + ph * 2) * amp * 0.35).toFixed(1);
      return d + ' L1920 1080 Z';
    }
    var trees = '';
    for (var i = 0; i < 26; i++) {
      var x = 60 + i * 72 + r() * 30, h = 40 + r() * 50, b = 1010 - Math.sin(x / 260 + 3) * 30;
      trees += '<path d="M' + x.toFixed(0) + ' ' + (b - h).toFixed(0) + ' L' + (x - h * 0.28).toFixed(0) + ' ' + b.toFixed(0) + ' L' + (x + h * 0.28).toFixed(0) + ' ' + b.toFixed(0) + ' Z" fill="' + css(c[2]) + '"/>';
    }
    root.querySelector('.sc-hills').innerHTML = '<svg width="1920" height="390" viewBox="0 690 1920 390"><path d="' + path(780, 60, 320, 1) + '" fill="' + css(c[0]) + '"/>' +
      '<path d="' + path(870, 50, 240, 2) + '" fill="' + css(c[1]) + '"/><path d="' + path(990, 34, 260, 3) + '" fill="' + css(c[2]) + '"/>' + trees + '</svg>';
  }
  function drawStars(n) {
    if (!starCv) { starCv = document.createElement('canvas'); starCv.width = 1920; starCv.height = 760; }
    var s = starCv.getContext('2d'), r = rng(11);
    s.clearRect(0, 0, 1920, 760);
    for (var i = 0; i < n; i++) { s.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7).toFixed(2) + ')'; s.beginPath(); s.arc(r() * 1920, r() * 760, r() * 1.6 + 0.3, 0, 6.283); s.fill(); }
    stars.style.backgroundImage = 'url(' + starCv.toDataURL('image/png') + ')';
  }

  function spawn(any) {
    return kind === 'snow'
      ? { x: Math.random() * 1920, y: any ? Math.random() * 1080 : -10, r: 1.4 + Math.random() * 3.2, v: 40 + Math.random() * 80, p: Math.random() * 6.28 }
      : { x: Math.random() * 2100 - 90, y: any ? Math.random() * 1080 : -40, l: (dim ? 10 : 16) + Math.random() * 16, v: 900 + Math.random() * 600 };
  }
  function draw(dt) {
    pctx.clearRect(0, 0, 1920, 1080);
    if (kind === 'rain') {
      pctx.strokeStyle = dim ? 'rgba(200,214,236,.32)' : 'rgba(210,222,240,.45)'; pctx.lineWidth = 1.6; pctx.beginPath();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i]; p.y += p.v * dt; p.x += p.v * 0.12 * dt;
        if (p.y > 1090) parts[i] = spawn(false);
        pctx.moveTo(p.x, p.y); pctx.lineTo(p.x - p.l * 0.12, p.y - p.l);
      }
      pctx.stroke();
    } else if (kind === 'snow') {
      pctx.fillStyle = 'rgba(255,255,255,.85)'; pctx.beginPath();
      for (var j = 0; j < parts.length; j++) {
        var s = parts[j]; s.y += s.v * dt; s.p += dt; s.x += Math.sin(s.p) * 18 * dt;
        if (s.y > 1090) parts[j] = spawn(false);
        pctx.moveTo(s.x + s.r, s.y); pctx.arc(s.x, s.y, s.r, 0, 6.283);
      }
      pctx.fill();
    }
  }
  function tick(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(tick);
    var dt = (now - lastT) / 1000;
    if (dt < 1 / 31) return;
    lastT = now;
    draw(Math.min(dt, 0.1));
    if (flashAt && now > flashAt) { flash(); flashAt = now + 6000 + Math.random() * 9000; }
  }
  function flash() {
    flashEl.style.transition = 'none'; flashEl.style.opacity = 0.5;
    setTimeout(function () { flashEl.style.opacity = 0.12; }, 70);
    setTimeout(function () { flashEl.style.opacity = 0.45; }, 140);
    setTimeout(function () { flashEl.style.transition = 'opacity .5s'; flashEl.style.opacity = 0; }, 210);
  }
  function running() { return shown && kind && !REDUCED && !paused && !document.hidden && Date.now() >= held; }
  function loop() {
    if (running()) { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function update(o) {
    var k = classify(o.force != null ? FORCE[o.force] : o.code), night = !o.isDay;
    if (o.force === 'drizzle') k.light = true;
    var sky = o.sky.map(function (c) { return c.slice(); }), t = TINT[k.cond];
    if (t) sky = sky.map(function (c, i) { return mix(c, rgb(t[0]).map(function (v) { return v * (night ? 0.35 : 1); }), t[1] * (i === 0 ? 0.9 : 1)); });
    sky = sky.map(function (c, i) { return cap(c, [0.24, 0.3, 0.42][i]); });
    var mid = sky[1];
    var cloudC = k.cond === 'clear' || k.cond === 'partly' ? (night ? css([60, 72, 110], 0.45) : css([236, 242, 250], 0.5))
      : k.cond === 'storm' ? css(mix(mid, [10, 12, 20], 0.5), 0.92) : k.cond === 'fog' ? css([214, 218, 222], 0.4)
      : k.cond === 'snow' ? css(mix(mid, [230, 234, 240], 0.3), 0.6) : css(mix(mid, [22, 26, 36], 0.5), 0.9);
    var hillBase = k.cond === 'snow' ? mix(mid, [236, 240, 246], night ? 0.25 : 0.55) : mix(mid, [8, 10, 18], 0.3);
    var hillC = [hillBase, mix(hillBase, [8, 10, 18], k.cond === 'snow' ? 0.12 : 0.28), mix(hillBase, [8, 10, 18], k.cond === 'snow' ? 0.24 : 0.5)];
    var s = [k.cond, night ? 'n' : 'd', k.rate || 0, k.light ? 1 : 0].join('|');
    if (s !== sig) {
      sig = s;
      clouds(root.querySelector('.sc-clouds.a'), k.clouds, cloudC, 3);
      clouds(root.querySelector('.sc-clouds.b'), Math.round(k.clouds * 0.6), cloudC, 5);
      root.querySelector('.sc-fog').style.display = k.cond === 'fog' ? '' : 'none';
      root.querySelector('.sc-fog').innerHTML = k.cond === 'fog' ? '<div class="sc-band" style="top:360px"></div><div class="sc-band" style="top:620px;animation-delay:-30s"></div><div class="sc-band" style="top:820px;animation-delay:-60s"></div>' : '';
      var clearSky = k.cond === 'clear' || k.cond === 'partly';
      root.querySelector('.sc-sun').style.display = clearSky && !night ? '' : 'none';
      root.querySelector('.sc-rays').style.display = k.cond === 'clear' ? '' : 'none';
      root.querySelector('.sc-moon').style.display = clearSky && night ? '' : 'none';
      stars.style.display = clearSky && night ? '' : 'none';
      if (clearSky && night) drawStars(k.cond === 'clear' ? 260 : 120);
      kind = k.precip || null; dim = !!k.light || night; parts = [];
      precip.style.display = kind ? '' : 'none';
      flashEl.style.display = k.flash ? '' : 'none';
      for (var i = 0; i < (k.rate || 0); i++) parts.push(spawn(true));
      flashAt = k.flash ? performance.now() + 3000 : 0;
      if (!kind) pctx.clearRect(0, 0, 1920, 1080);
      else if (REDUCED) draw(0);
    }
    hills(hillC);
    if (o.sunX != null) { var sun = root.querySelector('.sc-sun'); sun.style.left = (o.sunX / 100 * 1920 - 450).toFixed(0) + 'px'; sun.style.top = (o.sunY / 100 * 1080 - 450).toFixed(0) + 'px'; }
    loop();
    return {
      bg: 'linear-gradient(180deg, ' + css(sky[0]) + ' 0%, ' + css(sky[1]) + ' 58%, ' + css(sky[2]) + ' 100%)',
      glass: css(mix(mid.map(function (v) { return v * 0.84; }), [255, 255, 255], 0.14), 0.94),
      cond: k.cond
    };
  }
  function preview(o) {
    var k = classify(o.code), night = !o.isDay, t = TINT[k.cond], sky = o.sky.map(function (c) { return c.slice(); });
    if (t) sky = sky.map(function (c) { return mix(c, rgb(t[0]).map(function (v) { return v * (night ? 0.35 : 1); }), t[1]); });
    sky = sky.map(function (c) { return cap(c, 0.3); });
    return 'linear-gradient(180deg, ' + css(sky[0]) + ', ' + css(sky[2]) + ')';
  }

  window.TVScene = {
    mount: mount,
    update: update,
    preview: preview,
    show: function (on) { shown = !!on; if (root) root.hidden = !on; if (!on) sig = ''; loop(); },
    hold: function (ms) { held = Date.now() + (ms || 700); loop(); setTimeout(loop, (ms || 700) + 20); },
    pause: function (on) { paused = !!on; loop(); }
  };
})();
