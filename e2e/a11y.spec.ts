import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  '/',
  '/en/',
  '/projetos/caato/',
  '/en/projects/caato/',
  '/privacidade/',
  '/en/privacy/',
  '/404.html',
];

for (const route of ROUTES) {
  for (const theme of ['light', 'dark']) {
    test(`axe WCAG 2.2 AA clean on ${route} (${theme})`, async ({ page }) => {
      await page.goto(route);
      await page.evaluate((mode) => {
        document.documentElement.dataset.theme = mode;
      }, theme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
