#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const APP = path.join(__dirname, '..', 'app');
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
['hn.js', 'github.js', 'status.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), sandbox, { filename: f }));
const { TVHN, TVGitHub, TVStatus } = sandbox;

let failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); } }
const eq = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);

console.log('hn.js');
test('merge: orders Algolia hits by topstories', () => {
  const hits = [
    { objectID: '2', title: 'B', url: 'https://b.dev/x', points: 20, num_comments: 3, created_at_i: 200, author: 'bo', _tags: ['story'] },
    { objectID: '1', title: 'A', url: '', points: 10, num_comments: 1, created_at_i: 100, author: 'al', _tags: ['story'] }
  ];
  const m = TVHN.merge([1, 2], hits);
  eq(m.missing, []);
  eq(m.items.map((x) => x.title), ['A', 'B']);
  eq(m.items[1], { id: 2, title: 'B', url: 'https://b.dev/x', points: 20, comments: 3, time: 200, by: 'bo', job: false });
});
test('merge: ids missing from Algolia are listed and keep a null slot', () => {
  const m = TVHN.merge([5, 6], [{ objectID: '6', title: 'F', points: 1, num_comments: 0, created_at_i: 1, author: 'x', _tags: ['story'] }]);
  eq(m.missing, [5]);
  eq(m.items[0], null);
  eq(m.items[1].title, 'F');
});
test('merge: job posts (no points, job tag) get job=true, points=null', () => {
  const m = TVHN.merge([9], [{ objectID: '9', title: 'X is hiring', url: 'https://x.co/jobs', points: null, num_comments: 0, created_at_i: 5, author: 'x', _tags: ['job'] }]);
  eq([m.items[0].job, m.items[0].points], [true, null]);
});
test('merge: keeps only the first 30 ids', () => {
  const ids = Array.from({ length: 40 }, (_, i) => i + 1);
  eq(TVHN.merge(ids, []).missing.length, 30);
});
test('fromItem: maps a Firebase item to the common shape', () => {
  eq(TVHN.fromItem({ id: 7, title: 'T', url: 'https://t.io', score: 12, descendants: 4, time: 70, by: 'tt', type: 'story' }),
    { id: 7, title: 'T', url: 'https://t.io', points: 12, comments: 4, time: 70, by: 'tt', job: false });
  eq(TVHN.fromItem({ id: 8, title: 'J', type: 'job', time: 1 }).job, true);
});
test('text: <p> becomes a paragraph break, tags are dropped, entities decoded', () => {
  eq(TVHN.text('Hello <i>world</i>&#x27;s end<p>See <a href="https://x.io">x.io</a> &amp; &quot;y&quot;&#x2F;z'),
    'Hello world\'s end\n\nSee x.io & "y"/z');
});
test('text: <pre><code> content stays, extra whitespace collapses', () => {
  eq(TVHN.text('a   b<p><pre><code>  let x = 1;\n</code></pre>'), 'a b\n\nlet x = 1;');
});
test('text: a script tag survives only as plain text', () => {
  eq(TVHN.text('<script>alert(1)</script>ok'), 'alert(1)ok');
});
test('host: drops www and the port, lowercases, defaults to news.ycombinator.com', () => {
  eq([TVHN.host('https://www.Example.com/a?b'), TVHN.host('http://blog.x.dev:8080/p'), TVHN.host('')],
    ['example.com', 'blog.x.dev', 'news.ycombinator.com']);
});

console.log('github.js');
test('query: repos created in the last 7 days, by stars, 10 results', () => {
  eq(TVGitHub.query(Date.UTC(2026, 8, 30, 12)),
    'https://api.github.com/search/repositories?q=created%3A%3E2026-09-23&sort=stars&order=desc&per_page=10');
});
test('parse: fields, empty description, at most 4 topics', () => {
  const r = TVGitHub.parse({ items: [{ full_name: 'a/b', description: null, language: 'Rust', stargazers_count: 1968, forks_count: 12,
    topics: ['x', 'y', 'z', 'w', 'v'], created_at: '2026-09-25T10:00:00Z', html_url: 'https://github.com/a/b' }] });
  eq(r, [{ name: 'a/b', desc: '', lang: 'Rust', stars: 1968, forks: 12, topics: ['x', 'y', 'z', 'w'],
    created: Date.parse('2026-09-25T10:00:00Z'), url: 'https://github.com/a/b' }]);
});

