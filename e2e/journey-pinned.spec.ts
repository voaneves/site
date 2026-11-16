import { test, expect, type Page } from '@playwright/test';

// C3: pinned horizontal Jornada (desktop, fine pointer, scroll timelines). Carousel mode: journey.spec.ts.
const ready = async (page: Page, url = '/') => {
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
  await page.evaluate(() => document.documentElement.classList.add('vn-cv-off')); // real heights everywhere
  await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-ready', '', { timeout: 10_000 }).catch(async () => {
    await page.locator('#jornada').scrollIntoViewIfNeeded(); // journey.ts loads when the section nears
    await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-ready', '');
  });
};
const geo = (page: Page) =>
  page.evaluate(() => {
    const run = document.querySelector<HTMLElement>('.vn-journey-run')!;
    const top = run.getBoundingClientRect().top + scrollY;
    return { top, span: run.offsetHeight - innerHeight, h: run.offsetHeight, vh: innerHeight, vw: document.documentElement.clientWidth };
  });
const at = async (page: Page, p: number) => {
  const g = await geo(page);
  await page.evaluate(async (y) => {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, g.top + p * g.span);
  return g;
};
const cardsX = (page: Page) =>
  page.locator('.vn-journey-card').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));

test.describe('journey pinned', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

  test('mode: sticky pin in a tall runway, track on a view timeline, ghost shown, no inner scroller', async ({ page }) => {
    await ready(page);
    const m = await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>('[data-vn-journey]')!;
      const cs = getComputedStyle(t);
      const ghost = document.querySelector<HTMLElement>('.vn-journey-ghost')!;
      return {
        anim: cs.animationName, ox: cs.overflowX, tl: t.getAnimations().some((a) => a.timeline instanceof ViewTimeline),
        pin: getComputedStyle(document.querySelector('.vn-journey-pin')!).position,
        cardAnim: getComputedStyle(document.querySelector('.vn-journey-card')!).animationName,
        ghost: getComputedStyle(ghost).display, ghostHidden: ghost.getAttribute('aria-hidden'),
        scrollable: t.scrollWidth - t.clientWidth,
      };
    });
    expect(m.anim).toBe('vn-jpin');
    expect(m.tl).toBe(true);
    expect(m.ox).toBe('visible');
    expect(m.pin).toBe('sticky');
    expect(m.cardAnim).toBe('none');
    expect(m.ghost).toBe('block');
    expect(m.ghostHidden).toBe('true');
    expect(m.scrollable).toBeLessThanOrEqual(1);
    const g = await geo(page);
    expect(g.h).toBeGreaterThan(g.vh + 1500);
  });

  test('vertical scroll carries the row: first card at the start, last card fully in at the end', async ({ page }) => {
    await ready(page);
    const g = await at(page, 0);
    // the content column's left edge, read from the pin's own container: the head's container is scaled by the u-drift exit
      const lead = await page.locator('.vn-journey-progress').evaluate((e) => e.getBoundingClientRect().left);
    let xs = await cardsX(page);
    expect(Math.abs(xs[0][0] - lead)).toBeLessThanOrEqual(2);
    expect(xs.at(-1)![1]).toBeGreaterThan(g.vw);
    expect(await page.locator('.vn-journey-pin').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);
    await at(page, 0.5);
    const mid = await cardsX(page);
    expect(mid[0][0]).toBeLessThan(xs[0][0] - 300);
    expect(await page.locator('.vn-journey-pin').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);
    await at(page, 1);
    xs = await cardsX(page);
    expect(xs.at(-1)![1]).toBeLessThanOrEqual(g.vw + 1); // if this fails after cards were added or removed, fix --j-n in fx/journey-pin.css
    expect(xs.at(-1)![1]).toBeGreaterThan(g.vw - 200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('counter and bar follow the scroll', async ({ page }) => {
    await ready(page);
    const count = page.locator('[data-journey-count]');
    const bar = () => page.locator('[data-journey-bar]').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
    await at(page, 0);
    await expect(count).toHaveText(/^01 \/ 08$/);
    expect(await bar()).toBeCloseTo(0.125, 1);
    await at(page, 0.5);
    await expect(count).toHaveText(/^0[45] \/ 08$/);
    await at(page, 1);
    await expect(count).toHaveText(/^08 \/ 08$/);
    expect(await bar()).toBeCloseTo(1, 1);
  });

  test('next button and arrow keys scroll the page to the next card', async ({ page }) => {
    await ready(page);
    const g = await at(page, 0);
    await page.locator('[data-journey-next]').click();
    await expect(page.locator('[data-journey-count]')).toHaveText(/^02 \//, { timeout: 4000 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(g.top + g.span / 7 - 6);
    await page.locator('[data-vn-journey]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-journey-count]')).toHaveText(/^03 \//, { timeout: 4000 });
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-journey-count]')).toHaveText(/^02 \//, { timeout: 4000 });
    expect(await page.locator('[data-vn-journey]').evaluate((e) => e.scrollLeft)).toBe(0);
  });

  test('mouse drag scrolls the page, a vertical wheel over the row scrolls the page', async ({ page }) => {
    await ready(page);
    const g = await at(page, 0.2);
    const y0 = await page.evaluate(() => scrollY);
    const box = (await page.locator('.vn-journey-card').nth(2).boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x - 260, box.y + 80, { steps: 8 });
    await page.mouse.up();
    const travel = await page.locator('[data-vn-journey]').evaluate((e) => (e as HTMLElement).offsetWidth - innerWidth);
    const want = y0 + 300 * (g.span / travel);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(want - 40);
    expect(await page.evaluate(() => scrollY)).toBeLessThan(want + 40);
    const y1 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y1 + 100);
  });

  test('header ground and active nav link stay on Jornada through the pin; a later anchor lands', async ({ page }) => {
    await ready(page);
    await page.waitForSelector('.vn-navbar[data-flip]');
    await at(page, 0.5);
    await expect.poll(() => page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.vn-navbar')!;
      return nav.style.getPropertyValue('--vn-surface') === getComputedStyle(document.querySelector('#jornada')!).backgroundColor;
    })).toBe(true);
    await expect(page.locator('.vn-navbar__link[data-nav-hash="jornada"]')).toHaveClass(/is-active/);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.locator('.vn-navbar__link[data-nav-hash="projetos"]').click();
    await expect.poll(() => page.evaluate(() => {
      const r = document.getElementById('projetos')!.getBoundingClientRect();
      return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
    }), { timeout: 10_000 }).toBe(true);
  });

  test('english has the same pinned chapter', async ({ page }) => {
    await ready(page, '/en/');
    expect(await page.locator('[data-vn-journey]').evaluate((e) => getComputedStyle(e).animationName)).toBe('vn-jpin');
    await expect(page.locator('.vn-journey-ghost')).toHaveText(/journey/i);
  });
});

test.describe('journey pinned: fallbacks keep the carousel', () => {
  const carousel = async (page: Page) => {
    const t = page.locator('[data-vn-journey]');
    expect(await t.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    expect(await t.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
    await expect(page.locator('.vn-journey-ghost')).toBeHidden();
    expect(await page.locator('.vn-journey-pin').evaluate((e) => getComputedStyle(e).position)).toBe('static');
  };

  test('reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1200);
    await carousel(page);
    await ctx.close();
  });

  test('no scroll timelines (CSS.supports stub)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const s = CSS.supports.bind(CSS);
      CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? s(a) : s(a, b))) as typeof CSS.supports;
    });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('base');
    await carousel(page);
    await ctx.close();
  });

  test('touch, narrow and short windows', async ({ browser }) => {
    for (const opts of [
      { viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true },
      { viewport: { width: 1024, height: 900 } },
      { viewport: { width: 1440, height: 600 } },
    ]) {
      const ctx = await browser.newContext({ reducedMotion: 'no-preference', baseURL: test.info().project.use.baseURL, ...opts });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
      await carousel(page);
      await ctx.close();
    }
  });

  test('no JS', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    await carousel(page);
    await ctx.close();
  });
});
