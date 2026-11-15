// Load a plain-data TypeScript module (types + object literals, no runtime imports) using the esbuild
// that ships with Astro/Vite. Avoids a TS toolchain dependency and avoids regex-scraping the data.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './dist.mjs';

const require = createRequire(import.meta.url);

export async function loadTs(rel) {
  const esbuild = require('esbuild');
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const { code } = esbuild.transformSync(src, { loader: 'ts', format: 'esm', target: 'es2022' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
