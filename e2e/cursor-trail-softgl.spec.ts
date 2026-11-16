import { test, expect, type Page } from '@playwright/test';

// Software GL (SwiftShader) is forced with launch args, which needs a top-level test.use (its own worker).
const trail = (page: Page) => page.locator('canvas.vn-cursor-trail');
const wiggle = async (page: Page, n = 3) => {
  for (let i = 0; i < n; i++) await page.mouse.move(300 + i * 90, 260 + i * 40, { steps: 6 });
};
const ready = async (page: Page, url = '/') => {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
};

test.use({ viewport: { width: 1440, height: 900 }, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

test('SwiftShader picks the low-resolution ink-only mode and 20 pointer moves complete quickly', async ({ page }) => {
  await ready(page, '/?vn-debug');
  await wiggle(page, 2);
  await expect(trail(page)).toHaveCount(1);
  const wv = (k: string) => page.evaluate((key) => (window as unknown as Record<string, unknown>)[key], k);
  await expect.poll(() => wv('__vnTrailMode'), { timeout: 10_000 }).not.toBeUndefined();
  const mode = await wv('__vnTrailMode');
  test.skip(mode === '2d' || mode === 'none', `no WebGL at all here (mode: ${String(mode)})`);
  expect(mode).toBe('webgl-lite');
  expect(String(await wv('__vnTrailGL'))).toMatch(/swiftshader|llvmpipe|software|basic render|microsoft basic/i);
  const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]);
  const size = await trail(page).evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
  const cell = Math.max(2, iw / 640);
  expect(size).toEqual([Math.max(2, Math.ceil(iw / cell)), Math.max(2, Math.ceil(ih / cell))]);
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      dispatchEvent(new PointerEvent('pointermove', { clientX: 200 + i * 40, clientY: 300 + (i % 2) * 60, pointerType: 'mouse' }));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(6000);
  expect((await wv('__vnTrailWarp')) ?? 0).toBe(0);
});
