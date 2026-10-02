(function () {
  'use strict';

  var dicts = {}, lang = 'en', locale = 'en-GB';
  var NAV = String(navigator.language || 'en-GB');
  var DEFAULT_LOCALE = { tr: 'tr-TR', en: 'en-GB' };

  function add(code, dict) { dicts[code] = dict; }
  function fill(str, p) { return String(str).replace(/\{(\w+)\}/g, function (_, k) { return p && p[k] != null ? p[k] : ''; }); }
  function t(key, p) {
    var v = dicts[lang] && dicts[lang][key];
    if (v == null) v = dicts.en && dicts.en[key];
    if (v == null) return key;
    return typeof v === 'function' ? v(p || {}, api) : fill(v, p);
  }
  function resolve(pref) {
    lang = pref && pref !== 'auto' ? pref : (/^tr/i.test(NAV) ? 'tr' : 'en');
    if (!dicts[lang]) lang = 'en';
    locale = NAV.toLowerCase().indexOf(lang) === 0 ? NAV : DEFAULT_LOCALE[lang];
    document.documentElement.lang = lang;
  }
  function hour12() {
    try { return !!new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12; } catch (e) { return false; }
  }
  function num(v, digits) {
    try { return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v); } catch (e) { return v.toFixed(digits); }
  }
  function hourLabel(h) {
    var d = new Date(2000, 0, 1, h);
    try { return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(d); } catch (e) { return (h < 10 ? '0' : '') + h; }
  }
  function usesFahrenheit() { return /-(US|LR|MM)\b/i.test(locale); }
  function applyStatic(root) {
    var list = (root || document).querySelectorAll('[data-i18n]'), i;
    for (i = 0; i < list.length; i++) list[i].textContent = t(list[i].getAttribute('data-i18n'));
    list = (root || document).querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < list.length; i++) list[i].setAttribute('aria-label', t(list[i].getAttribute('data-i18n-aria')));
    document.title = t('app.title');
  }

  var api = {
    add: add, t: t, resolve: resolve, hour12: hour12, num: num, hourLabel: hourLabel,
    usesFahrenheit: usesFahrenheit, applyStatic: applyStatic,
    lang: function () { return lang; }, locale: function () { return locale; }, dict: function (code) { return dicts[code]; }
  };
  window.I18N = api;
})();
