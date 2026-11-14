import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

async function walkHtml(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function routeForHtml(absPath) {
  const rel = path.relative(DIST, absPath).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404.html';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

const files = await walkHtml(DIST);
if (files.length === 0) {
  throw new Error('No HTML files found in dist/');
}

const routeIds = new Map();
const parsed = [];

for (const file of files) {
  const html = await fs.readFile(file, 'utf8');
  const route = routeForHtml(file);

  if (!/^<!doctype html>/i.test(html.trimStart())) {
    throw new Error(`${route}: missing <!doctype html>`);
  }
  if (!/<html\b[^>]*\blang="(?:pt-BR|en)"/i.test(html)) {
    throw new Error(`${route}: missing valid <html lang="pt-BR|en">`);
  }
  if (!/<title>[^<]+<\/title>/i.test(html)) {
    throw new Error(`${route}: missing non-empty <title>`);
  }
  if (!/<main\b/i.test(html)) {
    throw new Error(`${route}: missing <main> landmark`);
  }

  for (const img of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=/i.test(img[1])) {
      throw new Error(`${route}: <img> missing alt attribute`);
    }
  }

  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/gi)) {
    const id = m[1];
    if (ids.has(id)) {
      throw new Error(`${route}: duplicate id="${id}"`);
    }
    ids.add(id);
  }

  routeIds.set(route, ids);
  parsed.push({ route, html });
}

for (const { route, html } of parsed) {
  for (const m of html.matchAll(/\bhref="([^"]+)"/gi)) {
    const href = m[1];
    if (
      href.startsWith('http://')
      || href.startsWith('https://')
      || href.startsWith('mailto:')
      || href.startsWith('tel:')
    ) {
      continue;
    }

    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      if (!routeIds.get(route)?.has(targetId)) {
        throw new Error(`${route}: broken local anchor ${href}`);
      }
      continue;
    }

    if (href.startsWith('/')) {
      const [rawPath, hash] = href.split('#');
      if (/\.(?:ico|svg|png|woff2|pdf|webmanifest|xml)$/i.test(rawPath)) {
        const assetPath = path.join(DIST, rawPath.slice(1));
        await fs.access(assetPath);
        continue;
      }
      const normPath = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
      if (!routeIds.has(normPath)) {
        throw new Error(`${route}: internal link target missing in dist: ${href}`);
      }
      if (hash && !routeIds.get(normPath)?.has(hash)) {
        throw new Error(`${route}: missing anchor #${hash} on ${normPath}`);
      }
    }
  }
}

console.log(`Verified ${files.length} HTML documents cleanly.`);
