// Brand CSS purge (scripts/lib/css-purge.mjs, wired in astro.config.mjs): dead brand rules and custom properties
// stay out of the inline CSS, live ones survive. Reads the built dist/index.html.
import assert from 'node:assert/strict';
import { distTest } from './lib/each.mjs';
import { readDist } from './lib/dist.mjs';
import { DEAD_CLASSES, DEAD_PROPERTIES } from '../scripts/lib/css-purge.mjs';

const inlineCss = () => [...readDist('index.html').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
// A name is "present" only as a whole token: `.vn-drawer` must not match `.vn-drawer__link`.
const hasClass = (css, name) => new RegExp(String.raw`\.${name}(?![\w-])`).test(css);
const hasProp = (css, name) => new RegExp(String.raw`${name}(?![\w-])`).test(css);

distTest('purge: no denylisted brand class survives in the inline <style>', () => {
  const css = inlineCss();
  for (const name of DEAD_CLASSES) assert.ok(!hasClass(css, name), `.${name} still in the inline CSS`);
});

distTest('purge: no denylisted brand custom property survives in the inline <style>', () => {
  const css = inlineCss();
  for (const name of DEAD_PROPERTIES) assert.ok(!hasProp(css, name), `${name} still in the inline CSS`);
});

distTest('purge: classes in use stay (a prefix of a dead class is not a dead class)', () => {
  const css = inlineCss();
  for (const name of ['vn-spec-list', 'vn-cursor', 'vn-cursor__dot', 'vn-drawer__link', 'vn-timeline-item']) {
    assert.ok(hasClass(css, name), `.${name} missing from the inline CSS`);
  }
});

distTest('purge: the denylist never names the drawer parts or the mobile drawer that are in use', () => {
  for (const name of ['vn-mobile-drawer', 'vn-drawer__link', 'vn-drawer__close', 'vn-drawer__num', 'vn-sec-tag-dark', 'vn-timeline-item']) {
    assert.ok(!DEAD_CLASSES.includes(name), name + ' must not be on the denylist');
  }
});

distTest('purge: --vn-radius-xl is still defined (read by sections/case.css)', () => {
  assert.match(inlineCss(), /--vn-radius-xl:/);
});

// ---- Plugin unit tests: postcss over input strings, with a fake `from` inside / outside the brand package ----
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import cssPurge, { BRAND_DIR } from '../scripts/lib/css-purge.mjs';
import { ROOT } from './lib/dist.mjs';

const IN_BRAND = `/fake/node_modules/${BRAND_DIR}components.css`;
const IN_BRAND_WIN = path.win32.join('C:\\fake\\node_modules', ...BRAND_DIR.split('/'), 'components.css');
const OUTSIDE = '/fake/src/styles/sections/own.css';
const run = (css, from) => postcss([cssPurge()]).process(css, { from }).css;
const squash = (css) => css.replace(/\s+/g, ' ').trim();

test('purge unit: a denylisted class and custom property are removed when they come from the brand', () => {
  const out = run('.vn-field{color:red}.vn-keep{color:blue}:root{--vn-viz-1:#000;--vn-keep:1}', IN_BRAND);
  assert.ok(!hasClass(out, 'vn-field'), out);
  assert.ok(!hasProp(out, '--vn-viz-1'), out);
  assert.ok(hasClass(out, 'vn-keep'), out);
  assert.ok(hasProp(out, '--vn-keep'), out);
});

test('purge unit: Windows-style paths inside the brand dir count as the brand too', () => {
  const out = run('.vn-field{color:red}.vn-keep{color:blue}', IN_BRAND_WIN);
  assert.ok(!hasClass(out, 'vn-field') && hasClass(out, 'vn-keep'), out);
});

test('purge unit: the same declarations from outside the brand are preserved byte for byte', () => {
  const css = '.vn-field{color:red}.vn-keep{color:blue}:root{--vn-viz-1:#000;--vn-keep:1}';
  assert.equal(run(css, OUTSIDE), css);
  assert.equal(run(css, undefined), css);
});

for (const fn of ['not', 'is', 'where', 'has']) {
  test(`purge unit: a dead class inside :${fn}() fails loudly (brand only)`, () => {
    const css = `.a:${fn}(.vn-field){color:red}`;
    assert.throws(() => run(css, IN_BRAND), /functional pseudo-class/);
    assert.equal(run(css, OUTSIDE), css, 'outside the brand it is left alone');
  });
}

test('purge unit: a live class inside :not() is fine', () => {
  const css = '.a:not(.vn-keep){color:red}';
  assert.equal(run(css, IN_BRAND), css);
});

test('purge unit: an @media (and nested @supports) left empty is removed, a live sibling stays', () => {
  const out = squash(run('@media (min-width:1px){.vn-field{color:red}}@supports (display:grid){@media (min-width:2px){.vn-field{color:red}}}.vn-keep{color:blue}', IN_BRAND));
  assert.equal(out, '.vn-keep{color:blue}');
  const kept = squash(run('@media (min-width:1px){.vn-field{color:red}.vn-keep{color:blue}}', IN_BRAND));
  assert.equal(kept, '@media (min-width:1px){.vn-keep{color:blue}}');
});

test('purge unit: an @keyframes left empty is removed', () => {
  // Synthetic (a real keyframes holds from/to), but it exercises the same empty-ancestor path.
  const out = squash(run('@keyframes x{.vn-field{opacity:0}}@keyframes y{from{opacity:0}to{opacity:1}}', IN_BRAND));
  assert.equal(out, '@keyframes y{from{opacity:0}to{opacity:1}}');
});

test('purge unit: a rule whose only declaration was a dead custom property is removed with its at-rule', () => {
  const out = squash(run('@media (min-width:1px){:root{--vn-viz-1:#000}}:root{--vn-keep:1}', IN_BRAND));
  assert.equal(out, ':root{--vn-keep:1}');
});

test('purge unit: a partly dead selector list keeps only the live selectors', () => {
  assert.equal(squash(run('.vn-field,.vn-keep{color:red}', IN_BRAND)), '.vn-keep{color:red}');
  assert.equal(squash(run('.a .vn-field__input,.b > .c,.vn-drawer .d{color:red}', IN_BRAND)), '.b > .c{color:red}');
  // a longer class name that only starts like a dead one is not dead
  assert.equal(squash(run('.vn-drawer__link,.vn-field{color:red}', IN_BRAND)), '.vn-drawer__link{color:red}');
});

test('purge unit: an @layer block left empty is kept (removing it could reorder the layers)', () => {
  assert.equal(squash(run('@layer vn.x{.vn-field{color:red}}', IN_BRAND)), '@layer vn.x{}');
  assert.equal(squash(run('@layer vn.x{@media (min-width:1px){.vn-field{color:red}}}', IN_BRAND)), '@layer vn.x{}');
  assert.equal(squash(run('@layer vn.x{:root{--vn-viz-1:#000}}', IN_BRAND)), '@layer vn.x{}');
  // the order statement and a non-empty layer are untouched
  assert.equal(squash(run('@layer vn.a,vn.b;@layer vn.b{.vn-field{color:red}.vn-keep{color:blue}}', IN_BRAND)), '@layer vn.a,vn.b;@layer vn.b{.vn-keep{color:blue}}');
});

// ---- The real brand CSS: guards against the purge silently doing nothing (path no longer matches, brand changed) ----
const BRAND_CSS_DIR = path.join(ROOT, 'node_modules', ...BRAND_DIR.split('/'));
const brandFiles = () => (fs.existsSync(BRAND_CSS_DIR) ? fs.readdirSync(BRAND_CSS_DIR).filter((f) => f.endsWith('.css')) : []);

test('purge guard: the brand CSS dir that the plugin matches on exists and has CSS files', () => {
  assert.ok(fs.existsSync(BRAND_CSS_DIR), `${BRAND_CSS_DIR} is missing: BRAND_DIR (${BRAND_DIR}) no longer matches where the brand package lives, so the purge would be a no-op`);
  assert.ok(brandFiles().length > 0, `no .css files in ${BRAND_CSS_DIR}`);
});

test('purge guard: running the plugin over the real brand files (real paths) removes denylisted names that were there', () => {
  const stats = { classes: 0, props: 0 };
  for (const f of brandFiles()) {
    const file = path.join(BRAND_CSS_DIR, f);
    const src = fs.readFileSync(file, 'utf8');
    const out = postcss([cssPurge()]).process(src, { from: file }).css;
    for (const name of DEAD_CLASSES) {
      if (hasClass(src, name)) stats.classes++;
      assert.ok(!hasClass(out, name), `.${name} survived the purge in ${f}`);
    }
    for (const name of DEAD_PROPERTIES) {
      if (hasProp(src, name)) stats.props++;
      assert.ok(!hasProp(out, name), `${name} survived the purge in ${f}`);
    }
  }
  assert.ok(stats.classes > 0 && stats.props > 0, `the real brand CSS holds no denylisted class/property (${JSON.stringify(stats)}): either the brand dropped them (trim the denylist) or the purge is being tested against nothing`);
});

distTest('purge guard: the built page really came through the purge (the brand source has dead names, the dist has none)', () => {
  const css = inlineCss();
  const brandSrc = brandFiles().map((f) => fs.readFileSync(path.join(BRAND_CSS_DIR, f), 'utf8')).join('\n');
  const inSource = [...DEAD_CLASSES.filter((n) => hasClass(brandSrc, n)), ...DEAD_PROPERTIES.filter((n) => hasProp(brandSrc, n))];
  assert.ok(inSource.length > 0, 'the brand source has no denylisted names: nothing for the purge to act on, the dist test above would pass vacuously');
  const survivors = inSource.filter((n) => (n.startsWith('--') ? hasProp(css, n) : hasClass(css, n)));
  assert.deepEqual(survivors, [], `the purge did not act on the dist: ${survivors.join(', ')} still in the inline CSS (BRAND_DIR no longer matches the brand file path?)`);
  assert.ok(css.length > 10000, 'the inline CSS is suspiciously small: was the brand included at all?');
});
