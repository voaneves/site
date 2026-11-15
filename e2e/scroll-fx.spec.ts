import { test, expect, type Page } from '@playwright/test';

const CHUNK = /\/_astro\/scroll-fx\./;
const T1 = 'Uma frase de teste com vários termos e um link no meio.';

function track(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (rq) => {
    if (CHUNK.test(rq.url())) hits.push(rq.url());
  });
  return hits;
}

// Two [data-enter=lines] probes exist before the idle chunk runs: one fresh, one already entered.
async function probes(page: Page) {
  await page.addInitScript((t) => {
    addEventListener('DOMContentLoaded', () => {
      const a = document.createElement('p');
      a.id = 'fx-a';
      a.setAttribute('data-enter', 'lines');
      a.innerHTML = 'Uma frase de teste com vários <a href="#x">termos</a> e um link no meio.';
      const b = document.createElement('p');
      b.id = 'fx-b';
      b.className = 'is-in';
      b.setAttribute('data-enter', 'lines');
      b.textContent = t;
      document.querySelector('main')!.append(a, b);
    });
  }, T1);
}

test.describe('scroll-fx, no-preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('lazy loads on idle, also on a touch phone, and adopts one sheet', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const hits = track(page);
    await page.goto('/');
    await expect.poll(() => hits.length).toBe(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBeTruthy();
    expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBeGreaterThanOrEqual(1);
    await ctx.close();
  });

  test('TL is adopted only when view timelines are supported', async ({ page, browser }) => {
    await page.goto('/');
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe(supported ? 'tl' : 'base');
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => {
      const s = CSS.supports.bind(CSS);
      CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? s(a) : s(a, b))) as typeof CSS.supports;
    });
    await p2.goto('/');
    await expect.poll(() => p2.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('base');
    // no top-level timeline @supports rule survives in the adopted sheet
    const tlRules = await p2.evaluate(() =>
      document.adoptedStyleSheets.flatMap((s) => [...(s.cssRules[0] as CSSGroupingRule).cssRules]).filter((r) => /animation-timeline/.test((r as CSSSupportsRule).conditionText ?? '')).length,
    );
    expect(tlRules).toBe(0);
    await ctx.close();
  });

  test('word split keeps textContent and the accessible name', async ({ page }) => {
    await probes(page);
    await page.goto('/');
    const before = await page.evaluate(() => document.getElementById('fx-a')!.textContent);
    await expect.poll(() => page.evaluate(() => document.getElementById('fx-a')!.querySelectorAll('.vn-w').length)).toBeGreaterThan(5);
    const after = await page.evaluate(() => document.getElementById('fx-a')!.textContent);
    expect(after).toBe('Uma frase de teste com vários termos e um link no meio.');
    expect(after).toBe(before);
    await expect(page.locator('#fx-a')).toHaveText('Uma frase de teste com vários termos e um link no meio.');
    expect(await page.locator('#fx-a').ariaSnapshot()).toContain('Uma frase de teste com vários');
    await expect(page.locator('#fx-a a')).toHaveAccessibleName('termos');
    expect(await page.locator('#fx-a a .vn-w').count()).toBe(1);
  });

  test('no split once .is-in', async ({ page }) => {
    await probes(page);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBeTruthy();
    expect(await page.locator('#fx-b .vn-w').count()).toBe(0);
    await expect(page.locator('#fx-b')).toHaveText(T1);
  });
});

test.describe('scroll-fx, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no request, no sheet', async ({ page }) => {
    const hits = track(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    expect(hits).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.dataset.scrollFx ?? null)).toBeNull();
  });
});
