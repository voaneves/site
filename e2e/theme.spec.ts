import { expect, test } from '@playwright/test';

const stub = () => {
  const w = window as unknown as { __vt: number };
  w.__vt = 0;
  document.startViewTransition = ((cb: () => void) => {
    w.__vt++;
    cb();
    return { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransitionCallbacks() {} };
  }) as unknown as typeof document.startViewTransition;
};

test.describe('theme colours actually follow the toggle', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`body background flips when the OS prefers ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/privacidade/');
      const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const before = await bg();
      await page.locator('#vn-theme-toggle').click();
      await expect.poll(bg).not.toBe(before);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
        scheme === 'dark' ? 'light' : 'dark',
      );
    });
  }
});

test.describe('theme reveal', () => {
  test('uses a view transition, sets origin, persists, updates meta', async ({ page }) => {
    await page.addInitScript(stub);
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#vn-theme-toggle').click();
    const next = before === 'dark' ? 'light' : 'dark';
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--vt-x'))).toMatch(/px$/);
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--vt-r'))).toMatch(/^[\d.]+px$/);
    expect(await page.evaluate(() => localStorage.getItem('vn-theme'))).toBe(next);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', next === 'dark' ? '#0a0a0a' : '#fdfbf6');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('does not call startViewTransition', async ({ page }) => {
      await page.addInitScript(stub);
      await page.goto('/');
      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.locator('#vn-theme-toggle').click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
      expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(0);
    });
  });
});

// Without JavaScript there is no data-theme: the hero follows the OS colour scheme and stays readable.
test.describe('hero colours without JavaScript', () => {
  type Rgba = [number, number, number, number];
  const probe = () => {
    const parse = (s: string): Rgba => {
      const m = s.match(/[\d.]+/g)!.map(Number);
      return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
    };
    const lum = (c: Rgba) => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (el: Element) => {
      const fg = parse(getComputedStyle(el).color);
      const layers: Rgba[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      let base: Rgba = layers.length && layers[layers.length - 1][3] === 1 ? layers.pop()! : [255, 255, 255, 1];
      while (layers.length) {
        const t = layers.pop()!;
        base = [0, 1, 2].map((i) => t[i] * t[3] + base[i] * (1 - t[3])).concat(1) as Rgba;
      }
      const [a, b] = [lum([fg[0], fg[1], fg[2], 1]), lum(base)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const q = (s: string) => [...document.querySelectorAll(s)];
    return {
      h1: getComputedStyle(document.querySelector('h1.vn-hero__title')!).color,
      parts: [
        ['h1', ratio(document.querySelector('h1.vn-hero__title')!)],
        ['lead', ratio(document.querySelector('.vn-hero__sub')!)],
        ...q('.vn-hero-chip').map((e, i) => [`chip ${i}`, ratio(e)]),
      ] as [string, number][],
    };
  };

  for (const route of ['/', '/en/']) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${route} ${scheme}: contrast >= 4.5 and the h1 matches the JS-on page`, async ({ browser }) => {
        const base = test.info().project.use.baseURL;
        const run = async (javaScriptEnabled: boolean) => {
          const ctx = await browser.newContext({ javaScriptEnabled, colorScheme: scheme, baseURL: base });
          const page = await ctx.newPage();
          await page.goto(route);
          const r = await page.evaluate(probe);
          await ctx.close();
          return r;
        };
        const plain = await run(false);
        const withJs = await run(true);
        expect(plain.parts.length).toBeGreaterThan(2);
        for (const [name, ratio] of plain.parts) expect(ratio, `${name} contrast`).toBeGreaterThanOrEqual(4.5);
        expect(plain.h1).toBe(withJs.h1);
      });
    }
  }
});
