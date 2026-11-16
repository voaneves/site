import { expect, test } from '@playwright/test';

// render-cost.css seeds each deferred section with its full height (--ci). Anchor jumps no longer depend on
// them (nav.ts renders everything first), but stale seeds still mislead the scrollbar and the first scroll.
// This measures the real heights at each breakpoint band and fails, printing the values to paste, on drift.
const IDS = ['quem-sou', 'numeros', 'expertise', 'jornada', 'projetos', 'servicos', 'perguntas', 'contato'];
const WIDTHS = [1366, 1100, 950, 850, 700, 390];
const TOLERANCE = 0.15;
// Same criterion as the nav tests: the section's top is in the upper 60% and it still fills the screen below 15%.
const inView = (id: string) => (page: import('@playwright/test').Page) =>
  page.evaluate((id) => {
    const r = document.getElementById(id)!.getBoundingClientRect();
    return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
  }, id);

for (const width of WIDTHS) {
  test(`content-visibility seeds stay within ${TOLERANCE * 100}% of real section heights at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const rows: { id: string; seed: number; real: number }[] = [];
    for (const path of ['/', '/en/']) {
      await page.goto(path);
      await page.waitForFunction(() => document.documentElement.dataset.scrollFx !== undefined);
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
  await expect.poll(() => inView('perguntas')(page), { timeout: 8000 }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('vn-cv-off'))).toBe(true);
});

test('loading with a hash lands on that section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#contato');
  await expect.poll(() => inView('contato')(page), { timeout: 8000 }).toBe(true);
});
