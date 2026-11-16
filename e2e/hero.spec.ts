import { test, expect, type Page } from '@playwright/test';

const ROUTES = ['/', '/en/'];

for (const route of ROUTES) {
  test(`hero name is a static two-line h1 with no animations (${route})`, async ({ page }) => {
    await page.goto(route);
    const h1 = page.locator('h1.vn-hero__title');
    await expect(h1).toHaveText(/Victor\s*Neves/);
    const lines = await h1.locator('.vn-hero__line').count();
    expect(lines).toBe(2);
    const running = await page.evaluate(() => {
      const h = document.querySelector('h1.vn-hero__title')!;
      return document
        .getAnimations()
        .filter((a) => {
          const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
          return !!t && h.contains(t);
        }).length;
    });
    expect(running).toBe(0);
    // The two lines are really on two rows, and the Sinal dot is a red disc on the second.
    const [l1, l2] = await h1.locator('.vn-hero__line').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().top),
    );
    expect(l2).toBeGreaterThan(l1);
    await expect(h1.locator('.vn-hero__dot')).toHaveAttribute('aria-hidden', 'true');
  });

  test(`hero does not overflow at 320px (${route})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(route);
    const over = await page.evaluate(() => {
      const t = document.querySelector('.vn-hero__title')!;
      const w = Math.max(...[...t.querySelectorAll('.vn-hero__line')].map((l) => l.scrollWidth));
      return { doc: document.documentElement.scrollWidth - innerWidth, title: w - t.clientWidth };
    });
    expect(over.doc).toBeLessThanOrEqual(0);
    expect(over.title).toBeLessThanOrEqual(0);
  });
}

test('HUD shows live X/Y from the pointer on a fine pointer', async ({ page }) => {
  await page.goto('/');
  const live = page.locator('[data-vn-hud-live]');
  await expect(live).toBeVisible();
  await expect(live).toHaveText(/^X \d{4} · Y \d{4} · 2026$/);
  await page.mouse.move(420, 300);
  await expect(live).toHaveText(/^X 0420 · Y 0\d{3} · 2026$/);
  const yBefore = await live.textContent();
  await page.mouse.move(700, 450);
  await expect(live).not.toHaveText(yBefore!);
  await expect(page.locator('[data-vn-hud]')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.vn-hero__hud-static')).toBeHidden();
});

test('HUD is the static Palmas readout under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await expect(page.locator('.vn-hero__hud-static')).toHaveText(/^-10\.2° · -48\.3° · 2026$/);
  await expect(page.locator('[data-vn-hud-live]')).toBeHidden();
  await page.mouse.move(420, 300);
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await ctx.close();
});

test('HUD is the static readout without JS', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.vn-hero__hud-static')).toBeVisible();
  await expect(page.locator('[data-vn-hud-live]')).toBeHidden();
  await ctx.close();
});

test('the display name does not move when the web fonts swap in', async ({ page }) => {
  await page.goto('/');
  const box = () =>
    page.evaluate(() => {
      const r = document.querySelector('h1.vn-hero__title')!.getBoundingClientRect();
      const lines = [...document.querySelectorAll('.vn-hero__line')].map((l) => l.getBoundingClientRect().top);
      return { top: r.top, height: r.height, lines };
    });
  // First paint is in the size-adjusted fallbacks; wait for the swap, then compare vertical geometry.
  const before = await box();
  await page.waitForFunction(() => document.documentElement.classList.contains('vn-fonts'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.includes('Fraunces') && f.status === 'loaded'));
  const after = await box();
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
  after.lines.forEach((t, i) => expect(Math.abs(t - before.lines[i])).toBeLessThanOrEqual(1));
});

test('hero opening plays only after the first interaction, touches no LCP element and ends at rest', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, baseURL: test.info().project.use.baseURL, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto('/en/');
  await page.waitForLoadState('load');
  // A12: before any interaction the motion module has not even started, so nothing can animate yet.
  expect(await page.evaluate(() => 'scrollFx' in document.documentElement.dataset)).toBe(false);
  const opening = () => page.evaluate(() => document.getAnimations().filter((a) => /^vn-o-/.test((a as CSSAnimation).animationName ?? '')).length);
  // no interaction: nothing animates and nothing is hidden
  expect(await opening()).toBe(0);
  expect(await page.evaluate(() => 'heroOpen' in document.documentElement.dataset)).toBe(false);
  for (const sel of ['.vn-hero__strip', '.vn-hero__strap', '.vn-hero__actions > a', '.vn-hero-chip', '.vn-hero-badge', '.vn-hero__grid', '.vn-hero-portrait__frame']) {
    expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).opacity), sel).toBe('1');
  }
  await page.mouse.move(400, 300);
  await expect.poll(opening).toBeGreaterThan(5);
  // the LCP elements and their ancestors never carry an opening animation
  const lcp = await page.evaluate(() => {
    const els = ['h1.vn-hero__title', '.vn-hero__sub', '.vn-hero-portrait__img', '.vn-hero__inner', '.vn-hero__stage', '.vn-hero__copy', '.vn-hero'].map((s) => document.querySelector(s)!);
    return document.getAnimations().filter((a) => /^vn-o-/.test((a as CSSAnimation).animationName ?? '') && els.some((e) => { const t = (a.effect as KeyframeEffect).target as Element; return t.contains(e); })).length;
  });
  expect(lcp).toBe(0);
  await expect.poll(opening, { timeout: 8000 }).toBe(0);
  for (const sel of ['.vn-hero__strip', '.vn-hero__strap', '.vn-hero__actions > a', '.vn-hero-chip', '.vn-hero-badge', '.vn-hero__grid']) {
    const s = await page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.clipPath]; });
    expect(s, sel).toEqual(['1', 'none']);
  }
  await ctx.close();
});

test('hero opening is off under reduced motion and without JS', async ({ browser }) => {
  for (const opts of [{ reducedMotion: 'reduce' as const }, { javaScriptEnabled: false }]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, baseURL: test.info().project.use.baseURL, ...opts });
    const page = await ctx.newPage();
    await page.goto('/en/');
    await page.mouse.move(400, 300);
    const names = await page.locator('.vn-hero__strip, .vn-hero__strap, .vn-hero-chip, .vn-hero-badge, .vn-hero__actions > a').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(new Set(names)).toEqual(new Set(['none']));
    await ctx.close();
  }
});

// --- Persistent colour reveal, whole-hero pointer, parallax, idle loop, touch ---

type W = { __vnHeroRunning?: boolean; __vnHeroBrush?: { x: number; y: number } };
const running = (page: Page) => page.evaluate(() => (window as unknown as W).__vnHeroRunning);
const settled = (page: Page) =>
  page.waitForFunction(() => (window as unknown as W).__vnHeroRunning === false, undefined, { timeout: 4000 });

/** Share of canvas pixels the colour brush has revealed (alpha > 20). */
const revealed = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.vn-hero-portrait__canvas')!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return n / (d.length / 4);
  });

async function paintPortrait(page: Page) {
  const box = (await page.locator('[data-vn-portrait-wrap]').boundingBox())!;
  const cx = box.x + box.width / 2;
  for (let y = box.y + 40; y < box.y + box.height - 40; y += 30) {
    await page.mouse.move(cx + (y % 120) - 60, y, { steps: 4 });
  }
  await page.mouse.move(cx, box.y + box.height / 2, { steps: 4 });
  await settled(page);
  return box;
}

test.describe('hero pointer effects (fine pointer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/?vn-debug');
    await page.waitForLoadState('load');
  });

  test('moving outward in 20px steps up to 400px never drops the reveal, and it persists after leaving', async ({ page }) => {
    const box = await paintPortrait(page);
    let prev = await revealed(page);
    expect(prev).toBeGreaterThan(0.1);
    const cy = box.y + box.height / 2;
    const right = box.x + box.width;
    for (let d = 0; d <= 400; d += 20) {
      // The portrait sits near the right edge: past the viewport, continue outward diagonally down-left.
      const x = right + d <= 1360 ? right + d : 1360 - (right + d - 1360);
      const y = right + d <= 1360 ? cy : cy + (right + d - 1360);
      await page.mouse.move(x, y, { steps: 2 });
      await page.waitForTimeout(60);
      const now = await revealed(page);
      expect(now, `reveal dropped at ${d}px from the edge`).toBeGreaterThanOrEqual(prev - 0.005);
      prev = now;
    }
    // Leave the hero entirely: scroll its bottom into view and move below it.
    const bottom = await page.evaluate(() => {
      const h = document.querySelector('.vn-hero')!;
      scrollTo(0, h.getBoundingClientRect().bottom + scrollY - 500);
      return h.getBoundingClientRect().bottom;
    });
    await page.mouse.move(600, bottom + 60, { steps: 6 });
    await page.waitForTimeout(1500);
    expect(await revealed(page)).toBeGreaterThanOrEqual(prev - 0.005);
  });

  test('the brush follows continuously when the pointer goes far away (no snap back)', async ({ page }) => {
    await paintPortrait(page);
    await page.evaluate(() => {
      const w = window as unknown as W & { __s: { x: number; y: number }[] };
      w.__s = [];
      const tick = () => {
        if (w.__vnHeroBrush) w.__s.push({ ...w.__vnHeroBrush });
        if (w.__s.length < 400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const start = (await page.evaluate(() => (window as unknown as W).__vnHeroBrush))!;
    await page.mouse.move(30, 260, { steps: 40 });
    await settled(page);
    const s = await page.evaluate(() => (window as unknown as { __s: { x: number; y: number }[] }).__s);
    expect(s.length).toBeGreaterThan(10);
    let maxStep = 0;
    for (let i = 1; i < s.length; i++) maxStep = Math.max(maxStep, Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
    expect(maxStep).toBeLessThan(60);
    const end = s[s.length - 1];
    // The far left of the hero maps onto the left of the portrait: the brush travelled there, it did not reset.
    expect(end.x).toBeLessThan(start.x - 40);
    expect(end.x).toBeGreaterThanOrEqual(0);
  });

  test('parallax moves the layers with the pointer anywhere in the hero, never the h1 or sub-copy', async ({ page }) => {
    const sel = ['.vn-hero-portrait', '.vn-hero-chip', '.vn-hero-badge', '.vn-hero__grid', '[data-vn-hud]', 'h1.vn-hero__title', '.vn-hero__sub'];
    // The grid lines live on .vn-hero__grid::before and move with the translate property.
    const read = () =>
      page.evaluate((s) =>
        s.map((q) =>
          q === '.vn-hero__grid'
            ? getComputedStyle(document.querySelector(q)!, '::before').translate
            : getComputedStyle(document.querySelector(q)!).transform,
        ), sel);
    await page.mouse.move(80, 240, { steps: 5 });
    await settled(page);
    const a = await read();
    await page.mouse.move(1300, 760, { steps: 5 });
    await settled(page);
    const b = await read();
    for (let i = 0; i < 5; i++) {
      expect(a[i], sel[i]).not.toBe('none');
      expect(a[i], sel[i]).not.toBe(b[i]);
    }
    for (const t of [a[5], b[5], a[6], b[6]]) expect(t).toBe('none');
  });

  test('the rAF loop runs while moving and stops when the pointer is idle', async ({ page }) => {
    await page.mouse.move(500, 300, { steps: 3 });
    await page.mouse.move(700, 420, { steps: 8 });
    // The first move fetches the lazy hero-fx chunk; it starts the loop with the replayed position.
    await page.waitForFunction(() => (window as unknown as W).__vnHeroRunning !== undefined);
    await page.mouse.move(760, 460, { steps: 8 });
    expect(await running(page)).toBe(true);
    await settled(page);
    // Leaving eases the layers home, then stops as well.
    await page.evaluate(() => scrollTo(0, 3000));
    await page.mouse.move(700, 880, { steps: 3 });
    await settled(page);
    expect(await running(page)).toBe(false);
  });
});

test('the hero-fx chunk is not requested on load, only after the first pointer move', async ({ page }) => {
  const fx: string[] = [];
  page.on('request', (rq) => {
    if (/\/_astro\/hero-fx\./.test(rq.url())) fx.push(rq.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  expect(fx).toEqual([]);
  await page.mouse.move(500, 320, { steps: 4 });
  await expect.poll(() => fx.length).toBe(1);
  // The triggering position is replayed: the HUD shows it without a second move.
  await expect(page.locator('[data-vn-hud-live]')).toHaveText(/^X 0500 · Y 0\d{3} · 2026$/);
});

test('reduced motion: the hero is static (no brush, no parallax, no loop)', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/?vn-debug');
  await page.waitForLoadState('load');
  const box = (await page.locator('[data-vn-portrait-wrap]').boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 80, { steps: 10 });
  await page.mouse.move(80, 240, { steps: 10 });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({
    running: (window as unknown as W).__vnHeroRunning,
    wrap: getComputedStyle(document.querySelector('.vn-hero-portrait')!).transform,
    chip: getComputedStyle(document.querySelector('.vn-hero-chip')!).transform,
    canvas: getComputedStyle(document.querySelector('.vn-hero-portrait__canvas')!).display,
  }));
  expect(st).toEqual({ running: undefined, wrap: 'none', chip: 'none', canvas: 'none' });
  await expect(page.locator('.vn-hero-portrait__hint')).toBeHidden();
  await ctx.close();
});

test('touch: tapping the portrait blooms colour, with a tap caption', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/?vn-debug');
  await page.waitForLoadState('load');
  await expect(page.locator('.vn-hero-portrait__hint-tap')).toBeVisible();
  await expect(page.locator('.vn-hero-portrait__hint-hover')).toBeHidden();
  await expect(page.locator('.vn-hero-portrait__canvas')).toBeHidden();
  await page.locator('[data-vn-portrait-wrap]').tap({ position: { x: 120, y: 160 } });
  await expect(page.locator('.vn-hero-portrait__canvas')).toBeVisible();
  await settled(page);
  expect(await revealed(page)).toBeGreaterThan(0.02);
  await ctx.close();
});

test('touch: the colour blooms by itself after the first scroll, not on load', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: test.info().project.use.baseURL });
  const page = await ctx.newPage();
  const fx: string[] = [];
  page.on('request', (rq) => /\/_astro\/hero-fx\./.test(rq.url()) && fx.push(rq.url()));
  await page.goto('/?vn-debug');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  expect(fx).toEqual([]); // nothing on load
  await expect(page.locator('.vn-hero-portrait__canvas')).toBeHidden();
  await page.locator('[data-vn-portrait-wrap]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('.vn-hero-portrait__canvas')).toBeVisible({ timeout: 5000 });
  await settled(page);
  expect(await revealed(page)).toBeGreaterThan(0.2);
  // the image itself is untouched
  await expect(page.locator('.vn-hero-portrait__img')).toHaveCSS('opacity', '1');
  await ctx.close();
});
