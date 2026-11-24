import { test, expect, type Page } from '@playwright/test';
import { engage } from './lib/site';

const trail = (page: Page) => page.locator('canvas.vn-cursor-trail');
const opacity = (page: Page) => trail(page).evaluate((c) => getComputedStyle(c).opacity);
const w = (page: Page, k: string) => page.evaluate((key) => (window as unknown as Record<string, unknown>)[key], k);

async function setup(page: Page) {
  await page.goto('/?vn-debug');
  await page.waitForLoadState('networkidle');
  // markup contract (data-trail="off" on #contato) is injected so the test is independent of the markup change
  await page.evaluate(() => {
    document.querySelector('#contato')!.setAttribute('data-trail', 'off');
  });
  await engage(page);
  await page.waitForFunction(
    () => 'late' in document.documentElement.dataset
      && 'fontsReady' in document.documentElement.dataset
      && document.documentElement.dataset.scrollFx !== undefined,
  );
  await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      const r = document.querySelector('#contato')!.getBoundingClientRect();
      if (i && Math.abs(r.top - innerHeight / 2) < 2) break;
      scrollTo({ top: scrollY + r.top - innerHeight / 2, behavior: 'instant' });
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    }
  });
  await expect.poll(() => page.evaluate(() => Math.abs(Math.round(document.querySelector('#contato')!.getBoundingClientRect().top - innerHeight / 2)))).toBeLessThan(4);
}

// y of a point inside #contato (visible part of the viewport) and one clearly above it
async function spots(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('#contato')!.getBoundingClientRect();
    return { inY: Math.min(innerHeight - 40, r.top + 80), outY: Math.max(10, r.top - 60) };
  });
}

async function moveUntil(page: Page, fn: (i: number) => [number, number], done: () => Promise<boolean>) {
  for (let i = 0; i < 60; i++) {
    const [x, y] = fn(i);
    await page.mouse.move(x, y, { steps: 3 });
    if (await done()) return;
  }
}

test.describe('trail: data-trail="off" opt-out', () => {
  test('canvas opacity reaches 0 within ~600 ms (1 s margin on a loaded CI box) of entering the off region and the flag is set', async ({ page }) => {
    await setup(page);
    const { inY } = await spots(page);
    await moveUntil(page, (i) => [300 + (i % 2) * 120, inY + (i % 3) * 10], async () => (await trail(page).count()) === 1 && (await w(page, '__vnTrailOff')) === true);
    await expect.poll(() => w(page, '__vnTrailOff')).toBe(true);
    const t0 = Date.now();
    await expect.poll(() => opacity(page), { timeout: 1000 }).toBe('0');
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test('the fade is smooth: a transition is set and opacity is intermediate at some point', async ({ page }) => {
    await setup(page);
    const { inY, outY } = await spots(page);
    await moveUntil(page, (i) => [300 + (i % 2) * 120, outY + (i % 2) * 5], async () => (await trail(page).count()) === 1);
    await expect.poll(() => opacity(page)).toBe('1');
    expect(await trail(page).evaluate((c) => getComputedStyle(c).transitionDuration)).not.toBe('0s');
    await page.evaluate(() => {
      const c = document.querySelector('canvas.vn-cursor-trail')!;
      const seen: number[] = [];
      (window as unknown as { __op: number[] }).__op = seen;
      const f = () => { seen.push(+getComputedStyle(c).opacity); requestAnimationFrame(f); };
      f();
    });
    await moveUntil(page, (i) => [300 + (i % 2) * 120, inY + (i % 2) * 5], async () => (await w(page, '__vnTrailOff')) === true);
    await expect.poll(() => opacity(page)).toBe('0');
    const seen = await page.evaluate(() => (window as unknown as { __op: number[] }).__op);
    expect(seen.some((o) => o > 0.02 && o < 0.98)).toBe(true);
  });

  test('canvas returns to opacity 1 after leaving the region and moving', async ({ page }) => {
    await setup(page);
    const { inY, outY } = await spots(page);
    await moveUntil(page, (i) => [300 + (i % 2) * 120, inY + (i % 2) * 5], async () => (await trail(page).count()) === 1 && (await w(page, '__vnTrailOff')) === true);
    await expect.poll(() => opacity(page)).toBe('0');
    await moveUntil(page, (i) => [300 + (i % 2) * 120, outY + (i % 2) * 5], async () => (await w(page, '__vnTrailOff')) === false);
    await expect.poll(() => w(page, '__vnTrailOff')).toBe(false);
    await expect.poll(() => opacity(page), { timeout: 3000 }).toBe('1');
  });

  test('outside the region the ink is not suppressed (flag false, canvas opaque)', async ({ page }) => {
    await page.goto('/?vn-debug');
    await page.waitForLoadState('networkidle');
    await moveUntil(page, (i) => [300 + (i % 2) * 120, 250 + (i % 3) * 10], async () => (await trail(page).count()) === 1);
    for (let i = 0; i < 8; i++) await page.mouse.move(300 + (i % 2) * 150, 260 + (i % 3) * 20, { steps: 4 });
    expect(await w(page, '__vnTrailOff')).toBe(false);
    await expect.poll(() => opacity(page)).toBe('1');
  });
});
