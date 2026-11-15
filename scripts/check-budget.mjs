import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { entryScripts, resolveSpec, staticImports } from './lib/js-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

async function walkFiles(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const budget = JSON.parse(await fs.readFile(path.join(ROOT, 'budget.json'), 'utf8'));
const allFiles = await walkFiles(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

if (htmlFiles.length === 0) {
  throw new Error('No built HTML files found in dist/. Run npm run build first.');
}

for (const file of htmlFiles) {
  const rel = path.relative(DIST, file);
  const html = await fs.readFile(file);
  const gzBytes = zlib.gzipSync(html).length;
  if (gzBytes > budget.htmlGzMaxBytes) {
    throw new Error(`${rel} HTML gzip ${gzBytes} B exceeds budget ${budget.htmlGzMaxBytes} B`);
  }

  const text = html.toString('utf8');
  const styleBlocks = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const cssGzBytes = styleBlocks ? zlib.gzipSync(Buffer.from(styleBlocks, 'utf8')).length : 0;
  if (cssGzBytes > budget.inlineCssGzMaxBytes) {
    throw new Error(`${rel} inline CSS gzip ${cssGzBytes} B exceeds budget ${budget.inlineCssGzMaxBytes} B`);
  }
  if (budget.inlineCssGzWarnBytes && cssGzBytes > budget.inlineCssGzWarnBytes) {
    console.warn(`WARN: ${rel} inline CSS gzip ${cssGzBytes} B above warn threshold ${budget.inlineCssGzWarnBytes} B`);
  }
  console.log(`Budget OK [${rel}]: html=${gzBytes} B gz, inlineCss=${cssGzBytes} B gz`);
}

const astroDir = path.join(DIST, '_astro');
const jsFiles = allFiles.filter((f) => f.startsWith(astroDir + path.sep) && /\.m?js$/.test(f));
const jsInfo = new Map(); // posix path relative to dist/_astro -> { code, gz }
for (const file of jsFiles) {
  const buf = await fs.readFile(file);
  const key = path.relative(astroDir, file).split(path.sep).join('/');
  jsInfo.set(key, { code: buf.toString('utf8'), gz: zlib.gzipSync(buf).length });
}

function resolveChunk(spec, fromKey, origin) {
  const key = resolveSpec(spec, fromKey, jsInfo);
  if (!key) {
    throw new Error(`Unresolved static import "${spec}" from ${origin}: no matching file in dist/_astro`);
  }
  return key;
}

let firstLoadMax = 0;
let firstLoadMaxPage = '';
const firstLoadUnion = new Set();
for (const file of htmlFiles) {
  const rel = path.relative(DIST, file);
  const { srcs, inline } = entryScripts(await fs.readFile(file, 'utf8'));
  const seen = new Set();
  let bytes = 0;
  const queue = []; // { spec, from, origin }
  for (const code of inline) {
    bytes += zlib.gzipSync(Buffer.from(code, 'utf8')).length;
    for (const spec of staticImports(code)) queue.push({ spec, from: '', origin: `inline script in ${rel}` });
  }
  for (const spec of srcs) queue.push({ spec, from: '', origin: rel });
  while (queue.length) {
    const { spec, from, origin } = queue.pop();
    const name = resolveChunk(spec, from, origin);
    if (seen.has(name)) continue;
    seen.add(name);
    bytes += jsInfo.get(name).gz;
    for (const s of staticImports(jsInfo.get(name).code)) queue.push({ spec: s, from: name, origin: `_astro/${name}` });
  }
  for (const n of seen) firstLoadUnion.add(n);
  if (bytes > firstLoadMax) {
    firstLoadMax = bytes;
    firstLoadMaxPage = rel;
  }
}
if (firstLoadMax > budget.firstLoadJsGzMaxBytes) {
  throw new Error(`First-load JS ${firstLoadMax} B gz (${firstLoadMaxPage}) exceeds budget ${budget.firstLoadJsGzMaxBytes} B`);
}

let lazyTotal = 0;
for (const [name, info] of jsInfo) {
  if (!firstLoadUnion.has(name)) lazyTotal += info.gz;
}
if (lazyTotal > budget.lazyJsGzMaxBytes) {
  throw new Error(`Lazy JS ${lazyTotal} B gz exceeds budget ${budget.lazyJsGzMaxBytes} B`);
}

for (const [chunk, max] of Object.entries(budget.lazyChunks ?? {})) {
  const prefix = `${chunk}.`;
  const matches = [...jsInfo.keys()].filter((n) => n.startsWith(prefix));
  if (matches.length === 0) {
    const msg = `lazy chunk "${chunk}" not found in dist/_astro`;
    if (budget.strictLazyChunks) throw new Error(msg);
    console.warn(`WARN: ${msg}`);
    continue;
  }
  for (const name of matches) {
    if (firstLoadUnion.has(name)) {
      throw new Error(`lazy chunk ${name} is part of a first-load set; it must stay lazy`);
    }
    const gz = jsInfo.get(name).gz;
    if (gz > max) throw new Error(`lazy chunk ${name} ${gz} B gz exceeds budget ${max} B`);
  }
}
console.log(`first-load max=${firstLoadMax} B gz (${firstLoadMaxPage}) lazy total=${lazyTotal} B gz`);

const preload1 = await fs.stat(path.join(DIST, 'fonts', 'fraunces-italic-display.woff2'));
const preload2 = await fs.stat(path.join(DIST, 'fonts', 'schibsted-grotesk.woff2'));
const preloadTotal = preload1.size + preload2.size;
if (preloadTotal > budget.preloadFontsMaxBytes) {
  throw new Error(`Preloaded fonts ${preloadTotal} B exceeds budget ${budget.preloadFontsMaxBytes} B`);
}
console.log(`Preloaded fonts: ${preloadTotal} B (<= ${budget.preloadFontsMaxBytes} B)`);
