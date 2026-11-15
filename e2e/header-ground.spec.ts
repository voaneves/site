// U7b: the navbar takes the ground of the section under a 1px line at the header's mid-height (WOW-PLAN §U7.3).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Theme = 'light' | 'dark';
const SECS = ['#inicio', '#quem-sou', '#numeros', '#expertise', '#jornada', '#projetos', '#servicos', '#perguntas', '#contato'];  // the footer is shorter than the viewport, so the header line never reaches it

async function open(page: Page, theme: Theme) {
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('vn-seeded')) return;
    sessionStorage.setItem('vn-seeded', '1');
    localStorage.setItem('vn-theme', t);
  }, theme);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
}

// Scroll so the probe line (header mid-height) sits `off` px inside the section.
async function probe(page: Page, sel: string, off = sel === '#contato' ? 120 : 6) {
  await page.evaluate(([s, o]) => {
    const h = document.querySelector<HTMLElement>('.vn-navbar')!.offsetHeight;
    const r = document.querySelector(s as string)!.getBoundingClientRect();
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, Math.min(max, scrollY + r.top - h / 2 + (o as number)));
  }, [sel, off] as const);
}

const state = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const nav = document.querySelector<HTMLElement>('.vn-navbar')!;
    const c = getComputedStyle(document.querySelector(s)!);
    return {
      surface: nav.style.getPropertyValue('--vn-surface'), bg: c.backgroundColor,
      color: nav.style.color, fg: c.color, scheme: nav.style.colorScheme, line: nav.style.getPropertyValue('--vn-line'), gline: c.getPropertyValue('--vn-line').trim(),
    };
  }, sel);

const settled = async (page: Page, sel: string) => {
  await expect.poll(async () => { const s = await state(page, sel); return s.surface === s.bg && s.color === s.fg && (s.line === s.gline || s.gline.startsWith('light-dark')) ? 'ok' : `${sel} ${JSON.stringify(s)}`; }).toBe('ok');
};

for (const theme of ['light', 'dark'] as Theme[]) {
  test.describe(`header ground · ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test(`navbar equals each section's ground (${theme})`, async ({ page }) => {
      await open(page, theme);
      for (const sel of SECS) {
        await probe(page, sel);
        await settled(page, sel);
        const s = await state(page, sel);
        expect(['light', 'dark']).toContain(s.scheme);
      }
    });

    test(`navbar contrast stays AA on every ground (${theme})`, async ({ page }) => {
      await open(page, theme);
      for (const sel of SECS) {
        await probe(page, sel);
        await settled(page, sel);
        const res = await new AxeBuilder({ page }).include('.vn-navbar').withTags(['wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(res.violations.filter((v) => v.id === 'color-contrast').map((v) => `${sel}:${v.nodes.map((n) => n.target.join())}`)).toEqual([]);
      }
    });
  });
}

test.describe('header ground · behaviours', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('toggling the theme mid-page re-applies the ground', async ({ page }) => {
    await open(page, 'light');
    await probe(page, '#numeros');
    await settled(page, '#numeros');
    const before = await state(page, '#numeros');
    await page.click('#vn-theme-toggle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await probe(page, '#numeros');
    await settled(page, '#numeros');
    expect((await state(page, '#numeros')).surface).not.toBe(before.surface);
  });

  for (const theme of ['light', 'dark'] as Theme[]) {
    test(`signal ground gives ink text and a light scheme (${theme})`, async ({ page }) => {
      await open(page, theme);
      await probe(page, '#contato');
      await settled(page, '#contato');
      const s = await state(page, '#contato');
      expect(s.surface).toBe('rgb(245, 0, 0)');
      expect(s.scheme).toBe('light');
      expect(s.color).toBe(s.fg);
    });
  }

  test('theme-color follows the ground: hero at top, Numbers mid-page', async ({ page }) => {
    await open(page, 'light');
    const meta = () => page.locator('meta[name="theme-color"]').first().getAttribute('content');
    await expect.poll(meta).toBe('#fdfbf6');
    await probe(page, '#numeros');
    await expect.poll(meta).toBe('#0a0a0a');
  });

  test('resize keeps the line at the header mid-height', async ({ page }) => {
    await open(page, 'light');
    await page.setViewportSize({ width: 1000, height: 600 });
    await probe(page, '#quem-sou');
    await settled(page, '#quem-sou');
    await probe(page, '#numeros');
    await settled(page, '#numeros');
    expect((await state(page, '#numeros')).surface).toBe('rgb(10, 10, 10)');
  });

  test('without JS the header keeps its default ground', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await page.goto('/');
    expect(await page.evaluate(() => document.querySelector<HTMLElement>('.vn-navbar')!.getAttribute('style'))).toBeNull();
    await ctx.close();
  });
});
