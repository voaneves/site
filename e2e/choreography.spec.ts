import { test, expect, type Page } from '@playwright/test';
import { PORTFOLIO } from '../src/data/portfolio';

// U4 choreography: [data-enter] / [data-stagger] entrances, split-headline masks, the contact drift and count-up.
const HOME_SECTIONS = ['#quem-sou', '#numeros', '#expertise', '#projetos', '#servicos', '#perguntas', '#contato', 'footer'];
const CASE_SECTIONS = ['.vn-case > section:not(.vn-case-hero)', 'footer'];
const ROUTES: [string, string[]][] = [
  ['/', HOME_SECTIONS],
  ['/en/', HOME_SECTIONS],
  ['/projetos/caato/', CASE_SECTIONS],
];
const MOVING = '[data-enter], [data-enter=mask] .vn-w, [data-enter=clip] img, [data-drift]';

async function settle(page: Page) {
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.evaluate(() => document.fonts.ready);
}

// Scroll the whole page like a reader: ~60% of a viewport per step, a short pause each.
async function readDown(page: Page) {
  for (let k = 0; k < 200; k++) {
    const done = await page.evaluate(() => {
      scrollBy({ top: innerHeight * 0.6, behavior: 'instant' });
      return innerHeight + scrollY >= document.documentElement.scrollHeight - 1;
    });
    await page.waitForTimeout(60);
    if (done) break;
  }
  await page.waitForTimeout(200);
  await transitionsDone(page);
}

// Every entrance has finished (CSS transitions only; the marquee and other loops are animations).
async function transitionsDone(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.getAnimations().filter((a) => a instanceof CSSTransition && a.playState === 'running').length,
        ),
      { timeout: 8000 },
    )
    .toBe(0);
}

