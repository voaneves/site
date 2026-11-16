import { test, expect, type Page } from '@playwright/test';

// U7e: fx/text.css. Paragraph word rise, eyebrow clip wipe, rules that draw in.
test.use({ reducedMotion: 'no-preference' });

async function ready(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.scrollFx !== undefined);
}

test('unentered lines words sit below a clip window; entered ones settle', async ({ page }) => {
  await ready(page);
  const p = page.locator('#servicos [data-enter=lines]');
  await expect(p.locator('.vn-w').first()).toBeAttached();
  const before = await p.locator('.vn-w').first().evaluate((e) => { const c = getComputedStyle(e); return [c.position, c.top, c.clipPath]; });
  expect(before[0]).toBe('relative');
  expect(before[1]).not.toBe('0px');
  expect(before[2]).toContain('inset');
  await expect(p).toHaveCSS('opacity', '1');
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator('xpath=..')).toHaveClass(/is-in/);
  await expect.poll(() => p.locator('.vn-w').first().evaluate((e) => getComputedStyle(e).top), { timeout: 4000 }).toBe('0px');
});

test('lines words ride the M ladder with a per-line delay', async ({ page }) => {
  await ready(page);
  const p = page.locator('#quem-sou [data-enter=lines]');
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator('xpath=..')).toHaveClass(/is-in/);
  const ws = await p.locator('.vn-w').evaluateAll((els) => {
    const last = els.at(-1) as HTMLElement;
    const c = getComputedStyle(last);
    const block = last.closest('[data-enter=lines]') as HTMLElement;
    return [c.transitionDuration, c.transitionTimingFunction, c.transitionDelay, last.style.getPropertyValue('--l'), block.style.getPropertyValue('--ls')];
  });
  // B1: lamalama timing, .85 s expo-out, .15 s base delay plus the block's per-line step --ls
  expect(ws[0]).toBe('0.85s, 0.85s, 0.85s');
  expect(ws[1]).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  expect(parseFloat(ws[2])).toBeCloseTo(0.15 + Number(ws[3]) * (parseFloat(ws[4]) / 1000), 2);
});

test('lines blocks take the same space with and without the motion layout', async ({ browser }) => {
  const measure = async (reducedMotion: 'reduce' | 'no-preference') => {
    const ctx = await browser.newContext({ reducedMotion, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1000);
    const n = await page.locator('[data-enter=lines]').count();
    const r: number[] = [];
    for (let i = 0; i < n; i++) {
      const el = page.locator('[data-enter=lines]').nth(i);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      r.push(await el.evaluate((e) => Math.round(e.getBoundingClientRect().height)));
    }
    await ctx.close();
    return r;
  };
  expect(await measure('no-preference')).toEqual(await measure('reduce'));
});

test('eyebrows wipe in with a clip at S .4 s', async ({ page }) => {
  await ready(page);
  const e = page.locator('#contato .vn-eyebrow[data-enter]');
  const hidden = await e.evaluate((el) => getComputedStyle(el).clipPath);
  expect(hidden).toContain('inset(0px 100%');
  await e.scrollIntoViewIfNeeded();
  await expect(e.locator('xpath=..')).toHaveClass(/is-in/);
  const t = await e.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(t.split(', ').at(-1)).toBe('0.4s');
  await expect.poll(() => e.evaluate((el) => getComputedStyle(el).clipPath), { timeout: 4000 }).toMatch(/inset\(0px(?: 0%| 0px)*\)|inset\(0px 0% 0px 0px\)/);
});

test('rules: the border hands over to a scrubbed hairline where view timelines exist', async ({ page }) => {
  await ready(page);
  const row = page.locator('.vn-faq-item').first();
  const r = await row.evaluate((e) => {
    const a = getComputedStyle(e, '::after');
    return [getComputedStyle(e).borderBottomColor, a.height, a.animationName, e.getAnimations({ subtree: true }).some((x) => x.timeline && 'subject' in x.timeline)];
  });
  expect(r[0]).toBe('rgba(0, 0, 0, 0)');
  expect(r[1]).toBe('1px');
  expect(r[2]).toBe('vn-hair');
  expect(r[3]).toBe(true);
});

test('without timelines the real borders stay; reduced motion hides nothing', async ({ browser }) => {
  const a = await browser.newContext({ reducedMotion: 'no-preference' });
  const p1 = await a.newPage();
  await p1.addInitScript(() => {
    const s = CSS.supports.bind(CSS);
    CSS.supports = ((q: string, v?: string) => (String(q).includes('animation-timeline') ? false : v === undefined ? s(q) : s(q, v))) as typeof CSS.supports;
  });
  await p1.goto('/');
  await p1.waitForFunction(() => document.documentElement.dataset.scrollFx === 'base');
  const c = await p1.locator('.vn-faq-item').first().evaluate((e) => getComputedStyle(e).borderBottomColor);
  expect(c).not.toBe('rgba(0, 0, 0, 0)');
  await a.close();
  const b = await browser.newContext({ reducedMotion: 'reduce' });
  const p2 = await b.newPage();
  await p2.goto('/');
  await expect(p2.locator('#quem-sou [data-enter=lines]')).toHaveCSS('opacity', '1');
  await expect(p2.locator('.vn-eyebrow[data-enter]').first()).toHaveCSS('clip-path', 'none');
  expect(await p2.locator('.vn-faq-item').first().evaluate((e) => getComputedStyle(e).borderBottomColor)).not.toBe('rgba(0, 0, 0, 0)');
  await b.close();
});
