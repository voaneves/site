import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWoff2Cmap } from '../scripts/lib/woff2-cmap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'public', 'fonts');
const DIST = path.join(ROOT, 'dist');

const cmapOf = async (name) => readWoff2Cmap(await fs.readFile(path.join(FONTS, name)));

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[n]);

const stripTags = (s) => s.replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
const visibleText = (html) => decode(stripTags(html.slice(html.indexOf('<body'))));

const missing = (text, cmap) =>
  [...new Set(text)].filter((c) => !/\s/.test(c) && c.codePointAt(0) > 31 && !cmap.has(c.codePointAt(0)));

test('woff2 cmap reader: Latin-1, pt-BR accents and punctuation the site uses', async () => {
  for (const name of ['schibsted-grotesk.woff2', 'fraunces-italic-display.woff2', 'fraunces-roman.woff2', 'jetbrains-mono.woff2']) {
    const cmap = await cmapOf(name);
    for (const ch of 'AZaz09ãçéêõúÁÇ“”—·…') assert.ok(cmap.has(ch.codePointAt(0)), `${name} lacks ${ch}`);
    assert.ok(!cmap.has(0x4e2d), `${name} must not cover CJK`);
  }
});

test('every glyph rendered on every built page is covered by the web font that renders it', async (t) => {
  let files;
  try {
    files = await htmlFiles(DIST);
  } catch {
    t.skip('dist/ not built');
    return;
  }
  const [text, display, mono] = await Promise.all([
    cmapOf('schibsted-grotesk.woff2'),
    cmapOf('fraunces-italic-display.woff2'),
    cmapOf('jetbrains-mono.woff2'),
  ]);
  const problems = [];
  const fmt = (c) => `"${c}" (U+${c.codePointAt(0).toString(16)})`;
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const rel = path.relative(DIST, file);
    // Body font: all visible text.
    for (const c of missing(visibleText(html), text)) problems.push(`${rel}: ${fmt(c)} missing in Schibsted Grotesk`);
    // Display font: headings.
    const headings = [...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map((m) => decode(stripTags(m[1]))).join(' ');
    for (const c of missing(headings, display)) problems.push(`${rel}: ${fmt(c)} missing in Fraunces (headings)`);
    // Mono font: labels, tags, micro text and buttons.
    const monoRe = /<(\w+)\b[^>]*class="[^"]*\b(?:vn-type-label|vn-type-tag|vn-type-micro|vn-btn)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
    const monoText = [...html.matchAll(monoRe)].map((m) => decode(stripTags(m[2]))).join(' ');
    for (const c of missing(monoText, mono)) problems.push(`${rel}: ${fmt(c)} missing in JetBrains Mono (labels)`);
  }
  assert.deepEqual(problems, []);
});
