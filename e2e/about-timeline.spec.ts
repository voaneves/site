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
    // Depends on the build naming the engine chunk after its module (`_astro/scroll-fx.<hash>.js`, from the dynamic
    // import in main.ts). The pattern only needs "scroll-fx" in an _astro path; if the chunk is ever renamed, nothing
    // is aborted and the poll below fails with a clear message instead of this test passing with the engine running.
    const aborted: string[] = [];
    page.on('requestfailed', (r) => { if (/\/_astro\/.*scroll-fx/.test(r.url())) aborted.push(r.url()); });
    await page.route(/\/_astro\/.*scroll-fx/, (r) => r.abort());
    await page.goto('/');
    await engage(page);
    await settle(page, grid(page));
    await expect.poll(() => aborted.length, { message: 'the scroll-fx chunk was never requested (chunk renamed? this test would not be testing the fallback)', timeout: 15000 }).toBeGreaterThan(0);
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
    test(`tema ${theme}: periodo, organizacao, funcao e detalhes da trajetoria tem contraste WCAG AA (4.5:1)`, async ({ page }) => {
      await page.addInitScript((t) => {
        if (sessionStorage.getItem('vn-seeded')) return;
        sessionStorage.setItem('vn-seeded', '1');
        localStorage.setItem('vn-theme', t);
      }, theme);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // Contrast computed in the browser from the computed colours. Any CSS colour syntax (color-mix, oklch, ...) is
      // normalised to sRGB through a canvas pixel, and the effective background is the stack of translucent background
      // colours of the ancestors over white. Background images/gradients are not modelled (the section has none).
      const rows = await page.evaluate(() => {
        const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        px.canvas.width = px.canvas.height = 1;
        const rgba = (css: string): [number, number, number, number] => {
          px.clearRect(0, 0, 1, 1);
          px.fillStyle = '#000';
          px.fillStyle = css;
          px.fillRect(0, 0, 1, 1);
          const d = px.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const over = (top: number[], below: number[]) => {
          const a = top[3];
          return [0, 1, 2].map((i) => top[i] * a + below[i] * (1 - a)).concat(1);
        };
        const effectiveBg = (el: Element) => {
          const layers: number[][] = [];
          for (let e: Element | null = el; e; e = e.parentElement) {
            const c = rgba(getComputedStyle(e).backgroundColor);
            if (c[3] > 0) layers.push(c);
            if (c[3] === 1) break;
          }
          return layers.reduceRight<number[]>((acc, l) => over(l, acc), [255, 255, 255, 1]);
        };
        const lum = (c: number[]) => {
          const [r, g, b] = c.slice(0, 3).map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (fg: number[], bg: number[]) => {
          const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
          return (hi + 0.05) / (lo + 0.05);
        };
        const targets: Array<[string, string]> = [
          ['periodo', '#quem-sou .vn-about-tl__period'],
          ['organizacao', '#quem-sou .vn-timeline-item h4'],
          ['funcao', '#quem-sou .vn-timeline-item .vn-type-body-strong'],
          ['detalhe', '#quem-sou .vn-about-tl__sub li'],
        ];
        return targets.flatMap(([name, sel]) =>
          [...document.querySelectorAll(sel)].map((el, i) => {
            const bg = effectiveBg(el);
            const fg = over(rgba(getComputedStyle(el).color), bg);
            return { name: `${name} #${i}`, fg: fg.map(Math.round).join(','), bg: bg.map(Math.round).join(','), ratio: Math.round(ratio(fg, bg) * 100) / 100 };
          }),
        );
      });
      expect(rows.length).toBeGreaterThanOrEqual(4);
      for (const r of rows) expect(r.ratio, `${r.name} (${theme}): fg rgb(${r.fg}) sobre bg rgb(${r.bg})`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
