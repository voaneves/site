import { test, expect, type Page } from '@playwright/test';

const first = (page: Page) => page.locator('.vn-faq-item').first();

async function prep(page: Page) {
  await page.goto('/');
  await page.locator('#perguntas').scrollIntoViewIfNeeded();
  const s = first(page).locator('summary');
  await expect(s).toBeVisible();
  return s;
}

test.describe('faq fx', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('opens with Enter and Space, answer becomes visible', async ({ page }) => {
    const s = await prep(page);
    await s.focus();
    await page.keyboard.press('Enter');
    await expect(first(page)).toHaveAttribute('open', '');
    await expect(first(page).locator('.vn-faq-item__a')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(first(page)).not.toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(first(page)).toHaveAttribute('open', '');
    await expect.poll(() => first(page).locator('.vn-faq-item__a').evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThan(10);
  });

  test('icon rotates when open and summary carries a cursor label', async ({ page }) => {
    const s = await prep(page);
    await expect(s).toHaveAttribute('data-cursor-label', /^(Abrir|Open)$/);
    const icon = first(page).locator('.vn-faq-item__icon');
    const before = await icon.evaluate((e) => getComputedStyle(e).transform);
    await s.click();
    await expect.poll(() => icon.evaluate((e) => getComputedStyle(e).transform)).not.toBe(before);
  });

  test('reduced motion opens without transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const s = await prep(page);
    await s.click();
    await expect(first(page)).toHaveAttribute('open', '');
    const a = first(page).locator('.vn-faq-item__a');
    await expect(a).toBeVisible();
    const t = await first(page).evaluate((e) => getComputedStyle(e, '::details-content').transitionDuration);
    expect(parseFloat(t) || 0).toBe(0);
  });
});
