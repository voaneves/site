import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_PAIRS } from '../src/i18n/routes.mjs';
import { PROJECT_SLUGS } from '../src/data/slugs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('portfolio.ts slugs match PROJECT_SLUGS for pt and en', async () => {
  const source = await fs.readFile(path.join(ROOT, 'src', 'data', 'portfolio.ts'), 'utf8');
  const all = [...source.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(all.length, PROJECT_SLUGS.length * 2, 'expected each slug once per locale');
  const half = all.length / 2;
  const expected = [...PROJECT_SLUGS].sort();
  assert.deepEqual([...all.slice(0, half)].sort(), expected, 'first locale slugs');
  assert.deepEqual([...all.slice(half)].sort(), expected, 'second locale slugs');
});

test('every project slug has a pt/en route pair', () => {
  for (const s of PROJECT_SLUGS) {
    const pair = ROUTE_PAIRS.find((p) => p.pt === `/projetos/${s}/`);
    assert.ok(pair, `missing pair for ${s}`);
    assert.equal(pair.en, `/en/projects/${s}/`);
  }
});
