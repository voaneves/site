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
    // Record every write to the debug flag with a timestamp, so a loaded machine can't make the test miss
    // the short true→false window between polls.
    await page.addInitScript(() => {
      const w = window as unknown as { __vnTrailLog: [boolean, number][] };
      w.__vnTrailLog = [];
      let v: boolean | undefined;
      Object.defineProperty(window, '__vnTrailRunning', {
        configurable: true,
        get: () => v,
        set: (x: boolean) => { v = x; w.__vnTrailLog.push([x, performance.now()]); },
      });
    });
    await ready(page, '/?vn-debug');
    // First move only triggers the lazy import; wait for the chunk to attach before the measured wiggle.
    await page.mouse.move(200, 200);
    await expect(trail(page)).toHaveCount(1);
    await wiggle(page);
    const lastMove = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => {
      const log = (window as unknown as { __vnTrailLog: [boolean, number][] }).__vnTrailLog;
      return log.some(([x]) => x) && log[log.length - 1][0] === false;
    }, undefined, { timeout: 8000 });
    const log = await page.evaluate(() => (window as unknown as { __vnTrailLog: [boolean, number][] }).__vnTrailLog);
    const stopAt = log[log.length - 1][1];
    // the loop must not stop early: it keeps running TRAIL_STOP_MS (1500) past the last move
    expect(stopAt - lastMove).toBeGreaterThan(900);
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
    // the canvas is drawn at one canvas pixel per CSS px (it redraws images), capped at 1920 across
    expect(size[0]).toBeLessThanOrEqual(1920);
    expect(errors).toEqual([]);
  });

  test('forced Canvas2D fallback paints red, then clears after the settle', async ({ page }) => {
    await ready(page, '/?vn-debug&vn-trail=2d');
    // move continuously for ~600ms so the fading circles accumulate
    for (let i = 0; i < 12; i++) await page.mouse.move(200 + i * 60, 300 + (i % 2) * 80, { steps: 4 });
    // the lazy chunk can still be in flight on a loaded machine: poll the flag instead of reading it once
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __vnTrailMode?: string }).__vnTrailMode), { timeout: 10_000 })
      .toBe('2d');
    await page.mouse.move(260, 300, { steps: 4 });
    for (let i = 0; i < 6; i++) await page.mouse.move(300 + i * 60, 300 + (i % 2) * 80, { steps: 4 });
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

  test('the ink follows the ground: Sinal red on creme, a hotter red on ink, Tinta on the Sinal band', async ({ page }) => {
    await ready(page, '/?vn-debug');
    await page.evaluate(() => {
      for (const [id, bg, left, sig] of [
        ['t-light', '#f4ead4', '0', ''],
        ['t-dark', '#0a0a0a', '33vw', ''],
        ['t-sig', '#f50000', '66vw', 'signal'],
      ]) {
        const d = document.createElement('div');
        d.id = id;
        if (sig) d.dataset.ground = sig;
        Object.assign(d.style, { position: 'fixed', left, top: '0', width: '34vw', height: '100vh', zIndex: '9000', background: bg });
        document.body.appendChild(d);
      }
    });
    await page.mouse.move(100, 300); // first move triggers the lazy import
    await expect(trail(page)).toHaveCount(1);
    const ink = () => page.evaluate(() => (window as unknown as { __vnTrailInk?: string }).__vnTrailInk);
    for (const [x, want] of [
      [200, '0.96,0,0'],
      [640, '1,0.2,0.17'],
      [1100, '0.04,0.035,0.035'],
    ] as const) {
      await page.mouse.move(x - 40, 320);
      await page.mouse.move(x, 330, { steps: 3 });
      await expect.poll(ink).toBe(want);
      // the trail never disappears on a ground: only its colour changes
      expect(await trail(page).evaluate((c) => getComputedStyle(c).opacity)).toBe('1');
    }
  });

  test('the ink is actually on screen while the pointer moves (screenshot over a blank creme ground)', async ({ page }) => {
    await ready(page, '/?vn-debug');
    await page.evaluate(() => {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', inset: '0', zIndex: '9000', background: '#f4ead4' });
      document.body.appendChild(d);
    });
    await page.mouse.move(300, 300);
    await expect(trail(page)).toHaveCount(1);
    for (let i = 0; i < 24; i++) await page.mouse.move(300 + i * 28, 300 + Math.sin(i / 3) * 90);
    const png = (await page.screenshot()).toString('base64');
    // count clearly red pixels (the 8px dot alone is about 50 of them)
    const red = await page.evaluate(async (b64) => {
      const img = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      const o = new OffscreenCanvas(img.width, img.height).getContext('2d')!;
      o.drawImage(img, 0, 0);
      const d = o.getImageData(0, 0, img.width, img.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 170 && d[i] - d[i + 1] > 60) n++;
      return n;
    }, png);
    expect(red).toBeGreaterThan(3000);
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

test.describe('trail: image distortion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const wv = (page: Page, k: string) => page.evaluate((key) => (window as unknown as Record<string, unknown>)[key], k);
  const sweep = async (page: Page, sel: string) => {
    const box = (await page.locator(sel).first().boundingBox())!;
    const y = box.y + box.height / 2;
    for (let i = 0; i <= 12; i++) await page.mouse.move(box.x + 10 + ((box.width - 20) * i) / 12, y + (i % 2 ? 6 : -6));
  };

  test('a project thumbnail is redrawn through the flow while the pointer crosses it, and released after', async ({ page }) => {
    await page.goto('/?vn-debug');
    await page.mouse.move(300, 300);
    await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
    test.skip((await wv(page, '__vnTrailMode')) !== 'webgl', 'no WebGL on this machine: the ink fallback has no image pass');
    const media = page.locator('.vn-project-row__media').first();
    await media.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(media).toHaveClass(/is-done/, { timeout: 8000 });
    await page.waitForTimeout(300); // let the scroll guard (140 ms) pass
    await sweep(page, '.vn-project-row__media');
    await expect.poll(async () => { await sweep(page, '.vn-project-row__media'); return wv(page, '__vnTrailWarp'); }, { timeout: 6000 }).toBeGreaterThanOrEqual(1);
    // away from any image: no image pass
    await page.mouse.move(40, 500);
    await page.mouse.move(60, 520);
    await expect.poll(() => wv(page, '__vnTrailWarp')).toBe(0);
    // and the loop still settles
    await expect.poll(() => wv(page, '__vnTrailRunning'), { timeout: 6000 }).toBe(false);
  });

  test('the case hero image takes part; the hero portrait never does', async ({ page }) => {
    await page.goto('/projetos/caato/?vn-debug');
    await page.mouse.move(300, 300);
    await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
    test.skip((await wv(page, '__vnTrailMode')) !== 'webgl', 'no WebGL on this machine');
    await page.locator('.vn-case-media').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    await expect.poll(async () => { await sweep(page, '.vn-case-media'); return wv(page, '__vnTrailWarp'); }, { timeout: 6000 }).toBeGreaterThanOrEqual(1);
    await page.goto('/?vn-debug');
    await page.mouse.move(300, 300);
    await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
    await sweep(page, '.vn-hero-portrait');
    await page.waitForTimeout(300);
    expect(await wv(page, '__vnTrailWarp')).toBe(0);
  });

  test('Canvas2D fallback: ink only, no image pass, no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?vn-debug&vn-trail=2d');
    await page.mouse.move(300, 300);
    await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
    const media = page.locator('.vn-project-row__media').first();
    await media.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    await sweep(page, '.vn-project-row__media');
    expect(await wv(page, '__vnTrailWarp')).toBeFalsy();
    expect(errors).toEqual([]);
  });
});