import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, specFiles, loadWeights } from '../scripts/e2e-shard.mjs';
import { sumReport, toWeights } from '../scripts/e2e-weights.mjs';

const TOTAL = 6; // keep in step with the e2e-shard matrix in .github/workflows/ci.yml

test('every spec file runs in exactly one CI shard, and no shard is empty', () => {
  const files = specFiles();
  const shards = plan(TOTAL);
  const assigned = shards.flatMap((s) => s.files);
  assert.equal(assigned.length, files.length, 'a spec file was dropped or duplicated');
  assert.deepEqual([...assigned].sort(), files);
  for (const [i, s] of shards.entries()) assert.ok(s.files.length > 0, `shard ${i + 1} is empty`);
});

test('the weights file names only spec files that exist', () => {
  const files = new Set(specFiles());
  for (const f of Object.keys(loadWeights())) assert.ok(files.has(f), `${f} is in e2e/shard-weights.json but not in e2e/`);
});

test('shards are balanced: the slowest is within the largest single file of the mean', () => {
  const shards = plan(TOTAL);
  const w = loadWeights();
  const mean = shards.reduce((a, s) => a + s.weight, 0) / TOTAL;
  const biggest = Math.max(...Object.values(w));
  const slowest = Math.max(...shards.map((s) => s.weight));
  assert.ok(slowest <= mean + biggest + 1e-9, `slowest shard ${slowest.toFixed(1)} s vs mean ${mean.toFixed(1)} s`);
});

test('a spec without a recorded weight still gets a shard', () => {
  const shards = plan(3, ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/new.spec.ts'], { 'e2e/a.spec.ts': 10, 'e2e/b.spec.ts': 2 });
  assert.deepEqual(shards.flatMap((s) => s.files).sort(), ['e2e/a.spec.ts', 'e2e/b.spec.ts', 'e2e/new.spec.ts']);
});

// Minimal Playwright JSON report: file-level suite > describe suite > spec > test > results (one per attempt).
const fixture = (extra = []) => ({
  suites: [
    { file: 'a.spec.ts', suites: [{ title: 'd', specs: [{ tests: [{ results: [{ duration: 1000 }, { duration: 500 }] }] }] }], specs: [] },
    { file: 'b.spec.ts', specs: [{ tests: [{ results: [{ duration: 4000 }] }, { results: [{ duration: 2000 }] }] }] },
    ...extra,
  ],
});

test('e2e-weights sums every attempt per spec file and nests describe suites', () => {
  const m = sumReport(fixture());
  assert.equal(m.get('e2e/a.spec.ts'), 1500);
  assert.equal(m.get('e2e/b.spec.ts'), 6000);
});

test('e2e-weights averages runs, rounds to 0.1 s and sorts heaviest first', () => {
  const run1 = sumReport(fixture());
  const run2 = sumReport({ suites: [{ file: 'a.spec.ts', specs: [{ tests: [{ results: [{ duration: 2549 }] }] }] }] });
  const w = toWeights([run1, run2]);
  assert.deepEqual(Object.keys(w), ['e2e/b.spec.ts', 'e2e/a.spec.ts']);
  assert.equal(w['e2e/b.spec.ts'], 6);
  assert.equal(w['e2e/a.spec.ts'], 2);
});
