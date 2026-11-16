import { test, expect, type Locator, type Page } from '@playwright/test';

// content-visibility sections above can resize while scrolling in: wait until the track stops moving.
async function settle(page: Page, track: Locator) {
  await track.scrollIntoViewIfNeeded();
  let prev = -1;
  await expect.poll(async () => {
    await track.scrollIntoViewIfNeeded();
    const y = (await track.boundingBox())!.y + (await page.evaluate(() => scrollY));
    const same = Math.abs(y - prev) < 0.5;
    prev = y;
    await page.waitForTimeout(120);
    return same;
  }).toBe(true);
}

// 1024 wide: the swipe carousel. The pinned desktop mode is covered by journey-pinned.spec.ts.
test.describe('journey gallery', () => {
  test.use({ viewport: { width: 1024, height: 900 } });

  test('next button and ArrowRight advance the live counter', async ({ page }) => {
    await page.goto('/');
    const count = page.locator('[data-journey-count]');
    const track = page.locator('[data-vn-journey]');
    await page.locator('#jornada').scrollIntoViewIfNeeded();
    await expect(count).toHaveText(/^01 \/ \d\d$/);
    await expect(async () => {
      await page.locator('[data-journey-next]').click();
      await expect(count).toHaveText(/^02 \//, { timeout: 1500 });
    }).toPass({ timeout: 10_000 });

    await track.focus();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText(/^03 \//);
    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText(/^02 \//);
  });

  test('counter text updates (not a live region) and the track is a labelled focusable region', async ({ page }) => {
    await page.goto('/en/');
    const count = page.locator('[data-journey-count]');
    await expect(count).not.toHaveAttribute('aria-live', /.+/);
    await expect(count).toHaveText(/^01 \/ \d\d$/);
    await page.locator('[data-vn-journey]').focus();
    // journey.ts is lazy (loads once #jornada nears the viewport): wait for its handlers before pressing.
    await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-ready', '');
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText(/^02 \//, { timeout: 1500 });
    const track = page.locator('[data-vn-journey]');
    await expect(track).toHaveAttribute('role', 'region');
    await expect(track).toHaveAttribute('tabindex', '0');
    await expect(track).toHaveAttribute('aria-label', /.+/);
  });

  test('carousel is seamless: no scrollbar, no vertical overflow, full-bleed, drag cue', async ({ page }) => {
    await page.goto('/en/');
    const track = page.locator('[data-vn-journey]');
    await track.scrollIntoViewIfNeeded();
    const m = await track.evaluate((el) => {
      const t = el as HTMLElement;
      const cs = getComputedStyle(t);
      const cards = t.querySelectorAll('.vn-journey-card');
      // Layout position, not getBoundingClientRect(): the first #jornada container carries a scroll-scrubbed drift (u-drift,
      // scale .96 on exit), so its painted left edge depends on how far the timeline has advanced when this runs.
      let lead = 0;
      for (let n: HTMLElement | null = document.querySelector<HTMLElement>('#jornada .vn-eyebrow'); n; n = n.offsetParent as HTMLElement | null) lead += n.offsetLeft + n.clientLeft;
      lead -= document.documentElement.scrollLeft;
      return {
        barH: t.offsetHeight - t.clientHeight - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth),
        vOverflow: t.scrollHeight - t.clientHeight,
        scrollbarWidth: cs.scrollbarWidth,
        overflowY: cs.overflowY,
        lastRight: cards[cards.length - 1].getBoundingClientRect().right,
        firstLeft: cards[0].getBoundingClientRect().left,
        lead,
        vw: document.documentElement.clientWidth,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(m.barH).toBe(0);
    expect(m.scrollbarWidth).toBe('none');
    expect(m.vOverflow).toBeLessThanOrEqual(0);
    expect(['hidden', 'clip']).toContain(m.overflowY);
    expect(m.lastRight).toBeGreaterThan(m.vw);
    expect(Math.abs(m.firstLeft - m.lead)).toBeLessThanOrEqual(1);
    expect(m.docOverflow).toBe(0);
    await expect(track).toHaveAttribute('data-cursor-label', 'Drag');
    await page.goto('/');
    await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-cursor-label', 'Arraste');
  });

  test('mouse drag moves the track and snaps to a card on release', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('[data-vn-journey]');
    await settle(page, track);
    // the drag handler is attached by the lazy journey chunk; a pointerdown before it is ready is ignored
    await expect(track).toHaveAttribute('data-ready', '');
    const box = (await track.boundingBox())!;
    const y = box.y + 80;
    await page.mouse.move(box.x + 800, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 600, y, { steps: 6 });
    await page.mouse.move(box.x + 400, y, { steps: 6 });
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await page.mouse.up();
    // Settles exactly on a card: scrollLeft equals one of the card offsets.
    await expect.poll(async () => track.evaluate((el) => {
      const cs = [...el.querySelectorAll<HTMLElement>('.vn-journey-card')];
      const max = el.scrollWidth - el.clientWidth;
      return cs.some((c) => Math.abs(Math.min(c.offsetLeft - cs[0].offsetLeft, max) - el.scrollLeft) < 1.5)
        && !el.classList.contains('is-dragging');
    }), { timeout: 4000 }).toBe(true);
    await expect(page.locator('[data-journey-count]')).not.toHaveText(/^01 \//);
    const frac = await page.locator('[data-journey-bar]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(frac).toBeGreaterThan(0.2);
  });

  test('a vertical wheel over the track scrolls the page, never the track', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('[data-vn-journey]');
    await settle(page, track);
    const box = (await track.boundingBox())!;
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(box.x + 400, box.y + 100);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 50);
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
    // Shift + wheel (and a horizontal wheel) pan the track.
    await page.mouse.wheel(250, 0);
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  test('reduced motion: depth animation is off and the next button jumps instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page, page.locator('[data-vn-journey]'));
    const names = await page.locator('.vn-journey-card').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(new Set(names)).toEqual(new Set(['none']));
    await expect(async () => {
      await page.locator('[data-journey-next]').click();
      await expect(page.locator('[data-journey-count]')).toHaveText(/^02 \//, { timeout: 1000 });
    }).toPass({ timeout: 10_000 });
  });

  test('controls meet the target size and carry names', async ({ page }) => {
    await page.goto('/en/');
    for (const sel of ['[data-journey-prev]', '[data-journey-next]']) {
      const b = page.locator(sel);
      await expect(b).toHaveAttribute('aria-label', /.+/);
      const bb = (await b.boundingBox())!;
      expect(Math.min(bb.width, bb.height)).toBeGreaterThanOrEqual(24);
    }
  });
});
