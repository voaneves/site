// Per-page CSP, inline-code and structured-data invariants over the built dist.
import assert from 'node:assert/strict';
import { eachPage, distTest } from './lib/each.mjs';
import { cspOf, parseCsp, sha256, resolveInDist, ROUTES, loadPage, ORIGIN, localeOf } from './lib/dist.mjs';

const inlineScripts = (p) => p.q((e) => e.tag === 'script' && !e.attrs.src && e.attrs.type !== 'application/ld+json');
const ldBlocks = (p) => p.q((e) => e.tag === 'script' && e.attrs.type === 'application/ld+json');
const ldDocs = (p) => ldBlocks(p).map((s) => JSON.parse(s.children[0].text));

eachPage('a CSP <meta> exists, once, in <head>', (p) => {
  const metas = p.q((e) => e.tag === 'meta' && (e.attrs['http-equiv'] ?? '').toLowerCase() === 'content-security-policy');
  assert.equal(metas.length, 1);
  assert.equal(metas[0].parent.tag, 'head');
});

eachPage('CSP has the core directives and no unsafe-inline / unsafe-eval / wildcard sources', (p) => {
  const csp = parseCsp(cspOf(p));
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.deepEqual(csp['frame-src'], ["'none'"]);
  assert.ok(csp['script-src'] && csp['style-src'] && csp['img-src'] && csp['font-src'] && csp['connect-src'] && csp['manifest-src']);
  const flat = Object.values(csp).flat();
  assert.ok(!flat.includes("'unsafe-inline'"), "'unsafe-inline' is forbidden");
  assert.ok(!flat.includes("'unsafe-eval'"), "'unsafe-eval' is forbidden");
  assert.ok(!flat.includes('*') && !flat.includes('http:') && !flat.includes('https:'), 'wildcard / scheme-wide source');
});

eachPage('CSP script-src allows only self, Cloudflare Web Analytics and hashes', (p) => {
  const src = parseCsp(cspOf(p))['script-src'];
  for (const s of src) assert.ok(s === "'self'" || s === 'https://static.cloudflareinsights.com' || /^'sha256-[A-Za-z0-9+/]+=*'$/.test(s), `unexpected script-src source ${s}`);
});

eachPage('CSP connect-src only allows self and Cloudflare Insights', (p) => {
  for (const s of parseCsp(cspOf(p))['connect-src']) assert.ok(["'self'", 'https://cloudflareinsights.com'].includes(s), s);
});

eachPage('CSP img-src / font-src are same-origin (+ data: for images)', (p) => {
  const csp = parseCsp(cspOf(p));
  for (const s of csp['img-src']) assert.ok(["'self'", 'data:'].includes(s), s);
  assert.deepEqual(csp['font-src'], ["'self'"]);
});

eachPage('every inline <script> body is covered by a CSP sha256 hash', (p) => {
  const allowed = new Set(parseCsp(cspOf(p))['script-src']);
  const scripts = inlineScripts(p);
  const missing = scripts.filter((s) => !allowed.has(`'${sha256(s.children[0]?.text ?? '')}'`)).map((s) => (s.children[0]?.text ?? '').slice(0, 60));
  assert.deepEqual(missing, []);
});

eachPage('every inline <style> body is covered by a CSP style-src hash', (p) => {
  const allowed = new Set(parseCsp(cspOf(p))['style-src']);
  const missing = p.q('style').filter((s) => !allowed.has(`'${sha256(s.children[0]?.text ?? '')}'`)).map((s) => (s.children[0]?.text ?? '').slice(0, 60));
  assert.deepEqual(missing, []);
});

// Astro emits one site-wide hash list (some hashes belong to pre-minification script bodies, so "stale hash"
// is not assertable); what matters is that every page ships the same, complete policy.
distTest('all pages ship byte-identical CSP policies', () => {
  const pages = ROUTES.map(loadPage);
  // Case pages inline their own <style> block (case.css), so their style-src carries one extra hash: compare every
  // directive except style-src for equality, and require each page's style-src to include the home page's hashes.
  const split = (p) => {
    const c = parseCsp(cspOf(p));
    const { 'style-src': style, ...rest } = c;
    return { style, rest: JSON.stringify(rest) };
  };
  const base = split(pages[0]);
  for (const p of pages) {
    const c = split(p);
    assert.equal(c.rest, base.rest, `${p.route} has a different CSP`);
    for (const h of base.style) assert.ok(c.style.includes(h), `${p.route} style-src lacks ${h}`);
  }
});

