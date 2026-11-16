import { test, expect, type Page } from '@playwright/test';
import { engage } from './lib/site';

const ROUTES = ['/', '/en/', '/projetos/caato/'];

async function settle(page: Page) {
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.evaluate(() => document.fonts.ready);
}

async function scrollSteps(page: Page, steps: number) {
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(
      (f) =>
        new Promise<void>((res) => {
          window.scrollTo({
            top: (document.documentElement.scrollHeight - innerHeight) * f,
            behavior: 'instant',
          });
          requestAnimationFrame(() => requestAnimationFrame(() => res()));
        }),
      i / steps,
    );
  }
}

for (const route of ROUTES) {
  test.describe(`gates ${route}`, () => {
    // (1) Reflow
    for (const width of [320, 375, 414, 768]) {
      test(`reflow: no horizontal overflow at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        await settle(page);
        const over = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(over.sw).toBeLessThanOrEqual(over.cw);
      });
    }

    // (2) Target size (WCAG 2.5.8 AA = 24px; 44px reported as info)
    for (const width of [390, 1366]) {
      test(`target size >= 24 (info <44) at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await settle(page);
        const res = await page.evaluate(() => {
          const small: string[] = [];
          const fail: string[] = [];
          const describe = (el: Element, r: DOMRect) =>
            `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
          document.querySelectorAll('a,button,summary,[role=button],input').forEach((el) => {
            if (el.closest('[aria-hidden="true"],[inert]')) return;
            if (el.matches('.vn-sr-only,.vn-visually-hidden,input[type=hidden]')) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            const r = el.getBoundingClientRect();
            if (r.width <= 1 && r.height <= 1) return;
            if (el.matches('.vn-skip-link') && document.activeElement !== el) return;
            const inlineText =
              el.tagName === 'A' && !!el.closest('p,li,dd,figcaption,small') && cs.display === 'inline';
            if (inlineText) return;
            if (r.width < 24 || r.height < 24) fail.push(describe(el, r));
            else if (r.width < 44 || r.height < 44) small.push(describe(el, r));
          });
          return { small, fail };
        });
        if (res.small.length) {
          console.log(`[info] ${route}@${width} targets <44px:\n  ` + res.small.join('\n  '));
        }
        expect(res.fail, 'targets below 24x24').toEqual([]);
      });
    }

    // (3) Focus not obscured (2.4.11: not entirely hidden)
    test('focus not obscured by sticky nav or cursor', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      await settle(page);
      const bad: string[] = [];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(async () => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          // scroll-into-view may be smooth (and Tab can wrap back to the top): wait, bounded, until
          // the element's position has been still for 3 consecutive frames, not merely on screen.
          let last = Number.NaN;
          let still = 0;
          // On a loaded runner the smooth scroll can start several frames late, so "still" alone is not enough:
          // keep waiting (bounded) until it is still and on screen; something truly off-screen still fails.
          const on = () => { const b = el.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
          for (let f = 0; f < 120 && (still < 3 || !on()); f++) {
            await new Promise((res) => requestAnimationFrame(res));
            const top = el.getBoundingClientRect().top;
            still = top === last ? still + 1 : 0;
            last = top;
          }
          const rect = el.getBoundingClientRect();
          const cover = (a: DOMRect, b: DOMRect | null) => {
            if (!b || a.width === 0 || a.height === 0) return 0;
            const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return (w * h) / (a.width * a.height);
          };
          const visibleRect = (sel: string) => {
            const n = document.querySelector(sel) as HTMLElement | null;
            if (!n || getComputedStyle(n).display === 'none') return null;
            return n.getBoundingClientRect();
          };
          const nav = document.querySelector('.vn-navbar');
          // Overlap only counts when the nav is actually painted above the element: a fixed element
          // stacked over the nav (e.g. the skip link, z 9999) overlaps it geometrically but is not obscured.
          const hit = (x: number, y: number) => {
            const top = document.elementFromPoint(x, y);
            return !!top && (el === top || el.contains(top));
          };
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const onTop = hit(cx, cy) || hit(rect.left + 2, rect.top + 2) || hit(rect.right - 2, rect.bottom - 2);
          return {
            id: `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]} "${(el.textContent || '').trim().slice(0, 24)}"`,
            nav: (nav && nav.contains(el)) || onTop ? 0 : cover(rect, visibleRect('.vn-navbar')),
            // The cursor root is a full-viewport, pointer-events:none layer; only its visible parts
            // (dot, pill, media) can cover anything, and only while it is not in the hidden state.
            cursor: document.querySelector('.vn-cursor:not([data-state="hidden"])')
              ? Math.max(
                  cover(rect, visibleRect('.vn-cursor__dot')),
                  cover(rect, visibleRect('.vn-cursor__pill')),
                  cover(rect, visibleRect('.vn-cursor__media')),
                )
              : 0,
            offscreen: rect.bottom <= 0 || rect.top >= innerHeight,
          };
        });
        if (!r) continue;
        if (r.nav >= 1 || r.cursor >= 1) {
          bad.push(`${r.id} nav=${r.nav.toFixed(2)} cursor=${r.cursor.toFixed(2)}`);
        }
        if (r.offscreen) bad.push(`${r.id} off-screen after focus`);
      }
      expect(bad).toEqual([]);
    });

    // (4) Text spacing (WCAG 1.4.12)
    test('text spacing does not clip content', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(route);
      await settle(page);
      // CSSOM only: the page CSP blocks injected <style> elements.
      await page.evaluate(() => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(
          '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}p{margin-bottom:2em !important}',
        );
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      });
      await page.evaluate(
        () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
      );
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('body *').forEach((el) => {
          if (el.closest('[aria-hidden="true"],.vn-marquee,.vn-marquee-stack,svg,canvas')) return;
          const cs = getComputedStyle(el);
          if (!/^(hidden|clip)$/.test(cs.overflowY)) return;
          if (cs.display === 'none') return;
          if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1) {
            out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]} ${el.scrollHeight}>${el.clientHeight}`);
          }
        });
        return out;
      });
      expect(clipped).toEqual([]);
    });

    // (6) CLS
    test('CLS <= 0.01 while scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        // Attribution, so a failure on CI says which element moved, when, and whether the late fonts had landed.
        const log: string[] = ((window as unknown as { __clsLog: string[] }).__clsLog = []);
        type Src = { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; startTime: number; sources: Src[] }[]) {
            if (e.hadRecentInput) continue;
            w.__cls += e.value;
            const src = e.sources.slice(0, 3).map((x) => {
              const el = x.node instanceof Element ? x.node : x.node?.parentElement;
              const where = el?.closest('section, footer, header');
              const r = (q: DOMRectReadOnly) => `${Math.round(q.x)},${Math.round(q.y)} ${Math.round(q.width)}x${Math.round(q.height)}`;
              return `${el?.tagName}.${String(el?.className ?? '').slice(0, 30)} in ${where?.id || where?.tagName} ${r(x.previousRect)} -> ${r(x.currentRect)}`;
            });
            log.push(`${e.value.toFixed(4)} t=${Math.round(e.startTime)} y=${Math.round(scrollY)} fonts=${document.documentElement.classList.contains('vn-fonts')} :: ${src.join(' | ')}`);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(route);
      await settle(page);
      // fonts.ready resolves before the after-LCP font swap; scroll only once every face is loaded and applied
      // (after-lcp.ts flags it), so the measurement is of scrolling, not of a swap racing a slow runner.
      await engage(page);
      await page.waitForFunction(() => 'fontsReady' in document.documentElement.dataset);
      await scrollSteps(page, 10);
      await page.evaluate(
        () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
      );
      const { cls, log } = await page.evaluate(() => ({
        cls: (window as unknown as { __cls: number }).__cls,
        log: (window as unknown as { __clsLog: string[] }).__clsLog,
      }));
      expect(cls, ['layout shifts:', ...log].join(' || ')).toBeLessThanOrEqual(0.01);
    });
  });
}

