import { test, expect, type Page } from '@playwright/test';

// Cursor zones (U6.1): data-cursor-zone -> root data-zone; data-cursor-idle rotates a pill label once per entry.
// The attributes are injected here so the spec does not depend on the markup of any section.
const cursor = (page: Page) => page.locator('.vn-cursor');
const label = (page: Page) => page.locator('.vn-cursor__pill span');

async function wake(page: Page) {
  await page.mouse.move(400, 80);
  await page.locator('.vn-cursor').waitFor({ state: 'attached' });
  await page.mouse.move(420, 90);
}

/** Two fixed bands (#za at y=220, #zb at y=420), each with a link on the right, injected before the first move. */
async function setup(page: Page, zoneA: string, idleA = '', zoneB = 'read') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    ({ zoneA, idleA, zoneB }) => {
      const mk = (id: string, top: number, zone: string, idle: string) => {
        const d = document.createElement('div');
        d.id = id;
        d.dataset.cursorZone = zone;
        if (idle) d.dataset.cursorIdle = idle;
        d.style.cssText = `position:fixed;left:0;width:100%;height:150px;top:${top}px;z-index:8000`;
        // CSSOM only: the site CSP blocks inline style attributes parsed from markup
        const a = document.createElement('a');
        a.href = '#x';
        a.textContent = 'go';
        a.style.cssText = 'position:absolute;right:20px;top:20px;width:80px;height:40px;background:#ccc';
        d.append(a);
        document.body.append(d);
      };
      mk('za', 220, zoneA, idleA);
      mk('zb', 420, zoneB, '');
    },
    { zoneA, idleA, zoneB },
  );
  await wake(page);
}

/** Moves inside a band, away from its link. */
async function moveIn(page: Page, id: string, x = 300) {
  const b = (await page.locator(`#${id}`).boundingBox())!;
  await page.mouse.move(x - 40, b.y + 100);
  await page.mouse.move(x, b.y + 90, { steps: 3 });
}

async function onLink(page: Page) {
  const b = (await page.locator('#za a').boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + 20, { steps: 2 });
}

const idleOn = (page: Page) => expect(cursor(page)).toHaveAttribute('data-idle', '', { timeout: 400 });
const idleOff = (page: Page, timeout = 400) => expect(cursor(page)).not.toHaveAttribute('data-idle', /.*/, { timeout });

test.describe('cursor zones', () => {
  for (const z of ['ring', 'read', 'plus', 'drag', 'view', 'signal']) {
    test(`zone "${z}" is written to the cursor root`, async ({ page }) => {
      await setup(page, z);
      await expect(async () => {
        await moveIn(page, 'za');
        await expect(cursor(page)).toHaveAttribute('data-zone', z, { timeout: 300 });
      }).toPass();
    });
  }

  test('leaving a zone clears data-zone and entering another switches it', async ({ page }) => {
    await setup(page, 'ring', '', 'plus');
    await expect(async () => {
      await moveIn(page, 'zb');
      await expect(cursor(page)).toHaveAttribute('data-zone', 'plus', { timeout: 300 });
    }).toPass();
    await expect(async () => {
      await page.mouse.move(300, 20);
      await page.mouse.move(310, 30);
      await expect(cursor(page)).toHaveAttribute('data-zone', '', { timeout: 300 });
    }).toPass();
  });

  test('a link wins over the zone state', async ({ page }) => {
    await setup(page, 'ring');
    await expect(async () => {
      await onLink(page);
      await expect(cursor(page)).toHaveAttribute('data-state', 'link', { timeout: 300 });
    }).toPass();
    await expect(cursor(page)).toHaveAttribute('data-zone', 'ring');
  });

  test('idle label shows on entry, then retracts', async ({ page }) => {
    await setup(page, 'ring', 'OI·HELLO|PROVA·PROOF');
    await expect(async () => {
      await moveIn(page, 'za');
      await idleOn(page);
    }).toPass();
    await expect(label(page)).toHaveText('OI·HELLO');
    await idleOff(page, 4000);
  });

  test('labels rotate on re-entry and never retrigger inside a zone', async ({ page }) => {
    await setup(page, 'ring', 'OI·HELLO|PROVA·PROOF');
    await expect(async () => {
      await moveIn(page, 'za');
      await idleOn(page);
    }).toPass();
    await expect(label(page)).toHaveText('OI·HELLO');
    await idleOff(page, 4000);
    await moveIn(page, 'za', 500); // same zone: nothing new
    await page.waitForTimeout(150);
    await idleOff(page, 100);
    await moveIn(page, 'zb'); // another zone without idle labels
    await expect(cursor(page)).toHaveAttribute('data-zone', 'read');
    await moveIn(page, 'za'); // back: the next label
    await idleOn(page);
    await expect(label(page)).toHaveText('PROVA·PROOF');
  });

  test('no idle label when entering straight onto a link', async ({ page }) => {
    await setup(page, 'ring', 'OI·HELLO');
    await page.mouse.move(700, 20);
    await onLink(page);
    await expect(cursor(page)).toHaveAttribute('data-state', 'link');
    await idleOff(page);
  });

  test('a link entered while the idle label is up cancels it', async ({ page }) => {
    await setup(page, 'ring', 'OI·HELLO');
    await expect(async () => {
      await moveIn(page, 'za');
      await idleOn(page);
    }).toPass();
    await onLink(page);
    await expect(cursor(page)).toHaveAttribute('data-state', 'link');
    await idleOff(page);
  });

  test('Tab still hides the cursor and drops the idle label', async ({ page }) => {
    await setup(page, 'ring', 'OI·HELLO');
    await expect(async () => {
      await moveIn(page, 'za');
      await idleOn(page);
    }).toPass();
    await page.keyboard.press('Tab');
    await expect(cursor(page)).toHaveAttribute('data-state', 'hidden');
    await idleOff(page);
  });

  test('zones add no inline CSS on the cursor root', async ({ page }) => {
    await setup(page, 'plus');
    await expect(async () => {
      await moveIn(page, 'za');
      await expect(cursor(page)).toHaveAttribute('data-zone', 'plus', { timeout: 300 });
    }).toPass();
    expect(await cursor(page).getAttribute('style')).toBeNull();
  });
});