distTest('the CSP carries a bounded number of hashes (no unbounded growth)', () => {
  const csp = parseCsp(cspOf(loadPage('/')));
  const n = [...csp['script-src'], ...csp['style-src']].filter((h) => h.startsWith("'sha256-")).length;
  assert.ok(n >= 4 && n <= 40, `${n} hashes`);
});

eachPage('no style="" attributes anywhere (style-src has no unsafe-inline)', (p) => {
  const bad = p.q((e) => e.attrs.style !== undefined).map((e) => `<${e.tag} class="${e.attrs.class ?? ''}">`);
  assert.deepEqual(bad, []);
});

eachPage('no inline event handler attributes (on*)', (p) => {
  const bad = [];
  for (const e of p.q(() => true)) for (const k of Object.keys(e.attrs)) if (/^on[a-z]+$/.test(k)) bad.push(`<${e.tag} ${k}>`);
  assert.deepEqual(bad, []);
});

eachPage('no external <script src> except Cloudflare Web Analytics; none are async-less blocking in <head>', (p) => {
  for (const s of p.q((e) => e.tag === 'script' && e.attrs.src)) {
    if (s.attrs.src.startsWith('https://static.cloudflareinsights.com/')) continue;
    assert.ok(s.attrs.src.startsWith('/'), s.attrs.src);
  }
});

eachPage('same-origin scripts are ES modules or deferred (never parser-blocking)', (p) => {
  for (const s of p.q((e) => e.tag === 'script' && e.attrs.src)) {
    assert.ok(s.attrs.type === 'module' || s.attrs.defer !== undefined || s.attrs.async !== undefined, `${s.attrs.src} is render-blocking`);
  }
});

eachPage('same-origin scripts live under /_astro/ with a content hash in the file name', (p) => {
  for (const s of p.q((e) => e.tag === 'script' && e.attrs.src && e.attrs.src.startsWith('/'))) {
    assert.match(s.attrs.src, /^\/_astro\/.+\.[A-Za-z0-9_-]{8}\.js$/);
    assert.ok(resolveInDist(s.attrs.src));
  }
});

