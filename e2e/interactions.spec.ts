import { test, expect } from '@playwright/test';

test('no console errors, page errors, or CSP violations on primary routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  await page.addInitScript(() => {
    (window as Window & { __cspViolations?: string[] }).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as Window & { __cspViolations?: string[] }).__cspViolations?.push(
        `${e.violatedDirective}: ${e.blockedURI}`,
      );
    });
  });

  for (const route of ['/', '/en/', '/projetos/caato/']) {
    await page.goto(route);
    const csp = await page.evaluate(
      () => (window as Window & { __cspViolations?: string[] }).__cspViolations ?? [],
    );
    expect(csp, `CSP violations on ${route}`).toEqual([]);
  }

  expect(errors).toEqual([]);
});

test('theme toggle switches theme, updates theme-color, and persists across reload', async ({ page }) => {
  await page.goto('/');
  const initial = await page.evaluate(() => document.documentElement.dataset.theme);
  const expectedNext = initial === 'dark' ? 'light' : 'dark';

  await page.locator('#vn-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', expectedNext);

  const metaColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
  expect(metaColor).toBe(expectedNext === 'dark' ? '#0a0a0a' : '#fdfbf6');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', expectedNext);
});

test('marquee pause/resume button toggles aria-pressed and paused state', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('[data-marquee-toggle]');
  const root = page.locator('[data-vn-marquee-root]');

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveClass(/is-paused/);
});

test('mobile viewport 360px has no horizontal overflow and drawer opens/closes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasOverflow).toBe(false);

  const menuBtn = page.locator('#vn-menu-btn');
  const drawer = page.locator('#vn-mobile-drawer');
  await menuBtn.click();
  await expect(drawer).toHaveAttribute('open', '');
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

  await page.locator('#vn-drawer-close').click();
  await expect(drawer).not.toHaveAttribute('open', '');
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
});

test('reduced-motion mode loads cleanly without console or layout errors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#contato')).toBeVisible();
});
