import { test, expect, type Page } from '@playwright/test';

// Layer B (dot + pill + media). The fluid trail has its own spec (cursor-trail.spec.ts).
const CHUNK = /\/_astro\/cursor(-trail)?\./;
const CURSOR = /\/_astro\/cursor\./;

const cursor = (page: Page) => page.locator('.vn-cursor');

/** The first pointermove only triggers the lazy import; wait for it, then keep moving. */
async function wake(page: Page, x = 400, y = 300) {
  await page.mouse.move(x, y);
  await page.locator('.vn-cursor').waitFor({ state: 'attached' });
  await page.mouse.move(x + 20, y + 20);
}

/** An element carrying `attr`, found on the page or injected so the test never depends on other sections. */
async function ensureTarget(page: Page, attr: string, value: string, extra = '') {
  await page.evaluate(
    ({ attr, value, extra }) => {
      if (document.querySelector(`[${attr}]`)) return;
      const a = document.createElement('a');
      a.href = '#x';
      a.id = 'vn-test-target';
      a.setAttribute(attr, value);
      if (extra) a.setAttribute(extra, '');
      a.textContent = 'Test target';
      a.style.cssText = 'position:fixed;left:200px;top:400px;width:200px;height:60px;z-index:9000;background:#ccc';
      document.body.append(a);
    },
    { attr, value, extra },
  );
  return page.locator(`[${attr}]`).first();
}

async function hoverCentre(page: Page, el: ReturnType<Page['locator']>) {
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2 - 30, b.y + b.height / 2 - 20);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
}

test.describe('cursor: gating', () => {
  test('no cursor chunk is requested before the pointer moves', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => CHUNK.test(r.url()) && hits.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(hits).toEqual([]);
    await expect(cursor(page)).toHaveCount(0);
  });

  test('the first pointer movement loads the chunk and shows the dot', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => CURSOR.test(r.url()) && hits.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await wake(page);
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
    expect(hits.length).toBeGreaterThan(0);
    await expect(cursor(page)).toHaveAttribute('aria-hidden', 'true');
    // the dot follows the pointer and settles on it
    await expect
      .poll(() => page.locator('.vn-cursor i').evaluate((e) => (e as HTMLElement).style.translate))
      .toBe('420px 320px');
  });

  test('reduced motion: no chunk and no cursor DOM', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const hits: string[] = [];
    page.on('request', (r) => CHUNK.test(r.url()) && hits.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await page.waitForTimeout(400);
    expect(hits).toEqual([]);
    await expect(cursor(page)).toHaveCount(0);
    await ctx.close();
  });

  test('touch device: no chunk and no cursor DOM', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const hits: string[] = [];
    page.on('request', (r) => CHUNK.test(r.url()) && hits.push(r.url()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.mouse.move(100, 100);
    await page.mouse.move(120, 120);
    await page.waitForTimeout(400);
    expect(hits).toEqual([]);
    await expect(cursor(page)).toHaveCount(0);
    await ctx.close();
  });

  test('switching to reduced motion at runtime removes the cursor', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(cursor(page)).toHaveCount(0);
    const sheets = await page.evaluate(() => document.adoptedStyleSheets.length);
    expect(sheets).toBe(0);
  });
});

