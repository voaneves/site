// Ground rhythm per theme (WOW-PLAN §U6k.4 / §U6k.7). Written against the plan table.
import { test, expect, type Page } from '@playwright/test';

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];

const PAPER = 'rgb(253, 251, 246)';
const CREME = 'rgb(232, 222, 197)';
const TINTA = 'rgb(10, 10, 10)';
const NIGHT = 'rgb(0, 0, 0)';
const GRAPHITE = 'rgb(26, 26, 26)';
const SIGNAL = 'rgb(245, 0, 0)';

const GROUNDS = [
  { key: 'hero', sel: '#inicio' },
  { key: 'about', sel: '#quem-sou' },
  { key: 'numbers', sel: '#numeros' },
  { key: 'expertise', sel: '#expertise' },
  { key: 'journey', sel: '#jornada' },
  { key: 'projects', sel: '#projetos' },
  { key: 'services', sel: '#servicos' },
  { key: 'faq', sel: '#perguntas' },
  { key: 'contact', sel: '#contato' },
  { key: 'footer', sel: '.vn-site-footer' },
] as const;
type Key = (typeof GROUNDS)[number]['key'];

const EXPECTED: Record<Theme, Record<Key, string>> = {
  light: { hero: PAPER, about: CREME, numbers: TINTA, expertise: PAPER, journey: CREME, projects: PAPER, services: CREME, faq: PAPER, contact: SIGNAL, footer: CREME },
  dark: { hero: TINTA, about: NIGHT, numbers: GRAPHITE, expertise: TINTA, journey: NIGHT, projects: GRAPHITE, services: NIGHT, faq: TINTA, contact: SIGNAL, footer: NIGHT },
};
const META: Record<Theme, string> = { light: '#fdfbf6', dark: '#0a0a0a' };
// Each chapter's corner wedge is drawn in the ground of the section ABOVE it (it bleeds into the chapter, so
// the join reads as a diagonal). Same-colour-as-self would be invisible, so §U6k.7 test 10 is read as "equals
// the previous section's ground", which also covers the Numbers exception (its wedge is About's ground).
const WEDGES: [Key, Key][] = [['about', 'hero'], ['expertise', 'numbers'], ['faq', 'services']];
const selOf = (k: Key) => GROUNDS.find((g) => g.key === k)!.sel;

