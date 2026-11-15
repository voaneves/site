// Navigation, language switching, error page, redirects, skip link, drawer and keyboard focus on every page.
import { test, expect, type Page } from '@playwright/test';
import { ALL_PAGES, NAV_HASHES, NOT_FOUND, PAGES, isEn, otherLocale } from './lib/site';

// Focus may legitimately leave to the browser UI (activeElement becomes <body>); it must never land on page content.
const outsideDialog = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return !!el && el !== document.body && !el.closest('#vn-mobile-drawer');
  });

const sectionInView = (page: Page, id: string) =>
  page.evaluate((hash) => {
    const el = document.getElementById(hash);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
  }, id);

test.describe('primary nav anchors scroll to their section (1366px)', () => {
  test.use({ viewport: { width: 1366, height: 800 } });
  for (const home of ['/', '/en/']) {
    for (const hash of NAV_HASHES) {
      test(`${home} · nav link #${hash}`, async ({ page }) => {
        await page.goto(home);
        const link = page.locator(`header .vn-navbar__link[data-nav-hash="${hash}"]`);
        await expect(link).toBeVisible();
        await link.click();
        await expect.poll(() => sectionInView(page, hash), { timeout: 8000 }).toBe(true);
        await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      });
    }
  }
});

test.describe('mobile drawer links scroll to their section and close the drawer (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const home of ['/', '/en/']) {
    for (const hash of NAV_HASHES) {
      test(`${home} · drawer link #${hash}`, async ({ page }) => {
        await page.goto(home);
        await page.locator('#vn-menu-btn').click();
        const drawer = page.locator('#vn-mobile-drawer');
        await expect(drawer).toBeVisible();
        await drawer.locator(`a[href="#${hash}"][data-drawer-link]`).first().click();
        await expect(drawer).toBeHidden();
        await expect(page.locator('#vn-menu-btn')).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(() => sectionInView(page, hash), { timeout: 8000 }).toBe(true);
      });
    }
  }
});

