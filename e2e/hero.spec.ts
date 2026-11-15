import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/en/'];

for (const route of ROUTES) {
  test(`hero name is a static two-line h1 with no animations (${route})`, async ({ page }) => {
    await page.goto(route);
    const h1 = page.locator('h1.vn-hero__title');
    await expect(h1).toHaveText(/Victor\s*Neves/);
    const lines = await h1.locator('.vn-hero__line').count();
    expect(lines).toBe(2);
    const running = await page.evaluate(() => {
      const h = document.querySelector('h1.vn-hero__title')!;
      return document
        .getAnimations()
        .filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
          return !!t && h.contains(t);
        }).length;
    });
    expect(running).toBe(0);
    // The two lines are really on two rows, and the Sinal dot is a red disc on the second.
    const [l1, l2] = await h1.locator('.vn-hero__line').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().top),
    );
    expect(l2).toBeGreaterThan(l1);
    await expect(h1.locator('.vn-hero__dot')).toHaveAttribute('aria-hidden', 'true');
  });

  test(`hero does not overflow at 320px (${route})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(route);
    const over = await page.evaluate(() => {
      const t = document.querySelector('.vn-hero__title')!;
      const w = Math.max(...[...t.querySelectorAll('.vn-hero__line')].map((l) => l.scrollWidth));
      return { doc: document.documentElement.scrollWidth - innerWidth, title: w - t.clientWidth };
    });
    expect(over.doc).toBeLessThanOrEqual(0);
    expect(over.title).toBeLessThanOrEqual(0);
  });
}

test('HUD shows live X/Y from the pointer on a fine pointer', async ({ page }) => {
  await page.goto('/');
  const live = page.locator('[data-vn-hud-live]');
  await expect(live).toBeVisible();
  await expect(live).toHaveText(/^X \d{4} · Y \d{4} · 2026$/);
  await page.mouse.move(420, 300);
  await expect(live).toHaveText(/^X 0420 · Y 0\d{3} · 2026$/);
  const yBefore = await live.textContent();
  await page.mouse.move(700, 450);
  await expect(live).not.toHaveText(yBefore!);
  await expect(page.locator('[data-vn-hud]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.vn-hero__hud-static')).toBeHidden();
});

test('HUD is the static Palmas readout under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await expect(page.locator('.vn-hero__hud-static')).toHaveText(/^-10\.2° · -48\.3° · 2026$/);
  await expect(page.locator('[data-vn-hud-live]')).toBeHidden();
  await page.mouse.move(420, 300);
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await ctx.close();
});

test('HUD is the static readout without JS', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await expect(page.locator('[data-vn-hud-live]')).toBeHidden();
  await ctx.close();
});

test('the display name does not move when the web fonts swap in', async ({ page }) => {
  await page.goto('/');
  const box = () =>
    page.evaluate(() => {
      const r = document.querySelector('h1.vn-hero__title')!.getBoundingClientRect();
      const lines = [...document.querySelectorAll('.vn-hero__line')].map((l) => l.getBoundingClientRect().top);
      return { top: r.top, height: r.height, lines };
    });
  // First paint is in the size-adjusted fallbacks; wait for the swap, then compare vertical geometry.
  const before = await box();
  await page.waitForFunction(() => document.documentElement.classList.contains('vn-fonts'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.includes('Fraunces') && f.status === 'loaded'));
  const after = await box();
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  after.lines.forEach((t, i) => expect(Math.abs(t - before.lines[i])).toBeLessThanOrEqual(1));
});
