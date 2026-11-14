import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('public/_headers stays within limits and defines security & cache policies', async () => {
  const raw = await fs.readFile(path.join(ROOT, 'public', '_headers'), 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  assert.ok(lines.length < 100, 'Cloudflare Pages _headers max 100 header lines');
  assert.match(raw, /Strict-Transport-Security:/);
  assert.match(raw, /X-Content-Type-Options:\s*nosniff/);
  assert.match(raw, /\/worker\.min\.js[\s\S]*Cache-Control:\s*no-cache/);
});

test('public/_redirects stays within limits, has no self-loops, and local targets resolve', async () => {
  const raw = await fs.readFile(path.join(ROOT, 'public', '_redirects'), 'utf8');
  const rules = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  assert.ok(rules.length < 2100, 'Cloudflare Pages _redirects max 2100 rules');

  for (const rule of rules) {
    const [src, dst, code] = rule.split(/\s+/);
    assert.ok(src && dst && code, `Invalid redirect rule: ${rule}`);
    assert.notEqual(src, dst, `Self-loop detected: ${rule}`);

    if (dst.startsWith('/') && !dst.includes(':splat')) {
      const [cleanPath] = dst.split('#');
      if (cleanPath === '/') {
        await fs.access(path.join(ROOT, 'src', 'pages', 'index.astro'));
      } else {
        await fs.access(path.join(ROOT, 'public', cleanPath.slice(1)));
      }
    }
  }
});
