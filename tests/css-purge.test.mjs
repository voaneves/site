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
