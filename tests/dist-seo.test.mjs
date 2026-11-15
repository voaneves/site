// Per-page SEO / head metadata invariants over the built dist (17 pages).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eachPage, distTest } from './lib/each.mjs';
import { ROUTES, INDEXABLE_ROUTES, ORIGIN, loadPage, urlOf, resolveInDist, localeOf } from './lib/dist.mjs';
import { routeAlternates } from '../src/i18n/routes.mjs';
import { all } from './lib/html.mjs';

const IDX = { routes: INDEXABLE_ROUTES };

const alternates = (p) =>
  Object.fromEntries(p.link('alternate', (e) => e.attrs.hreflang).map((a) => [a.attrs.hreflang, a.attrs.href]));

eachPage('has a doctype and is UTF-8 with a responsive viewport', (p) => {
  assert.match(p.html.trimStart(), /^<!doctype html>/i);
  const vp = p.meta('viewport') ?? '';
  assert.ok(vp.includes('width=device-width'), 'viewport width=device-width');
  assert.ok(!vp.includes('user-scalable=no'), 'must not disable zoom');
  assert.ok(!vp.includes('maximum-scale=1'), 'must not cap zoom');
  const cs = all(p.head, (e) => e.tag === 'meta' && e.attrs.charset)[0];
  assert.equal(cs?.attrs.charset.toLowerCase(), 'utf-8');
  assert.ok(p.html.indexOf('charset') < 1024, 'charset must be within the first 1024 bytes');
});

eachPage('<title> is non-empty, single and 10-70 chars', (p) => {
  assert.equal(all(p.head, 'title').length, 1);
  assert.ok(p.title.length >= 10 && p.title.length <= 70, `title length ${p.title.length}: "${p.title}"`);
});

eachPage(
  '<title> is unique across the site',
  (p) => {
    const dupes = ROUTES.filter((r) => r !== p.route && loadPage(r).title === p.title);
    assert.deepEqual(dupes, [], `same title as ${dupes.join(', ')}`);
  },
  IDX,
);

eachPage('<title> carries the brand', (p) => {
  assert.match(p.title, /Victor Neves/);
});

eachPage('meta description is 50-160 chars (404: >=20), trimmed, single-spaced', (p) => {
  const d = p.meta('description');
  assert.ok(d, 'description missing');
  const min = p.kind === '404' ? 20 : 50;
  assert.ok(d.length >= min && d.length <= 160, `description length ${d.length}`);
  assert.equal(d, d.trim());
  assert.ok(!/\s{2,}/.test(d), 'description has repeated whitespace');
});

eachPage(
  'meta description is unique across indexable pages',
  (p) => {
    const d = p.meta('description');
    const dupes = INDEXABLE_ROUTES.filter((r) => r !== p.route && loadPage(r).meta('description') === d);
    assert.deepEqual(dupes, []);
  },
  IDX,
);

eachPage(
  'exactly one canonical, absolute https on the production origin, equal to its own URL',
  (p) => {
    const c = p.link('canonical');
    assert.equal(c.length, 1, 'exactly one canonical');
    assert.ok(c[0].attrs.href.startsWith(`${ORIGIN}/`), c[0].attrs.href);
    assert.equal(c[0].attrs.href, urlOf(p.route));
    assert.ok(!c[0].attrs.href.includes('?') && !c[0].attrs.href.includes('#'));
  },
  IDX,
);

eachPage(
  'the error page must not canonicalise to a URL that does not exist',
  (p) => {
    const c = p.link('canonical')[0]?.attrs.href;
    if (!c) return; // no canonical is fine for an error page
    assert.ok(resolveInDist(new URL(c).pathname), `canonical ${c} resolves to nothing in dist (it would 404)`);
  },
  { routes: ['/404.html'] },
);

eachPage(
  'hreflang pt-BR, en and x-default exist once each and match the route table',
  (p) => {
    const alts = p.link('alternate', (e) => e.attrs.hreflang);
    assert.equal(alts.length, 3, 'exactly three hreflang links, no duplicates');
    const by = alternates(p);
    assert.deepEqual(Object.keys(by).sort(), ['en', 'pt-BR', 'x-default']);
    const expected = Object.fromEntries(routeAlternates(`${ORIGIN}${p.route}`).map((a) => [a.lang, a.url]));
    assert.deepEqual(by, expected);
    assert.equal(by['x-default'], by['pt-BR'], 'x-default is the pt-BR page');
  },
  IDX,
);

