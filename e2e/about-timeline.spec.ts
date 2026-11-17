import { test, expect, type Page } from '@playwright/test';
import { engage, settle } from './lib/site';

// "Quem sou": portrait that reveals (frame + colour ink over a grey base) and the trajectory timeline with its rail.
const LOCALES = [
  {
    name: 'pt',
    url: '/',
    items: [
      { org: 'ALETO', period: 'Mar 2026 — Atual' },
      { org: 'SEBRAE Tocantins', period: 'Set 2022 — Mar 2026' },
      { org: 'DIO', period: '2023 — 2025' },
    ],
  },
  {
    name: 'en',
    url: '/en/',
    items: [
      { org: 'ALETO', period: 'Mar 2026 — Present' },
      { org: 'SEBRAE Tocantins', period: 'Sep 2022 — Mar 2026' },
      { org: 'DIO', period: '2023 — 2025' },
    ],
  },
];

const grid = (p: Page) => p.locator('#quem-sou .vn-about-grid');
const ink = (p: Page) => p.locator('#quem-sou .vn-about-portrait__ink');
const clip = (p: Page) => ink(p).evaluate((e) => getComputedStyle(e).clipPath);

async function engineReady(page: Page) {
  await engage(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx), { timeout: 15000 }).toBeTruthy();
}

for (const L of LOCALES) {
  test.describe(`quem sou, retrato e trajetoria (${L.name})`, () => {
    test.use({ viewport: { width: 1366, height: 800 }, reducedMotion: 'no-preference' });

    test('timeline: 3 nos na ordem, o primeiro e o atual', async ({ page }) => {
      await page.goto(L.url);
      const items = page.locator('#quem-sou .vn-timeline-item');
      await expect(items).toHaveCount(3);
      for (const [i, it] of L.items.entries()) {
        await expect(items.nth(i).locator('h4')).toHaveText(it.org);
        await expect(items.nth(i).locator('.vn-about-tl__period')).toHaveText(it.period);
      }
      await expect(items.nth(0)).toHaveAttribute('data-current', '');
      await expect(items.nth(1)).not.toHaveAttribute('data-current');
      await expect(items.nth(2)).not.toHaveAttribute('data-current');
    });

    test('retrato: duas imagens decorativas com o mesmo arquivo, sem pedir a imagem antes de chegar perto', async ({ page }) => {
      await page.goto(L.url);
      const box = page.locator('#quem-sou .vn-about-portrait');
      await expect(box).toHaveAttribute('aria-hidden', 'true');
      const imgs = box.locator('img[data-src]');
      await expect(imgs).toHaveCount(2);
      const read = () =>
        imgs.evaluateAll((els) =>
          els.map((e) => ({ file: e.getAttribute('data-src'), src: e.getAttribute('src'), alt: e.getAttribute('alt'), w: e.getAttribute('width'), h: e.getAttribute('height') })),
        );
      // not part of the first load (it would compete with the hero image): no src until the portrait is within one viewport
      const before = await read();
      for (const a of before) expect(a.src).toBeNull();
      expect(before[0].file).toBe(before[1].file);
      await settle(page, box);
      await expect.poll(async () => (await read()).every((a) => a.src === a.file)).toBe(true);
      for (const a of await read()) {
        expect(a.alt).toBe('');
        expect(Number(a.w)).toBeGreaterThan(0);
        expect(Number(a.h)).toBeGreaterThan(0);
      }
    });
  });
}

test.describe('quem sou, revelacao e fallbacks', () => {
  test.use({ viewport: { width: 1366, height: 800 } });

  test('com movimento: a tinta abre ao entrar e as animacoes nomeadas existem', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await engineReady(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');

    // grid below the fold: the ink is still closed
    await page.evaluate(() => scrollTo(0, 0));
    expect(await grid(page).evaluate((e) => e.getBoundingClientRect().top)).toBeGreaterThan(800);
    await expect.poll(() => clip(page)).not.toBe('none');

    await settle(page, grid(page));
    await grid(page).evaluate((e) => e.scrollIntoView({ block: 'end' }));
    await expect.poll(() => clip(page), { timeout: 15000 }).toBe('none');

    const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).toContain('vn-pf');
    expect(names).toContain('vn-pi');
  });

  test('reduced motion: sem animacao e o retrato ja colorido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await engage(page);
    await settle(page, grid(page));
    const r = await page.evaluate(() => {
      const q = (s: string) => document.querySelector(s) as HTMLElement;
      const frame = q('#quem-sou .vn-about-portrait');
      const el = q('#quem-sou .vn-about-portrait__ink');
      return { frame: frame.getAnimations().length, ink: el.getAnimations().length, clip: getComputedStyle(el).clipPath, op: getComputedStyle(el).opacity };
    });
    expect(r.frame).toBe(0);
    expect(r.ink).toBe(0);
    expect(r.clip).toBe('none');
    expect(r.op).toBe('1');
    await expect(ink(page)).toBeVisible();
  });

  test('sem o engine de scroll: retrato colorido e bordas da trajetoria visiveis', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route(/\/_astro\/scroll-fx\./, (r) => r.abort());
    await page.goto('/');
    await engage(page);
    await settle(page, grid(page));
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.dataset.scrollFx === 'tl')).toBe(false);
    await expect.poll(() => clip(page)).toBe('none');
    await expect(ink(page)).toBeVisible();
    const borders = await page.locator('#quem-sou .vn-timeline-item').evaluateAll((els) =>
      els.map((e) => {
        const s = getComputedStyle(e);
        return { w: parseFloat(s.borderLeftWidth), c: s.borderLeftColor };
      }),
    );
    expect(borders).toHaveLength(3);
    for (const b of borders) {
      expect(b.w).toBeGreaterThan(0);
      expect(b.c).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('390x844: sem overflow horizontal e retrato de ate 16rem', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await engage(page);
    await settle(page, grid(page));
    const m = await page.evaluate(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const p = document.querySelector('#quem-sou .vn-about-portrait')!.getBoundingClientRect();
      const d = document.documentElement;
      return { sw: d.scrollWidth, cw: d.clientWidth, pw: p.width / rem };
    });
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.pw).toBeGreaterThan(0);
    expect(m.pw).toBeLessThanOrEqual(16.01);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`tema ${theme}: o periodo contrasta com o fundo da secao`, async ({ page }) => {
      await page.addInitScript((t) => {
        if (sessionStorage.getItem('vn-seeded')) return;
        sessionStorage.setItem('vn-seeded', '1');
        localStorage.setItem('vn-theme', t);
      }, theme);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const c = await page.evaluate(() => ({
        bg: getComputedStyle(document.querySelector('#quem-sou')!).backgroundColor,
        fg: getComputedStyle(document.querySelector('#quem-sou .vn-about-tl__period')!).color,
      }));
      expect(c.fg).not.toBe(c.bg);
    });
  }
});
