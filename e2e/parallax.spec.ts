import { test, expect, type Page } from '@playwright/test';
import { engage } from './lib/site';

test.use({ reducedMotion: 'no-preference' });

const tl = (p: Page) => p.evaluate(() => document.documentElement.dataset.scrollFx);
const ready = async (p: Page) => {
  await p.goto('/');
  await engage(p);
  await expect.poll(() => tl(p)).toBeTruthy();
  return (await tl(p)) === 'tl';
};
const raf2 = (p: Page) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const sel = '.vn-hero-portrait__img';

test('hero portrait is identity at load and zooms/drifts within 1.15 / 6% on scroll', async ({ page }) => {
  const isTl = await ready(page);
  test.skip(!isTl, 'view timelines unsupported');
  const read = () => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)!); return { scale: c.scale, translate: c.translate, opacity: c.opacity }; }, sel);
  const top = await read();
  expect(top.opacity).toBe('1');
  expect(['none', '1']).toContain(top.scale);
  expect(['none', '0px', '0px 0px', '0px 0%']).toContain(top.translate);
  await page.evaluate(() => scrollTo({ top: innerHeight, behavior: 'instant' }));
  await raf2(page);
  const end = await read();
  expect(parseFloat(end.scale)).toBeCloseTo(1.15, 2);
  expect(parseFloat(end.translate.split(' ')[1])).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo({ top: innerHeight / 2, behavior: 'instant' }));
  await raf2(page);
  expect(parseFloat((await read()).scale)).toBeCloseTo(1.075, 1);
});

test('project thumbnails drift ±8% at 1.18 and always cover their clip', async ({ page }) => {
  const isTl = await ready(page);
  test.skip(!isTl, 'view timelines unsupported');
  const cover = (frac: number) => page.evaluate((f) => {
    const m = document.querySelector('.vn-project-row__media')!;
    const r = m.getBoundingClientRect();
    const y = scrollY + r.top - innerHeight + (r.height + innerHeight) * f;
    scrollTo({ top: y, behavior: 'instant' });
    return new Promise<{ s: string; ok: boolean }>((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const i = m.querySelector('img')!.getBoundingClientRect();
      const mr = m.getBoundingClientRect();
      res({ s: getComputedStyle(m.querySelector('img')!).scale, ok: i.top <= mr.top + 0.5 && i.bottom >= mr.bottom - 0.5 && i.left <= mr.left + 0.5 && i.right >= mr.right - 0.5 });
    })));
  }, frac);
  for (const f of [0.02, 0.5, 0.98]) {
    const r = await cover(f);
    expect(parseFloat(r.s)).toBeCloseTo(1.18, 2);
    expect(r.ok).toBe(true);
  }
  const tr = await page.evaluate(() => getComputedStyle(document.querySelector('.vn-project-row__media img')!).translate);
  expect(parseFloat(tr.split(' ')[1])).toBeGreaterThan(4);
});

test('reduced motion: no parallax transforms', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() => scrollTo({ top: innerHeight, behavior: 'instant' }));
  await raf2(page);
  const s = await page.evaluate((q) => getComputedStyle(document.querySelector(q)!).scale, sel);
  expect(['none', '1']).toContain(s);
  await ctx.close();
});

test('TL unsupported: base fallback leaves images untransformed', async ({ page }) => {
  await page.addInitScript(() => {
    const o = CSS.supports.bind(CSS);
    CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? o(a) : o(a, b))) as typeof CSS.supports;
  });
  await page.goto('/');
  await engage(page);
  await expect.poll(() => tl(page)).toBe('base');
  await page.evaluate(() => scrollTo({ top: innerHeight, behavior: 'instant' }));
  await raf2(page);
  const s = await page.evaluate((q) => getComputedStyle(document.querySelector(q)!).scale, sel);
  expect(['none', '1']).toContain(s);
});

test('animations are really bound to scroll/view timelines', async ({ page }) => {
  const isTl = await ready(page);
  test.skip(!isTl, 'view timelines unsupported');
  const r = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s)!;
    const names = [q('.vn-hero-portrait__img'), q('.vn-project-row__media img')].map((e) => getComputedStyle(e).animationName);
    const tls = document.getAnimations().map((a) => a.timeline?.constructor.name);
    return { names, hasScroll: tls.includes('ScrollTimeline'), hasView: tls.includes('ViewTimeline') };
  });
  expect(r.names).toEqual(['vn-pz', 'vn-pt']);
  expect(r.hasScroll && r.hasView).toBe(true);
});

test('hero badge turns with scroll and keeps its time-based spin', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const isTl = await ready(page);
  test.skip(!isTl, 'view timelines unsupported');
  const turn = page.locator('.vn-hero-badge__turn');
  expect(['none', '0deg']).toContain(await turn.evaluate((e) => getComputedStyle(e).rotate));
  await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
  await raf2(page);
  const deg = parseFloat(await turn.evaluate((e) => getComputedStyle(e).rotate));
  expect(deg).toBeGreaterThan(90);
  expect(deg).toBeLessThan(110);
  expect(await page.locator('.vn-hero-badge__svg').evaluate((e) => getComputedStyle(e).animationName)).toBe('vn-spin');
  const box = await page.locator('.vn-hero-badge').evaluate((e) => [e.clientWidth, e.clientHeight]);
  expect(box).toEqual([110, 110]); // the wrapper did not change the badge size
});
