import { test, expect } from '@playwright/test';
import { settle } from './lib/site';

// The awards strip reuses the journey carousel (src/scripts/journey.ts): drag with inertia, arrows, counter.
test.describe('awards strip', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('arrows, counter and mouse drag work, and the journey keeps its own counter', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('[data-vn-car]');
    await settle(page, strip);
    await expect(strip).toHaveAttribute('data-ready', '');
    await expect(strip).toHaveAttribute('data-cursor-label', 'Arraste');
    const count = page.locator('#quem-sou [data-car-count]');
    const total = await strip.locator('> *').count();
    await expect(count).toHaveText(`01 / ${String(total).padStart(2, '0')}`);

    await page.locator('#quem-sou [data-car-next]').click();
    await expect(count).toHaveText(/^02 \//);
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);

    await page.locator('#quem-sou [data-car-prev]').click();
    await expect(count).toHaveText(/^01 \//);
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeLessThan(2);

    await settle(page, strip);
    const b = (await strip.boundingBox())!;
    await page.mouse.move(b.x + 900, b.y + 80);
    await page.mouse.down();
    await page.mouse.move(b.x + 300, b.y + 80, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeGreaterThan(150);
    await expect(count).not.toHaveText(/^01 \//);

    await expect(page.locator('#jornada [data-journey-count]')).toHaveText(/^01 \/ /);
  });

  test('keyboard: arrow keys on the focused strip move it and update the counter', async ({ page }) => {
    await page.goto('/');
    const strip = page.locator('[data-vn-car]');
    await settle(page, strip);
    await expect(strip).toHaveAttribute('data-ready', '');
    const count = page.locator('#quem-sou [data-car-count]');
    await expect(count).toHaveText(/^01 \//);

    await strip.focus();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText(/^02 \//);
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);

    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText(/^01 \//);
    await expect.poll(() => strip.evaluate((e) => e.scrollLeft)).toBeLessThan(2);
  });
});
