import { test, expect, type Page } from '@playwright/test';

const CHUNK = /\/_astro\/hover-fx\./;

function track(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (rq) => {
    if (CHUNK.test(rq.url())) hits.push(rq.url());
  });
  return hits;
}

// Markup hooks may not exist yet (parallel work): inject our own data-fx targets.
async function inject(page: Page) {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'fx-host';
    host.style.cssText = 'position:fixed;left:40px;top:40px;z-index:99999;display:flex;gap:20px;background:#fff;padding:10px';
    host.innerHTML =
      '<div id="fx-tilt" data-fx="tilt"><ul><li class="vn-chip">a</li><li class="vn-chip">b</li></ul></div>' +
      '<div id="fx-spot" data-fx="spot"></div>' +
      '<p id="fx-scr" data-fx="scramble"><span aria-hidden="true">[ 03 — </span>EXPERTISE<span aria-hidden="true"> ]</span></p>';
    const css: Record<string, string> = {
      'fx-tilt': 'width:200px;height:120px;background:#ddd',
      'fx-spot': 'width:200px;height:120px;background:#222',
      'fx-scr': 'font-family:monospace;width:260px;margin:0',
    };
    for (const id in css) (host.querySelector('#' + id) as HTMLElement).style.cssText = css[id];
    document.body.append(host);
  });
}

async function ready(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await inject(page);
}

// keep the pointer moving until the lazy chunk has adopted its sheet and listens
async function wake(page: Page, x: number, y: number) {
  let i = 0;
  await expect(async () => {
    await page.mouse.move(x + (i++ % 2), y, { steps: 2 });
    expect(await page.evaluate(() => document.adoptedStyleSheets.some((s) => [...s.cssRules].some((r) => r.cssText.includes('data-fx="tilt"'))))).toBe(true);
  }).toPass({ timeout: 8000 });
}

const center = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).boundingBox())!;
  return { x: b.x + b.width * 0.8, y: b.y + b.height * 0.3 };
};

test.describe('hover-fx', () => {
  test('lazy: not requested before a pointer move, requested after', async ({ page }) => {
    const hits = track(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    expect(hits).toHaveLength(0);
    await page.mouse.move(5, 5);
    await expect.poll(() => hits.length).toBeGreaterThan(0);
  });

  test('spot: --mx/--my follow the pointer', async ({ page }) => {
    await ready(page);
    const { x, y } = await center(page, '#fx-spot');
    let wob = 0;
    await wake(page, x, y);
    const v = () => page.locator('#fx-spot').evaluate((el) => [el.style.getPropertyValue('--mx'), el.style.getPropertyValue('--my')]);
    await expect(async () => {
      await page.mouse.move(x + (wob++ % 3), y, { steps: 2 });
      expect(await v(), 'spot var not set').not.toEqual(['', '']);
    }).toPass({ timeout: 5000 });
    const a = await v();
    const b = (await page.locator('#fx-spot').boundingBox())!;
    await page.mouse.move(b.x + 20, b.y + 90, { steps: 3 });
    await expect.poll(v).not.toEqual(a);
  });

  test('tilt: lifts, tilts at most 4deg and resets on leave', async ({ page }) => {
    await ready(page);
    const { x, y } = await center(page, '#fx-tilt');
    await wake(page, x, y);
    const t = page.locator('#fx-tilt');
    const num = (n: string) => t.evaluate((el, k) => parseFloat(el.style.getPropertyValue(k)) || 0, n);
    let wob = 0;
    await expect(async () => {
      await page.mouse.move(x + (wob++ % 3), y, { steps: 2 });
      expect(await num('--ry')).not.toBe(0);
    }).toPass({ timeout: 5000 });
    expect(Math.abs(await num('--ry'))).toBeLessThanOrEqual(4.01);
    expect(Math.abs(await num('--rx'))).toBeLessThanOrEqual(4.01);
    await expect.poll(() => t.evaluate((el) => getComputedStyle(el).getPropertyValue('--ly').trim())).toBe('-4px');
    await page.mouse.move(700, 700, { steps: 5 });
    await expect.poll(() => num('--ry')).toBe(0);
    await expect.poll(() => num('--rx')).toBe(0);
    await expect.poll(() => t.evaluate((el) => getComputedStyle(el).getPropertyValue('--ly').trim())).not.toBe('-4px');
  });

  test('scramble: decodes then restores exact text, aria-label while running, no width change', async ({ page }) => {
    await ready(page);
    const s = page.locator('#fx-scr');
    const real = await s.evaluate((el) => el.textContent);
    const w0 = (await s.boundingBox())!.width;
    const { x, y } = await center(page, '#fx-scr');
    await wake(page, x, y);
    await page.mouse.move(700, 700, { steps: 3 });
    const seen = await page.evaluate(async () => {
      const el = document.getElementById('fx-scr')!;
      const out = { label: '', changed: false, w: 0 };
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: document.body }));
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      out.label = el.getAttribute('aria-label') ?? '';
      out.changed = el.textContent !== 'x';
      out.w = el.getBoundingClientRect().width - r.width;
      return out;
    });
    expect(seen.label).toBe(real!.replace(/\s+/g, ' ').trim());
    expect(Math.abs(seen.w)).toBeLessThan(0.5);
    await expect.poll(() => s.evaluate((el) => el.textContent), { timeout: 4000 }).toBe(real);
    await expect.poll(() => s.evaluate((el) => el.hasAttribute('aria-label') || el.style.width !== '260px')).toBe(false);
    expect(Math.abs((await s.boundingBox())!.width - w0)).toBeLessThan(0.5);
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

  test.describe('touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });
    test('never requested', async ({ page }) => {
      const hits = track(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.touchscreen.tap(100, 300);
      await page.waitForTimeout(600);
      expect(hits).toHaveLength(0);
    });
  });
});
