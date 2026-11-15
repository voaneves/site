import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SLUGS = ['mte', 'dashboards', 'caato', 'mota-godinho', 'boas-obras', 'midflow'];

for (const [route, label, caseBase] of [
  ['/', 'Ver case →', '/projetos'],
  ['/en/', 'View case →', '/en/projects'],
] as const) {
  test(`project rows on ${route}: sized thumbnails, unique data-vt, cursor hooks`, async ({ page }) => {
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
      await expect(row.locator('.vn-unveil [data-vt], .vn-unveil[data-vt]').first()).toHaveAttribute('data-vt', SLUGS[i]);
      await expect(row).toHaveAttribute('data-cursor-label', label);
      await expect(row).toHaveAttribute('data-cursor-media', /\/assets\/img\/port\/.+\.webp$/);
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

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

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
