(function () {
  'use strict';

  var t = I18N.t;
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13 }, BACK = [27, 8, 10009];
  var PHASE_KEY = { investigating: 'hub.phase.investigating', identified: 'hub.phase.identified', monitoring: 'hub.phase.monitoring' };
  var HN_ROWS = 8, GH_ROWS = 4, COMMENT_DELAY = 400;
  var LANG_COLOR = { TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5', Rust: '#dea584', Go: '#00add8', 'C++': '#f34b7d',
    C: '#555555', 'C#': '#178600', Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', Ruby: '#701516', PHP: '#4f5d95', Shell: '#89e051', Zig: '#ec915c' };
  var ICON = {
    up: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
    chat: '<path d="M20.5 11.6c0 4.1-3.8 7.4-8.5 7.4-1.2 0-2.3-.2-3.3-.6L4 20l1.3-3.7c-1.1-1.3-1.8-2.9-1.8-4.7C3.5 7.5 7.3 4.2 12 4.2s8.5 3.3 8.5 7.4z"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'
  };
  var zone = 'hn', idx = { hn: 0, gh: 0 }, open = false, shown = false, clockTimer = null, commentTimer = null;
  var comm = { id: null, phase: 'idle', list: [] };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function svg(name, size, fill) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  function ago(ms) {
    var m = Math.floor((Date.now() - ms) / 60000);
    if (m < 1) return t('time.now');
    if (m < 60) return t('ago.min', { n: m });
    var h = Math.round(m / 60);
    return h < 24 ? t('ago.hour', { n: h }) : t('ago.day', { n: Math.round(h / 24) });
  }
  function num(n) { try { return new Intl.NumberFormat(I18N.locale()).format(n); } catch (e) { return String(n); } }
  function count(key, n) { return t(key, { n: num(n), count: n }); }
  function hn() { return window.TVHN ? TVHN.get().items : []; }
  function gh() { return window.TVGitHub ? TVGitHub.get().items : []; }
  function current() { return zone === 'hn' ? hn()[idx.hn] : gh()[idx.gh]; }
  function win(i, n, rows, ctx) { return Math.max(0, Math.min(i - ctx, n - rows)); }
  function clampIdx() {
    idx.hn = Math.max(0, Math.min(idx.hn, hn().length - 1));
    idx.gh = Math.max(0, Math.min(idx.gh, gh().length - 1));
  }

  function renderClock() {
    var d = new Date(), h = d.getHours(), m = pad(d.getMinutes());
    $('hub-clock').innerHTML = I18N.hour12()
      ? ((h % 12) || 12) + ':' + m + '<span class="hub-ampm">' + esc(t(h < 12 ? 'time.am' : 'time.pm')) + '</span>'
      : pad(h) + ':' + m;
    $('hub-date').textContent = t('date.long', { date: d });
  }
  function renderSub(el, st, key) {
    var stale = !!(st.error && st.items.length);
    el.classList.toggle('warn', stale);
    el.textContent = stale ? t('hub.stale', { ago: ago(st.at) }) : t(key);
  }
  function renderHN() {
    var st = window.TVHN ? TVHN.get() : { items: [], at: 0, error: null }, items = st.items, html = '';
    renderSub($('hub-hn-sub'), st, 'hub.hnSub');
    if (!items.length) { $('hub-hn').innerHTML = '<div class="hub-msg">' + esc(t(st.error ? 'hub.hnError' : 'hub.hnLoading')) + '</div>'; return; }
    var start = win(idx.hn, items.length, HN_ROWS, 3);
    for (var i = start; i < Math.min(items.length, start + HN_ROWS); i++) {
      var s = items[i];
      html += '<div class="hub-row' + (zone === 'hn' && i === idx.hn ? ' focus' : '') + '">' +
        '<div class="hub-rk">' + (i + 1) + '</div>' +
        '<div class="hub-tx"><div class="hub-t">' + esc(s.title) + '</div>' +
        '<div class="hub-m">' + esc(t('hub.rowMeta', { host: TVHN.host(s.url), ago: ago(s.time * 1000) })) + '</div></div>' +
        (s.job ? '<div class="hub-n hub-job">' + esc(t('hub.job')) + '</div>'
          : '<div class="hub-n hub-p">' + svg('up', 24) + esc(num(s.points)) + '</div><div class="hub-n">' + svg('chat', 24) + esc(num(s.comments)) + '</div>') +
        '</div>';
    }
    $('hub-hn').innerHTML = html;
  }
  function renderGH() {
    var st = window.TVGitHub ? TVGitHub.get() : { items: [], at: 0, error: null }, items = st.items, html = '';
    renderSub($('hub-gh-sub'), st, 'hub.ghSub');
    if (!items.length) { $('hub-gh').innerHTML = '<div class="hub-msg">' + esc(t(st.error ? 'hub.ghError' : 'hub.ghLoading')) + '</div>'; return; }
    var start = win(idx.gh, items.length, GH_ROWS, 1);
    for (var i = start; i < Math.min(items.length, start + GH_ROWS); i++) {
      var r = items[i], p = r.name.split('/');
      html += '<div class="hub-repo' + (zone === 'gh' && i === idx.gh ? ' focus' : '') + '">' +
        '<div class="hub-rn"><span>' + esc(p[0]) + '/</span>' + esc(p.slice(1).join('/')) + '</div>' +
        (r.desc ? '<div class="hub-rd">' + esc(r.desc) + '</div>' : '') +
        '<div class="hub-rm"><b>' + svg('star', 22, true) + esc(num(r.stars)) + '</b>' +
        (r.lang ? '<span><i class="hub-dot" style="background:' + (LANG_COLOR[r.lang] || '#8793a3') + '"></i>' + esc(r.lang) + '</span>' : '') +
        '</div></div>';
    }
    $('hub-gh').innerHTML = html;
  }
  function renderStatus() {
    if (!window.TVStatus) return;
    var st = TVStatus.get(), html = '', incident = null, calm = false;
    TVStatus.SOURCES.forEach(function (src) {
      var parsed = st.sources[src.id];
      html += '<div class="hub-sg"><span class="hub-sn">' + esc(src.name) + '</span>';
      if (!parsed) html += '<span class="hub-lamp lv-x"><i></i>' + esc(t('status.unknown')) + '</span>';
      else {
        var s = TVStatus.strip(src, parsed);
        s.list.forEach(function (c) {
          html += '<span class="hub-lamp lv-' + c.level + '"><i></i>' +
            esc(c.level ? t('hub.lamp', { name: c.name, state: t('status.' + c.status) }) : c.name) + '</span>';
        });
        if (s.more) html += '<span class="hub-lamp lv-more">' + esc(t('hub.more', { n: s.more })) + '</span>';
        var phase = PHASE_KEY[parsed.phase] ? parsed.phase : 'investigating';
        if (parsed.incident && (!incident || (calm && phase !== 'monitoring'))) {
          incident = t('hub.incident', { provider: src.name, phase: t(PHASE_KEY[phase]), name: parsed.incident });
          calm = phase === 'monitoring';
        }
      }
      html += '</div>';
    });
    $('hub-status').innerHTML = html + '<span class="hub-upd' + (incident ? (calm ? ' calm' : ' warn') : '') + '">' +
      esc(incident || (st.at ? t('hub.checked', { ago: ago(st.at) }) : '')) + '</span>';
  }
  function renderLists() { clampIdx(); renderHN(); renderGH(); }

  function webUrl(u) { return /^https?:\/\/[\x21-\x7e]+$/.test(u || '') ? u : ''; }
  function qrBox(url, hintKey) {
    if (!window.qrcode || !url) return '';
    var code = '';
    try { var q = qrcode(0, 'M'); q.addData(url); q.make(); code = q.createSvgTag({ cellSize: 5, margin: 0 }); } catch (e) { return ''; }
    return '<div class="hub-qr"><div class="hub-q">' + code + '</div><div class="hub-ql"><b>' + esc(t('hub.qrOpen')) + '</b>' + esc(t(hintKey)) + '</div></div>';
  }
  function commentsHtml(it) {
    if (comm.id !== it.id || comm.phase === 'loading') return '<div class="hub-cmsg">' + esc(t('hub.commentsLoading')) + '</div>';
    if (comm.phase === 'error') return '<div class="hub-cmsg">' + esc(t('hub.commentsError')) + '</div>';
    if (!comm.list.length) return '<div class="hub-cmsg">' + esc(t('hub.noComments')) + '</div>';
    return comm.list.map(function (c) {
      return '<div class="hub-c"><div class="hub-cb">' + esc(c.by) + '</div><div class="hub-ct">' + esc(c.text) + '</div></div>';
    }).join('');
  }
  function renderDetail() {
    var it = current(), html;
    if (!open || !it) return;
    if (zone === 'hn') {
      var page = 'https://news.ycombinator.com/item?id=' + it.id, meta = [TVHN.host(it.url)];
      if (!it.job) meta.push(count('hub.points', it.points), count('hub.comments', it.comments));
      meta.push(ago(it.time * 1000));
      html = '<div class="hub-dt">' + esc(it.title) + '</div><div class="hub-dm">' + esc(meta.join(', ')) + '</div>' +
        qrBox(it.job ? (webUrl(it.url) || page) : page, it.job ? 'hub.qrJob' : 'hub.qrHn') +
        (it.job ? '' : '<div class="hub-cm" id="hub-cm">' + commentsHtml(it) + '</div>');
    } else {
      var p = it.name.split('/'), meta2 = [count('hub.stars', it.stars), count('hub.forks', it.forks)];
      if (it.lang) meta2.push(it.lang);
      if (it.created) meta2.push(t('hub.created', { when: ago(it.created) }));
      html = '<div class="hub-dt"><span>' + esc(p[0]) + '/</span>' + esc(p.slice(1).join('/')) + '</div>' +
        '<div class="hub-dm">' + esc(meta2.join(', ')) + '</div>' +
        (it.desc ? '<div class="hub-dd">' + esc(it.desc) + '</div>' : '') +
        (it.topics && it.topics.length ? '<div class="hub-tp">' + it.topics.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '') +
        qrBox(webUrl(it.url), 'hub.qrRepo');
    }
    $('hub-det').innerHTML = html;
  }
  function wantComments() {
    clearTimeout(commentTimer);
    var it = current();
    if (!open || zone !== 'hn' || !it || it.job || (comm.id === it.id && comm.phase !== 'error')) return;
    comm = { id: it.id, phase: 'loading', list: [] };
    commentTimer = setTimeout(function () {
      var id = it.id;
      TVHN.comments(id, function (err, list) {
        if (comm.id !== id) return;
        comm = { id: id, phase: err ? 'error' : 'ok', list: list || [] };
        var c = current(), box = $('hub-cm');
        if (open && zone === 'hn' && c && c.id === id && box) box.innerHTML = commentsHtml(c);
      });
    }, COMMENT_DELAY);
  }
  function openDetail() { open = true; $('dev').classList.add('det-open'); renderDetail(); wantComments(); }
  function closeDetail() { open = false; clearTimeout(commentTimer); $('dev').classList.remove('det-open'); }
  function changed() { if (zone === 'hn') renderHN(); else renderGH(); if (open) { renderDetail(); wantComments(); } }

  function onKey(kc) {
    var n = zone === 'hn' ? hn().length : gh().length;
    if (kc === KEY.UP) {
      if (idx[zone] > 0) { idx[zone]--; changed(); return true; }
      return open;
    }
    if (kc === KEY.DOWN) { if (idx[zone] < n - 1) { idx[zone]++; changed(); } return true; }
    if (kc === KEY.RIGHT) { if (!open && zone === 'hn' && gh().length) { zone = 'gh'; renderLists(); } return true; }
    if (kc === KEY.LEFT) { if (!open && zone === 'gh') { zone = 'hn'; renderLists(); } return true; }
    if (kc === KEY.ENTER) { if (!open && n) openDetail(); return true; }
    if (BACK.indexOf(kc) >= 0 && open) { closeDetail(); return true; }
    return false;
  }

  function render() { renderClock(); renderLists(); renderStatus(); if (open) renderDetail(); }
  function show() {
    shown = true; zone = 'hn'; idx.hn = 0; idx.gh = 0;
    closeDetail();
    if (window.TVHN) TVHN.start();
    if (window.TVGitHub) TVGitHub.start();
    render();
    var k = 0;
    clearInterval(clockTimer);
    clockTimer = setInterval(function () { renderClock(); if (++k % 6 === 0) { renderLists(); renderStatus(); } }, 10000);
  }
  function hide() {
    shown = false;
    closeDetail();
    clearInterval(clockTimer);
    if (window.TVHN) TVHN.stop();
    if (window.TVGitHub) TVGitHub.stop();
  }
  function mount() {
    if (window.TVHN) TVHN.onChange(function () { if (shown) { renderLists(); if (open) renderDetail(); } });
    if (window.TVGitHub) TVGitHub.onChange(function () { if (shown) { renderLists(); if (open) renderDetail(); } });
    if (window.TVStatus) TVStatus.onChange(function () { if (shown) renderStatus(); });
  }

  window.TVHub = { mount: mount, show: show, hide: hide, onKey: onKey, applyLocale: function () { if (shown) render(); } };
})();
