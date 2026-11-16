import { test, expect, type Locator } from '@playwright/test';

const CASES = [
  { route: '/', sections: ['quem-sou', 'numeros', 'expertise', 'perguntas'] },
  { route: '/en/', sections: ['quem-sou', 'numeros', 'expertise', 'perguntas'] },
];

for (const { route, sections } of CASES) {
  test.describe(`section heads ${route}`, () => {
    for (const id of sections) {
      test(`#${id}: eyebrow exposes the tag only, brackets are aria-hidden`, async ({ page }) => {
        await page.goto(route);
        const eyebrow = page.locator(`#${id} .vn-eyebrow`);
        await expect(eyebrow).toHaveCount(1);
        const info = await eyebrow.evaluate((el) => {
          const hidden = [...el.querySelectorAll('[aria-hidden="true"]')];
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
          return {
            hiddenText: hidden.map((n) => n.textContent ?? ''),
            exposed: (clone.textContent ?? '').trim(),
            bracketsExposed: /[\[\]]/.test(clone.textContent ?? ''),
          };
        });
        expect(info.bracketsExposed).toBe(false);
        expect(info.hiddenText[0]).toMatch(/^\[ 0\d — $/);
        expect(info.hiddenText[1]).toBe(' ]');
        expect(info.exposed.length).toBeGreaterThan(2);
        expect(info.exposed).not.toMatch(/\d\d\s*·/);
        await expect(page.locator(`#${id} .vn-eyebrow`).getByText(info.exposed)).toHaveCount(1); // scoped: the Numbers arch repeats the tag in an aria-hidden SVG
        await expect(page.getByRole('region').or(page.locator(`#${id}`)).locator('.vn-eyebrow')).toContainText(info.exposed);
      });
    }

    test('chapters alternate creme / ink / creme / creme', async ({ page }) => {
      await page.goto(route);
      const cls = await Promise.all(
        sections.map((id) => page.locator(`#${id}`).getAttribute('class')),
      );
      expect(cls[0]).toContain('vn-chapter--creme');
      expect(cls[1]).toContain('vn-chapter--ink');
      expect(cls[2]).toContain('vn-chapter--creme');
      expect(cls[3]).toContain('vn-chapter--creme');
    });

    test('FAQ stays native details and opens on click', async ({ page }) => {
      await page.goto(route);
      const first = page.locator('#perguntas details.vn-faq-item').first();
      await first.locator('summary').scrollIntoViewIfNeeded();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
    });

    // U6k.4: the ink chapter is the day's dark counterpoint (tinta) and the night's ember band (graphite),
    // no longer pure black. Text stays cream on it in both themes.
    for (const [theme, bg] of [['light', 'rgb(10, 10, 10)'], ['dark', 'rgb(26, 26, 26)']] as const) {
      test(`ink chapter text is cream on its ground (${theme})`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem('vn-theme', t), theme);
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const c = await page.locator('#numeros').evaluate((el) => {
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, fg: cs.color };
        });
        expect(c.bg).toBe(bg);
        expect(c.fg).toBe('rgb(232, 222, 197)');
      });
    }
  });
}

const HEADS = [
  { id: 'jornada', num: '04' },
  { id: 'projetos', num: '05' },
  { id: 'servicos', num: '06' },
  { id: 'contato', num: '08' },
];

for (const route of ['/', '/en/']) {
  for (const { id, num } of HEADS) {
    test(`${route} #${id}: bracketed eyebrow, brackets aria-hidden, tag text exposed`, async ({ page }) => {
      await page.goto(route);
      const eyebrow = page.locator(`#${id} .vn-eyebrow`);
      await expect(eyebrow).toHaveCount(1);
      const info = await eyebrow.evaluate((el) => {
        const hidden = [...el.querySelectorAll('[aria-hidden="true"]')].map((n) => n.textContent ?? '');
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
        return { hidden, exposed: (clone.textContent ?? '').trim() };
      });
      expect(info.hidden).toEqual([`[ ${num} — `, ' ]']);
      expect(info.exposed.length).toBeGreaterThan(2);
      expect(info.exposed).not.toMatch(/[\[\]]|\d\d\s*·/);
      await expect(page.locator(`#${id} .vn-type-tag.vn-sec-tag`)).toHaveCount(0);
    });
  }

  test(`${route} split-italic headlines on projects, services, journey`, async ({ page }) => {
    await page.goto(route);
    for (const id of ['jornada', 'projetos', 'servicos']) {
      await expect(page.locator(`#${id} h2.vn-split-title em`)).toHaveCount(1);
    }
  });
}

