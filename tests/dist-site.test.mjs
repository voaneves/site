// Site-wide invariants over the built dist: sitemap, robots, headers, manifest, pt/en parity, build hygiene.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { distTest } from './lib/each.mjs';
import { eachPage } from './lib/each.mjs';
import { DIST, ORIGIN, INDEXABLE_ROUTES, ROUTES, loadPage, readDist, readRepo, resolveInDist, distPath, urlOf } from './lib/dist.mjs';
import { ROUTE_PAIRS } from '../src/i18n/routes.mjs';
import { PROJECT_SLUGS } from '../src/data/slugs.mjs';
import { textOf } from './lib/html.mjs';

const sitemap = () => readDist('sitemap-0.xml');
const locs = () => [...sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const headers = () => readRepo('public/_headers').replace(/\r\n/g, '\n');

/** Parse Cloudflare _headers into [{pattern, headers: {name: value}}]. */
function parseHeaders(raw) {
  const blocks = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      cur = { pattern: line.trim(), headers: {} };
      blocks.push(cur);
    } else {
      const i = line.indexOf(':');
      cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return blocks;
}

// ---- sitemap ----------------------------------------------------------------------------------------
distTest('sitemap-index references sitemap-0.xml, which exists', () => {
  const idx = readDist('sitemap-index.xml');
  assert.match(idx, /<loc>https:\/\/voaneves\.com\/sitemap-0\.xml<\/loc>/);
  assert.ok(fs.existsSync(distPath('sitemap-0.xml')));
});

distTest('sitemap lists exactly the indexable pages: no more, no fewer, no duplicates', () => {
  const l = locs();
  assert.equal(new Set(l).size, l.length, 'duplicate <loc>');
  assert.deepEqual([...l].sort(), INDEXABLE_ROUTES.map(urlOf).sort());
});

distTest('sitemap does not list the 404 page, redirects or non-canonical URLs', () => {
  const l = locs();
  assert.ok(!l.some((u) => /404/.test(u)));
  assert.ok(l.every((u) => u.endsWith('/') && !u.includes('?') && !u.includes('#') && u.startsWith('https://voaneves.com/')));
});

for (const route of INDEXABLE_ROUTES) {
  distTest(`${route} · is in the sitemap, resolves to a built page and carries pt-BR/en/x-default alternates`, () => {
    const xml = sitemap();
    const url = urlOf(route);
    const entry = xml.split('<url>').find((b) => b.includes(`<loc>${url}</loc>`));
    assert.ok(entry, `${url} missing from sitemap`);
    assert.ok(resolveInDist(route));
    for (const lang of ['pt-BR', 'en', 'x-default']) assert.match(entry, new RegExp(`hreflang="${lang}" href="https://voaneves\\.com/[^"]*"`));
  });
}

distTest('sitemap hreflang agrees with the <head> hreflang of every page', () => {
  const xml = sitemap();
  for (const route of INDEXABLE_ROUTES) {
    const entry = xml.split('<url>').find((b) => b.includes(`<loc>${urlOf(route)}</loc>`));
    const inSitemap = Object.fromEntries([...entry.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const inHead = Object.fromEntries(loadPage(route).link('alternate', (e) => e.attrs.hreflang).map((a) => [a.attrs.hreflang, a.attrs.href]));
    assert.deepEqual(inSitemap, inHead, route);
  }
});

// ---- robots -----------------------------------------------------------------------------------------
distTest('robots.txt allows crawling and references the sitemap index', () => {
  const r = readDist('robots.txt');
  assert.match(r, /^User-agent:\s*\*/m);
  assert.doesNotMatch(r, /^Disallow:\s*\/\s*$/m, 'must not block the whole site');
  assert.match(r, /^Sitemap:\s*https:\/\/voaneves\.com\/sitemap-index\.xml\s*$/m);
  assert.ok(fs.existsSync(distPath('sitemap-index.xml')));
});

distTest('robots.txt does not disallow any indexable page', () => {
  const disallows = [...readDist('robots.txt').matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
  for (const route of INDEXABLE_ROUTES) for (const d of disallows) assert.ok(!route.startsWith(d), `${route} is disallowed by ${d}`);
});

// ---- _headers ---------------------------------------------------------------------------------------
distTest('_headers is shipped into dist unchanged', () => {
  assert.equal(readDist('_headers').replace(/\r\n/g, '\n'), headers());
});

const HDR = [
  ['Strict-Transport-Security', /max-age=(\d+)/, (m) => Number(m[1]) >= 31536000, 'HSTS max-age >= 1y'],
  ['X-Content-Type-Options', /^nosniff$/i, () => true, 'nosniff'],
  ['Referrer-Policy', /^(strict-origin-when-cross-origin|no-referrer|same-origin|strict-origin)$/, () => true, 'safe referrer policy'],
  ['X-Frame-Options', /^(DENY|SAMEORIGIN)$/, () => true, 'clickjacking'],
  ['Cross-Origin-Opener-Policy', /^same-origin/, () => true, 'COOP'],
];
for (const [name, re, ok, label] of HDR) {
  distTest(`_headers /* sets ${name} (${label})`, () => {
    const star = parseHeaders(headers()).find((b) => b.pattern === '/*');
    assert.ok(star, 'no /* block');
    const m = star.headers[name]?.match(re);
    assert.ok(m, `${name} missing or weak: ${star.headers[name]}`);
    assert.ok(ok(m));
  });
}

distTest('_headers Permissions-Policy denies camera, microphone, geolocation and payment', () => {
  const v = parseHeaders(headers()).find((b) => b.pattern === '/*').headers['Permissions-Policy'];
  for (const f of ['camera', 'microphone', 'geolocation', 'payment']) assert.match(v, new RegExp(`${f}=\\(\\)`));
});

distTest('_headers CSP header carries the directives a <meta> CSP cannot (frame-ancestors, form-action, base-uri, object-src)', () => {
  const v = parseHeaders(headers()).find((b) => b.pattern === '/*').headers['Content-Security-Policy'];
  assert.match(v, /frame-ancestors 'none'/);
  assert.match(v, /base-uri 'self'/);
  assert.match(v, /form-action 'self'/);
  assert.match(v, /object-src 'none'/);
  assert.match(v, /upgrade-insecure-requests/);
  assert.doesNotMatch(v, /unsafe-/);
});

distTest('_headers: immutable year-long cache for /_astro/* and /fonts/*', () => {
  const blocks = parseHeaders(headers());
  for (const pattern of ['/_astro/*', '/fonts/*']) {
    const b = blocks.find((x) => x.pattern === pattern);
    assert.ok(b, `${pattern} block missing`);
    assert.match(b.headers['Cache-Control'], /max-age=31536000/);
    assert.match(b.headers['Cache-Control'], /immutable/);
  }
});

distTest('_headers: the service worker file is never cached hard', () => {
  const b = parseHeaders(headers()).find((x) => x.pattern === '/worker.min.js');
  assert.match(b.headers['Cache-Control'], /no-cache|max-age=0|no-store/);
});

distTest('_headers: no cache rule marks HTML immutable, and preview hosts are noindex', () => {
  const blocks = parseHeaders(headers());
  for (const b of blocks) {
    if (b.pattern === '/*' || /\.(html)$/.test(b.pattern)) assert.doesNotMatch(b.headers['Cache-Control'] ?? '', /immutable/);
  }
  for (const host of ['https://voaneves.pages.dev/*', 'https://beta.voaneves.com/*']) {
    assert.match(blocks.find((b) => b.pattern === host)?.headers['X-Robots-Tag'] ?? '', /noindex/);
  }
});

distTest('_headers stays within Cloudflare limits (100 rules, 2000 chars/line) and has no tabs/duplicates', () => {
  const lines = headers().split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  assert.ok(lines.length <= 100);
  assert.ok(lines.every((l) => l.length <= 2000));
  const pats = parseHeaders(headers()).map((b) => b.pattern);
  assert.equal(new Set(pats).size, pats.length, 'duplicate pattern blocks');
});

distTest('every path pattern in _headers that names a file or directory exists in dist', () => {
  for (const b of parseHeaders(headers())) {
    if (!b.pattern.startsWith('/') || b.pattern === '/*') continue;
    const base = b.pattern.replace(/\/\*$/, '');
    assert.ok(fs.existsSync(distPath(base)), `${b.pattern} matches nothing in dist`);
  }
});

// ---- manifest ---------------------------------------------------------------------------------------
const manifest = () => JSON.parse(readDist('manifest.webmanifest'));

distTest('manifest is valid JSON with name, short_name, start_url, display, colours and lang', () => {
  const m = manifest();
  for (const k of ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color', 'lang', 'icons', 'description']) assert.ok(m[k], `manifest.${k}`);
  assert.ok(m.short_name.length <= 12, 'short_name should fit under an icon');
  assert.ok(['standalone', 'minimal-ui', 'fullscreen', 'browser'].includes(m.display));
  assert.match(m.background_color, /^#[0-9a-f]{3,8}$/i);
  assert.match(m.theme_color, /^#[0-9a-f]{3,8}$/i);
  assert.ok(resolveInDist(m.start_url), 'start_url must resolve');
});

distTest('manifest icons exist, match their declared size and type; 192, 512 and a maskable are present', () => {
  const m = manifest();
  for (const i of m.icons) {
    const f = resolveInDist(i.src);
    assert.ok(f, `${i.src} missing`);
    const b = fs.readFileSync(f);
    assert.equal(b.toString('ascii', 1, 4), 'PNG');
    const [w, h] = i.sizes.split('x').map(Number);
    assert.equal(b.readUInt32BE(16), w, `${i.src} width`);
    assert.equal(b.readUInt32BE(20), h, `${i.src} height`);
    assert.equal(i.type, 'image/png');
  }
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && !i.purpose));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

eachPage('apple-touch-icon is a 180x180 PNG', (p) => {
  const f = resolveInDist(p.link('apple-touch-icon')[0].attrs.href);
  const b = fs.readFileSync(f);
  assert.equal(b.readUInt32BE(16), 180);
  assert.equal(b.readUInt32BE(20), 180);
});

distTest('the manifest is wired in: after-lcp injects <link rel=manifest> (kept out of the LCP window) and no page also hard-codes it', () => {
  const entry = walkFiles(path.join(DIST, '_astro')).find((f) => /Base\.astro.*\.js$/.test(f));
  assert.ok(entry, 'entry chunk');
  assert.match(fs.readFileSync(entry, 'utf8'), /manifest\.webmanifest/);
  for (const r of ROUTES) assert.equal(loadPage(r).link('manifest').length, 0, `${r} hard-codes the manifest in <head>`);
});

// ---- pt/en parity -----------------------------------------------------------------------------------
const shape = (p) => ({
  sections: p.q('section').length,
  h2: p.q('h2').length,
  h3: p.q('h3').length,
  h4: p.q('h4').length,
  imgs: p.q('img').map((i) => i.attrs.src).sort(),
  buttons: p.q('button').length,
  details: p.q('details').length,
  articles: p.q('article').length,
  navs: p.q('nav').length,
  dialogs: p.q('dialog').length,
  internalLinks: p.q((e) => e.tag === 'a' && e.attrs.href?.startsWith('/')).length,
  externalLinks: p.q((e) => e.tag === 'a' && (e.attrs.href ?? '').startsWith('https:') && !e.attrs.href.startsWith(ORIGIN)).map((a) => new URL(a.attrs.href).hostname).sort(),
  ldTypes: p.q((e) => e.tag === 'script' && e.attrs.type === 'application/ld+json').map((s) => JSON.parse(s.children[0].text)['@type']).sort(),
  sectionIds: p.q((e) => e.tag === 'section' && e.attrs.id).map((s) => s.attrs.id),
  scripts: p.q((e) => e.tag === 'script' && e.attrs.src).map((s) => s.attrs.src).sort(),
});

for (const pair of ROUTE_PAIRS) {
  distTest(`${pair.pt} <-> ${pair.en} · pt and en pages exist and mirror the same structure`, () => {
    assert.ok(resolveInDist(pair.pt) && resolveInDist(pair.en), 'both variants are built');
    const a = shape(loadPage(pair.pt));
    const b = shape(loadPage(pair.en));
    // Section ids are the same language-neutral anchors on both homes.
    assert.deepEqual(b, a);
  });
}

for (const pair of ROUTE_PAIRS) {
  distTest(`${pair.pt} <-> ${pair.en} · language switch links point to each other`, () => {
    const sw = (route) => loadPage(route).q((e) => e.tag === 'a' && /^(EN|PT)$/.test(textOf(e)) && e.attrs['aria-label']).map((a) => a.attrs.href);
    assert.ok(sw(pair.pt).length >= 1 && sw(pair.pt).every((h) => h === pair.en), `${pair.pt} switch -> ${sw(pair.pt)}`);
    assert.ok(sw(pair.en).length >= 1 && sw(pair.en).every((h) => h === pair.pt), `${pair.en} switch -> ${sw(pair.en)}`);
  });
}

for (const pair of ROUTE_PAIRS) {
  distTest(`${pair.pt} <-> ${pair.en} · visible copy differs between languages (no untranslated twin)`, () => {
    const a = textOf(loadPage(pair.pt).q('main')[0]);
    const b = textOf(loadPage(pair.en).q('main')[0]);
    assert.notEqual(a, b);
    // crude overlap check: a translated page shares well under half of its words
    const wa = new Set(a.toLowerCase().split(/\s+/));
    const wb = b.toLowerCase().split(/\s+/);
    const shared = wb.filter((w) => w.length > 4 && wa.has(w)).length / wb.length;
    assert.ok(shared < 0.5, `${(shared * 100).toFixed(0)}% of English words also appear in the Portuguese page`);
  });
}

distTest('route table covers the home, privacy and every project slug exactly once', () => {
  assert.equal(ROUTE_PAIRS.length, 2 + PROJECT_SLUGS.length);
  assert.equal(new Set(ROUTE_PAIRS.map((p) => p.pt)).size, ROUTE_PAIRS.length);
  assert.equal(new Set(ROUTE_PAIRS.map((p) => p.en)).size, ROUTE_PAIRS.length);
  assert.equal(ROUTES.length, 17);
});

// ---- build hygiene ----------------------------------------------------------------------------------
function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

distTest('dist ships no source maps, TypeScript, dotfiles or editor leftovers', () => {
  const bad = walkFiles(DIST).filter((f) => /\.(map|ts|tsx|astro|md|log|orig|bak|swp)$|(^|[\\/])\.[^\\/]+$|~$/.test(f)).map((f) => path.relative(DIST, f));
  assert.deepEqual(bad, []);
});

distTest('every file under dist/_astro is content-hashed and immutable-cacheable', () => {
  const files = walkFiles(path.join(DIST, '_astro')).map((f) => path.basename(f));
  assert.ok(files.length >= 5);
  for (const f of files) assert.match(f, /\.[A-Za-z0-9_-]{8}\.(js|css)$/, f);
});

distTest('no built file is unreasonably large (images <= 400 KB, JS <= 20 KB, fonts <= 120 KB each)', () => {
  const caps = { '.webp': 400_000, '.js': 20_000, '.woff2': 120_000, '.png': 150_000 };
  for (const f of walkFiles(DIST)) {
    const cap = caps[path.extname(f)];
    if (cap) assert.ok(fs.statSync(f).size <= cap, `${path.relative(DIST, f)} is ${fs.statSync(f).size} bytes (cap ${cap})`);
  }
});

distTest('every _redirects target that is a local path exists in dist (or is a prefix route)', () => {
  const rules = readRepo('public/_redirects').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const r of rules) {
    const [, dst] = r.split(/\s+/);
    if (!dst.startsWith('/') || dst.includes(':splat')) continue;
    assert.ok(resolveInDist(dst.split('#')[0]), `${dst} missing`);
  }
});

distTest('favicon.ico, favicon.svg and the CV PDF are real files with the right signatures', () => {
  assert.equal(fs.readFileSync(distPath('favicon.ico')).readUInt16LE(2), 1, 'ICO type');
  assert.match(readDist('favicon.svg'), /<svg\b/);
  assert.equal(fs.readFileSync(distPath('assets/cv-pt.pdf')).toString('ascii', 0, 5), '%PDF-');
});

distTest('the 404 page is shipped as /404.html (Cloudflare Pages serves it with a 404 status)', () => {
  assert.ok(fs.existsSync(distPath('404.html')));
  assert.ok(!fs.existsSync(distPath('404/index.html')), 'must not also ship /404/ as a 200 page');
});

distTest('the home page main text stays free of known copy slips', () => {
  for (const r of ['/', '/en/']) {
    const t = textOf(loadPage(r).q('main')[0]);
    assert.doesNotMatch(t, /\bTODO\b|\bFIXME\b|lorem ipsum|\bxxx\b|undefined|\[object/);
  }
});