test.describe('language switcher goes to the equivalent page', () => {
  test.use({ viewport: { width: 1366, height: 800 } });
  for (const route of PAGES) {
    test(`${route} · header switch -> ${otherLocale(route)}`, async ({ page }) => {
      await page.goto(route);
      const sw = page.locator('header .vn-navbar__actions a[aria-label]').first();
      await expect(sw).toHaveText(isEn(route) ? 'PT' : 'EN');
      await sw.click();
      await expect(page).toHaveURL(new RegExp(`${otherLocale(route).replace(/\//g, '\\/')}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', isEn(route) ? 'pt-BR' : 'en');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
    });
  }

  test('the switch there and back returns to the original page', async ({ page }) => {
    await page.goto('/projetos/caato/');
    await page.locator('header .vn-navbar__actions a[aria-label]').first().click();
    await expect(page).toHaveURL(/\/en\/projects\/caato\/$/);
    await page.locator('header .vn-navbar__actions a[aria-label]').first().click();
    await expect(page).toHaveURL(/\/projetos\/caato\/$/);
  });
});

test.describe('language switcher in the mobile drawer (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of ['/', '/en/', '/privacidade/', '/en/projects/midflow/']) {
    test(`${route} · drawer switch -> ${otherLocale(route)}`, async ({ page }) => {
      await page.goto(route);
      await page.locator('#vn-menu-btn').click();
      await page.locator('#vn-mobile-drawer a[aria-label]').last().click();
      await expect(page).toHaveURL(new RegExp(`${otherLocale(route).replace(/\//g, '\\/')}$`));
    });
  }
});

test.describe('404 page', () => {
  for (const url of ['/nao-existe', '/nao-existe/', '/en/nope/', '/projetos/xyz/', '/en/projects/xyz/', '/projetos/mte/extra/', '/privacy/']) {
    test(`${url} · status 404 with the branded page`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(404);
      await expect(page.locator('h1')).toContainText('Sinal perdido');
      await expect(page.locator('main a[href="/"]')).toBeVisible();
      await expect(page.locator('main a[href="/en/"]')).toBeVisible();
    });
  }

  test('serves a text/html document, not a blank body', async ({ request }) => {
    const res = await request.get('/definitely/missing/');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('text/html');
    expect(await res.text()).toContain('Sinal perdido');
  });

  test('a missing asset is a 404, not the HTML shell with status 200', async ({ request }) => {
    const res = await request.get('/assets/img/does-not-exist.webp');
    expect(res.status()).toBe(404);
  });

  test('English block is marked lang="en" and offers a way home in English', async ({ page }) => {
    await page.goto(NOT_FOUND);
    await expect(page.locator('main [lang="en"]')).toContainText('Signal lost');
    await page.locator('main [lang="en"] a').click();
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test('the "back to start" link returns home', async ({ page }) => {
    await page.goto(NOT_FOUND);
    await page.locator('main a[href="/"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toContainText('Victor');
  });

  test('header navigation on the 404 page leads to home sections', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto(NOT_FOUND);
    await page.locator('header .vn-navbar__link[data-nav-hash="contato"]').click();
    await expect(page).toHaveURL(/\/#contato$/);
    await expect.poll(() => sectionInView(page, 'contato'), { timeout: 8000 }).toBe(true);
  });
});

test.describe('redirects from _redirects', () => {
  const cases: Array<[string, number, RegExp]> = [
    ['/cv', 302, /\/assets\/cv-pt\.pdf$/],
    ['/timeline', 301, /\/#jornada$/],
    ['/timeline.html', 301, /\/#jornada$/],
    ['/loading.html', 301, /\/$/],
    ['/games.html', 301, /\/$/],
    ['/project/mte/', 301, /\/projetos\/mte\/$/],
    ['/voaneves-intermediario/foo/', 301, /\/foo\/$/],
  ];
  for (const [from, status, to] of cases) {
    test(`${from} -> ${status} ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(status);
      expect(res.headers().location).toMatch(to);
    });
  }

  test('the CV download serves a real PDF', async ({ request }) => {
    const res = await request.get('/assets/cv-pt.pdf');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

test.describe('response headers (served by Pages, applied from _headers)', () => {
  for (const url of ['/', '/en/', '/privacidade/', '/projetos/mte/']) {
    test(`${url} · security headers`, async ({ request }) => {
      const h = (await request.get(url)).headers();
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['strict-transport-security']).toMatch(/max-age=\d{8,}/);
      expect(h['referrer-policy']).toBeTruthy();
      expect(h['permissions-policy']).toContain('camera=()');
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['x-frame-options']).toBe('DENY');
    });
  }

  test('hashed build assets are immutable for a year', async ({ request, page }) => {
    await page.goto('/');
    const src = await page.evaluate(() => [...document.querySelectorAll('script[src^="/_astro/"], link[href^="/_astro/"]')].map((e) => e.getAttribute('src') ?? e.getAttribute('href')));
    // the first-load JS is inlined; fall back to any known lazy chunk
    const href = src[0] ?? (await (await request.get('/')).text()).match(/\/_astro\/[^"']+\.js/)?.[0] ?? '/_astro/cursor.DnJ4eMvj.js';
    const res = await request.get(href);
    if (res.status() === 200) expect(res.headers()['cache-control']).toMatch(/immutable/);
  });

  test('fonts are immutable for a year', async ({ request }) => {
    const res = await request.get('/fonts/schibsted-grotesk.woff2');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toMatch(/max-age=31536000/);
    expect(res.headers()['cache-control']).toMatch(/immutable/);
  });
});

test.describe('skip link', () => {
  test.use({ viewport: { width: 1366, height: 800 } });
  for (const route of ALL_PAGES) {
    test(`${route} · first Tab reveals the skip link and Enter jumps to #main`, async ({ page }) => {
      await page.goto(route);
      await page.keyboard.press('Tab');
      const skip = page.locator('a.vn-skip-link');
      await expect(skip).toBeFocused();
      // it slides in with a transition: wait for it to settle fully on-screen
      await expect
        .poll(async () => {
          const b = await skip.boundingBox();
          return !!b && b.x >= 0 && b.y >= 0 && b.y + b.height <= 800 && b.x + b.width <= 1366;
        })
        .toBe(true);
      expect(await skip.evaluate((e) => getComputedStyle(e).opacity)).not.toBe('0');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#main$/);
      const mainTop = await page.evaluate(() => document.getElementById('main')!.getBoundingClientRect().top);
      expect(mainTop).toBeLessThan(300);
      // the next Tab continues inside main (focus moved past the header), not back to the logo
      await page.keyboard.press('Tab');
      const inMain = await page.evaluate(() => !!document.activeElement?.closest('main, footer'));
      expect(inMain, 'focus continues after the skip target').toBe(true);
    });
  }
});

test.describe('keyboard focus is visible on every focusable element (1366px)', () => {
  test.use({ viewport: { width: 1366, height: 800 } });
  for (const route of ALL_PAGES) {
    test(`${route} · tabbing through the page always shows a focus indicator`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(route);
      const seen = new Set<string>();
      const invisible: string[] = [];
      let count = 0;
      for (let i = 0; i < 140; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && cs.outlineColor !== 'rgba(0, 0, 0, 0)';
          const shadow = cs.boxShadow !== 'none';
          // some components draw the ring on a child/sibling pseudo element: accept an explicit :focus-visible rule hit
          const ring = el.matches(':focus-visible');
          const id = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]}[${(el.getAttribute('href') ?? el.textContent ?? '').trim().slice(0, 24)}]`;
          return { id, outline, shadow, ring, visible: r.width > 0 && r.height > 0, onscreen: r.bottom > 0 && r.top < innerHeight };
        });
        if (!info) break;
        if (seen.has(info.id)) {
          if (seen.size > 5) break; // wrapped around
        }
        seen.add(info.id);
        count++;
        expect(info.ring, `${info.id} should match :focus-visible after keyboard focus`).toBe(true);
        if (!info.outline && !info.shadow) invisible.push(info.id);
      }
      expect(count, 'reached at least the nav, content links and footer').toBeGreaterThan(8);
      expect(invisible, 'elements focused by keyboard without outline or box-shadow').toEqual([]);
    });
  }
});

test.describe('mobile drawer works from the keyboard', () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    for (const route of ['/', '/en/', '/privacidade/', '/projetos/caato/']) {
      test.describe(`${route} @ ${vp.width}px`, () => {
        test.use({ viewport: vp });

        test('opens with Enter, moves focus inside, and Esc closes and restores focus', async ({ page }) => {
          await page.goto(route);
          const btn = page.locator('#vn-menu-btn');
          await expect(btn).toBeVisible();
          await btn.focus();
          await page.keyboard.press('Enter');
          const drawer = page.locator('#vn-mobile-drawer');
          await expect(drawer).toBeVisible();
          await expect(btn).toHaveAttribute('aria-expanded', 'true');
          expect(await page.evaluate(() => !!document.activeElement?.closest('#vn-mobile-drawer')), 'focus moved into the dialog').toBe(true);
          await page.keyboard.press('Escape');
          await expect(drawer).toBeHidden();
          await expect(btn).toHaveAttribute('aria-expanded', 'false');
          await expect(btn).toBeFocused();
        });

        test('while open, Tab and Shift+Tab never reach the page behind the modal', async ({ page }) => {
          await page.goto(route);
          await page.locator('#vn-menu-btn').click();
          for (let i = 0; i < 14; i++) {
            await page.keyboard.press('Tab');
            expect(await outsideDialog(page), `Tab #${i + 1} landed on page content behind the modal`).toBe(false);
          }
          for (let i = 0; i < 4; i++) {
            await page.keyboard.press('Shift+Tab');
            expect(await outsideDialog(page)).toBe(false);
          }
        });

        test('after closing, nothing is trapped: Tab reaches page content again and scroll is not locked', async ({ page }) => {
          await page.goto(route);
          await page.locator('#vn-menu-btn').click();
          await page.keyboard.press('Escape');
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => !document.activeElement?.closest('#vn-mobile-drawer'))).toBe(true);
          const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow + getComputedStyle(document.documentElement).overflow);
          expect(overflow).not.toMatch(/hidden.*hidden/);
          await page.mouse.wheel(0, 600);
          await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
        });

        test('the close button and a backdrop click close it too', async ({ page }) => {
          await page.goto(route);
          const drawer = page.locator('#vn-mobile-drawer');
          await page.locator('#vn-menu-btn').click();
          await page.locator('#vn-drawer-close').click();
          await expect(drawer).toBeHidden();
          await page.locator('#vn-menu-btn').click();
          await expect(drawer).toBeVisible();
          await page.mouse.click(vp.width - 2, vp.height - 2); // outside the panel, on the backdrop
          await expect(drawer).toBeHidden();
        });
      });
    }
  }
});

test.describe('without JavaScript the content is still there and readable', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1366, height: 800 } });
  for (const route of ALL_PAGES) {
    test(`${route} · h1, h2 and the main text are visible with JS disabled`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('html')).not.toHaveClass(/\bjs\b/);
      await expect(page.locator('h1')).toBeVisible();
      const hidden = await page.evaluate(() => {
        const bad: string[] = [];
        for (const h of document.querySelectorAll('main h1, main h2')) {
          const cs = getComputedStyle(h);
          const r = h.getBoundingClientRect();
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0 || r.height === 0) bad.push((h.textContent ?? '').trim().slice(0, 30));
        }
        return bad;
      });
      expect(hidden).toEqual([]);
      const textLength = await page.evaluate(() => document.querySelector('main')!.innerText.length);
      expect(textLength).toBeGreaterThan(60);
    });
  }
});
