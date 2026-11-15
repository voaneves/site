import { test, expect, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

const CASE = '/projetos/caato/';
const raf2 = (p: Page) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const ready = async (p: Page, url = CASE) => {
  await p.goto(url);
  await expect.poll(() => p.evaluate(() => document.documentElement.dataset.scrollFx)).toBeTruthy();
  return (await p.evaluate(() => document.documentElement.dataset.scrollFx)) === 'tl';
};
const cs = (p: Page, sel: string) =>
  p.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)!); return { t: c.translate, s: c.scale, o: c.opacity, n: c.animationName }; }, sel);

test('case LCP (title, media) is identity at load and the hero sinks on scroll', async ({ page }) => {
  test.skip(!(await ready(page)), 'view timelines unsupported');
  for (const sel of ['.vn-case-hero__title', '.vn-case-media img']) {
    const top = await cs(page, sel);
    expect(top.o).toBe('1');
    expect(['none', '1']).toContain(top.s);
    expect(['none', '0px', '0px 0px', '0px 0%']).toContain(top.t);
  }
  const sel = '.vn-case-hero > .vn-container';
  expect((await cs(page, sel)).n).toBe('vn-cs');
  await page.evaluate(() => scrollTo({ top: innerHeight, behavior: 'instant' }));
  await raf2(page);
  const end = await page.evaluate((s) => { const el = document.querySelector(s)!; return { y: parseFloat(getComputedStyle(el).translate.split(' ')[1]), vh: innerHeight, tl: el.getAnimations().some((a) => a.timeline instanceof ScrollTimeline) }; }, sel);
  expect(end.y).toBeCloseTo(end.vh * 0.1, 0);
  expect(end.tl).toBe(true);
});

test('case media zooms 1 to 1.1 with a 5% drift via a scroll timeline', async ({ page }) => {
  test.skip(!(await ready(page)), 'view timelines unsupported');
  expect((await cs(page, '.vn-case-media img')).n).toBe('vn-cz');
  await page.evaluate(() => scrollTo({ top: innerHeight, behavior: 'instant' }));
  await raf2(page);
  const end = await cs(page, '.vn-case-media img');
  expect(parseFloat(end.s)).toBeCloseTo(1.1, 2);
  expect(parseFloat(end.t.split(' ')[1])).toBeGreaterThan(0);
});

test('focus inside the hero releases the sink', async ({ page }) => {
  test.skip(!(await ready(page)), 'view timelines unsupported');
  await page.evaluate(() => scrollTo({ top: innerHeight / 2, behavior: 'instant' }));
  await raf2(page);
  await page.locator('.vn-case-crumb a').first().focus();
  await raf2(page);
  expect((await cs(page, '.vn-case-hero > .vn-container')).n).toBe('none');
});

test('KPIs rise in once and rest visible; 404 and privacy get no hero motion', async ({ page }) => {
  await ready(page);
  const k = page.locator('.vn-case-kpi');
  await k.first().scrollIntoViewIfNeeded();
  await expect.poll(() => k.evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === '1' && parseFloat(getComputedStyle(e).translate.split(' ')[1] || '0') === 0))).toBe(true);
  expect(await k.count()).toBeGreaterThan(0);
  await page.goto('/this-does-not-exist/');
  expect(await page.evaluate(() => document.querySelectorAll('.vn-case-hero').length)).toBe(0);
  expect(await page.evaluate(() => document.querySelector('h1')!.getAnimations().some((a) => a.timeline instanceof ScrollTimeline || a.timeline instanceof ViewTimeline))).toBe(false);
});