async function open(page: Page, theme: Theme, url = '/') {
  // seed once per tab: the init script re-runs on reload, which would otherwise undo a theme the test just stored
  await page.addInitScript((t) => {
    if (sessionStorage.getItem('vn-seeded')) return;
    sessionStorage.setItem('vn-seeded', '1');
    localStorage.setItem('vn-theme', t);
  }, theme);
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

const bgs = (page: Page) =>
  page.evaluate(
    (grounds) => Object.fromEntries(grounds.map((g) => [g.key, getComputedStyle(document.querySelector(g.sel)!).backgroundColor])),
    [...GROUNDS],
  );

const adjacentRepeats = (b: Record<string, string>) => GROUNDS.slice(1).filter((g, i) => b[g.key] === b[GROUNDS[i].key]).map((g) => g.key);

const metaContents = (page: Page) =>
  page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')));

for (const theme of THEMES) {
  test.describe(`rhythm · ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test(`each ground has the exact §U6k.4 background (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(() => bgs(page)).toEqual(EXPECTED[theme]);
    });

    test(`no two adjacent grounds share a background (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(async () => adjacentRepeats(await bgs(page))).toEqual([]);
    });

    test(`luminance classes (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(() => bgs(page)).toEqual(EXPECTED[theme]);
      const lum = await page.evaluate((grounds) => {
        const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
        return Object.fromEntries(
          grounds.map((g) => {
            const [r, gg, b] = getComputedStyle(document.querySelector(g.sel)!).backgroundColor.match(/[\d.]+/g)!.map(Number);
            return [g.key, 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b)];
          }),
        );
      }, [...GROUNDS]);
      for (const g of GROUNDS) {
        if (g.key === 'contact') continue;
        if (theme === 'light') {
          if (g.key === 'numbers') expect(lum[g.key]).toBeLessThan(0.01);
          else expect(lum[g.key], g.key).toBeGreaterThanOrEqual(0.6);
        } else {
          expect(lum[g.key], g.key).toBeLessThan(0.015);
        }
      }
    });

    test(`text contrast: heading >= 3, paragraph and eyebrow >= 4.5 (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(() => bgs(page)).toEqual(EXPECTED[theme]);
      // scroll reveals hold eyebrows at opacity 0 until their section is in view; visit each ground first
      for (const g of GROUNDS) await page.locator(g.sel).first().scrollIntoViewIfNeeded();
      await page.evaluate(() => scrollTo(0, 0));
      const measure = () => page.evaluate((grounds) => {
        const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number);
        const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
        const L = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        const out: { id: string; what: string; ratio: number; min: number }[] = [];
        for (const g of grounds) {
          if (g.key === 'footer') continue;
          const sec = document.querySelector(g.sel)!;
          const bg = parse(getComputedStyle(sec).backgroundColor).slice(0, 3);
          const check = (el: Element | null, what: string, min: number) => {
            if (!el) return;
            const cs = getComputedStyle(el);
            const [r, gg, b, a = 1] = parse(cs.color);
            const op = Number(cs.opacity);
            const al = a * (Number.isNaN(op) ? 1 : op);
            const fg = [r * al + bg[0] * (1 - al), gg * al + bg[1] * (1 - al), b * al + bg[2] * (1 - al)];
            const hi = Math.max(L(fg), L(bg));
            const lo = Math.min(L(fg), L(bg));
            out.push({ id: g.key, what, ratio: (hi + 0.05) / (lo + 0.05), min });
          };
          check(sec.querySelector('h1, h2'), 'heading', 3);
          check(sec.querySelector('p'), 'paragraph', 4.5);
          check(sec.querySelector('.vn-eyebrow'), 'eyebrow', 4.5);
        }
        return out;
      }, [...GROUNDS]);
      // revealed text keeps its opacity (they do not unreveal), so poll until every measured row has settled
      await expect
        .poll(async () => (await measure()).filter((r) => r.ratio < r.min).map((r) => `${r.id} ${r.what} ${r.ratio.toFixed(2)}`))
        .toEqual([]);
      expect((await measure()).some((r) => r.what === 'heading')).toBe(true);
    });

    test(`color-scheme per section (${theme})`, async ({ page }) => {
      await open(page, theme);
      const cs = await page.evaluate(
        (grounds) => Object.fromEntries(grounds.map((g) => [g.key, getComputedStyle(document.querySelector(g.sel)!).colorScheme])),
        [...GROUNDS],
      );
      for (const g of GROUNDS) {
        if (g.key === 'contact') continue;
        const want = theme === 'dark' || g.key === 'numbers' ? 'dark' : 'light';
        expect(cs[g.key], g.key).toBe(want);
      }
    });

    test(`chapter wedges match the ground (${theme})`, async ({ page }) => {
      await open(page, theme);
      for (const [k, prev] of WEDGES) {
        await expect
          .poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)!, '::before').backgroundColor, selOf(k)), { message: k })
          .toBe(EXPECTED[theme][prev]);
      }
      // Numbers has an arch instead of a wedge: its mask is filled with About's ground
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.vn-arch__fill')!).fill)).toBe(EXPECTED[theme].about);
    });

    test(`theme-color is ${META[theme]} on load without a click, and flips on toggle`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(() => metaContents(page)).toEqual([META[theme]]);
      const other: Theme = theme === 'light' ? 'dark' : 'light';
      await page.locator('#vn-theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', other);
      await expect.poll(() => metaContents(page)).toEqual([META[other]]);
    });
  });
}

test('every non-signal ground differs between modes; contact is Sinal in both', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'light');
  await expect.poll(() => bgs(page)).toEqual(EXPECTED.light);
  const light = await bgs(page);
  await page.evaluate(() => localStorage.setItem('vn-theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => bgs(page)).toEqual(EXPECTED.dark);
  const dark = await bgs(page);
  for (const g of GROUNDS) {
    if (g.key === 'contact') {
      expect(light.contact).toBe(SIGNAL);
      expect(dark.contact).toBe(SIGNAL);
    } else {
      expect(light[g.key], g.key).not.toBe(dark[g.key]);
    }
  }
});

test.describe('toggle transition', () => {
  const animNames = (page: Page) =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => (a as CSSAnimation).animationName)
        .filter(Boolean),
    );

  test('to dark runs vn-dusk and vn-spin', async ({ page }) => {
    await open(page, 'light');
    await page.locator('#vn-theme-toggle').click();
    await expect.poll(() => animNames(page)).toEqual(expect.arrayContaining(['vn-dusk', 'vn-spin']));
  });

  test('to light runs vn-dawn', async ({ page }) => {
    await open(page, 'dark');
    await page.locator('#vn-theme-toggle').click();
    await expect.poll(() => animNames(page)).toEqual(expect.arrayContaining(['vn-dawn']));
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('no view-transition animation and the switch is instant', async ({ page }) => {
      await open(page, 'light');
      await page.locator('#vn-theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const names = await animNames(page);
      expect(names.filter((n) => /^vn-(dusk|dawn|spin)$/.test(n))).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(PAPER);
    });
  });
});

test.describe('trail ink follows the ground', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const cases: [Theme, string, string][] = [
    ['light', '#quem-sou', '0.96,0,0'],
    ['dark', '#quem-sou', '1,0.2,0.17'],
    ['light', '#numeros', '1,0.2,0.17'],
  ];
  for (const [theme, sel, want] of cases) {
    test(`${theme} ${sel}`, async ({ page }) => {
      await open(page, theme, '/?vn-debug');
      await page.waitForLoadState('networkidle');
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.mouse.move(300, 300);
      await page.mouse.move(340, 320);
      let i = 0;
      await expect
        .poll(async () => {
          i++;
          await page.mouse.move(400 + (i % 5) * 30, 320 + (i % 3) * 20, { steps: 3 });
          return page.evaluate(() => (window as unknown as { __vnTrailInk?: string }).__vnTrailInk);
        })
        .toBe(want);
    });
  }
});

test('hero portrait filter differs between themes and the LCP image is opaque', async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.vn-hero-portrait__img')!);
      return { filter: cs.filter, opacity: cs.opacity };
    });
  await open(page, 'light');
  const l = await read();
  await page.evaluate(() => localStorage.setItem('vn-theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const d = await read();
  expect(l.filter).not.toBe(d.filter);
  expect(l.opacity).toBe('1');
  expect(d.opacity).toBe('1');
});

test('/privacidade/ and /projetos/mte/ are paper in light', async ({ page }) => {
  for (const url of ['/privacidade/', '/projetos/mte/']) {
    await open(page, 'light', url);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), { message: url }).toBe(PAPER);
  }
});

test.describe('mobile 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const theme of THEMES) {
    test(`grounds and adjacency hold at 390 (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect.poll(() => bgs(page)).toEqual(EXPECTED[theme]);
      expect(adjacentRepeats(await bgs(page))).toEqual([]);
    });
  }
});

test('full-page screenshots of both themes are attached for review', async ({ browser }, info) => {
  test.slow();
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript((t) => localStorage.setItem('vn-theme', t), theme);
    await page.goto(new URL('/', info.project.use.baseURL).toString());
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await info.attach(`home-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await ctx.close();
  }
});
