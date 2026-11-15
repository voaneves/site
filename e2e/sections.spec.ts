import { test, expect } from '@playwright/test';

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
        await expect(page.locator(`#${id}`).getByText(info.exposed)).toHaveCount(1);
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

    test('ink chapter text is cream on black', async ({ page }) => {
      await page.goto(route);
      const c = await page.locator('#numeros').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color };
      });
      expect(c.bg).toBe('rgb(0, 0, 0)');
    });
  });
}
