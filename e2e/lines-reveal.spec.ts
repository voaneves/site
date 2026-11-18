import { test, expect, type Page } from '@playwright/test';
import { engage } from './lib/site';

// U7f: paragraph line reveal (data-enter=lines), Journey mask heading, S/M/L ladder, Proof-board sticky panel.
test.use({ reducedMotion: 'no-preference' });

async function ready(page: Page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await engage(page);
  await page.waitForFunction(() => document.documentElement.dataset.scrollFx !== undefined);
}

test('About p1 groups its words into rendered lines (--l) when it enters', async ({ page }) => {
  await ready(page);
  const p = page.locator('#quem-sou p[data-enter=lines]');
  await expect(p.locator('.vn-w').first()).toBeAttached();
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator('xpath=..')).toHaveClass(/is-in/);
  const words = await p.locator('.vn-w').evaluateAll((els) => els.map((e) => [(e as HTMLElement).offsetTop, Number((e as HTMLElement).style.getPropertyValue('--l'))]));
  for (let i = 1; i < words.length; i++) {
    const [top, l] = words[i];
    const [pTop, pl] = words[i - 1];
    expect(l).toBe(top > pTop + 4 ? pl + 1 : pl);
  }
  expect(words.at(-1)?.[1]).toBeGreaterThan(0);
});

test('without the engine the lines block keeps the plain fade-rise and stays visible', async ({ page }) => {
  await page.route(/\/_astro\/scroll-fx\./, (r) => r.abort());
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  const p = page.locator('#quem-sou p[data-enter=lines]');
  await p.scrollIntoViewIfNeeded();
  await expect(p.locator('xpath=..')).toHaveClass(/is-in/);
  await expect(p.locator('.vn-w')).toHaveCount(0);
  await expect(p).toHaveCSS('opacity', '1');
});

test('data-enter=lines sits on the subtitles and never on LCP text', async ({ page }) => {
  await page.goto('/');
  const ids = await page.locator('[data-enter=lines]').evaluateAll((els) => els.map((e) => e.closest('section')?.id));
  expect(ids).toEqual(['quem-sou', 'numeros', 'jornada', 'projetos', 'servicos', 'perguntas', 'contato']);
  await expect(page.locator('#inicio [data-enter=lines], #inicio [data-enter=mask]')).toHaveCount(0);
});

test('Journey heading masks like the others and keeps its text', async ({ page }) => {
  await ready(page);
  const h = page.locator('#jornada h2');
  await expect(h).toHaveAttribute('data-enter', 'mask');
  const text = await h.evaluate((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim());
  expect(await h.locator('.vn-w').evaluateAll((w) => w.map((e) => e.textContent).join(' '))).toBe(text);
  await expect(page.locator('#perguntas h2')).toHaveAttribute('data-drift', '');
});

test('S/M/L ladder: .8 s opacity, 1.2 s translate/scale/clip, Out ease', async ({ page }) => {
  await ready(page);
  const t = await page.locator('#perguntas .vn-faq-item').first().evaluate((e) => {
    const cs = getComputedStyle(e);
    return [cs.transitionDuration, cs.transitionTimingFunction];
  });
  expect(t[0]).toBe('0.8s, 1.2s, 1.2s, 1.2s');
  expect(t[1]).toContain('cubic-bezier(0.25, 1, 0.5, 1)');
});

test('mask headline words use the lamalama line timing and settle at identity', async ({ page }) => {
  await ready(page); // 1366x900, '/', waits for the fx sheet
  const h = page.locator('#servicos h2[data-enter=mask]');
  const w = h.locator('.vn-w').first();
  // deferred sections keep stale computed styles until rendered (R8): render them all, the heading stays far below
  await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
  // hidden pose, read while the heading is still below the fold
  const hid = await w.evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.scale, c.transitionDuration, c.transitionTimingFunction]; });
  expect(hid[0]).toBe('0');
  expect(parseFloat(hid[1])).toBeCloseTo(0.96, 2);
  expect(hid[2].split(', ').every((d) => d === '0.85s')).toBe(true);
  expect(hid[3]).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
  await h.scrollIntoViewIfNeeded();
  await expect(h.locator('xpath=..')).toHaveClass(/is-in/);
  const { ls, n } = await h.evaluate((e) => ({
    ls: (e as HTMLElement).style.getPropertyValue('--ls'),
    n: Math.max(...[...e.querySelectorAll<HTMLElement>('.vn-w')].map((x) => Number(x.style.getPropertyValue('--l')))) + 1,
  }));
  expect(ls).toBe(n > 1 ? `${Math.round((135 + 30 * n) / (n - 1))}ms` : '0ms');
  await expect.poll(() => w.evaluate((e) => getComputedStyle(e).opacity), { timeout: 4000 }).toBe('1');
  await expect.poll(() => w.evaluate((e) => parseFloat(getComputedStyle(e).scale))).toBe(1);
});

