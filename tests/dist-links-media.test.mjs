// Per-page link, anchor, image and resource-reference integrity over the built dist.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eachPage } from './lib/each.mjs';
import { ORIGIN, loadPage, resolveInDist, INDEXABLE_ROUTES } from './lib/dist.mjs';
import { all, hasAncestor } from './lib/html.mjs';

const isHidden = (e) => e.attrs['aria-hidden'] === 'true' || hasAncestor(e, (a) => a.attrs['aria-hidden'] === 'true');
const withHref = (p) => p.q((e) => e.tag === 'a' && e.attrs.href !== undefined);

/** Split an href into {kind, pathname, hash} relative to a page route. */
function classify(href, route) {
  if (/^(mailto:|tel:)/i.test(href)) return { kind: 'contact' };
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
    const u = new URL(href.startsWith('//') ? `https:${href}` : href);
    if (u.origin === ORIGIN) return { kind: 'internal', pathname: u.pathname, hash: u.hash.slice(1), absolute: true };
    return { kind: 'external', url: u };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { kind: 'other-scheme' };
  const u = new URL(href, `${ORIGIN}${route === '/404.html' ? '/404.html' : route}`);
  return { kind: 'internal', pathname: u.pathname, hash: u.hash.slice(1) };
}

eachPage('every internal <a href> resolves to a file in dist', (p) => {
  const bad = [];
  for (const a of withHref(p)) {
    const c = classify(a.attrs.href, p.route);
    if (c.kind === 'internal' && !resolveInDist(c.pathname)) bad.push(a.attrs.href);
  }
  assert.deepEqual(bad, []);
});

eachPage('every #anchor points at an id that exists on the target page', (p) => {
  const bad = [];
  for (const a of withHref(p)) {
    const c = classify(a.attrs.href, p.route);
    if (c.kind !== 'internal' || !c.hash) continue;
    const file = resolveInDist(c.pathname);
    if (!file || !file.endsWith('.html')) continue;
    const target = loadPage(c.pathname === '/404.html' ? '/404.html' : c.pathname);
    if (!target.idSet.has(decodeURIComponent(c.hash))) bad.push(a.attrs.href);
  }
  assert.deepEqual(bad, []);
});

eachPage('no empty, "#"-only or javascript: hrefs', (p) => {
  const bad = withHref(p).filter((a) => a.attrs.href.trim() === '' || a.attrs.href.trim() === '#' || /^\s*javascript:/i.test(a.attrs.href));
  assert.equal(bad.length, 0);
});

