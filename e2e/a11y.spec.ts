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

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1366, height: 800 },
];

for (const route of ROUTES) {
  for (const theme of ['light', 'dark']) {
   for (const vp of VIEWPORTS) {
    test(`axe WCAG 2.2 AA clean on ${route} (${theme}, ${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(route);
      await page.evaluate(async (mode) => {
        document.documentElement.dataset.theme = mode;
        // Flipping the theme flips color-scheme, which starts colour transitions, and entrances (vn-beat) fade in; audit the settled state.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => a instanceof CSSTransition || (a instanceof CSSAnimation && Number.isFinite(a.effect?.getComputedTiming().endTime as number)))
            .map((a) => a.finished.catch(() => {})),
        );
      }, theme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
   }
  }
}