eachPage('no third-party resource is referenced by src/href except links, preconnect-free', (p) => {
  const bad = [];
  for (const e of p.q((x) => ['img', 'link', 'source', 'video', 'audio', 'iframe'].includes(x.tag))) {
    const u = e.attrs.src ?? e.attrs.href;
    if (u && /^(https?:)?\/\//.test(u) && !u.startsWith(ORIGIN) && !['canonical', 'alternate'].includes(e.attrs.rel)) bad.push(u);
    if (['preconnect', 'dns-prefetch'].includes(e.attrs.rel)) bad.push(`${e.attrs.rel} ${u}`);
  }
  assert.deepEqual(bad, []);
});

eachPage('inline CSS never loads a remote url() (img-src / font-src are self)', (p) => {
  for (const s of p.q('style')) {
    const css = s.children[0]?.text ?? '';
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
    for (const u of urls) assert.ok(u.startsWith('/') || u.startsWith('data:') || u.startsWith('#'), `remote url(${u}) in inline CSS`);
  }
});

eachPage('inline CSS url() targets that are files exist in dist', (p) => {
  for (const s of p.q('style')) {
    const css = s.children[0]?.text ?? '';
    for (const m of css.matchAll(/url\(\s*['"]?(\/[^'")#?]+)['"]?\s*\)/g)) assert.ok(resolveInDist(m[1]), `${m[1]} referenced by CSS is missing`);
  }
});

// ---- JSON-LD ----------------------------------------------------------------------------------------
// Person + ProfessionalService + WebSite everywhere; BreadcrumbList on the case pages.
const expectedLdTypes = (p) =>
  ['Person', 'ProfessionalService', 'WebSite', ...(p.kind === 'project' ? ['BreadcrumbList'] : [])].sort();

eachPage('JSON-LD: parseable blocks with schema.org @context', (p) => {
  assert.equal(ldBlocks(p).length, expectedLdTypes(p).length);
  for (const d of ldDocs(p)) assert.equal(d['@context'], 'https://schema.org');
});

eachPage('JSON-LD @type set matches the page kind', (p) => {
  assert.deepEqual(ldDocs(p).map((d) => d['@type']).sort(), expectedLdTypes(p));
});

eachPage('JSON-LD Person: ALETO, full name, knowsAbout and the four profile links', (p) => {
  const person = ldDocs(p).find((d) => d['@type'] === 'Person');
  assert.equal(person.worksFor.name, 'ALETO');
  assert.ok(person.alternateName.includes('Victor Otávio Andrade das Neves'));
  assert.ok(person.alumniOf.name.includes('UNICAMP'));
  for (const k of ['Laravel', 'Jamstack', 'GitOps']) assert.ok(person.knowsAbout.includes(k), k);
  for (const host of ['github.com', 'linkedin.com', 'youtube.com', 'stackoverflow.com']) {
    assert.ok(person.sameAs.some((u) => new URL(u).hostname.endsWith(host)), host);
  }
});

eachPage(
  'JSON-LD BreadcrumbList has three items ending on the page itself',
  (p) => {
    const bc = ldDocs(p).find((d) => d['@type'] === 'BreadcrumbList');
    assert.deepEqual(bc.itemListElement.map((i) => i.position), [1, 2, 3]);
    assert.equal(bc.itemListElement[2].item, `${ORIGIN}${p.route}`);
  },
  { routes: ROUTES.filter((r) => r.includes('/projetos/') || r.includes('/projects/')) },
);

eachPage('JSON-LD Person has the identity fields search engines read', (p) => {
  const person = ldDocs(p).find((d) => d['@type'] === 'Person');
  for (const k of ['name', 'url', 'image', 'jobTitle', 'description']) assert.ok(person[k], `Person.${k}`);
  assert.match(person.url, /^https:\/\/voaneves\.com/);
  assert.equal(person.name, 'Victor Neves');
});

eachPage('JSON-LD ProfessionalService has an offer catalog with priced offers', (p) => {
  const ps = ldDocs(p).find((d) => d['@type'] === 'ProfessionalService');
  assert.ok(ps.hasOfferCatalog?.itemListElement?.length >= 5, 'offers');
  assert.ok(ps.areaServed?.length >= 1);
  assert.ok(ps.priceRange);
});

eachPage('JSON-LD every url / image is absolute https and resolves when same-origin', (p) => {
  const bad = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      for (const [k, v] of Object.entries(n)) {
        if (['url', 'image', 'logo', '@id'].includes(k) && typeof v === 'string') {
          if (!v.startsWith('https://')) bad.push(`${k}=${v}`);
          else if (v.startsWith(ORIGIN)) {
            const pathname = new URL(v).pathname;
            if (!resolveInDist(pathname)) bad.push(`${k}=${v} not built`);
          }
        } else walk(v);
      }
    }
  };
  ldDocs(p).forEach(walk);
  assert.deepEqual(bad, []);
});

eachPage('JSON-LD contains no placeholder/undefined/null strings', (p) => {
  for (const b of ldBlocks(p)) assert.doesNotMatch(b.children[0].text, /undefined|\bnull\b|\[object|NaN/);
});

eachPage('JSON-LD language fields agree with the page locale', (p) => {
  const langs = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) { if (k === 'inLanguage') langs.push(v); else walk(v); }
  };
  ldDocs(p).forEach(walk);
  assert.ok(langs.length >= 1);
  for (const l of langs) assert.equal(l, localeOf(p.route));
});

eachPage('JSON-LD description mirrors the page meta description for page-specific content', (p) => {
  const person = ldDocs(p).find((d) => d['@type'] === 'Person');
  assert.equal(person.description, p.meta('description'));
});
