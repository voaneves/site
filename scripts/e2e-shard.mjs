#!/usr/bin/env node
// Duration-balanced Playwright shards. Playwright's --shard cuts the test list into equal counts in file order, and
// this suite's heaviest specs sort first, so one shard took ~7 min while others took ~1. This assigns whole spec
// files to shards by greedy longest-first packing on measured durations (e2e/shard-weights.json), so every file runs
// in exactly one shard and the slowest shard is as short as the file sizes allow.
// Usage: node scripts/e2e-shard.mjs <index 1-based> <total>   -> prints the spec paths for that shard, one per line.
// Spec files missing from the weights file get the median weight, so a new spec can never be skipped.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function specFiles() {
  return readdirSync(join(root, 'e2e'))
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => `e2e/${f}`)
    .sort();
}

export function loadWeights() {
  const p = join(root, 'e2e', 'shard-weights.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

/** Returns an array of `total` shards, each { files: string[], weight: number }. Deterministic for the same input. */
export function plan(total, files = specFiles(), weights = loadWeights()) {
  const known = files.map((f) => weights[f]).filter((w) => typeof w === 'number' && w > 0).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const items = files
    .map((f) => ({ f, w: typeof weights[f] === 'number' && weights[f] > 0 ? weights[f] : median }))
    .sort((a, b) => b.w - a.w || a.f.localeCompare(b.f));
  const shards = Array.from({ length: total }, () => ({ files: [], weight: 0 }));
  for (const it of items) {
    let best = 0;
    for (let i = 1; i < total; i++) if (shards[i].weight < shards[best].weight) best = i;
    shards[best].files.push(it.f);
    shards[best].weight += it.w;
  }
  for (const s of shards) s.files.sort();
  return shards;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [index, total] = process.argv.slice(2).map(Number);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || index > total) {
    console.error('usage: node scripts/e2e-shard.mjs <index> <total>');
    process.exit(2);
  }
  const shard = plan(total)[index - 1];
  if (!shard.files.length) {
    console.error(`shard ${index}/${total} is empty`);
    process.exit(1);
  }
  process.stdout.write(shard.files.join('\n') + '\n');
}
