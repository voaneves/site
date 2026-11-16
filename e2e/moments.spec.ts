import { test, expect, type Page } from '@playwright/test';

// U7g: pinned moments. Proof board (Numbers, sticky chart + scroll-tied bars) and Track focus (Journey cards).
const ready = (page: Page) => expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
const scrollTo = (page: Page, y: number) => page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y);
const raf2 = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const pos = (page: Page) => page.locator('.vn-chart-panel').evaluate((el) => getComputedStyle(el).position);
const barScale = (page: Page) =>
  page.locator('.vn-chart-svg__fill').first().evaluate((el) => {
    const s = getComputedStyle(el).scale;
    return s === 'none' ? 1 : parseFloat(s);
  });

test.describe('moments, no-preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('sticky panel never traps content at the 1100x760 gate', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.goto('/');
    await ready(page);
    const m = await page.evaluate(() => {
      const p = document.querySelector('.vn-chart-panel') as HTMLElement;
      const nav = document.querySelector('.vn-navbar') as HTMLElement;
      return { h: p.getBoundingClientRect().height, nav: nav.offsetHeight, vh: innerHeight, pos: getComputedStyle(p).position };
    });
    expect(m.pos).toBe('sticky');
    expect(m.h + m.nav + 32).toBeLessThanOrEqual(m.vh - 32);
  });

  for (const theme of ['light', 'dark']) {
    test(`sticky panel engages at 1280 and not at 1024 (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('vn-theme', t), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/');
      await ready(page);
      expect(await pos(page)).toBe('sticky');
      await page.setViewportSize({ width: 1024, height: 900 });
      expect(await pos(page)).toBe('static');
      await page.setViewportSize({ width: 1280, height: 700 });
      expect(await pos(page)).toBe('static');
    });
  }

  test('panel stays pinned while the numbers row scrolls, and bars grow with progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await ready(page);
    const lower = page.locator('.vn-numbers-lower');
    const top = await lower.evaluate((el) => el.getBoundingClientRect().top + scrollY);
    const h = await lower.evaluate((el) => el.getBoundingClientRect().height);
    await scrollTo(page, top - 900 + 20);
    await raf2(page);
    const early = await barScale(page);
    await scrollTo(page, top - 300);
    await raf2(page);
    const mid = await barScale(page);
    await scrollTo(page, top + h);
    await raf2(page);
    const late = await barScale(page);
    expect(early).toBeLessThan(0.25);
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeCloseTo(1, 1);
    const tls = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.timeline instanceof ViewTimeline && (a.effect as KeyframeEffect).target?.classList.contains('vn-chart-svg__fill')).length,
    );
    expect(tls).toBeGreaterThan(0);
  });

  test('journey cards scale by inline position on the track', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/');
    await ready(page);
    const track = page.locator('[data-vn-journey]');
    await track.scrollIntoViewIfNeeded();
    await raf2(page);
    const scales = () =>
      page.locator('.vn-journey-card').evaluateAll((els) => els.map((el) => (getComputedStyle(el).scale === 'none' ? 1 : parseFloat(getComputedStyle(el).scale))));
    const s0 = await scales();
    expect(s0[0]).toBeCloseTo(1, 1);
    expect(Math.min(...s0)).toBeLessThan(1); // a card off the right edge is scaled down
    expect(Math.min(...s0)).toBeGreaterThanOrEqual(0.9);
    await track.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
    await raf2(page);
    const s1 = await scales();
    expect(s1[s1.length - 1]).toBeCloseTo(1, 1);
    // text is never faded: cards keep full opacity at any position
    expect(await page.locator('.vn-journey-card').evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === '1'))).toBe(true);
  });

  test('focus stays visible: Tab lands on the track, arrows move it, sticky panel never covers the focused element', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await ready(page);
    const track = page.locator('[data-vn-journey]');
    await track.focus();
    await page.keyboard.press('ArrowRight');
    await raf2(page);
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-vn-journey'))).toBe(true);
    // Tab through the Numbers section: each focused control must not sit under the pinned chart panel or the header
    await page.locator('#numeros').scrollIntoViewIfNeeded();
    const links = page.locator('#numeros a, #numeros button');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      await links.nth(i).focus();
      await raf2(page);
      const ok = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement;
        const r = a.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const panel = document.querySelector('.vn-chart-panel')!;
        return !panel.contains(hit) || panel.contains(a);
      });
      expect(ok).toBe(true);
    }
  });

  test('mobile: a service card opens from an inset frame as it enters', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await ready(page);
    const card = page.locator('.vn-service-card').nth(1);
    const clip = (p: number) =>
      page.evaluate(async (q) => {
        const el = document.querySelectorAll('.vn-service-card')[1];
        const place = () => { const r = el.getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight + q * Math.min(r.height, innerHeight), behavior: 'instant' }); };
        place();
        await new Promise((r) => setTimeout(r, 150));
        place();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return getComputedStyle(el).clipPath;
      }, p);
    expect(await clip(0.05)).toMatch(/^inset\(/);
    expect(await clip(0.95)).toBe('none');
    await card.locator('a').focus();
    await expect.poll(() => card.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  });

  test('the marquee speeds up while scrolling and eases back to 1', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await ready(page);
    await page.locator('.vn-marquee-stack').scrollIntoViewIfNeeded();
    const rate = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('.vn-marquee-stack .vn-marquee__track')].flatMap((e) => e.getAnimations().map((a) => a.playbackRate))));
    await expect.poll(rate).toBe(1);
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) {
        scrollBy({ top: i % 2 ? -160 : 200, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    expect(await rate()).toBeGreaterThan(1.5);
    await expect.poll(rate, { timeout: 4000 }).toBe(1);
  });
});

test.describe('moments, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no timelines and no dimming; sticky is layout only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.locator('#jornada').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.dataset.scrollFx ?? null)).toBeNull();
    const info = await page.evaluate(() => ({
      anim: document.getAnimations().filter((a) => a.timeline instanceof ViewTimeline).length,
      cards: [...document.querySelectorAll('.vn-journey-card')].every((el) => getComputedStyle(el).scale === 'none' && getComputedStyle(el).opacity === '1'),
      bar: getComputedStyle(document.querySelector('.vn-chart-svg__fill')!).scale,
    }));
    expect(info.anim).toBe(0);
    expect(info.cards).toBe(true);
    expect(info.bar).toBe('none');
  });
});

test.describe('moments, timeline fallback', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('without view timelines the sheet is BASE only: bars and cards are plain', async ({ page }) => {
    await page.addInitScript(() => {
      const s = CSS.supports.bind(CSS);
      CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? s(a) : s(a, b))) as typeof CSS.supports;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('base');
    const r = await page.evaluate(() => ({
      sticky: getComputedStyle(document.querySelector('.vn-chart-panel')!).position,
      jt: [...document.getAnimations()].some((a) => (a as CSSAnimation).animationName === 'vn-jt-in'),
    }));
    expect(r.sticky).toBe('sticky'); // BASE layout rule still applies
    expect(r.jt).toBe(false);
  });
});