console.log('status.js');
const CL = TVStatus.SOURCES[0], GH = TVStatus.SOURCES[1];
const sum = (components, incidents) => ({ components, incidents: incidents || [] });
test('shortName: drops the parenthesis, Claude API → API, Claude Console → Console', () => {
  eq(['Claude API (api.anthropic.com)', 'Claude Console (platform.claude.com)', 'Claude Code', 'claude.ai'].map((n) => TVStatus.shortName(n)),
    ['API', 'Console', 'Claude Code', 'claude.ai']);
});
test('components: drops groups and "Visit …", marks pinned ones', () => {
  const p = TVStatus.components(GH, sum([
    { name: 'Git Operations', status: 'operational' }, { name: 'Visit www.githubstatus.com for more information', status: 'operational' },
    { name: 'Group', status: 'operational', group: true }, { name: 'Pages', status: 'partial_outage' }]));
  eq(p.comps, [{ name: 'Git Operations', status: 'operational', level: 0, pinned: true },
    { name: 'Pages', status: 'partial_outage', level: 2, pinned: false }]);
  eq(p.incident, null);
});
test('components: unknown status → degraded_performance; first unresolved incident name', () => {
  const p = TVStatus.components(CL, sum([{ name: 'Claude Code', status: 'weird' }],
    [{ name: 'Old', status: 'resolved' }, { name: 'Elevated errors', status: 'investigating' }]));
  eq(p.comps[0].status, 'degraded_performance');
  eq(p.incident, 'Elevated errors');
});
test('components: incident phase; an ongoing incident wins over a monitored one, unknown → investigating', () => {
  const p = TVStatus.components(CL, sum([{ name: 'API', status: 'operational' }],
    [{ name: 'Delayed credits', status: 'monitoring' }, { name: 'Errors on API', status: 'identified' }]));
  eq([p.incident, p.phase], ['Errors on API', 'identified']);
  const q = TVStatus.components(CL, sum([], [{ name: 'Delayed credits', status: 'monitoring' }]));
  eq([q.incident, q.phase], ['Delayed credits', 'monitoring']);
  eq(TVStatus.components(CL, sum([], [{ name: 'X', status: 'weird' }])).phase, 'investigating');
  eq(TVStatus.components(CL, sum([], [])).phase, null);
});
test('strip: pinned ones in pin order + other degraded ones (max 3) + the rest as a count', () => {
  const p = TVStatus.components(CL, sum([
    { name: 'Claude Code', status: 'operational' }, { name: 'claude.ai', status: 'operational' },
    { name: 'Claude API (api.anthropic.com)', status: 'operational' }, { name: 'A', status: 'major_outage' },
    { name: 'B', status: 'under_maintenance' }, { name: 'C', status: 'partial_outage' },
    { name: 'D', status: 'degraded_performance' }, { name: 'E', status: 'operational' }]));
  const s = TVStatus.strip(CL, p);
  eq(s.list.map((c) => c.name), ['claude.ai', 'API', 'Claude Code', 'A', 'B', 'C']);
  eq(s.more, 1);
});
test('diff: an event for a pinned component whose level changes, silence for others', () => {
  const a = TVStatus.components(CL, sum([{ name: 'Claude Code', status: 'operational' }, { name: 'Other', status: 'operational' }]));
  const b = TVStatus.components(CL, sum([{ name: 'Claude Code', status: 'partial_outage' }, { name: 'Other', status: 'major_outage' }],
    [{ name: 'Errors', status: 'investigating' }]));
  eq(TVStatus.diff(CL, a, b), [{ source: 'Claude', name: 'Claude Code', from: 'operational', to: 'partial_outage', level: 2, incident: 'Errors' }]);
  eq(TVStatus.diff(CL, b, a).map((e) => [e.name, e.level]), [['Claude Code', 0]]);
});
test('diff: same level (degraded → maintenance) is silent; degraded → outage is an event', () => {
  const w = TVStatus.components(CL, sum([{ name: 'API', status: 'degraded_performance' }]));
  const m = TVStatus.components(CL, sum([{ name: 'API', status: 'under_maintenance' }]));
  const x = TVStatus.components(CL, sum([{ name: 'API', status: 'major_outage' }]));
  eq(TVStatus.diff(CL, w, m), []);
  eq(TVStatus.diff(CL, w, x).length, 1);
});
test('diff: no previous snapshot (first live poll) means no events', () => {
  eq(TVStatus.diff(CL, null, TVStatus.components(CL, sum([{ name: 'API', status: 'major_outage' }]))), []);
});

console.log(failed ? failed + ' failed, ' + passed + ' passed.' : 'OK: ' + passed + ' tests passed.');
process.exit(failed ? 1 : 0);
