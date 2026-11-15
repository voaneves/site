import { test, expect } from '@playwright/test';

test.describe('journey gallery', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('next button and ArrowRight advance the live counter', async ({ page }) => {
    await page.goto('/');
    const count = page.locator('[data-journey-count]');
    const track = page.locator('[data-vn-journey]');
    await page.locator('#jornada').scrollIntoViewIfNeeded();
    await expect(count).toHaveText(/^01 \/ \d\d$/);
    await expect(async () => {
      await page.locator('[data-journey-next]').click();
      await expect(count).toHaveText(/^02 \//, { timeout: 1500 });
    }).toPass({ timeout: 10_000 });

    await track.focus();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText(/^03 \//);
    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText(/^02 \//);
  });

  test('counter is a polite live region and the track is a labelled focusable region', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('[data-journey-count]')).toHaveAttribute('aria-live', 'polite');
    const track = page.locator('[data-vn-journey]');
    await expect(track).toHaveAttribute('role', 'region');
    await expect(track).toHaveAttribute('tabindex', '0');
    await expect(track).toHaveAttribute('aria-label', /.+/);
  });
});
