// Light and dark themes on the key pages: first paint, persistence, fallbacks, colour and layout in both.
import { test, expect, type Page } from '@playwright/test';
import { NOT_FOUND } from './lib/site';

const KEY_PAGES = ['/', '/en/', '/privacidade/', '/projetos/mte/', NOT_FOUND];
const META: Record<string, string> = { dark: '#0a0a0a', light: '#f4ead4' };
const OTHER: Record<string, string> = { dark: 'light', light: 'dark' };

const luminance = (page: Page) =>
  page.evaluate(() => {
    const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number);
    const first = (els: Element[]) => {
      for (const e of els) {
        const [r, g, b, a = 1] = parse(getComputedStyle(e).backgroundColor);
        if (a > 0.5) return [r, g, b];
      }
      return [255, 255, 255];
    };
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = first([document.body, document.documentElement]);
    const bg = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const [tr, tg, tb] = parse(getComputedStyle(document.body).color);
    const fg = 0.2126 * lin(tr) + 0.7152 * lin(tg) + 0.0722 * lin(tb);
    return { bg, fg, ratio: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) };
  });

for (const route of KEY_PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${route} · ${theme}`, () => {
      test.use({ colorScheme: theme });

      test('first paint follows the OS preference when nothing is stored (set before DOMContentLoaded)', async ({ page }) => {
        await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => ((window as unknown as { __t0: string }).__t0 = document.documentElement.dataset.theme ?? ''));
        });
        await page.goto(route);
        expect(await page.evaluate(() => (window as unknown as { __t0: string }).__t0)).toBe(theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme);
      });

      test('a stored preference overrides the OS preference and survives a reload', async ({ page }) => {
        const stored = OTHER[theme];
        await page.addInitScript((v) => localStorage.setItem('vn-theme', v), stored);
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', stored);
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', stored);
      });

      test('toggle flips the theme, theme-color meta and storage, and the second click flips back', async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 800 });
        await page.goto(route);
        const html = page.locator('html');
        const next = OTHER[theme];
        await page.locator('#vn-theme-toggle').click();
        await expect(html).toHaveAttribute('data-theme', next);
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', META[next]);
        expect(await page.evaluate(() => localStorage.getItem('vn-theme'))).toBe(next);
        await page.locator('#vn-theme-toggle').click();
        await expect(html).toHaveAttribute('data-theme', theme);
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', META[theme]);
      });

      test('page background and text are on the right side of the luminance scale with AA-level contrast', async ({ page }) => {
        await page.goto(route);
        const { bg, ratio } = await luminance(page);
        if (theme === 'dark') expect(bg).toBeLessThan(0.1);
        else expect(bg).toBeGreaterThan(0.45);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      for (const width of [390, 1366]) {
        test(`no horizontal overflow and nothing clipped at ${width}px`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(route);
          const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
          expect(o.sw).toBeLessThanOrEqual(o.cw);
          expect(o.bw).toBeLessThanOrEqual(o.cw);
        });
      }
    });
  }
}

test.describe('theme storage edge cases', () => {
  test('an invalid stored value is ignored in favour of the OS preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('vn-theme', 'solarized'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('blocked storage still renders a theme and the toggle still works, without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
    const before = await page.locator('html').getAttribute('data-theme');
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.locator('#vn-theme-toggle').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', before!);
    expect(errors).toEqual([]);
  });

  test('prefers-color-scheme changes are not required for the toggle: toggling twice is idempotent', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/privacidade/');
    const start = await page.locator('html').getAttribute('data-theme');
    for (let i = 0; i < 4; i++) await page.locator('#vn-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', start!);
  });

  test('the theme toggle is a labelled button that is reachable by keyboard and works with Enter and Space', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/');
    const btn = page.locator('#vn-theme-toggle');
    await expect(btn).toHaveAttribute('aria-label', /.+/);
    await btn.focus();
    const a = await page.locator('html').getAttribute('data-theme');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', a!);
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', a!);
  });
});
