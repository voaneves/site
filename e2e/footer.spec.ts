import { test, expect, type Page } from '@playwright/test';

const late = (page: Page) => page.waitForFunction(() => 'late' in document.documentElement.dataset);
const bottom = (page: Page) =>
  page.evaluate(async () => {
    for (let i = 0; i < 3; i++) {
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 200));
    }
  });

test.describe('footer closing moment', () => {
  for (const [route, w] of [['/', 1440], ['/en/', 1440], ['/', 390], ['/projetos/caato/', 1366], ['/', 320]] as const) {
    test(`wordmark spans the page and never overflows ${route} @${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(route);
      await late(page);
      await page.evaluate(() => document.fonts.ready);
      await bottom(page);
      const mark = page.locator('.vn-foot-mark');
      await expect(mark).toBeVisible();
      await expect(mark).toHaveAttribute('aria-hidden', 'true');
      // The display face may only start loading once the wordmark is shown: wait for the settled width.
      const ratio = () => page.evaluate(() => document.querySelector('.vn-foot-mark span')!.getBoundingClientRect().width / innerWidth);
      await expect.poll(ratio).toBeGreaterThan(0.8);
      expect(await ratio()).toBeLessThan(1.02);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test('wordmark rises with scroll and rests at the page end', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await late(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
    await bottom(page);
    const y = () => page.locator('.vn-foot-mark span').evaluate((e) => getComputedStyle(e).translate);
    // At the end of the range the translate is 0 up to float residue ("0px 1.6e-08%").
    const rest = (s: string) => (s === 'none' ? 0 : Math.abs(parseFloat(s.split(' ')[1] ?? '0')));
    expect(rest(await y())).toBeLessThan(0.01);
    await page.evaluate(() => scrollBy({ top: -220, behavior: 'instant' }));
    await page.waitForTimeout(100);
    expect(rest(await y())).toBeGreaterThan(1);
  });

  test('Palmas time is live and correct', async ({ page }) => {
    await page.goto('/en/');
    await late(page);
    const clock = page.locator('[data-vn-clock]');
    await expect(clock).toHaveText(/^\d{2}:\d{2}$/);
    const want = await page.evaluate(() => new Intl.DateTimeFormat('en', { timeZone: 'America/Araguaina', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()));
    const got = (await clock.textContent())!;
    const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    expect(Math.abs(mins(got) - mins(want)) % 1439).toBeLessThanOrEqual(1);
  });

  test('no JS: no wordmark, static offset', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.vn-foot-mark')).toBeHidden();
    await expect(page.locator('[data-vn-clock]')).toHaveText('UTC−3');
    await ctx.close();
  });
});
