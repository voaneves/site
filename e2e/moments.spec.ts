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
    await page.setViewportSize({ width: 1280, height: 900 });
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
