import { test, expect } from '@playwright/test';

test.describe('chrome fx', () => {
  test('easing and hover tokens: Era values, brand 1ms under reduced motion', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/');
    const v = (n: string) => page.evaluate((k) => getComputedStyle(document.documentElement).getPropertyValue(k).replace(/\s+/g, ''), n);
    expect(await v('--vn-ease-out')).toBe('cubic-bezier(.25,1,.5,1)');
    expect(await v('--vn-ease-in-out')).toBe('cubic-bezier(.76,0,.24,1)');
    expect(await page.locator('.vn-navbar__link').first().evaluate((e) => getComputedStyle(e, '::after').transitionDuration)).toBe('0.4s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await v('--vn-dur-hover')).toBe('1ms');
  });

  test('late sheet: lazy for everyone, carries the hover rules, none of them inline', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => /\/_astro\/late\./.test(r.url()) && hits.push(r.url()));
    await page.emulateMedia({ reducedMotion: 'reduce' }); // it must load under reduced motion too
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/');
    await page.waitForFunction(() => 'late' in document.documentElement.dataset);
    expect(hits.length).toBe(1);
    const inline = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent).join(''));
    expect(inline).not.toContain('.vn-navbar__link:hover');
    expect(inline).not.toContain('vn-project-row__media img{transition');
    const link = page.locator('.vn-navbar__link').first();
    const before = await link.evaluate((e) => getComputedStyle(e).color);
    await link.hover();
    await expect.poll(() => link.evaluate((e) => getComputedStyle(e).color)).not.toBe(before);
  });

  test('header CTA is magnetic and follows the pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('.vn-navbar__cta');
    await expect(btn).toHaveAttribute('data-magnetic', '');
    await expect(btn).toHaveAttribute('data-cursor-label', /.+/);
    const box = (await btn.boundingBox())!;
    const tx = () => btn.evaluate((el) => parseFloat(getComputedStyle(el).translate.split(' ')[0]) || 0);
    await page.mouse.move(5, 300);
    let w = 0;
    await expect(async () => {
      await page.mouse.move(box.x + box.width - 4 - (w++ % 2), box.y + box.height / 2, { steps: 3 });
      expect(await tx()).toBeGreaterThan(0.5);
    }).toPass({ timeout: 8000 });
  });

  test('nav link letters roll on keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('.vn-navbar__link[data-fx="roll"]').first();
    const inner = link.locator('> span > span');
    const ty = () => inner.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
    expect(await ty()).toBe(0);
    await page.keyboard.press('Tab');
    await expect(async () => {
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused({ timeout: 300 });
    }).toPass({ timeout: 8000 });
    await expect.poll(ty, { timeout: 3000 }).toBeLessThan(-5);
    await expect(link).toHaveAccessibleName(/\S/);
  });

  test('focused nav links are not obscured (WCAG 2.4.11)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const links = page.locator('.vn-navbar__link');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const l = links.nth(i);
      await l.focus();
      const top = await l.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!hit && (hit === el || el.contains(hit));
      });
      expect(top).toBe(true);
    }
  });

  test('outline buttons fill from the edge on hover and on keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForFunction(() => 'late' in document.documentElement.dataset);
    const btn = page.locator('.vn-hero-btn-ghost');
    const fill = () => btn.evaluate((e) => new DOMMatrix(getComputedStyle(e, '::before').transform).a);
    const color = () => btn.evaluate((e) => getComputedStyle(e).color);
    expect(await fill()).toBe(0);
    const rest = await color();
    // Wait on the real conditions: fonts settled (the hero reflows when they land and the button can move under a
    // still pointer), then the real mouse centred on the button until the browser reports :hover, then the fill.
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(async () => {
        const b = (await btn.boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        return btn.evaluate((e) => e.matches(':hover'));
      })
      .toBe(true);
    await expect.poll(fill, { timeout: 3000 }).toBe(1);
    await expect(btn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect.poll(color).not.toBe(rest);
    await page.mouse.move(5, 5);
    await expect.poll(fill, { timeout: 3000 }).toBe(0);
    // keyboard parity
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.classList.contains('vn-hero-btn-ghost'))) break;
    }
    await expect.poll(fill, { timeout: 3000 }).toBe(1);
  });

  test('outline buttons keep the instant colour swap under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('/');
    await page.waitForFunction(() => 'late' in document.documentElement.dataset);
    const btn = page.locator('.vn-hero-btn-ghost');
    expect(await btn.evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none');
    await btn.hover();
    await expect.poll(() => btn.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  });
});