test.describe('cursor: state machine', () => {
  test('a project row shows the media preview and the pill text equals data-cursor-label', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await wake(page);
    const row = await ensureTarget(page, 'data-cursor-media', '/favicon.svg');
    await hoverCentre(page, row);
    const label = await row.getAttribute('data-cursor-label');
    await expect(cursor(page)).toHaveAttribute('data-state', /^(media|label)$/);
    if (label) await expect(page.locator('.vn-cursor__pill span')).toHaveText(label);
    const src = await row.getAttribute('data-cursor-media');
    await expect(page.locator('.vn-cursor__media img')).toHaveAttribute('src', src!);
    await expect(cursor(page)).toHaveAttribute('data-state', 'media');
    await expect(page.locator('.vn-cursor__media')).toHaveCSS('opacity', '1');
  });

  test('a data-cursor-label element shows the pill', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    const el = await ensureTarget(page, 'data-cursor-label', 'BORA?');
    // the hero buttons (if present) carry labels, so check against whatever we found
    const expected = (await el.getAttribute('data-cursor-label'))!;
    await hoverCentre(page, el);
    await expect(cursor(page)).toHaveAttribute('data-state', /^(label|media)$/);
    await expect(page.locator('.vn-cursor__pill span')).toHaveText(expected);
    await expect(page.locator('.vn-cursor__pill')).toHaveCSS('opacity', '1');
  });

  test('a plain link scales the dot (state link), leaving it returns to idle', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#x';
      a.id = 'vn-plain';
      a.textContent = 'plain';
      a.style.cssText = 'position:fixed;left:200px;top:400px;width:200px;height:60px;z-index:9000;background:#ccc';
      document.body.append(a);
    });
    await hoverCentre(page, page.locator('#vn-plain'));
    await expect(cursor(page)).toHaveAttribute('data-state', 'link');
    await expect(page.locator('.vn-cursor i')).toHaveCSS('scale', '3');
    await page.mouse.move(700, 120, { steps: 3 });
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
  });

  test('pressing the button squashes the dot (data-pressed)', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await page.mouse.down();
    await expect(cursor(page)).toHaveAttribute('data-pressed', '');
    await page.mouse.up();
    await expect(cursor(page)).not.toHaveAttribute('data-pressed', '');
  });

  test('Tab hides the cursor (never over a focus ring); moving the mouse brings it back', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
    await page.keyboard.press('Tab');
    await expect(cursor(page)).toHaveAttribute('data-state', 'hidden');
    await expect(cursor(page)).toHaveCSS('opacity', '0', { timeout: 2000 });
    await page.mouse.move(500, 400);
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
  });

  test('inputs and textareas hide the cursor', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await page.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'vn-test-input';
      i.setAttribute('aria-label', 'test');
      i.style.cssText = 'position:fixed;left:200px;top:400px;width:200px;height:40px;z-index:9000';
      document.body.append(i);
    });
    await hoverCentre(page, page.locator('#vn-test-input'));
    await expect(cursor(page)).toHaveAttribute('data-state', 'hidden');
    await page.mouse.move(700, 120, { steps: 3 });
    await expect(cursor(page)).toHaveAttribute('data-state', 'idle');
  });

  test('on a data-ground="signal" band the cursor switches to the ink variant', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.dataset.ground = 'signal';
      d.style.cssText = 'position:fixed;left:200px;top:400px;width:300px;height:100px;z-index:9000;background:#f50000';
      document.body.append(d);
    });
    await page.mouse.move(300, 450, { steps: 4 });
    await expect(cursor(page)).toHaveAttribute('data-ground', 'signal');
    await expect(page.locator('.vn-cursor i')).toHaveCSS('background-color', 'rgb(10, 10, 10)');
    await page.mouse.move(800, 120, { steps: 4 });
    await expect(cursor(page)).not.toHaveAttribute('data-ground', 'signal');
  });

  test('over the always-dark hero the pill is the light variant (data-ground=ink), even on the light theme', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    await wake(page, 300, 300);
    await page.mouse.move(320, 320, { steps: 3 });
    await expect(cursor(page)).toHaveAttribute('data-ground', 'ink');
    await expect(page.locator('.vn-cursor__pill')).toHaveCSS('background-color', 'rgb(244, 234, 212)');
  });

  test('the rAF loop settles: the dot stops moving after the pointer stops', async ({ page }) => {
    await page.goto('/');
    await wake(page);
    await page.mouse.move(800, 500, { steps: 6 });
    await page.waitForTimeout(1500);
    const read = () => page.evaluate(() => (document.querySelector('.vn-cursor__pill') as HTMLElement).style.translate);
    const a = await read();
    await page.waitForTimeout(200);
    expect(await read()).toBe(a);
    expect(a).toBe('800px 500px');
  });
});

test.describe('cursor: never hides the native cursor, no CSP violations', () => {
  test('body and anchors never get cursor:none', async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __csp?: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => (window as Window & { __csp?: string[] }).__csp!.push(e.violatedDirective));
    });
    await page.goto('/');
    await wake(page);
    const res = await page.evaluate(() => ({
      body: getComputedStyle(document.body).cursor,
      anchors: [...document.querySelectorAll('a, button')].map((a) => getComputedStyle(a).cursor),
      csp: (window as Window & { __csp?: string[] }).__csp,
      cssApplied: getComputedStyle(document.querySelector('.vn-cursor')!).position,
    }));
    expect(res.body).not.toBe('none');
    expect(res.anchors.length).toBeGreaterThan(0);
    expect(res.anchors).not.toContain('none');
    expect(res.csp).toEqual([]);
    expect(res.cssApplied).toBe('fixed');
  });
});