eachPage(
  'hreflang targets are absolute and resolve to built pages',
  (p) => {
    for (const a of p.link('alternate', (e) => e.attrs.hreflang)) {
      assert.match(a.attrs.href, /^https:\/\/voaneves\.com\//);
      assert.ok(resolveInDist(new URL(a.attrs.href).pathname), `${a.attrs.hreflang} -> ${a.attrs.href} not built`);
    }
  },
  IDX,
);

eachPage(
  'hreflang is reciprocal (the target lists this page back, with the same set)',
  (p) => {
    const mine = alternates(p);
    for (const [lang, href] of Object.entries(mine)) {
      const theirs = alternates(loadPage(new URL(href).pathname));
      assert.deepEqual(theirs, mine, `${lang} page ${href} disagrees about the alternate set`);
      assert.ok(Object.values(theirs).includes(urlOf(p.route)), `${href} does not link back to ${p.route}`);
    }
  },
  IDX,
);

eachPage('Open Graph: type, title, description, url, image are present and mirror the head', (p) => {
  const keys = ['og:type', 'og:title', 'og:description', 'og:image', ...(p.kind === '404' ? [] : ['og:url'])];
  for (const k of keys) {
    assert.ok(p.meta(k), `${k} missing`);
  }
  assert.equal(p.meta('og:title'), p.title);
  assert.equal(p.meta('og:description'), p.meta('description'));
});

eachPage(
  'og:url equals the canonical',
  (p) => {
    assert.equal(p.meta('og:url'), p.link('canonical')[0].attrs.href);
  },
  IDX,
);

eachPage('og:image is absolute, exists in dist and declares 1200x630', (p) => {
  const img = p.meta('og:image');
  assert.match(img, /^https:\/\/voaneves\.com\/.+\.(webp|png|jpe?g)$/);
  const f = resolveInDist(new URL(img).pathname);
  assert.ok(f, `og:image ${img} not in dist`);
  assert.ok(fs.statSync(f).size > 1024, 'og:image suspiciously small');
  assert.equal(p.meta('og:image:width'), '1200');
  assert.equal(p.meta('og:image:height'), '630');
});

eachPage('Twitter card: summary_large_image with title, description and image', (p) => {
  assert.equal(p.meta('twitter:card'), 'summary_large_image');
  assert.equal(p.meta('twitter:title'), p.title);
  assert.equal(p.meta('twitter:description'), p.meta('description'));
  assert.equal(p.meta('twitter:image'), p.meta('og:image'));
});

eachPage('<html lang> matches the locale and the WebSite JSON-LD agrees', (p) => {
  assert.equal(p.htmlEl.attrs.lang, localeOf(p.route));
  const ld = p
    .q((e) => e.tag === 'script' && e.attrs.type === 'application/ld+json')
    .map((s) => JSON.parse(s.children[0].text));
  const web = ld.find((j) => j['@type'] === 'WebSite');
  assert.equal(web.inLanguage, localeOf(p.route));
});

eachPage(
  'page is indexable: no noindex robots meta',
  (p) => {
    assert.ok(!/noindex/i.test(p.meta('robots') ?? ''));
  },
  IDX,
);

eachPage('theme-color meta and icons are declared and resolvable', (p) => {
  assert.match(p.meta('theme-color') ?? '', /^#[0-9a-f]{6}$/i);
  const icons = p.link('icon');
  assert.ok(icons.length >= 2, 'favicon .ico + .svg');
  for (const l of [...icons, ...p.link('apple-touch-icon')]) {
    assert.ok(resolveInDist(l.attrs.href), `${l.attrs.href} missing in dist`);
  }
});

eachPage('head has no duplicate meta names/properties', (p) => {
  const keys = all(p.head, 'meta')
    .map((m) => m.attrs.name ?? m.attrs.property ?? m.attrs['http-equiv'] ?? (m.attrs.charset ? 'charset' : undefined))
    .filter(Boolean);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
});

eachPage('head has no placeholder leakage (undefined / [object / NaN / lorem)', (p) => {
  const head = p.html
    .slice(0, p.html.indexOf('</head>'))
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(head, /undefined|\[object|\bNaN\b|lorem ipsum/i);
});

distTest('every canonical across the site is unique', () => {
  const cs = ROUTES.map((r) => loadPage(r).link('canonical')[0]?.attrs.href).filter(Boolean);
  assert.equal(new Set(cs).size, cs.length);
});

distTest('pt and en variants of the same page have different titles (no untranslated copy)', () => {
  const same = [];
  for (let i = 0; i < INDEXABLE_ROUTES.length; i += 2) {
    const [pt, en] = [INDEXABLE_ROUTES[i], INDEXABLE_ROUTES[i + 1]];
    if (loadPage(pt).title === loadPage(en).title) same.push(`${pt} == ${en}`);
  }
  assert.deepEqual(same, []);
});
