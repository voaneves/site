// Every built <img> must reserve its intrinsic ratio: numeric width/height attributes, and no
// stylesheet rule that resets its width to `auto` (that discards the attribute-derived size and
// Chrome reports LayoutImageUnsized).
import assert from 'node:assert/strict';
import { eachPage } from './lib/each.mjs';
import { all } from './lib/html.mjs';

const num = (v) => /^[1-9]\d*(\.\d+)?$/.test(String(v ?? '').trim());

eachPage('every <img> has numeric width and height attributes', (page) => {
  const imgs = page.q((e) => e.tag === 'img');
  for (const img of imgs) {
    assert.ok(num(img.attrs.width) && num(img.attrs.height), `<img src="${img.attrs.src}"> lacks numeric width/height`);
  }
  const sources = page.q((e) => e.tag === 'source' && e.parent?.tag === 'picture');
  for (const s of sources) assert.ok(num(s.attrs.width) && num(s.attrs.height), '<source> lacks width/height');
});

eachPage('no stylesheet rule resets an <img> width to auto', (page) => {
  const css = all(page.root, 'style').map((s) => (s.children ?? []).map((c) => c.text ?? '').join('')).join('\n');
  const classes = new Set(page.q((e) => e.tag === 'img').flatMap((i) => (i.attrs.class ?? '').split(/\s+/).filter(Boolean)));
  const offenders = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, sel, body] = m;
    if (!/(^|;)\s*width:\s*auto\s*(;|$)/.test(body)) continue;
    const hit = sel.split(',').some((s) => {
      const last = s.trim().split(/[\s>+~]+/).pop();
      return /(^|[^\w-])img(?![\w-])/.test(last) || [...classes].some((c) => last.includes(`.${c}`));
    });
    if (hit) offenders.push(sel.trim());
  }
  assert.deepEqual(offenders, []);
});
