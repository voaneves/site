import { test, expect, type Page } from '@playwright/test';

const CHUNK = /\/_astro\/smooth\./;
const track = (page: Page) => {
  const hits: string[] = [];
  page.on('request', (r) => CHUNK.test(r.url()) && hits.push(r.url()));
  return hits;
};
const y = (page: Page) => page.evaluate(() => scrollY);
const running = (page: Page) => page.evaluate(() => (window as unknown as { __vnSmooth?: boolean }).__vnSmooth === true);
// first notch loads the module (and scrolls natively); wait for the page to rest
const arm = async (page: Page) => {
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 100);
  await page.waitForResponse((r) => CHUNK.test(r.url()));
  let prev = -1;
  await expect.poll(async () => { const v = await y(page); const same = v === prev; prev = v; return same; }, { intervals: [150] }).toBe(true);
};

test.describe('smooth wheel', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

  test('lazy: nothing before the first wheel, loaded by it', async ({ page }) => {
    const hits = track(page);
    await page.goto('/?vn-debug');
    await page.waitForLoadState('networkidle');
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420);
    await page.waitForTimeout(500);
    expect(hits).toEqual([]);
    await arm(page);
    expect(hits.length).toBe(1);
  });

  test('a wheel notch eases the page to exactly its target', async ({ page }) => {
    await page.goto('/?vn-debug');
    await arm(page);
    const y0 = await y(page);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(60);
    const mid = await y(page);
    expect(mid).toBeGreaterThan(y0);
    expect(mid).toBeLessThan(y0 + 380); // still on its way after 60 ms
    expect(await running(page)).toBe(true);
    await expect.poll(() => running(page), { timeout: 4000 }).toBe(false);
    expect(Math.abs((await y(page)) - (y0 + 400))).toBeLessThanOrEqual(1);
  });

  test('small deltas (trackpad), Shift and Ctrl wheels stay native', async ({ page }) => {
    await page.goto('/?vn-debug');
    await arm(page);
    await page.mouse.wheel(0, 20);
    expect(await running(page)).toBe(false);
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 300);
    await page.keyboard.up('Shift');
    expect(await running(page)).toBe(false);
  });

  test('keys and anchor links take over at once and land where they should', async ({ page }) => {
    await page.goto('/?vn-debug');
    await arm(page);
    await page.mouse.wheel(0, 600);
    await page.keyboard.press('End');
    expect(await running(page)).toBe(false);
    await expect.poll(() => page.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 2), { timeout: 8000 }).toBe(true);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.mouse.wheel(0, 500);
    await page.locator('.vn-navbar__link[data-nav-hash="servicos"]').click();
    await expect.poll(() => page.evaluate(() => {
      const r = document.getElementById('servicos')!.getBoundingClientRect();
      return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
    }), { timeout: 10_000 }).toBe(true);
    expect(await running(page)).toBe(false);
  });

  test('scroll-driven animations follow the smoothed scroll', async ({ page }) => {
    await page.goto('/?vn-debug');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
    await arm(page);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => running(page), { timeout: 4000 }).toBe(false);
    expect(await page.locator('.vn-hero__inner').evaluate((e) => getComputedStyle(e).translate)).not.toBe('none');
  });

  test('a wheel over an inner scroller or an opted-out element is native; the kill switch works', async ({ page }) => {
    await page.goto('/?vn-debug');
    await arm(page);
    await page.evaluate(() => {
      const b = document.createElement('div');
      b.id = 'probe';
      Object.assign(b.style, { position: 'fixed', left: '100px', top: '200px', width: '300px', height: '200px', overflowY: 'auto', background: '#fff', zIndex: '999' });
      const c = document.createElement('div');
      c.style.height = '2000px';
      b.append(c);
      document.body.append(b);
    });
    const y0 = await y(page);
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => document.getElementById('probe')!.scrollTop)).toBeGreaterThan(100);
    expect(await running(page)).toBe(false);
    expect(await y(page)).toBe(y0);
    await page.evaluate(() => { document.getElementById('probe')!.remove(); localStorage.setItem('vn-smooth', '0'); });
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 300);
    expect(await running(page)).toBe(false);
    await expect.poll(() => y(page)).toBeGreaterThan(y0 + 100); // native scrolling still works
  });

  test('journey: a vertical wheel over the cards scrolls the page', async ({ page }) => {
    await page.goto('/?vn-debug');
    await arm(page);
    await page.locator('[data-vn-journey]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const box = (await page.locator('[data-vn-journey]').boundingBox())!;
    const y0 = await y(page);
    await page.mouse.move(700, Math.min(850, Math.max(120, box.y + 80)));
    await page.mouse.wheel(0, 300);
    await expect.poll(() => y(page)).toBeGreaterThan(y0 + 200);
  });
});

test.describe('smooth wheel is never loaded', () => {
  test('under reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    const hits = track(page);
    await page.goto('/');
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(600);
    expect(hits).toEqual([]);
    await ctx.close();
  });

  test('on touch devices', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    const hits = track(page);
    await page.goto('/');
    await page.evaluate(() => scrollTo(0, 400));
    await page.waitForTimeout(600);
    expect(hits).toEqual([]);
    await ctx.close();
  });
});
