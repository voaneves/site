import { test, expect } from '@playwright/test';

test.describe('chrome fx', () => {
  test('header CTA is magnetic and follows the pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('.vn-navbar__cta');
    await expect(btn).toHaveAttribute('data-magnetic', '');
    await expect(btn).toHaveAttribute('data-cursor-label', /.+/);
    const box = (await btn.boundingBox())!;
    const tx = () => btn.evaluate((el) => parseFloat(getComputedStyle(el).translate.split(' ')[0]) || 0);
    await page.mouse.move(5, 300);
    let w = 0;
    await expect(async () => {
      await page.mouse.move(box.x + box.width - 4 - (w++ % 2), box.y + box.height / 2, { steps: 3 });
      expect(await tx()).toBeGreaterThan(0.5);
    }).toPass({ timeout: 8000 });
  });

  test('nav link letters roll on keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('.vn-navbar__link[data-fx="roll"]').first();
    const inner = link.locator('> span > span');
    const ty = () => inner.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
    expect(await ty()).toBe(0);
    await page.keyboard.press('Tab');
    await expect(async () => {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused({ timeout: 300 });
    }).toPass({ timeout: 8000 });
    await expect.poll(ty, { timeout: 3000 }).toBeLessThan(-5);
    await expect(link).toHaveAccessibleName(/\S/);
  });

  test('focused nav links are not obscured (WCAG 2.4.11)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const links = page.locator('.vn-navbar__link');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const l = links.nth(i);
      await l.focus();
      const top = await l.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!hit && (hit === el || el.contains(hit));
      });
      expect(top).toBe(true);
    }
  });
});
