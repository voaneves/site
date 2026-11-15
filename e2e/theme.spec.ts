import { expect, test } from '@playwright/test';

const stub = () => {
  const w = window as unknown as { __vt: number };
  w.__vt = 0;
  document.startViewTransition = ((cb: () => void) => {
    w.__vt++;
    cb();
    return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransitionCallbacks() {} };
  }) as unknown as typeof document.startViewTransition;
};

test.describe('theme colours actually follow the toggle', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`body background flips when the OS prefers ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/privacidade/');
      const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const before = await bg();
      await page.locator('#vn-theme-toggle').click();
      await expect.poll(bg).not.toBe(before);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
        scheme === 'dark' ? 'light' : 'dark',
      );
    });
  }
});

test.describe('theme reveal', () => {
  test('uses a view transition, sets origin, persists, updates meta', async ({ page }) => {
    await page.addInitScript(stub);
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#vn-theme-toggle').click();
    const next = before === 'dark' ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--vt-x'))).toMatch(/px$/);
    expect(await page.evaluate(() => localStorage.getItem('vn-theme'))).toBe(next);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', next === 'dark' ? '#0a0a0a' : '#f4ead4');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('does not call startViewTransition', async ({ page }) => {
      await page.addInitScript(stub);
      await page.goto('/');
      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.locator('#vn-theme-toggle').click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
      expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(0);
    });
  });
});
