import { test, expect, type Page } from '@playwright/test';

const late = (page: Page) => page.waitForFunction(() => 'late' in document.documentElement.dataset);
const pct = (page: Page) => page.evaluate(() => Number(getComputedStyle(document.querySelector('.vn-rail__n')!).getPropertyValue('--vn-p')));
const to = (page: Page, f: number) =>
  page.evaluate(async (q) => {
    scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * q, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, f);

test.describe('scroll rail', () => {
  for (const route of ['/', '/en/']) {
    test(`wide screen ${route}: rail replaces the top bar and counts with scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await late(page);
      const rail = page.locator('.vn-rail');
      await expect(rail).toBeVisible();
      await expect(rail).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('#vn-scroll-progress')).toBeHidden();
      expect(await pct(page)).toBe(0);
      await to(page, 0.5);
      expect(await pct(page)).toBeGreaterThanOrEqual(48);
      expect(await pct(page)).toBeLessThanOrEqual(51);
      const line = await page.locator('.vn-rail__line i').evaluate((e) => parseFloat(getComputedStyle(e).scale.split(' ')[1] ?? '1'));
      expect(line).toBeGreaterThan(0.45);
      expect(line).toBeLessThan(0.55);
      // gone before the red band reaches the rail
      await page.evaluate(async () => {
        const r = document.querySelector('#contato')!.getBoundingClientRect();
        scrollTo({ top: scrollY + r.top - innerHeight / 2, behavior: 'instant' });
        await new Promise((res) => setTimeout(res, 200));
        const r2 = document.querySelector('#contato')!.getBoundingClientRect();
        scrollTo({ top: scrollY + r2.top - innerHeight / 2, behavior: 'instant' });
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      });
      expect(Number(await rail.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThanOrEqual(0.05);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test('narrow screen: no rail, the top bar works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await late(page);
    await expect(page.locator('.vn-rail')).toBeHidden();
    await expect(page.locator('#vn-scroll-progress')).not.toHaveCSS('display', 'none');
    await to(page, 0.5);
    const sx = await page.locator('#vn-scroll-progress').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
    expect(sx).toBeGreaterThan(0.4);
  });

  test('reduced motion: no rail', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await late(page);
    await expect(page.locator('.vn-rail')).toBeHidden();
    await expect(page.locator('#vn-scroll-progress')).not.toHaveCSS('display', 'none');
  });

  test('other pages have no rail element', async ({ page }) => {
    await page.goto('/projetos/caato/');
    await expect(page.locator('.vn-rail')).toHaveCount(0);
    await page.goto('/privacidade/');
    await expect(page.locator('.vn-rail')).toHaveCount(0);
  });

  test('no JS: the rail stays hidden', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.vn-rail')).toBeHidden();
    await ctx.close();
  });
});
