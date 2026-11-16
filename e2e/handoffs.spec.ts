import { inflateSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';

// U7c: the nine section hand-offs (src/styles/fx/handoff.css). Progress is set by scrolling so the element sits at a known view() position.
type Kind = 'entry' | 'exit';

async function ready(page: Page, want = 'tl') {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe(want);
}

/** Scrolls so `sel` is at view() `kind` progress p, then reads one computed property (optionally of a pseudo). */
async function at(page: Page, sel: string, kind: Kind, p: number, prop: string, pseudo?: string, readSel = sel): Promise<string> {
  const place = () =>
    page.evaluate(
      ([s, k, q]) => {
        const el = document.querySelector(s as string)!;
        const r = el.getBoundingClientRect();
        const vh = innerHeight;
        const L = Math.min(r.height, vh);
        const top = k === 'entry' ? vh - (q as number) * L : L - r.height - (q as number) * L;
        scrollTo({ top: scrollY + r.top - top, behavior: 'instant' });
      },
      [sel, kind, p] as const,
    );
  await place();
  await page.waitForTimeout(120);
  await place(); // content-visibility sections settle to their real height after the first jump
  await page.waitForTimeout(120);
  return page.evaluate(
    ([s, pr, ps]) => (getComputedStyle(document.querySelector(s as string)!, (ps as string) || null) as unknown as Record<string, string>)[pr as string],
    [readSel, prop, pseudo ?? ''] as const,
  );
}

const nums = (v: string) => (v.match(/-?\d*\.?\d+/g) ?? []).map(Number);
const num = (v: string, i = 0) => nums(v)[i] ?? NaN;
const rest = (v: string) => expect(['none', '0px', '0px 0px', '1']).toContain(v);

test.describe('handoffs, timelines', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

  test('identity at scroll 0 (nothing moved, faded or clipped above the fold)', async ({ page }) => {
    await ready(page);
    const s = await page.evaluate(() => {
      const g = (sel: string, ps?: string) => getComputedStyle(document.querySelector(sel)!, ps ?? null);
      return { inner: g('.vn-hero__inner').translate, scrim: g('.vn-hero', '::after').opacity, scrollY };
    });
    expect(s.scrollY).toBe(0);
    rest(s.inner);
    expect(s.scrim).toBe('0');
  });

  test('1 Sink & lift: hero inner sinks and lags, scrim darkens', async ({ page }) => {
    await ready(page);
    const y = async (f: number) => {
      await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), f * 900);
      await page.waitForTimeout(150);
      return page.evaluate(() => [getComputedStyle(document.querySelector('.vn-hero__inner')!).translate, getComputedStyle(document.querySelector('.vn-hero')!, '::after').opacity]);
    };
    const [t0] = await y(0);
    const [t5, o5] = await y(0.5);
    const [t1, o1] = await y(1);
    rest(t0);
    expect(num(t5, 1)).toBeGreaterThan(30);
    expect(num(t1, 1)).toBeGreaterThan(num(t5, 1));
    // The sink equals the hero's bottom padding, so the content reaches the hero's edge at most and is never sliced.
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.vn-hero')!).paddingBottom));
    expect(num(t1, 1)).toBeGreaterThan(pad - 2);
    expect(num(t1, 1)).toBeLessThan(pad + 2);
    expect(parseFloat(o5)).toBeLessThan(0.1);
    expect(parseFloat(o1)).toBeGreaterThan(0.5);
  });

  test('2 Arch rise: the dome over About settles, grid rises', async ({ page }) => {
    await ready(page);
    const a0 = await at(page, '#numeros', 'entry', 0.02, 'scale', undefined, '.vn-arch');
    const a5 = await at(page, '#numeros', 'entry', 0.45, 'scale', undefined, '.vn-arch');
    const a1 = await at(page, '#numeros', 'entry', 1, 'scale', undefined, '.vn-arch');
    expect(num(a0, 1)).toBeGreaterThan(1.8); // "1 2.2" at the start of the entry
    expect(num(a5, 1)).toBeLessThan(num(a0, 1));
    expect(num(a5, 1)).toBeGreaterThan(1);
    rest(a1);
    const g0 = await at(page, '#numeros', 'entry', 0.2, 'translate', undefined, '.vn-stats-hero-grid');
    const g1 = await at(page, '#numeros', 'entry', 1, 'translate', undefined, '.vn-stats-hero-grid');
    expect(num(g0, 1)).toBeGreaterThan(60);
    rest(g1);
  });

  test('3 Counter-drift + wedge lift', async ({ page }) => {
    await ready(page);
    const v0 = await at(page, '#numeros > .vn-container', 'exit', 0, 'translate');
    const v5 = await at(page, '#numeros > .vn-container', 'exit', 0.5, 'translate');
    const v1 = await at(page, '#numeros > .vn-container', 'exit', 1, 'translate');
    rest(v0);
    expect(num(v5, 1)).toBeLessThan(-20);
    expect(num(v1, 1)).toBeLessThan(num(v5, 1));
    expect(num(v1, 1)).toBeGreaterThan(-80); // -8vh at 900px = -72
    const w0 = await at(page, '#expertise', 'entry', 0.02, 'scale', '::before');
    const w3 = await at(page, '#expertise', 'entry', 0.3, 'scale', '::before');
    const w6 = await at(page, '#expertise', 'entry', 0.7, 'scale', '::before');
    expect(num(w0, w0.split(' ').length - 1)).toBeLessThan(0.15);
    expect(num(w3, w3.split(' ').length - 1)).toBeGreaterThan(0.2);
    expect(num(w3, w3.split(' ').length - 1)).toBeLessThan(1);
    rest(w6);
  });

  test('4 Side shutter: #jornada opens from the sides', async ({ page }) => {
    await ready(page);
    const a = await at(page, '#jornada', 'entry', 0.02, 'clipPath');
    const b = await at(page, '#jornada', 'entry', 0.5, 'clipPath');
    const c = await at(page, '#jornada', 'entry', 1, 'clipPath');
    expect(num(a, 1)).toBeGreaterThan(150); // 12vw at 1440 = 173px
    expect(num(b, 1)).toBeLessThan(num(a, 1));
    expect(num(b, 1)).toBeGreaterThan(0);
    expect(c).not.toBe(a);
  });

  test('5 Hand-under: first journey container scales down and lifts', async ({ page }) => {
    await ready(page);
    const s = '#jornada > .vn-container:first-of-type';
    const t0 = await at(page, s, 'exit', 0, 'translate');
    const t5 = await at(page, s, 'exit', 0.5, 'translate');
    const s5 = await at(page, s, 'exit', 0.5, 'scale');
    const s1 = await at(page, s, 'exit', 1, 'scale');
    expect(num(t5, 1)).toBeLessThan(num(t0, 1) - 5);
    expect(parseFloat(s5)).toBeLessThan(1);
    expect(parseFloat(s1)).toBeCloseTo(0.96, 2);
  });

  test('6 Horizon rise: #servicos arch flattens by 80%', async ({ page }) => {
    await ready(page);
    const a = await at(page, '#servicos', 'entry', 0.02, 'clipPath');
    const b = await at(page, '#servicos', 'entry', 0.4, 'clipPath');
    const c = await at(page, '#servicos', 'entry', 0.85, 'clipPath');
    expect(num(a)).toBeGreaterThan(55);
    expect(num(b)).toBeLessThan(num(a));
    expect(c.startsWith('none') || c.startsWith('inset(0')).toBe(true);
  });

  test('7 Wedge lift + drift: #perguntas wedge scales up', async ({ page }) => {
    await ready(page);
    await at(page, '#perguntas', 'entry', 0.5, 'scale', '::before'); // lazy faq styles load near the viewport
    await page.waitForTimeout(400);
    const a = await at(page, '#perguntas', 'entry', 0.02, 'scale', '::before');
    const b = await at(page, '#perguntas', 'entry', 0.3, 'scale', '::before');
    const last = (v: string) => num(v, v.trim().split(/\s+/).length - 1);
    expect(last(a)).toBeLessThan(0.15);
    expect(last(b)).toBeGreaterThan(last(a));
    expect(last(b)).toBeLessThan(1);
  });

  test('8 Lamp on: #contato clip scrubs open', async ({ page }) => {
    await ready(page);
    const a = await at(page, '#contato', 'entry', 0.02, 'clipPath');
    const b = await at(page, '#contato', 'entry', 0.5, 'clipPath');
    expect(num(a)).toBeGreaterThan(55);
    expect(num(b)).toBeLessThan(num(a));
  });

  test('9 Sinal set: contact container drifts, footer inner rises', async ({ page }) => {
    await ready(page);
    const v5 = await at(page, '#contato > .vn-container', 'exit', 0.03, 'translate');
    const v1 = await at(page, '#contato > .vn-container', 'exit', 0.08, 'translate');
    expect(num(v5, 1)).toBeLessThan(-3);
    expect(num(v1, 1)).toBeLessThan(num(v5, 1));
    const f0 = await at(page, '.vn-site-footer', 'entry', 0.05, 'translate', undefined, '.vn-site-footer__inner');
    const f1 = await at(page, '.vn-site-footer', 'entry', 1, 'translate', undefined, '.vn-site-footer__inner');
    expect(num(f0, 1)).toBeGreaterThan(40);
    rest(f1);
  });

  test('wedge ::before rests before its range and is eased (fill backwards)', async ({ page }) => {
    await ready(page);
    const r = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('#expertise')!, '::before');
      return { fill: c.animationFillMode, ease: c.animationTimingFunction };
    });
    expect(r.fill).toBe('backwards');
    expect(r.ease).toContain('cubic-bezier(0.25, 1, 0.5, 1)');
    const w0 = await at(page, '#expertise', 'entry', 0, 'scale', '::before');
    expect(num(w0, w0.split(' ').length - 1)).toBeLessThan(0.15);
  });

  test('focus inside a drifting container releases its translate and keeps it clear of the header', async ({ page }) => {
    await ready(page);
    for (const sel of ['#numeros > .vn-container', '#contato > .vn-container', '#jornada > .vn-container:first-of-type']) {
      const before = await at(page, sel, 'exit', 0.5, 'translate');
      expect(before, sel).not.toBe('none');
      const res = await page.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement;
        const t = (el.querySelector('a[href],button,input,textarea') as HTMLElement) ?? el;
        if (t === el) el.tabIndex = -1;
        t.focus({ preventScroll: true });
        return null;
      }, sel);
      void res;
      await expect.poll(() => page.evaluate((s) => getComputedStyle(document.querySelector(s)!).translate, sel), sel).toBe('none');
    }
  });

  test('hero scrim is released on focus', async ({ page }) => {
    await ready(page);
    await at(page, '.vn-hero', 'exit', 0.8, 'opacity', '::after');
    await page.evaluate(() => (document.querySelector('.vn-hero a[href],.vn-hero button') as HTMLElement).focus({ preventScroll: true }));
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.vn-hero')!, '::after').opacity)).toBe('0');
  });

  test('focus inside a clipped section releases the clip', async ({ page }) => {
    await ready(page);
    const before = await at(page, '#servicos', 'entry', 0.3, 'clipPath');
    expect(before).not.toBe('none');
    await page.evaluate(() => {
      const el = document.querySelector('#servicos .vn-container') as HTMLElement;
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#servicos')!).clipPath)).toBe('none');
  });
});

