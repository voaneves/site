import { test, expect } from '@playwright/test';

const CASE = '/projetos/mte/';

test.describe('case and 404 fx', () => {
  test('case CTA is magnetic and labelled', async ({ page }) => {
    await page.goto(CASE);
    const cta = page.locator('.vn-case-cta a[data-magnetic]');
    await expect(cta).toHaveCount(1);
    await expect.poll(() => cta.getAttribute('data-cursor-label')).toMatch(/\S/);
    await expect(page.locator('.vn-case-chapter[data-cursor-zone="read"]').first()).toBeAttached();
  });

  test('spec row wipes and shifts on hover and focus-within', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(CASE);
    const row = page.locator('.vn-case .vn-spec-list__row').first();
    await row.scrollIntoViewIfNeeded();
    const state = () =>
      row.evaluate((r) => ({
        dt: getComputedStyle(r.querySelector('dt')!).transform,
        line: getComputedStyle(r, '::after').transform,
      }));
    await expect.poll(async () => (await state()).dt).toBe('none');
    await row.hover();
    await expect.poll(async () => (await state()).dt, { timeout: 5000 }).not.toBe('none');
    await expect.poll(async () => (await state()).line, { timeout: 5000 }).toMatch(/matrix\(1,/);
    await page.mouse.move(5, 5);
    await expect.poll(async () => (await state()).dt, { timeout: 5000 }).toBe('none');
    await row.locator('dt').evaluate((el) => { el.tabIndex = 0; el.focus(); });
    await expect.poll(async () => (await state()).dt, { timeout: 5000 }).not.toBe('none');
  });

  test('404 beats end visible and reduced motion shows them at once', async ({ page }) => {
    await page.goto('/this-does-not-exist/');
    const beats = page.locator('.vn-beat');
    expect(await beats.count()).toBeGreaterThan(2);
    await expect
      .poll(() => beats.evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === '1')), { timeout: 5000 })
      .toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    expect(await beats.evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === '1' && getComputedStyle(e).animationName === 'none'))).toBe(true);
  });

  test('404 has a ring cursor zone and scrambling 404', async ({ page }) => {
    await page.goto('/this-does-not-exist/');
    await expect(page.locator('[data-cursor-zone="ring"]')).toHaveCount(1);
    await expect(page.locator('[data-fx="scramble"]')).toHaveText('404');
  });
});
