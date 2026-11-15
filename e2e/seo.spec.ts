import { test, expect, type Page } from '@playwright/test';

async function readLd(page: Page): Promise<unknown[]> {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  return raw.map((r) => JSON.parse(r));
}

function collect(node: unknown, out: { strings: string[]; langs: unknown[] }): void {
  if (typeof node === 'string') out.strings.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'inLanguage') out.langs.push(v);
      collect(v, out);
    }
  }
}

test('/en/ JSON-LD is English only', async ({ page }) => {
  await page.goto('/en/');
  const ld = await readLd(page);
  expect(ld.length).toBeGreaterThan(0);
  const out = { strings: [] as string[], langs: [] as unknown[] };
  collect(ld, out);
  expect(out.langs.length).toBeGreaterThan(0);
  for (const l of out.langs) expect(l).toBe('en');
  for (const s of out.strings) {
    expect(s).not.toContain('ção');
    expect(s).not.toContain('você');
  }
});

test('/ JSON-LD declares pt-BR', async ({ page }) => {
  await page.goto('/');
  const out = { strings: [] as string[], langs: [] as unknown[] };
  collect(await readLd(page), out);
  expect(out.langs.length).toBeGreaterThan(0);
  for (const l of out.langs) expect(l).toBe('pt-BR');
});
