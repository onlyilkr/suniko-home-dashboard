#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name).split(path.sep).join('/')]));

const problems = [];
const personal = new Set(['app/config.js', 'app/secrets.js']);
const appJs = walk('app').filter((f) => f.endsWith('.js') && !personal.has(f));
const toolJs = walk('tools').filter((f) => f.endsWith('.js'));

for (const f of appJs) {
  try { acorn.parse(read(f), { ecmaVersion: 5, sourceType: 'script' }); } catch (e) { problems.push(f + ': not ES5 (' + e.message + ')'); }
}

for (const f of appJs.concat(toolJs)) {
  const src = read(f);
  let comments = 0;
  try {
    acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, onComment: (block, text, start) => { if (!(start === 0 && src.startsWith('#!'))) comments++; } });
  } catch (e) { problems.push(f + ': ' + e.message); continue; }
  if (comments) problems.push(f + ': ' + comments + ' comment(s)');
}

for (const f of ['app/index.html', 'app/dev.css', 'app/config.xml', 'docs/brand/icon.svg']) {
  if (/<!--|\/\*/.test(read(f))) problems.push(f + ': comment');
}

for (const f of ['build.sh', 'gen-secrets.sh']) {
  read(f).split('\n').forEach((line, i) => { if (/^\s*#/.test(line) && !(i === 0 && line.startsWith('#!'))) problems.push(f + ':' + (i + 1) + ': comment'); });
}

const py = ['st_auth.py', 'dev-server.py'];
const pyCheck = [
  'import ast, io, sys, tokenize',
  'bad = []',
  'for f in sys.argv[1:]:',
  '    src = open(f, encoding="utf-8").read()',
  '    tree = ast.parse(src)',
  '    if [t for t in tokenize.generate_tokens(io.StringIO(src).readline) if t.type == tokenize.COMMENT and not t.string.startswith("#!")]: bad.append(f + ": comment")',
  '    for n in ast.walk(tree):',
  '        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body and isinstance(n.body[0], ast.Expr) and isinstance(getattr(n.body[0], "value", None), ast.Constant) and isinstance(n.body[0].value.value, str): bad.append(f + ": docstring")',
  'print("\\n".join(bad))'
].join('\n');
try {
  const out = execFileSync('python3', ['-c', pyCheck].concat(py), { cwd: ROOT, encoding: 'utf8' }).trim();
  if (out) out.split('\n').forEach((l) => problems.push(l));
} catch (e) {
  problems.push('python check failed: ' + e.message.split('\n')[0]);
}

if (problems.length) {
  problems.forEach((p) => console.log('  x ' + p));
  console.log(problems.length + ' problem(s).');
  process.exit(1);
}
console.log('OK: app code is ES5 and no file has comments (' + (appJs.length + toolJs.length) + ' JS files).');
