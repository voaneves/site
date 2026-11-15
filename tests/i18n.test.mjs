import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alternatePathForLocale, routeAlternates } from '../src/i18n/routes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('UI dictionaries maintain identical keys between pt-br and en', async () => {
  // Normalise CRLF (Windows checkouts) so the block regexes below match on every platform.
  const source = (await fs.readFile(path.join(ROOT, 'src', 'i18n', 'ui.ts'), 'utf8')).replace(/\r\n/g, '\n');
  const extractKeys = (block) => [...block.matchAll(/^\s+([a-zA-Z0-9_]+):/gm)].map((m) => m[1]).sort();

  const ptMatch = source.match(/'pt-br':\s*\{([\s\S]*?)\n\s*\},\n\s*en:/);
  const enMatch = source.match(/\ben:\s*\{([\s\S]*?)\n\s*\},\n\}(?:\s+as\s+const)?;/);
  assert.ok(ptMatch, 'pt-br dictionary block missing');
  assert.ok(enMatch, 'en dictionary block missing');

  assert.deepEqual(extractKeys(ptMatch[1]), extractKeys(enMatch[1]));

  const extractString = (block, key) => block.match(new RegExp(`^\\s+${key}:\\s*'([^']*)'`, 'm'))?.[1] ?? '';
  for (const [name, block] of [['pt-br', ptMatch[1]], ['en', enMatch[1]]]) {
    const label = extractString(block, 'langSwitchLabel');
    const text = extractString(block, 'langSwitchText');
    assert.ok(text.length > 0, `${name}.langSwitchText missing`);
    assert.match(
      label,
      new RegExp(`\\b${text}\\b`, 'i'),
      `${name}.langSwitchLabel ("${label}") must contain visible text "${text}" (WCAG 2.5.3)`,
    );
  }
});

test('routeAlternates emits pt-BR, en, and x-default hreflang links', () => {
  const homeAlts = routeAlternates('https://voaneves.com/');
  assert.equal(homeAlts.length, 3);
  assert.deepEqual(
    homeAlts.map((a) => a.lang),
    ['pt-BR', 'en', 'x-default'],
  );
  assert.equal(alternatePathForLocale('/privacidade/', 'en'), '/en/privacy/');
  assert.equal(alternatePathForLocale('/en/privacy/', 'pt-br'), '/privacidade/');
});
