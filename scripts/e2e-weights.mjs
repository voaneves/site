#!/usr/bin/env node
// Regenerates e2e/shard-weights.json (the weights scripts/e2e-shard.mjs packs shards with) from Playwright JSON reports.
// The CI e2e-shard job writes playwright-report/results.json and uploads it in the playwright-report-<n> artifact.
// Usage:
//   gh run download <run-id> -D /tmp/run1 -p 'playwright-report-*'
//   node scripts/e2e-weights.mjs /tmp/run1 [/tmp/run2 ...]
// Each argument is ONE run: a directory (searched recursively for results.json, one per shard) or a single results.json.
// Per spec file the durations of every test attempt (retries included) are summed within a run, then averaged over the
// runs given (1+ is fine; 2-3 smooths noise). Result: seconds with 1 decimal, sorted from the heaviest to the lightest.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const key = (f) => `e2e/${f.replaceAll('\\', '/').replace(/^e2e\//, '')}`;

/** Sum of attempt durations (ms) per spec path ("e2e/x.spec.ts") in one parsed Playwright JSON report. */
export function sumReport(report, into = new Map()) {
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? [])
        for (const r of t.results ?? [])
          if (f) into.set(key(f), (into.get(key(f)) ?? 0) + (r.duration ?? 0));
    for (const child of suite.suites ?? []) walk(child, f);
  };
  for (const s of report.suites ?? []) walk(s, undefined);
  return into;
}

/** Averages per-run totals (array of Map<spec, ms>) into { spec: seconds }, heaviest first. */
export function toWeights(runs) {
  const acc = new Map();
  for (const run of runs) for (const [f, ms] of run) acc.set(f, [...(acc.get(f) ?? []), ms]);
  const out = [...acc].map(([f, v]) => [f, Math.round((v.reduce((a, b) => a + b, 0) / v.length / 1000) * 10) / 10]);
  out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return Object.fromEntries(out);
}

function reportsIn(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? reportsIn(join(path, e.name)) : e.name === 'results.json' ? [join(path, e.name)] : [],
  );
}

export function loadRun(path) {
  const files = reportsIn(path);
  if (!files.length) throw new Error(`no results.json under ${path}`);
  const run = new Map();
  for (const f of files) sumReport(JSON.parse(readFileSync(f, 'utf8')), run);
  return run;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: node scripts/e2e-weights.mjs <results.json|artifact dir> [...more runs]');
    process.exit(2);
  }
  const weights = toWeights(args.map(loadRun));
  writeFileSync(join(root, 'e2e', 'shard-weights.json'), JSON.stringify(weights, null, 2) + '\n');
  console.log(`e2e/shard-weights.json: ${Object.keys(weights).length} specs from ${args.length} run(s)`);
}