// Offenders: anything still hidden, offset, scaled or clipped in.
function notSettled(sel: string) {
  return [...document.querySelectorAll(sel)]
    .filter((e) => {
      const cs = getComputedStyle(e);
      const zero = (v: string) => v === 'none' || v.split(' ').every((n) => parseFloat(n) === 0);
      // U7 parallax drives scale/translate from a scroll or view timeline on purpose (e.g. project thumbnails at
      // 1.18 inside their clip): that is choreography in progress, not an entrance left unfinished. Opacity still counts.
      const scrolled = e.getAnimations().some((a) => a.timeline && !(a.timeline instanceof DocumentTimeline));
      if (scrolled) return cs.opacity !== '1';
      return cs.opacity !== '1' || !zero(cs.translate) || !['none', '1'].includes(cs.scale) || cs.transform !== 'none';
    })
    .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/)[0]}[${e.getAttribute('data-enter')}]`);
}

for (const [route, sections] of ROUTES) {
  for (const [w, h] of [
    [1366, 900],
    [390, 844],
  ]) {
    test(`${route} @${w}: every section has entrances and all of them settle fully visible`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(route);
      await settle(page);
      for (const s of sections) {
        expect(await page.locator(`${s} [data-enter], ${s}[data-enter]`).count(), `${s} has [data-enter]`).toBeGreaterThan(0);
      }
      // below the fold they start hidden (the positive control for the hidden state)
      const hiddenBelow = await page.evaluate(() =>
        [...document.querySelectorAll('[data-enter]')].some(
          (e) => e.getBoundingClientRect().top > innerHeight * 1.5 && getComputedStyle(e).opacity !== '1',
        ),
      );
      expect(hiddenBelow).toBe(true);
      await readDown(page);
      expect(await page.locator('[data-enter]:not(.is-in):not([data-stagger] > *)').count()).toBe(0);
      // content-visibility skips off-screen sections (their computed style is stale), so look at each on screen
      for (const s of sections) {
        await page.locator(s).first().evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await transitionsDone(page);
        expect(await page.evaluate(notSettled, MOVING.split(', ').map((m) => `${s} ${m}, ${s}${m}`).join(', ')), s).toEqual([]);
      }
    });
  }
}

test('staggered children queue in order (--i rises with the index)', async ({ page }) => {
  await page.goto('/');
  const is = await page.locator('#numeros .vn-stats-hero-grid > *').evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).getPropertyValue('--i').trim()),
  );
  expect(is).toEqual(['0', '1', '2', '3']);
  // project rows alternate their entrance side
  const sides = await page.locator('.vn-project-row__left').evaluateAll((els) => els.map((e) => e.getAttribute('data-enter')));
  expect(sides.slice(0, 4)).toEqual(['left', 'right', 'left', 'right']);
});

test('mask headlines group words into rendered lines before rising', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await settle(page);
  const h = page.locator('#quem-sou h2[data-enter=mask]');
  await h.scrollIntoViewIfNeeded();
  await expect(h).toHaveClass(/is-in/);
  // words on the same rendered line share one --l; a new line gets the next index
  const words = await h.locator('.vn-w').evaluateAll((els) => els.map((e) => [(e as HTMLElement).offsetTop, Number((e as HTMLElement).style.getPropertyValue('--l'))]));
  for (let i = 1; i < words.length; i++) {
    const [top, l] = words[i];
    const [pTop, pl] = words[i - 1];
    expect(l).toBe(top > pTop + 4 ? pl + 1 : pl);
  }
  expect(words.at(-1)?.[1]).toBeGreaterThan(0);
});

test('split headlines keep their text and accessible name', async ({ page }) => {
  for (const [route, locale] of [
    ['/', 'pt-br'],
    ['/en/', 'en'],
  ] as const) {
    await page.goto(route);
    const a = PORTFOLIO[locale].about;
    await expect(page.locator('#quem-sou h2')).toHaveAccessibleName(
      a.statementPre + a.statementEm1 + a.statementMid + a.statementEm2 + a.statementPost,
    );
    await expect(page.locator('#contato h2')).toHaveAccessibleName(locale === 'en' ? "Let's make signal?" : 'Bora fazer sinal?');
    for (const [id, title] of [
      ['#numeros', PORTFOLIO[locale].numbers.title],
      ['#expertise', PORTFOLIO[locale].expertise.title],
      ['#projetos', PORTFOLIO[locale].projects.title],
      ['#servicos', PORTFOLIO[locale].services.title],
      ['#perguntas', PORTFOLIO[locale].faq.title],
    ]) {
      await expect(page.locator(`${id} h2[data-enter=mask]`)).toHaveAccessibleName(title);
    }
  }
});

test('split headlines take the same space with and without the motion layout', async ({ browser }) => {
  const measure = async (reducedMotion: 'reduce' | 'no-preference') => {
    const ctx = await browser.newContext({ reducedMotion, viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await settle(page);
    await readDown(page);
    const r = await page.locator('[data-enter=mask]').evaluateAll((els) => els.map((e) => (e as HTMLElement).offsetHeight));
    await ctx.close();
    return r;
  };
  expect(await measure('no-preference')).toEqual(await measure('reduce'));
});

test('stats count up on an aria-hidden overlay; the real number never changes', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const val = page.locator('#numeros [data-count]').nth(1);
  const finalText = (await val.textContent())?.trim();
  await val.scrollIntoViewIfNeeded();
  await expect(val.locator('.vn-count')).toHaveAttribute('aria-hidden', 'true');
  expect(await val.evaluate((e) => e.firstChild?.textContent?.trim())).toBe(finalText);
  await expect(val.locator('.vn-count')).toHaveCount(0, { timeout: 5000 });
  await expect(val).toHaveText(finalText ?? '');
});

test('CLS <= 0.01 while reading down the page with the entrances', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await settle(page);
  // This test owns the entrance choreography's CLS. Load-time CLS (including the post-LCP swap of the
  // below-the-fold fonts, after-lcp.ts → html.vn-fonts) is owned by gates.spec.ts and Lighthouse, so start
  // counting once those late fonts have landed: a reader cannot be 3,500px down within the first 600 ms.
  await page.waitForFunction(() => document.documentElement.classList.contains('vn-fonts'));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    (window as unknown as { __cls: number }).__cls = 0;
  });
  await readDown(page);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.01);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const [route] of ROUTES) {
    test(`${route}: nothing hidden, no transition or drift, no count-up chunk`, async ({ page }) => {
      const chunks: string[] = [];
      page.on('request', (r) => /\/_astro\/count\./.test(r.url()) && chunks.push(r.url()));
      await page.goto(route);
      await settle(page);
      const at = async () =>
        page.evaluate((sel) => {
          const moving = [...document.querySelectorAll(sel)].filter((e) => {
            const cs = getComputedStyle(e);
            const d = (v: string) => v.split(',').some((x) => parseFloat(x) > 0);
            return d(cs.transitionDuration) || cs.animationName !== 'none';
          });
          return moving.map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(/\s+/)[0]);
        }, MOVING);
      expect(await at()).toEqual([]);
      expect(await page.evaluate(notSettled, MOVING)).toEqual([]);
      await readDown(page);
      expect(await page.evaluate(notSettled, MOVING)).toEqual([]);
      expect(chunks).toEqual([]);
    });
  }
});

test.describe('no javascript', () => {
  test.use({ javaScriptEnabled: false });
  for (const [route] of ROUTES) {
    test(`${route}: every entrance is visible without JS`, async ({ page }) => {
      await page.goto(route);
      expect(await page.locator('[data-enter]').count()).toBeGreaterThan(0);
      expect(await page.evaluate(notSettled, MOVING)).toEqual([]);
      const clipped = await page.evaluate(() =>
        // a resting rounded inset(0) (the project thumbnails) is fine; anything that cuts into the box is not
        [...document.querySelectorAll('[data-enter], [data-enter] .vn-w')].filter(
          (e) => !/^(none|inset\(0px( round [^)]*)?\))$/.test(getComputedStyle(e).clipPath),
        ).length,
      );
      expect(clipped).toBe(0);
    });
  }
});