const gapBelow = (h: Locator) =>
  h.evaluate((el) => (el.nextElementSibling as HTMLElement).getBoundingClientRect().top - el.getBoundingClientRect().bottom);

// Defect fixes: heading breathing room, chip containment, footer wrapping, no horizontal overflow.
for (const route of ['/', '/en/']) {
  for (const width of [390, 1440]) {
    test(`${route} @${width}: section h2 keeps at least 12px (and under 40px) above the next element`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
      for (const id of ['numeros', 'jornada', 'projetos', 'servicos']) {
        const h = page.locator(`#${id} h2.vn-split-title`);
        await h.scrollIntoViewIfNeeded();
        // The next element is still mid-reveal (offset) until its enter animation settles.
        await expect.poll(async () => { const g = await gapBelow(h); return g >= 12 && g < 40 ? 'ok' : `#${id} gap ${g}`; }, { timeout: 8000 }).toBe('ok');
      }
    });

    test(`${route} @${width}: the About statement does not touch its body paragraph`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
      const h = page.locator('#quem-sou .vn-about-statement');
      await h.scrollIntoViewIfNeeded();
      await expect.poll(async () => { const g = await gapBelow(h); return g >= 12 && g < 80 ? 'ok' : `gap ${g}`; }, { timeout: 8000 }).toBe('ok');
    });
  }

  for (const width of [320, 390, 1440]) {
    test(`${route} @${width}: every expertise chip contains its text; no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        const chips = document.querySelectorAll<HTMLElement>('#expertise .vn-pillar-card .vn-chip');
        for (const chip of chips) {
          const box = chip.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(chip);
          for (const r of range.getClientRects()) {
            if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) {
              out.push(`${chip.textContent}`);
              break;
            }
          }
        }
        return { n: chips.length, out };
      });
      expect(bad.n).toBeGreaterThan(20);
      expect(bad.out).toEqual([]);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  }

  test(`${route} @390: footer links wrap 3 + 2, not 4 + 1`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const rows = await page.locator('.vn-site-footer__links a').evaluateAll((as) => {
      const tops = as.map((a) => Math.round(a.getBoundingClientRect().top));
      return [...new Set(tops)].map((t) => tops.filter((x) => x === t).length);
    });
    expect(rows).toEqual([3, 2]);
  });
}

for (const route of ['/', '/en/']) {
  test(`${route} Numbers arch: decorative, full width, inside the section, label on the curve`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await page.locator('#numeros').scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      // Layout size, not getBoundingClientRect(): the arch carries a scroll-scrubbed scale (u-arch, 1 x 2.2 at entry 0%),
      // so its painted box depends on how far the timeline has advanced when this runs (slow runners read it early).
      const s = document.querySelector('#numeros')!.getBoundingClientRect();
      const a = document.querySelector('.vn-arch')!;
      const cs = getComputedStyle(a);
      const r = { width: parseFloat(cs.width), height: parseFloat(cs.height) };
      const eb = document.querySelector('#numeros .vn-eyebrow')!;
      return {
        hidden: a.getAttribute('aria-hidden'), w: r.width / s.width, ratio: r.height / r.width,
        before: getComputedStyle(document.querySelector('#numeros')!, '::before').content,
        label: a.querySelector('textPath')!.textContent, tag: eb.textContent!.replace(/[\[\]—\d\s]+/g, ' ').trim(),
      };
    });
    expect(m.hidden).toBe('true');
    expect(m.w).toBeCloseTo(1, 2);
    expect(m.ratio).toBeCloseTo(0.15, 2);
    expect(m.before).toBe('none');
    expect(m.tag).toContain(m.label!.trim());
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator('.vn-arch__text')).toBeHidden();
  });
}
