import { test, expect, type Page } from '@playwright/test';

const TRAIL_RE = /\/_astro\/cursor-trail\./;

function trackTrailRequests(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (TRAIL_RE.test(r.url())) hits.push(r.url());
  });
  return hits;
}

async function wiggle(page: Page, n = 3) {
  for (let i = 0; i < n; i++) {
    await page.mouse.move(300 + i * 90, 260 + i * 40, { steps: 6 });
  }
}

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

const trail = (page: Page) => page.locator('canvas.vn-cursor-trail');

test.describe('trail: loading', () => {
  test('no cursor-trail chunk is requested before the pointer moves', async ({ page }) => {
    const hits = trackTrailRequests(page);
    await ready(page);
    expect(hits).toEqual([]);
    await expect(trail(page)).toHaveCount(0);
  });

  test('two pointer moves load the chunk and attach one aria-hidden canvas, never cursor:none', async ({ page }) => {
    const hits = trackTrailRequests(page);
    await ready(page);
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await expect(trail(page)).toHaveCount(1);
    expect(hits.length).toBeGreaterThan(0);
    const info = await trail(page).evaluate((c) => {
      const cs = getComputedStyle(c);
      return {
        aria: c.getAttribute('aria-hidden'),
        pe: cs.pointerEvents,
        pos: cs.position,
        z: cs.zIndex,
        w: c.getBoundingClientRect().width,
        h: c.getBoundingClientRect().height,
        body: getComputedStyle(document.body).cursor,
      };
    });
    expect(info.aria).toBe('true');
    expect(info.pe).toBe('none');
    expect(info.pos).toBe('fixed');
    expect(info.z).toBe('9997');
    expect(info.w).toBe(1280);
    expect(info.body).not.toBe('none');
  });

  test('reduced motion: moves never request the chunk and no canvas exists', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const hits = trackTrailRequests(page);
    await ready(page);
    await wiggle(page);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    expect(hits).toEqual([]);
    await expect(trail(page)).toHaveCount(0);
  });
});

test.describe('trail: touch', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('a touch context never requests the chunk', async ({ page }) => {
    const hits = trackTrailRequests(page);
    await ready(page);
    await wiggle(page);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    expect(hits).toEqual([]);
    await expect(trail(page)).toHaveCount(0);
  });
});

test.describe('trail: runtime', () => {
  test('settles: __vnTrailRunning is true while moving and false 2 s after the last move', async ({ page }) => {
    await ready(page, '/?vn-debug');
    await wiggle(page);
    await page.waitForFunction(() => (window as unknown as { __vnTrailRunning?: boolean }).__vnTrailRunning === true);
    const t0 = Date.now();
    await page.waitForFunction(() => (window as unknown as { __vnTrailRunning?: boolean }).__vnTrailRunning === false, undefined, {
      timeout: 5000,
    });
    // the loop must not stop early: it keeps running TRAIL_STOP_MS (1500) past the last move
    expect(Date.now() - t0).toBeGreaterThan(900);
    const mode = await page.evaluate(() => (window as unknown as { __vnTrailMode?: string }).__vnTrailMode);
    expect(['webgl', '2d']).toContain(mode);
  });

  test('the default path (WebGL, or Canvas2D when the GPU has none) renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await ready(page, '/?vn-debug');
    await wiggle(page, 5);
    await expect(trail(page)).toHaveCount(1);
    const size = await trail(page).evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
    expect(size[0]).toBeGreaterThan(0);
    expect(size[1]).toBeGreaterThan(0);
    // canvas is tiny: about one cell per 24-36 CSS px, times a small upscale
    expect(size[0]).toBeLessThan(400);
    expect(errors).toEqual([]);
  });

  test('forced Canvas2D fallback paints red, then clears after the settle', async ({ page }) => {
    await ready(page, '/?vn-debug&vn-trail=2d');
    // move continuously for ~600ms so the fading circles accumulate
    for (let i = 0; i < 12; i++) await page.mouse.move(200 + i * 60, 300 + (i % 2) * 80, { steps: 4 });
    expect(await page.evaluate(() => (window as unknown as { __vnTrailMode?: string }).__vnTrailMode)).toBe('2d');
    const painted = () =>
      trail(page).evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
        return n;
      });
    expect(await painted()).toBeGreaterThan(0);
    await page.waitForFunction(() => (window as unknown as { __vnTrailRunning?: boolean }).__vnTrailRunning === false, undefined, {
      timeout: 5000,
    });
    expect(await painted()).toBe(0);
  });

  test('the trail is hidden over a data-ground="signal" band and the canvas never exceeds 0.35 opacity', async ({ page }) => {
    await ready(page, '/?vn-debug&vn-trail=2d');
    await page.evaluate(() => {
      const band = document.createElement('div');
      band.setAttribute('data-ground', 'signal');
      Object.assign(band.style, { position: 'fixed', left: '0', top: '0', width: '50vw', height: '100vh', zIndex: '9000' });
      document.body.appendChild(band);
    });
    await page.mouse.move(700, 300); // first move triggers the lazy import
    await expect(trail(page)).toHaveCount(1);
    await page.mouse.move(720, 320);
    await page.mouse.move(740, 330);
    await expect.poll(() => trail(page).evaluate((c) => getComputedStyle(c).opacity)).toBe('0.35');
    await page.mouse.move(100, 300);
    await page.mouse.move(120, 320);
    await page.mouse.move(140, 330);
    await expect.poll(() => trail(page).evaluate((c) => getComputedStyle(c).opacity)).toBe('0');
  });

  test('plain alpha blending on light and dark grounds (never multiply/screen, which erase the trail on the wrong ground)', async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
      for (const [id, bg, left] of [['t-light', '#f4ead4', '0'], ['t-dark', '#0a0a0a', '50vw']]) {
        const d = document.createElement('div');
        d.id = id;
        Object.assign(d.style, { position: 'fixed', left, top: '0', width: '50vw', height: '100vh', zIndex: '9000', background: bg });
        document.body.appendChild(d);
      }
    });
    await page.mouse.move(100, 300); // first move triggers the lazy import
    await expect(trail(page)).toHaveCount(1);
    for (const x of [140, 160, 800, 840, 860]) {
      await page.mouse.move(x, 320);
      expect(await trail(page).evaluate((c) => getComputedStyle(c).mixBlendMode)).toBe('normal');
    }
  });

  test('pagehide removes the canvas and stops the loop', async ({ page }) => {
    await ready(page, '/?vn-debug');
    await wiggle(page);
    await expect(trail(page)).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(trail(page)).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __vnTrailRunning?: boolean }).__vnTrailRunning)).toBe(false);
  });

  test('the media query flipping to reduced motion removes the trail', async ({ page }) => {
    await ready(page);
    await wiggle(page);
    await expect(trail(page)).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(trail(page)).toHaveCount(0);
  });
});
