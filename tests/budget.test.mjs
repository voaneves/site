import test from 'node:test';
import assert from 'node:assert/strict';
import { baseName, entryScripts, staticImports } from '../scripts/lib/js-graph.mjs';

test('staticImports: named, side-effect and minified forms', () => {
  const code = 'import{a as b}from"./x.BoKv.js";import"./y.js";import c from\'./z.js\';import * as d from "./w.js";';
  assert.deepEqual(staticImports(code), ['./x.BoKv.js', './y.js', './z.js', './w.js']);
});

test('staticImports: excludes dynamic import()', () => {
  const code = 'const m=()=>import("./lazy.js");import("./l2.js").then(x=>x);import{a}from"./s.js";';
  assert.deepEqual(staticImports(code), ['./s.js']);
});

test('staticImports: ignores non-js and member access', () => {
  assert.deepEqual(staticImports('import{a}from"./x.css";foo.import"./q.js"'), []);
});

test('entryScripts: module src, modulepreload, inline module', () => {
  const html = `<link rel="modulepreload" href="/_astro/pre.abc.js">
  <script type="application/ld+json">{"a":1}</script>
  <script>var x=1</script>
  <script type="module" src="/_astro/Base.js"></script>
  <script type="module">import"./i.js";console.log(1)</script>`;
  const r = entryScripts(html);
  assert.deepEqual(r.srcs, ['/_astro/Base.js', '/_astro/pre.abc.js'].sort((a, b) => r.srcs.indexOf(a) - r.srcs.indexOf(b)));
  assert.equal(r.srcs.length, 2);
  assert.equal(r.inline.length, 1);
  assert.match(r.inline[0], /console\.log/);
});

test('baseName and cursor prefix distinction', () => {
  assert.equal(baseName('/_astro/cursor-trail.x.js?v=1'), 'cursor-trail.x.js');
  assert.equal('cursor-trail.x.js'.startsWith('cursor.'), false);
  assert.equal('cursor.x.js'.startsWith('cursor.'), true);
});
