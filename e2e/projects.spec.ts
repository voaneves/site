import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SLUGS = ['mte', 'dashboards', 'caato', 'mota-godinho', 'boas-obras', 'midflow'];

for (const [route, label, caseBase] of [
  ['/', 'Ver case →', '/projetos'],
  ['/en/', 'View case →', '/en/projects'],
] as const) {
  test(`project rows on ${route}: sized thumbnails, unique data-vt, cursor label (no media preview)`, async ({ page }) => {
    await page.goto(route);
    const rows = page.locator('.vn-project-row');
    await expect(rows).toHaveCount(SLUGS.length);

    const vts = await page.locator('[data-vt]').evaluateAll((els) => els.map((e) => e.getAttribute('data-vt')));
    expect(vts).toEqual(SLUGS);
    expect(new Set(vts).size).toBe(vts.length);

    for (let i = 0; i < SLUGS.length; i++) {
      const row = rows.nth(i);
      const img = row.locator('img');
      await expect(img).toHaveAttribute('width', /^\d+$/);
      await expect(img).toHaveAttribute('height', /^\d+$/);
      await expect(img).toHaveAttribute('loading', 'lazy');
      await expect(img).toHaveAttribute('decoding', 'async');
      await expect(row.locator('[data-enter=clip][data-vt]').first()).toHaveAttribute('data-vt', SLUGS[i]);
      await expect(row).toHaveAttribute('data-cursor-label', label);
      expect(await row.getAttribute('data-cursor-media')).toBeNull();
      await expect(row).toHaveAttribute('href', `${caseBase}/${SLUGS[i]}/`);
      await expect(row.locator('.vn-project-row__cta')).toHaveText(label);
    }
  });
}

test('clicking a row opens the case with a visible h1 and a single matching data-vt', async ({ page }) => {
  await page.goto('/');
  const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.waitForURL('**/projetos/caato/');
  await expect(page.locator('h1')).toBeVisible();

  const vts = await page.locator('[data-vt]').evaluateAll((els) => els.map((e) => e.getAttribute('data-vt')));
  expect(vts).toEqual(['caato']);
  const img = page.locator('.vn-case-media[data-vt="caato"] img');
  await expect(img).toHaveAttribute('width', '1600');
  await expect(img).toHaveAttribute('height', '800');
  await expect(page.locator('.vn-eyebrow')).toContainText('Case');
});

test('the project thumbnails on the home stay lazy (not requested above the fold)', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/img\/port\//.test(r.url())) requested.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('load');
  expect(requested).toEqual([]);
});

test('cross-document view transition is armed and names the shared element', async ({ page }) => {
  await page.goto('/');
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('[data-vt]')].map((e) => getComputedStyle(e).viewTransitionName),
  );
  expect(names).toEqual(SLUGS.map((s) => `project-${s}`));

  await page.goto('/projetos/caato/');
  const name = await page.locator('.vn-case-media').evaluate((e) => getComputedStyle(e).viewTransitionName);
  expect(name).toBe('project-caato');
});

const record = () => {
  addEventListener('pagereveal', (e) => {
    const vt = (e as unknown as { viewTransition?: { types: Set<string>; ready: Promise<void> } }).viewTransition;
    sessionStorage.setItem('vtTypes', vt ? [...vt.types].join(',') : 'none');
    vt?.ready.then(() =>
      sessionStorage.setItem('vtAnims', document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? '').join(',')),
    );
  });
};

test('navigation transition is typed: cover, counter and reveal run, then everything is cleared', async ({ page }) => {
  await page.addInitScript(record);
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto('/');
  const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.waitForURL('**/projetos/caato/');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtTypes'))).toBe('nav');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtAnims') ?? '')).toContain('vn-nav-in');
  const anims = (await page.evaluate(() => sessionStorage.getItem('vtAnims')))!;
  expect(anims).toContain('vn-nav-out');
  expect(anims).toContain('vn-count');
  await expect(page.locator('html')).not.toHaveClass(/vn-vt/, { timeout: 5000 });
  await expect(page.locator('.vn-vt-count')).toBeHidden();
  await expect(page.locator('h1')).toBeVisible();
});

test('the theme toggle keeps its own reveal: no navigation rules, no counter', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await page.goto('/projetos/caato/');
  const names = () => page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? ''));
  await page.locator('#vn-theme-toggle').click();
  await expect.poll(async () => (await names()).some((n) => n === 'vn-dusk' || n === 'vn-dawn')).toBe(true);
  const seen = await names();
  expect(seen).not.toContain('vn-nav-in');
  expect(seen).not.toContain('vn-nav-out');
  expect(seen).not.toContain('vn-count');
  await expect(page.locator('html')).not.toHaveClass(/vn-vt/);
  await expect(page.locator('.vn-vt-count')).toBeHidden();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('navigation has no view transition', async ({ page }) => {
    await page.addInitScript(record);
    await page.goto('/');
    const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.waitForURL('**/projetos/caato/');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtTypes'))).toBe('none');
    await expect(page.locator('.vn-vt-count')).toBeHidden();
  });

  test('matchMedia reports reduce and no zoom or transition runs on the row thumbnails', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const row = page.locator('.vn-project-row').first();
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    const tf = await row.locator('img').evaluate((e) => getComputedStyle(e).transform);
    expect(tf).toBe('none');
  });
});

test('built CSS: @view-transition only inside the no-preference block', async ({ page }) => {
  const dist = path.resolve('dist');
  const html = fs.readFileSync(path.join(dist, 'projetos', 'caato', 'index.html'), 'utf8');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const idx: number[] = [];
  for (let i = css.indexOf('@view-transition'); i !== -1; i = css.indexOf('@view-transition', i + 1)) idx.push(i);
  expect(idx.length).toBeGreaterThan(0);

  for (const i of idx) {
    // walk back to the enclosing @media and make sure it is the no-preference one
    let depth = 0;
    let j = i - 1;
    for (; j >= 0; j--) {
      if (css[j] === '}') depth++;
      else if (css[j] === '{') {
        if (depth === 0) break;
        depth--;
      }
    }
    const head = css.slice(css.lastIndexOf('}', j) + 1, j);
    expect(head.replace(/\s+/g, '')).toContain('@media(prefers-reduced-motion:no-preference)');
  }
  void page;
});

test('row click starts a cross-document view transition that pairs the shared element', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('vt', '0');
    window.addEventListener('pageswap', (e) => {
      if ((e as unknown as { viewTransition?: unknown }).viewTransition) sessionStorage.setItem('vt', '1');
    });
  });
  const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await page.waitForURL('**/projetos/caato/');
  expect(await page.evaluate(() => sessionStorage.getItem('vt'))).toBe('1');
});

for (const [route, subtitle] of [
  ['/', 'Seis projetos com contexto, arquitetura e resultado.'],
  ['/en/', 'Six projects with context, architecture and outcome.'],
] as const) {
  test(`projects subtitle on ${route} states the real count and is not pointer-only`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#projetos')).toContainText(subtitle);
    await expect(page.locator('#projetos .vn-project-row')).toHaveCount(6);
  });
}
