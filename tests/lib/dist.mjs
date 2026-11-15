import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseHtml, all, textOf } from './html.mjs';
import { ROUTE_PAIRS } from '../../src/i18n/routes.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = path.join(ROOT, 'dist');
export const ORIGIN = 'https://voaneves.com';
export const HAS_DIST = fs.existsSync(path.join(DIST, 'index.html'));
export const SKIP = HAS_DIST ? false : 'dist/ not built (run `npm run build`)';

const routeToFile = (route) => (route === '/404.html' ? '404.html' : path.posix.join(route.replace(/^\//, ''), 'index.html'));

/** Every route the site is expected to build: all pt/en pairs plus the 404. */
export const ROUTES = [...ROUTE_PAIRS.flatMap((p) => [p.pt, p.en]), '/404.html'];
export const INDEXABLE_ROUTES = ROUTES.filter((r) => r !== '/404.html');
export const localeOf = (route) => (route.startsWith('/en/') ? 'en' : 'pt-BR');
export const kindOf = (route) => {
  if (route === '/404.html') return '404';
  if (route === '/' || route === '/en/') return 'home';
  if (route === '/privacidade/' || route === '/en/privacy/') return 'privacy';
  return 'project';
};

export const distPath = (rel) => path.join(DIST, rel.replace(/^\//, ''));

/** Resolve a site-absolute path (no query/hash) to a file in dist, like Cloudflare Pages does. */
export function resolveInDist(pathname) {
  let p = decodeURIComponent(pathname);
  const abs = distPath(p);
  if (!abs.startsWith(DIST)) return null;
  const cands = p.endsWith('/') ? [path.join(abs, 'index.html')] : [abs, abs + '.html', path.join(abs, 'index.html')];
  return cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

const cache = new Map();
export function loadPage(route) {
  if (cache.has(route)) return cache.get(route);
  const file = path.join(DIST, routeToFile(route));
  const html = fs.readFileSync(file, 'utf8');
  const root = parseHtml(html);
  const page = { route, file, html, root, locale: localeOf(route), kind: kindOf(route) };
  const head = all(root, 'head')[0];
  const body = all(root, 'body')[0];
  page.head = head;
  page.body = body;
  page.htmlEl = all(root, 'html')[0];
  page.meta = (name) => all(head, (e) => e.tag === 'meta' && (e.attrs.name === name || e.attrs.property === name))[0]?.attrs.content;
  page.link = (rel, extra = () => true) => all(head, (e) => e.tag === 'link' && e.attrs.rel === rel && extra(e));
  page.title = textOf(all(head, 'title')[0] ?? { children: [] });
  page.q = (pred) => all(root, pred);
  page.ids = all(root, (e) => e.attrs.id !== undefined).map((e) => e.attrs.id);
  page.idSet = new Set(page.ids);
  cache.set(route, page);
  return page;
}

export const allPages = () => ROUTES.map(loadPage);

export function cspOf(page) {
  const m = all(page.head, (e) => e.tag === 'meta' && (e.attrs['http-equiv'] ?? '').toLowerCase() === 'content-security-policy')[0];
  return m?.attrs.content ?? '';
}

export function parseCsp(csp) {
  const out = {};
  for (const part of csp.split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (toks.length) out[toks[0]] = toks.slice(1);
  }
  return out;
}

export const sha256 = (s) => 'sha256-' + crypto.createHash('sha256').update(s).digest('base64');

export const readDist = (rel) => fs.readFileSync(distPath(rel), 'utf8');
export const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Pages whose route is `/`-style absolute URL on the production origin. */
export const urlOf = (route) => (route === '/404.html' ? `${ORIGIN}/404.html` : `${ORIGIN}${route}`);
