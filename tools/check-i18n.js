#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');

const sandbox = { navigator: { language: 'tr-TR' }, document: { documentElement: {} }, Intl };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('i18n.js'), sandbox);
const langs = fs.readdirSync(path.join(APP, 'i18n')).filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
langs.forEach((l) => vm.runInContext(read('i18n/' + l + '.js'), sandbox));
const dicts = {};
langs.forEach((l) => { dicts[l] = sandbox.I18N.dict(l); });

let problems = 0;
const report = (msg) => { problems++; console.log('  ✗ ' + msg); };

const all = new Set();
langs.forEach((l) => Object.keys(dicts[l]).forEach((k) => all.add(k)));
langs.forEach((l) => all.forEach((k) => { if (!(k in dicts[l])) report(l + '.js is missing: ' + k); }));

const used = new Set();
const app = read('app.js'), html = read('index.html');
const i18nCore = read('i18n.js');
for (const src of [app, i18nCore]) for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
for (const m of app.matchAll(/t\((\w+) \? '([\w.]+)' : '([\w.]+)'/g)) { used.add(m[2]); used.add(m[3]); }
for (const m of html.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)) used.add(m[1]);
sandbox.TVThemes = null;
vm.runInContext(read('themes.js'), sandbox);
sandbox.TVThemes.all().forEach((x) => used.add('theme.' + x.id));
const prefsSrc = app.slice(app.indexOf('var PREFS = ['), app.indexOf('].filter(function (p)'));
for (const m of prefsSrc.matchAll(/\{ key: '(\w+)'/g)) used.add('pref.' + m[1]);
for (const m of prefsSrc.matchAll(/\{ key: '(\w+)'[^\n]*?options: \[(.*)\] \}/g)) {
  for (const o of m[2].matchAll(/\['(\w+)'(?:, '([^']*)')?\]/g)) if (!o[2]) used.add('pref.' + m[1] + '.' + o[1]);
}
for (const m of app.matchAll(/\? '(clear|mostlyClear|partly|overcast|fog|drizzle|rain|freezingRain|snow|showers|snowShowers|storm)'/g)) used.add('wx.' + m[1]);
['Home', 'Away', 'Night'].forEach((m) => used.add('mode.' + m));
for (const m of app.matchAll(/'(prefs\.(?:group|row)\.\w+)'/g)) used.add(m[1]);
const pk = /var KEYS = \[([^\]]*)\]/.exec(read('prayer.js'));
(pk ? pk[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)) : []).forEach((k) => { used.add('prayer.' + k); used.add('prayer.until.' + k); used.add('note.prayerNow.' + k); });
const extraSrc = ['screens.js', 'devhub.js', 'status.js', 'smartthings.js'].filter((f) => fs.existsSync(path.join(APP, f))).map(read);
for (const src of extraSrc) {
  for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
  for (const m of src.matchAll(/'((?:hub|status|menu|note|aria)\.[\w.]+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]);
}
const lv = /var LEVEL = \{([^}]*)\}/.exec(read('status.js'));
(lv ? lv[1].match(/(\w+):/g).map((x) => x.slice(0, -1)) : []).forEach((k) => used.add('status.' + k));
used.forEach((k) => langs.forEach((l) => { if (!(k in dicts[l])) report(l + '.js does not define (used in code): ' + k); }));

const unused = [...all].filter((k) => !used.has(k) && !app.includes("'" + k + "'") && !extraSrc.some((s) => s.includes("'" + k + "'")));
console.log('Languages: ' + langs.join(', ') + ' | keys: ' + all.size + ' | used in code: ' + used.size);
if (unused.length) console.log('  (info) keys not referenced directly in code: ' + unused.join(', '));
if (problems) { console.log(problems + ' problem(s).'); process.exit(1); }
console.log('OK: dictionaries match and every key used in code is defined.');