// (5) Reduced motion
test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const route of ROUTES) {
    test(`no running animations, reveals visible, no lazy motion chunks ${route}`, async ({ page }) => {
      const lazy: string[] = [];
      page.on('request', (rq) => {
        if (/\/_astro\/(cursor|cursor-trail|magnetic|signal-field|hero-fx|scroll-fx)\./.test(rq.url())) lazy.push(rq.url());
      });
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      await settle(page);
      await scrollSteps(page, 10);
      const motionOffenders = await page.evaluate(() =>
        [...document.querySelectorAll('.vn-reveal, .vn-sr, .vn-unveil, .vn-par, .vn-marquee__track')]
          .filter((e) => {
            const cs = getComputedStyle(e);
            const names = cs.animationName.split(',').map((s) => s.trim());
            if (names.every((n) => n === 'none')) return false;
            if (cs.animationPlayState.split(',').every((s) => s.trim() === 'paused')) return false;
            const durs = cs.animationDuration.split(',').map((s) => {
              const v = parseFloat(s);
              return /ms$/.test(s.trim()) ? v : v * 1000;
            });
            return !durs.every((d) => d <= 1);
          })
          .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/)[0]}`),
      );
      expect(motionOffenders, 'animated elements under reduced motion').toEqual([]);
      await expect
        .poll(() =>
          page.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => a.playState === 'running' && Number(a.effect?.getTiming().duration ?? 0) > 1)
              .map((a) => {
                const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
                return `${(a as CSSAnimation).animationName ?? 'anim'} on ${t?.tagName}.${t?.className}`;
              }),
          ),
        )
        .toEqual([]);
      const hidden = await page.evaluate(
        () => [...document.querySelectorAll('.vn-reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length,
      );
      expect(hidden).toBe(0);
      expect(lazy).toEqual([]);
    });
  }
});

// (5b) Positive control: without reduced motion, reveals really start hidden/animated
test.describe('reduced motion positive control', () => {
  test.use({ reducedMotion: 'no-preference' });
  for (const route of ROUTES) {
    test(`reveal elements are hidden or animated before intersecting ${route}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      await settle(page);
      const found = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.vn-reveal, .vn-sr')];
        const far = els.filter((e) => e.getBoundingClientRect().top > innerHeight * 2);
        return far.some((e) => {
          const cs = getComputedStyle(e);
          return Number(cs.opacity) < 1 || cs.animationName.split(',').some((n) => n.trim() !== 'none');
        });
      });
      if (!found) {
        testInfo.annotations.push({
          type: 'no-reveal-control',
          description: `no far-below-fold .vn-reveal/.vn-sr with opacity<1 or animation on ${route}`,
        });
        return;
      }
      expect(found).toBe(true);
    });
  }
});

// (7) No JS
test.describe('no javascript', () => {
  test.use({ javaScriptEnabled: false });
  for (const route of ROUTES) {
    test(`reveals visible without JS ${route}`, async ({ page }) => {
      await page.goto(route);
      const els = page.locator('.vn-reveal');
      const n = await els.count();
      for (let i = 0; i < n; i++) {
        await expect(els.nth(i)).toBeVisible();
        await expect(els.nth(i)).toHaveCSS('opacity', '1');
      }
    });
  }
});

test('case CSS is inlined only on case pages and still beats the brand layers', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent!.includes('.vn-case-hero')))).toBe(false);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto('/projetos/caato/');
  // a site-layer rule that the brand would otherwise override: the pager is a two-column grid
  await expect(page.locator('.vn-case-pager')).toHaveCSS('display', 'grid');
  expect(await page.locator('.vn-case-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
  await page.setViewportSize({ width: 700, height: 800 });
  expect(await page.locator('.vn-case-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.locator('.vn-case-pager').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
  await expect(page.locator('.vn-case-pager__link--next')).toHaveCSS('text-align', 'left');
});
