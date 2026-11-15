import { expect, test } from '@playwright/test';

// render-cost.css seeds each deferred section with its full height (--ci). Anchor jumps no longer depend on
// them (nav.ts renders everything first), but stale seeds still mislead the scrollbar and the first scroll.
// This measures the real heights at each breakpoint band and fails, printing the values to paste, on drift.
const IDS = ['quem-sou', 'numeros', 'expertise', 'jornada', 'projetos', 'servicos', 'perguntas', 'contato'];
const WIDTHS = [1366, 1100, 950, 850, 700, 390];
const TOLERANCE = 0.15;

for (const width of WIDTHS) {
  test(`content-visibility seeds stay within ${TOLERANCE * 100}% of real section heights at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const rows: { id: string; seed: number; real: number }[] = [];
    for (const path of ['/', '/en/']) {
      await page.goto(path);
      const r = await page.evaluate(async (ids) => {
        const seeds = ids.map((id) => parseFloat(getComputedStyle(document.getElementById(id)!).getPropertyValue('--ci')));
        document.documentElement.classList.add('vn-cv-off');
        await document.fonts.ready;
        await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 300)));
        return ids.map((id, i) => ({ id, seed: seeds[i], real: Math.round(document.getElementById(id)!.getBoundingClientRect().height) }));
      }, IDS);
      for (const x of r) {
        const prev = rows.find((y) => y.id === x.id);
        if (!prev) rows.push(x);
        else prev.real = Math.max(prev.real, x.real);
      }
    }
    const drift = rows.filter((x) => Math.abs(x.real - x.seed) / x.real > TOLERANCE);
    const fresh = rows.map((x) => `#${x.id}{--ci:${x.real}px}`).join('');
    expect(drift, `stale seeds at ${width}px; update render-cost.css with: ${fresh}`).toEqual([]);
  });
}

test('an in-page nav jump lands on its section even while sections are unrendered', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto('/');
  await page.locator('a[href$="#perguntas"]').first().click();
  await expect
    .poll(() => page.evaluate(() => Math.round(document.getElementById('perguntas')!.getBoundingClientRect().top)), { timeout: 5000 })
    .toBeLessThan(200);
  expect(await page.evaluate(() => document.documentElement.classList.contains('vn-cv-off'))).toBe(true);
});

test('loading with a hash lands on that section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#contato');
  await expect
    .poll(() => page.evaluate(() => Math.round(document.getElementById('contato')!.getBoundingClientRect().top)), { timeout: 5000 })
    .toBeLessThan(200);
});
