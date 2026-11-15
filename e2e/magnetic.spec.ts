import { test, expect, type Page } from '@playwright/test';

const CHUNK = /\/_astro\/magnetic\./;

function track(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (rq) => {
    if (CHUNK.test(rq.url())) hits.push(rq.url());
  });
  return hits;
}

test.describe('magnetic', () => {
  test('not requested before a pointer move, requested after; element follows then returns', async ({ page }) => {
    const hits = track(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    expect(hits).toHaveLength(0);

    const btn = page.locator('[data-magnetic]:visible').first();
    await btn.scrollIntoViewIfNeeded();
    const box = (await btn.boundingBox())!;
    await page.mouse.move(5, 5);
    await expect.poll(() => hits.length).toBeGreaterThan(0);
    await page.waitForTimeout(300);

    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 5 });
    const tx = () => btn.evaluate((el) => parseFloat(getComputedStyle(el).translate.split(' ')[0]) || 0);
    await expect.poll(tx).toBeGreaterThan(0.5);
    expect(await tx()).toBeLessThanOrEqual(6.01);

    await page.mouse.move(5, 5, { steps: 5 });
    await expect.poll(tx, { timeout: 3000 }).toBe(0);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('never requested', async ({ page }) => {
      const hits = track(page);
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto('/');
      await page.mouse.move(100, 100, { steps: 5 });
      await page.mouse.move(300, 300, { steps: 5 });
      await page.waitForTimeout(600);
      expect(hits).toHaveLength(0);
    });
  });
});
