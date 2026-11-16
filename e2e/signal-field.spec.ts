import { test, expect, type Page } from '@playwright/test';
import { engage } from './lib/site';

// A12: the motion sheet (which gives the pinned Jornada its scroll runway) starts on the first interaction. A visitor
// interacts before reaching the contact band; jumping there as the very first interaction would land on a layout
// that grows above it. Engage, then wait for the sheet, so the jump lands on the final layout.
const settleLayout = async (page: Page) => {
  await engage(page);
  await expect.poll(() => page.evaluate(() => 'scrollFx' in document.documentElement.dataset)).toBe(true);
};

const CHUNK = /\/_astro\/signal-field\./;

function track(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (rq) => {
    if (CHUNK.test(rq.url())) hits.push(rq.url());
  });
  return hits;
}

for (const route of ['/', '/en/']) {
  test.describe(`signal field ${route}`, () => {
    test('is not requested before the band nears, then draws a canvas behind the copy', async ({ page }) => {
      const hits = track(page);
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      expect(hits).toHaveLength(0);
      await expect(page.locator('#contato canvas.vn-sf')).toHaveCount(0);

      await page.locator('#contato').scrollIntoViewIfNeeded();
      const canvas = page.locator('#contato canvas.vn-sf');
      await expect(canvas).toHaveCount(1);
      expect(hits.length).toBeGreaterThan(0);
      await expect(canvas).toHaveAttribute('aria-hidden', 'true');
      const geo = await page.evaluate(() => {
        const band = document.getElementById('contato')!.getBoundingClientRect();
        const cv = document.querySelector('#contato canvas.vn-sf') as HTMLCanvasElement;
        const r = cv.getBoundingClientRect();
        return {
          sameBox: Math.abs(r.width - band.width) < 1 && Math.abs(r.height - band.height) < 1,
          pe: getComputedStyle(cv).pointerEvents,
          pos: getComputedStyle(cv).position,
          bg: getComputedStyle(document.getElementById('contato')!).backgroundColor,
          ground: document.getElementById('contato')!.dataset.ground,
        };
      });
      expect(geo.sameBox).toBe(true);
      expect(geo.pe).toBe('none');
      expect(geo.pos).toBe('absolute');
      expect(geo.bg).toBe('rgb(245, 0, 0)');
      expect(geo.ground).toBe('signal');
    });

    test('the field reacts to the pointer, then the rAF loop goes idle', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(`${route}?vn-debug`);
      await page.waitForLoadState('networkidle');
      await settleLayout(page);
      await page.locator('#contato').scrollIntoViewIfNeeded();
      const canvas = page.locator('#contato canvas.vn-sf');
      await expect(canvas).toHaveCount(1);
      await page.waitForTimeout(300);

      const before = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
      await page.mouse.move(700, 300);
      await page.mouse.move(720, 320, { steps: 6 });
      await page.waitForFunction(() => (window as unknown as { __vnFieldRunning?: boolean }).__vnFieldRunning === true);
      await page.waitForTimeout(250);
      const during = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
      expect(during).not.toBe(before);

      // Settles: the pointer stays put, so the springs converge and the loop stops by itself.
      await page.waitForFunction(
        () => (window as unknown as { __vnFieldRunning?: boolean }).__vnFieldRunning === false,
        undefined,
        { timeout: 6000 },
      );
    });

    test('with no pointer over the band the field drifts, and stops when the band leaves the screen', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(`${route}?vn-debug`);
      await page.waitForLoadState('networkidle');
      await page.mouse.move(600, 20); // a real move (motionOK chunks load); it stays over the header, not the band
      await page.locator('#contato').scrollIntoViewIfNeeded();
      const canvas = page.locator('#contato canvas.vn-sf');
      await expect(canvas).toHaveCount(1);
      await page.waitForFunction(() => (window as unknown as { __vnFieldDrift?: boolean }).__vnFieldDrift === true, undefined, { timeout: 5000 });
      const a = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
      await page.waitForTimeout(500);
      const b = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
      expect(b).not.toBe(a);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForFunction(() => (window as unknown as { __vnFieldRunning?: boolean }).__vnFieldRunning === false, undefined, { timeout: 4000 });
    });

    test('the copy stays clickable and keeps contrast above the canvas', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await settleLayout(page);
      await page.locator('#contato').scrollIntoViewIfNeeded();
      await expect(page.locator('#contato canvas.vn-sf')).toHaveCount(1);
      const top = await page.evaluate(() => {
        const a = document.querySelector('#contato .vn-contact-actions a') as HTMLElement;
        const r = a.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return a.contains(hit);
      });
      expect(top).toBe(true);
    });
  });
}

test.describe('signal field reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('never requests the chunk and never draws a canvas', async ({ page }) => {
    const hits = track(page);
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#contato').scrollIntoViewIfNeeded();
    await page.mouse.move(600, 300, { steps: 4 });
    await page.waitForTimeout(800);
    expect(hits).toHaveLength(0);
    await expect(page.locator('#contato canvas')).toHaveCount(0);
  });
});

test.describe('signal field touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('does not load on coarse pointers', async ({ page }) => {
    const hits = track(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#contato').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    expect(hits).toHaveLength(0);
  });
});
