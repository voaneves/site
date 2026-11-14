import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

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
  console.log(`Budget OK [${rel}]: html=${gzBytes} B gz, inlineCss=${cssGzBytes} B gz`);
}

const jsFiles = allFiles.filter((f) => f.includes(`${path.sep}_astro${path.sep}`) && f.endsWith('.js'));
let totalJsGz = 0;
for (const file of jsFiles) {
  const buf = await fs.readFile(file);
  totalJsGz += zlib.gzipSync(buf).length;
}
if (totalJsGz > budget.firstLoadJsGzMaxBytes) {
  throw new Error(`Bundled JS gzip ${totalJsGz} B exceeds budget ${budget.firstLoadJsGzMaxBytes} B`);
}
console.log(`Bundled JS total: ${totalJsGz} B gz (<= ${budget.firstLoadJsGzMaxBytes} B)`);

const preload1 = await fs.stat(path.join(DIST, 'fonts', 'fraunces-italic-display.woff2'));
const preload2 = await fs.stat(path.join(DIST, 'fonts', 'schibsted-grotesk.woff2'));
const preloadTotal = preload1.size + preload2.size;
if (preloadTotal > budget.preloadFontsMaxBytes) {
  throw new Error(`Preloaded fonts ${preloadTotal} B exceeds budget ${budget.preloadFontsMaxBytes} B`);
}
console.log(`Preloaded fonts: ${preloadTotal} B (<= ${budget.preloadFontsMaxBytes} B)`);
