import { test, expect } from '@playwright/test';

const dash = (loc: import('@playwright/test').Locator) =>
  loc.evaluate((el) => parseFloat(getComputedStyle(el).strokeDasharray));

test.describe('services arc CTA', () => {
  test('arc grows on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    const cta = page.locator('.vn-service-card__cta').first();
    const ring = cta.locator('.vn-arc circle');
    await cta.scrollIntoViewIfNeeded();
    const start = await dash(ring);
    expect(start).toBeLessThan(20);
    await cta.hover();
    await expect.poll(() => dash(ring)).toBeGreaterThan(45);
  });

  test('arc grows on keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    const cta = page.locator('.vn-service-card__cta').first();
    const ring = cta.locator('.vn-arc circle');
    await cta.scrollIntoViewIfNeeded();
    const start = await dash(ring);
    await page.keyboard.press('Tab');
    await cta.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    await expect.poll(() => dash(ring)).toBeGreaterThan(start + 30);
  });

  test('reduced motion shows the final arc without transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const ring = page.locator('.vn-service-card__cta .vn-arc circle').first();
    expect(await dash(ring)).toBeGreaterThan(45);
    const dur = await ring.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(dur)).toBe(0);
  });
});
