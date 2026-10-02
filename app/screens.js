(function () {
  'use strict';

  var MENU_IDLE = 8000, KEY = { LEFT: 37, RIGHT: 39, DOWN: 40, ENTER: 13 }, BACK = [27, 8, 10009];
  var screens = [], cur = 'home', menuOn = false, menuIdx = 0, menuTimer = null, settings = function () {};

  function get(id) { for (var i = 0; i < screens.length; i++) if (screens[i].id === id) return screens[i]; return null; }
  function usable(s) { return !!s && (!s.enabled || s.enabled()); }
  function items() { return screens.filter(usable).map(function (s) { return s.id; }).concat(['settings']); }
  function paint() {
    var its = items(), list = document.querySelectorAll('#menu .mi');
    for (var i = 0; i < list.length; i++) {
      var k = list[i].getAttribute('data-screen');
      list[i].hidden = k !== 'settings' && !usable(get(k));
      list[i].classList.toggle('on', k === cur);
      list[i].classList.toggle('focus', menuOn && k === its[menuIdx]);
    }
    document.body.classList.toggle('menu-on', menuOn);
  }
  function register(id, o) { o.id = id; screens.push(o); paint(); }
  function go(id) {
    var next = get(id), prev = get(cur);
    if (!usable(next) || id === cur) return;
    cur = id;
    if (prev) document.body.classList.remove('scr-' + prev.id);
    document.body.classList.add('scr-' + id);
    if (next.show) next.show();
    if (prev && prev.hide) prev.hide();
    paint();
  }
  function poke() { clearTimeout(menuTimer); menuTimer = setTimeout(closeMenu, MENU_IDLE); }
  function openMenu() { menuOn = true; menuIdx = Math.max(0, items().indexOf(cur)); poke(); paint(); }
  function closeMenu() { menuOn = false; clearTimeout(menuTimer); paint(); }
  function choose(k) { closeMenu(); if (k === 'settings') settings(); else go(k); }
  function menuKey(kc) {
    var its = items();
    poke();
    if (kc === KEY.LEFT) menuIdx = Math.max(0, menuIdx - 1);
    else if (kc === KEY.RIGHT) menuIdx = Math.min(its.length - 1, menuIdx + 1);
    else if (kc === KEY.ENTER || kc === KEY.DOWN) { choose(its[menuIdx]); return; }
    else if (BACK.indexOf(kc) >= 0) { closeMenu(); return; }
    paint();
  }
  function screenKey(kc) { var s = get(cur); return !!(s && s.onKey && s.onKey(kc)); }
  function refresh() {
    if (!usable(get(cur))) go('home');
    menuIdx = Math.min(menuIdx, items().length - 1);
    paint();
  }
  var menuEl = document.getElementById('menu');
  if (menuEl) menuEl.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.mi') : null;
    if (el) choose(el.getAttribute('data-screen'));
  });
  document.body.classList.add('scr-home');

  window.TVScreens = {
    register: register, go: go, openMenu: openMenu, closeMenu: closeMenu, menuKey: menuKey, screenKey: screenKey, refresh: refresh,
    current: function () { return cur; },
    menuActive: function () { return menuOn; },
    setSettingsHandler: function (fn) { settings = fn; }
  };
})();