eachPage('no plain-http:// URL in any attribute (mixed content / upgrade-insecure-requests)', (p) => {
  const bad = [];
  for (const e of p.q(() => true)) {
    for (const [k, v] of Object.entries(e.attrs)) {
      if (/^http:\/\//i.test(v) && !['xmlns', 'xmlns:xlink'].includes(k)) bad.push(`${e.tag}[${k}]=${v}`);
    }
  }
  assert.deepEqual(bad, []);
});

eachPage('external links are https', (p) => {
  const bad = withHref(p).filter((a) => classify(a.attrs.href, p.route).kind === 'external' && !a.attrs.href.startsWith('https://')).map((a) => a.attrs.href);
  assert.deepEqual(bad, []);
});

eachPage('target=_blank links carry rel=noopener', (p) => {
  const bad = p.q((e) => e.tag === 'a' && e.attrs.target === '_blank').filter((a) => !/\bnoopener\b/.test(a.attrs.rel ?? '')).map((a) => a.attrs.href);
  assert.deepEqual(bad, []);
});

eachPage('every external link has rel=noopener (credit link included)', (p) => {
  const bad = withHref(p).filter((a) => classify(a.attrs.href, p.route).kind === 'external' && !/\bnoopener\b/.test(a.attrs.rel ?? '')).map((a) => a.attrs.href);
  assert.deepEqual(bad, []);
});

eachPage('third-party links opening a new tab also carry noreferrer', (p) => {
  const bad = p.q((e) => e.tag === 'a' && e.attrs.target === '_blank' && !/noreferrer/.test(e.attrs.rel ?? '')).map((a) => a.attrs.href);
  assert.deepEqual(bad, []);
});

eachPage('mailto links carry a single well-formed address', (p) => {
  for (const a of withHref(p).filter((x) => x.attrs.href.startsWith('mailto:'))) {
    assert.match(a.attrs.href, /^mailto:[^\s@?]+@[^\s@?]+\.[a-z]{2,}(\?[^\s]*)?$/i);
  }
});

eachPage('WhatsApp links use wa.me with the configured number and an encoded text', (p) => {
  for (const a of withHref(p).filter((x) => x.attrs.href.includes('wa.me'))) {
    const u = new URL(a.attrs.href);
    assert.equal(u.protocol, 'https:');
    assert.equal(u.hostname, 'wa.me');
    assert.match(u.pathname, /^\/\d{12,13}$/);
    assert.ok((u.searchParams.get('text') ?? '').length > 10, 'prefilled text');
    assert.ok(!/\s/.test(a.attrs.href), 'unencoded whitespace in URL');
  }
});

eachPage('download links point at an existing file', (p) => {
  for (const a of p.q((e) => e.tag === 'a' && e.attrs.download !== undefined)) {
    const f = resolveInDist(a.attrs.href);
    assert.ok(f, `${a.attrs.href} missing`);
    assert.ok(fs.statSync(f).size > 10_000, `${a.attrs.href} is suspiciously small`);
  }
});

eachPage('no link points at a different locale than the page (except the language switch and the brand-credit)', (p) => {
  const bad = [];
  for (const a of withHref(p)) {
    const c = classify(a.attrs.href, p.route);
    if (c.kind !== 'internal' || c.absolute) continue;
    const toEn = c.pathname.startsWith('/en/');
    const isSwitch = a.attrs['aria-label'] && /^(EN|PT)\b/.test(a.attrs['aria-label']);
    if (p.locale === 'pt-BR' && toEn && !isSwitch && p.route !== '/404.html') bad.push(a.attrs.href);
    if (p.locale === 'en' && !toEn && !isSwitch && /^\/(projetos|privacidade)/.test(c.pathname)) bad.push(a.attrs.href);
  }
  assert.deepEqual(bad, []);
});

eachPage('the primary nav has no duplicate hrefs', (p) => {
  const nav = p.q((e) => e.tag === 'nav' && e.attrs.class?.includes('vn-navbar__nav'))[0];
  const hrefs = all(nav, 'a').map((a) => a.attrs.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

// ---- images ------------------------------------------------------------------------------------------
eachPage('every <img> has an alt attribute (empty only when decorative)', (p) => {
  const bad = [];
  for (const i of p.q('img')) {
    if (i.attrs.alt === undefined) bad.push(`${i.attrs.src} has no alt`);
    else if (i.attrs.alt.trim() === '' && !(isHidden(i) || i.attrs.role === 'presentation' || i.attrs.role === 'none')) bad.push(`${i.attrs.src} has empty alt but is not decorative`);
  }
  assert.deepEqual(bad, []);
});

eachPage('every informative alt is descriptive (>= 8 chars) and not a filename', (p) => {
  const bad = p.q('img').filter((i) => i.attrs.alt && (i.attrs.alt.length < 8 || /\.(webp|png|jpe?g|svg)$/i.test(i.attrs.alt) || /^(image|img|foto|imagem|logo)$/i.test(i.attrs.alt.trim()))).map((i) => `${i.attrs.src}: "${i.attrs.alt}"`);
  assert.deepEqual(bad, []);
});

eachPage('every <img> declares intrinsic width and height (no layout shift)', (p) => {
  const bad = p.q('img').filter((i) => !/^\d+$/.test(i.attrs.width ?? '') || !/^\d+$/.test(i.attrs.height ?? '') || Number(i.attrs.width) === 0 || Number(i.attrs.height) === 0).map((i) => i.attrs.src);
  assert.deepEqual(bad, []);
});

eachPage('every <img src> exists in dist and is a modern format', (p) => {
  for (const i of p.q('img')) {
    assert.ok(i.attrs.src, 'img without src');
    assert.ok(resolveInDist(i.attrs.src), `${i.attrs.src} missing in dist`);
    assert.match(i.attrs.src, /\.(webp|avif|svg|png)$/i, `${i.attrs.src}: use webp/avif`);
  }
});

eachPage('declared img dimensions match the file aspect ratio (WebP header)', (p) => {
  for (const i of p.q('img')) {
    const f = resolveInDist(i.attrs.src);
    if (!f?.endsWith('.webp')) continue;
    const b = fs.readFileSync(f);
    if (b.toString('ascii', 0, 4) !== 'RIFF') continue;
    const fmt = b.toString('ascii', 12, 16);
    let w, h;
    if (fmt === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
    else if (fmt === 'VP8L') { const v = b.readUInt32LE(21); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
    else if (fmt === 'VP8X') { w = b.readUIntLE(24, 3) + 1; h = b.readUIntLE(27, 3) + 1; }
    else continue;
    const declared = Number(i.attrs.width) / Number(i.attrs.height);
    const real = w / h;
    assert.ok(Math.abs(declared - real) / real < 0.02, `${i.attrs.src}: declared ${i.attrs.width}x${i.attrs.height} vs file ${w}x${h}`);
  }
});

eachPage('at most one fetchpriority=high image, and only an eager one', (p) => {
  const high = p.q((e) => e.tag === 'img' && e.attrs.fetchpriority === 'high');
  assert.ok(high.length <= 1);
  for (const h of high) assert.notEqual(h.attrs.loading, 'lazy');
});

eachPage('below-the-fold images are lazy: at most 2 eager images, none after the first section', (p) => {
  const imgs = p.q('img');
  const eager = imgs.filter((i) => i.attrs.loading !== 'lazy');
  assert.ok(eager.length <= 2, `${eager.length} eager images`);
  for (const i of imgs) assert.ok(['async', 'sync', 'auto'].includes(i.attrs.decoding), `decoding on ${i.attrs.src}`);
  if (imgs.length) {
    assert.notEqual(imgs[0].attrs.loading, 'lazy', 'the LCP candidate (first image) must not be lazy');
    for (const i of imgs.slice(1)) assert.equal(i.attrs.loading, 'lazy', `${i.attrs.src} should be lazy`);
  }
});

eachPage('the LCP image of the page is preloaded when it is the hero portrait', (p) => {
  const preload = p.link('preload', (e) => e.attrs.as === 'image');
  assert.equal(preload.length, 1);
  assert.equal(preload[0].attrs.fetchpriority, 'high');
  assert.ok(resolveInDist(preload[0].attrs.href));
  assert.equal(p.q('img')[0].attrs.src, preload[0].attrs.href);
}, { routes: ['/', '/en/'] });

eachPage('the LCP image of a case study is eager + high priority', (p) => {
  const hero = p.q('img')[0];
  assert.equal(hero.attrs.loading, 'eager');
  assert.equal(hero.attrs.fetchpriority, 'high');
}, { routes: INDEXABLE_ROUTES.filter((r) => /proje/.test(r) && !/privacidade|privacy/.test(r) && r.split('/').filter(Boolean).length >= 2) });

// ---- other resource references ---------------------------------------------------------------------
eachPage('every <script src>, stylesheet and preload resolves in dist and is same-origin (or Cloudflare analytics)', (p) => {
  const refs = [
    ...p.q((e) => e.tag === 'script' && e.attrs.src).map((e) => e.attrs.src),
    ...p.q((e) => e.tag === 'link' && ['stylesheet', 'preload', 'modulepreload', 'manifest'].includes(e.attrs.rel)).map((e) => e.attrs.href),
  ];
  for (const r of refs) {
    if (r.startsWith('https://static.cloudflareinsights.com/')) continue;
    assert.ok(r.startsWith('/'), `${r} must be site-absolute`);
    assert.ok(resolveInDist(r.split('?')[0]), `${r} missing in dist`);
  }
});

eachPage('font preloads are woff2, crossorigin and exist', (p) => {
  for (const l of p.link('preload', (e) => e.attrs.as === 'font')) {
    assert.match(l.attrs.href, /\.woff2$/);
    assert.ok(l.attrs.crossorigin !== undefined, 'font preload needs crossorigin');
    assert.equal(l.attrs.type, 'font/woff2');
    assert.ok(resolveInDist(l.attrs.href));
  }
});

eachPage('the web manifest is linked (or inherited) and resolvable', (p) => {
  const m = p.link('manifest');
  for (const l of m) assert.ok(resolveInDist(l.attrs.href));
});

eachPage('no <iframe>, <object>, <embed> or <form> (frame-src none, object-src none)', (p) => {
  assert.equal(p.q((e) => ['iframe', 'object', 'embed', 'form', 'frame'].includes(e.tag)).length, 0);
});

eachPage('every <svg><use href="#id"> references a symbol defined on the page', (p) => {
  const bad = [];
  for (const u of p.q('use')) {
    const h = u.attrs.href ?? u.attrs['xlink:href'];
    if (h?.startsWith('#') && !p.idSet.has(h.slice(1))) bad.push(h);
  }
  assert.deepEqual(bad, []);
});

eachPage('inline <script> blocks are classic/module only (no eval-ish document.write)', (p) => {
  for (const s of p.q((e) => e.tag === 'script' && !e.attrs.src && e.attrs.type !== 'application/ld+json')) {
    const code = s.children[0]?.text ?? '';
    assert.doesNotMatch(code, /document\.write\(|\beval\(|new Function\(/);
  }
});