test('Proof-board chart panel is sticky on large screens only', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.vn-chart-panel')).toHaveCSS('position', 'sticky');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator('.vn-chart-panel')).toHaveCSS('position', 'static');
});

// Chrome rejects view()/scroll() inside the `animation` shorthand, so the minifier must not merge the longhands.
test('built inline scroll-driven animations keep a name and a scroll/view timeline', async ({ page }) => {
  await ready(page);
  const sel = ['.vn-chart-svg__fill', '#jornada .vn-journey-track', '.vn-service-card', '#perguntas h2[data-drift]'];
  for (const s of sel) {
    const r = await page.locator(s).first().evaluate((e) => ({
      name: getComputedStyle(e).animationName,
      tl: e.getAnimations().some((a) => a.timeline instanceof ViewTimeline || a.timeline instanceof ScrollTimeline),
    }));
    expect(r.name, s).not.toBe('none');
    expect(r.tl, s).toBe(true);
  }
});

// A clip-path on an inline box that wraps paints only its first fragment, so every piece of a word that can end a
// line (after a hyphen, slash or dash) must be its own .vn-w: one box each, text untouched, nothing left clipped.
for (const width of [320, 390, 1440]) {
  for (const path of ['/', '/en/', '/projetos/caato/']) {
    test(`lines words never fragment across lines and keep the server text ${path} @${width}`, async ({ page, browser }) => {
      const plain = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
      const src = await plain.newPage();
      await src.goto(path);
      const server = await src.locator('[data-enter=lines]').evaluateAll((els) => els.map((e) => e.textContent));
      await plain.close();
      expect(server.length).toBeGreaterThan(0);

      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await engage(page);
      await page.waitForFunction(() => document.documentElement.dataset.scrollFx !== undefined);
      const blocks = page.locator('[data-enter=lines]');
      await expect(blocks).toHaveCount(server.length);
      for (let i = 0; i < server.length; i++) {
        await expect(blocks.nth(i).locator('.vn-w').first()).toBeAttached();
        await blocks.nth(i).scrollIntoViewIfNeeded();
        await expect(blocks.nth(i).locator('xpath=ancestor-or-self::*[contains(concat(" ", @class, " "), " is-in ")]').first()).toBeAttached();
      }
      await page.waitForFunction(() => [...document.querySelectorAll('[data-enter=lines]')].every((e) => e.closest('.is-done')), null, { timeout: 15_000 });

      expect(await blocks.evaluateAll((els) => els.map((e) => e.textContent))).toEqual(server);
      const split = await page.locator('[data-enter=lines] .vn-w').evaluateAll((ws) => ws.filter((w) => w.getClientRects().length !== 1).map((w) => w.textContent));
      expect(split).toEqual([]);

      if (path !== '/') return;
      const piece = await page.locator('#quem-sou p[data-enter=lines]').evaluate((p) => {
        const w = [...p.querySelectorAll('.vn-w')].find((e) => e.textContent?.startsWith('gradua'));
        if (!w) return null;
        const r = w.getBoundingClientRect();
        const b = p.getBoundingClientRect();
        return {
          size: r.width > 0 && r.height > 0,
          inside: r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
          clip: getComputedStyle(w).clipPath,
        };
      });
      expect(piece).toEqual({ size: true, inside: true, clip: 'none' });
    });
  }
}