test.describe('handoffs, wiring', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
  test('every hand-off resolves to a named animation on a Scroll/View timeline', async ({ page }) => {
    await ready(page);
    const sels = ['.vn-hero__inner', '.vn-arch', '#jornada', '#servicos', '#contato', '.vn-stats-hero-grid', '.vn-site-footer__inner', '#numeros > .vn-container', '#jornada > .vn-container:first-of-type', '#contato > .vn-container'];
    for (const q of sels) {
      await page.evaluate((s) => document.querySelector(s)!.scrollIntoView({ block: 'center' }), q);
      await page.waitForTimeout(100);
      expect(await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).animationName, q), q).toMatch(/^u-/);
    }
    const kinds = await page.evaluate(() => document.getAnimations().map((a) => a.timeline?.constructor.name));
    expect(kinds).toContain('ViewTimeline');
    expect(kinds).toContain('ScrollTimeline');
  });
});

test.describe('handoffs, no timelines', () => {
  const probe = (page: Page) =>
    page.evaluate(() => {
      scrollTo({ top: innerHeight * 4, behavior: 'instant' });
      const g = (s: string) => getComputedStyle(document.querySelector(s)!);
      return [g('#numeros').clipPath, g('#jornada').clipPath, g('#servicos').clipPath, g('.vn-hero__inner').translate, g('#numeros > .vn-container').translate, g('#jornada > .vn-container').scale];
    });
  const ident = (r: string[]) => expect(r).toEqual(['none', 'none', 'none', 'none', 'none', 'none']);

  test('reduced motion: no sheet, everything at rest mid-page', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.documentElement.dataset.scrollFx ?? null)).toBeNull();
    ident(await probe(page));
    await ctx.close();
  });

  test('timeline-unsupported fallback (CSS.supports stub): base mode, everything at rest', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const s = CSS.supports.bind(CSS);
      CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? s(a) : s(a, b))) as typeof CSS.supports;
    });
    await ready(page, 'base');
    ident(await probe(page));
    await ctx.close();
  });
});

