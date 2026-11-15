// One navigation per (page, viewport), reported as many tests. Playwright restarts a worker after any failed
// test, which would redo every navigation, so the measured results are cached on disk for the lifetime of the
// run (keyed by the runner pid) with a lock so two workers never measure the same page twice.
import { test, expect, type Browser } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NOT_FOUND, VIEWPORTS, attachProbe, drainCsp, scrollThrough, type Probe } from './site';

export interface Sweep {
  probe: Probe;
  overflowX: { scrollWidth: number; clientWidth: number; bodyScrollWidth: number };
  clippedControls: string[];
  headingsOutside: string[];
  undecoded: string[];
  h1: { visible: boolean; text: string };
  mainHeight: number;
  fontSize: number;
  status: number;
}

const CACHE = path.join(os.tmpdir(), `vn-thorough-${process.ppid}`);
const mem = new Map<string, Promise<Record<number, Sweep>>>();
const slug = (route: string) => route.replace(/[^a-z0-9]+/gi, '_');

async function measure(browser: Browser, baseURL: string, route: string): Promise<Record<number, Sweep>> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 800 } });
  const page = await context.newPage();
  const probe = await attachProbe(page, { ignoreDocumentStatus: route === NOT_FOUND ? route : undefined });
  const out: Record<number, Sweep> = {};
  for (const vp of VIEWPORTS) {
    probe.console.length = probe.pageErrors.length = probe.failed.length = probe.csp.length = 0;
    await page.setViewportSize(vp);
    const resp = await page.goto(route, { waitUntil: 'load' });
    await scrollThrough(page);
    await page.waitForTimeout(150);
    await drainCsp(page, probe);
    const m = await page.evaluate(async () => {
      const vw = document.documentElement.clientWidth;
      const de = document.documentElement;
      const undecoded: string[] = [];
      await Promise.all(
        [...document.images].map(async (i) => {
          const src = i.getAttribute('src') ?? '?';
          i.loading = 'eager'; // off-screen lazy images (e.g. horizontal carousels) never load by vertical scroll alone
          try {
            await Promise.race([i.decode(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
          } catch {
            undecoded.push(src);
            return;
          }
          if (i.naturalWidth === 0) undecoded.push(src);
        }),
      );
      const outside: string[] = [];
      for (const h of document.querySelectorAll('h1, h2')) {
        const r = h.getBoundingClientRect();
        if (r.width > 0 && (r.left < -1 || r.right > vw + 1)) outside.push(`${h.tagName} "${(h.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
      }
      // Header controls that are laid out but pushed past the viewport edge are unreachable (clipped by overflow).
      const clipped: string[] = [];
      for (const c of document.querySelectorAll('header a, header button')) {
        const r = c.getBoundingClientRect();
        if (r.width > 0 && getComputedStyle(c).display !== 'none' && r.right > vw + 0.5) clipped.push(`${c.id || c.className || c.tagName} right=${Math.round(r.right)} of ${vw}`);
      }
      const h1 = document.querySelector('h1');
      const hr = h1?.getBoundingClientRect();
      const cs = h1 ? getComputedStyle(h1) : null;
      return {
        overflowX: { scrollWidth: de.scrollWidth, clientWidth: vw, bodyScrollWidth: document.body.scrollWidth },
        clippedControls: clipped,
        headingsOutside: outside,
        undecoded,
        h1: { visible: !!hr && hr.width > 0 && hr.height > 0 && cs?.visibility !== 'hidden' && cs?.display !== 'none', text: h1?.textContent?.trim() ?? '' },
        mainHeight: document.querySelector('main')?.getBoundingClientRect().height ?? 0,
        fontSize: parseFloat(getComputedStyle(document.body).fontSize),
      };
    });
    out[vp.width] = {
      probe: { console: [...probe.console], pageErrors: [...probe.pageErrors], failed: [...probe.failed], csp: [...probe.csp] },
      status: resp?.status() ?? 0,
      ...m,
    };
  }
  await context.close();
  return out;
}

async function getSweeps(browser: Browser, baseURL: string, route: string): Promise<Record<number, Sweep>> {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${slug(route)}.json`);
  const lock = `${file}.lock`;
  const deadline = Date.now() + 150_000;
  for (;;) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    let owner = false;
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      owner = true;
    } catch {
      // someone else is measuring; take over a lock left behind by a crashed worker
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 100_000) fs.rmSync(lock, { force: true });
      } catch {
        /* lock vanished */
      }
    }
    if (owner) {
      try {
        const data = await measure(browser, baseURL, route);
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
        fs.renameSync(`${file}.tmp`, file);
        return data;
      } finally {
        fs.rmSync(lock, { force: true });
      }
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for the ${route} sweep`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Register the per-viewport tests for these pages. */
export function registerSweeps(routes: string[]): void {
  for (const route of routes) {
    test.describe(`sweep ${route}`, () => {
      test.describe.configure({ timeout: 180_000 });
      let sweeps: Record<number, Sweep> | undefined;
      test.beforeEach(async ({ browser }, testInfo) => {
        sweeps ??= await (mem.get(route) ?? mem.set(route, getSweeps(browser, testInfo.project.use.baseURL as string, route)).get(route)!);
      });

      for (const vp of VIEWPORTS) {
        const at = `${vp.width}px`;
        const get = (): Sweep => {
          const s = sweeps?.[vp.width];
          if (!s) throw new Error('sweep missing');
          return s;
        };

        test(`${at} · responds with the expected status`, () => {
          expect(get().status).toBe(route === NOT_FOUND ? 404 : 200);
        });

        test(`${at} · no horizontal overflow`, () => {
          const { scrollWidth, clientWidth, bodyScrollWidth } = get().overflowX;
          expect(scrollWidth, 'documentElement.scrollWidth').toBeLessThanOrEqual(clientWidth);
          expect(bodyScrollWidth, 'body.scrollWidth').toBeLessThanOrEqual(clientWidth);
        });

        test(`${at} · header controls are all inside the viewport (nothing clipped off-screen)`, () => {
          expect(get().clippedControls).toEqual([]);
        });

        test(`${at} · no console errors or uncaught exceptions`, () => {
          expect([...get().probe.console, ...get().probe.pageErrors]).toEqual([]);
        });

        test(`${at} · no failed or 4xx/5xx requests`, () => {
          expect(get().probe.failed).toEqual([]);
        });

        test(`${at} · no CSP violations`, () => {
          expect(get().probe.csp).toEqual([]);
        });

        test(`${at} · h1 is rendered and h1/h2 headings stay inside the viewport`, () => {
          expect(get().h1.visible, 'h1 visible').toBe(true);
          expect(get().h1.text.length).toBeGreaterThan(1);
          expect(get().headingsOutside).toEqual([]);
        });

        test(`${at} · every image decodes (nothing broken or zero-sized)`, () => {
          expect(get().undecoded).toEqual([]);
        });

        test(`${at} · main has real height and body text is at least 14px`, () => {
          expect(get().mainHeight).toBeGreaterThan(200);
          expect(get().fontSize).toBeGreaterThanOrEqual(14);
        });
      }
    });
  }
}