/** Colour of one screen pixel, read from a 1x1 PNG screenshot (no image dependency). */
async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  let o = 8;
  const idat: Buffer[] = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o);
    if (png.toString('latin1', o + 4, o + 8) === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); // 1 filter byte (none for a single pixel), then R, G, B (A)
  return [raw[1], raw[2], raw[3]];
}
const near = (a: number[], b: number[], d = 3) => a.every((v, i) => Math.abs(v - b[i]) <= d);

test.describe('hero hand-off and chapter seams (owner screenshots)', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const [w, h] of [[1440, 900], [1866, 1030], [1480, 822], [390, 844]] as const) {
    test(`the hero's content is never sliced by its own bottom edge while it hands off to About (${w}x${h})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await ready(page);
      const hero = await page.evaluate(() => document.querySelector('.vn-hero')!.getBoundingClientRect().height);
      const bad: string[] = [];
      for (let y = 0; y <= hero + 60; y += 60) {
        await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const r = await page.evaluate(() => {
          const box = document.querySelector('.vn-hero')!.getBoundingClientRect();
          const op = parseFloat(getComputedStyle(document.querySelector('.vn-hero__inner')!).opacity);
          const els = [...document.querySelectorAll<HTMLElement>('.vn-hero__actions > *, .vn-hero-portrait, .vn-hero-portrait__hint, .vn-hero-chip, .vn-hero__sub')];
          return { op, visible: box.bottom > 120, over: els.filter((e) => e.getBoundingClientRect().bottom > box.bottom + 0.5).map((e) => e.className) };
        });
        // Never cut by the hero box, and never faded away while the hero is still on screen (owner: "the hero suddenly
        // faded and vanished" when the earlier fix faded the inner instead of keeping it inside the box).
        if (r.over.length) bad.push(`scrollY ${y}: past the hero bottom: ${r.over.join(', ')}`);
        if (r.visible && r.op < 1) bad.push(`scrollY ${y}: hero content faded to ${r.op} while the hero is on screen`);
      }
      expect(bad).toEqual([]);
    });
  }

  test('at rest the hero meets the About wedge cleanly: no sand stripe under the hero (1866x1030)', async ({ page }) => {
    await page.setViewportSize({ width: 1866, height: 1030 });
    await ready(page);
    const edge = await page.evaluate(() => {
      const wedge = getComputedStyle(document.querySelector('#quem-sou')!, '::before');
      return { origin: wedge.transformOrigin, hero: document.querySelector('.vn-hero')!.getBoundingClientRect().bottom, about: document.querySelector('#quem-sou')!.getBoundingClientRect().top };
    });
    expect(edge.origin).toBe('0px 0px'); // the wedge grows from the seam, not from its bottom
    expect(Math.abs(edge.hero - edge.about)).toBeLessThan(1);
    expect(edge.hero).toBeLessThan(1030 - 20); // the seam is on screen
    const hero = await pixel(page, 3, Math.floor(edge.hero) - 6);
    for (const dy of [1, 3, 8]) {
      expect(near(await pixel(page, 3, Math.ceil(edge.hero) + dy), hero), `row +${dy} below the hero is the hero's ground`).toBe(true);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`Numbers meets Expertise with no gap at three scroll positions (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript((t) => localStorage.setItem('vn-theme', t), theme);
      await ready(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const p of [0.12, 0.35, 0.8]) {
        await at(page, '#expertise', 'entry', p, 'scale', '::before');
        const g = await page.evaluate(() => {
          const n = document.querySelector('#numeros')!.getBoundingClientRect().bottom;
          return { n, e: document.querySelector('#expertise')!.getBoundingClientRect().top };
        });
        expect(Math.abs(g.n - g.e), `layout gap at ${p}`).toBeLessThan(1);
        const above = await pixel(page, 3, Math.floor(g.n) - 4);
        for (const dy of [1, 3, 6]) {
          expect(near(await pixel(page, 3, Math.ceil(g.n) + dy), above), `${theme} ${p}: row +${dy} under Numbers has Numbers' ground`).toBe(true);
        }
      }
    });
  }
});
