import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTE_PAIRS } from '../../src/i18n/routes.mjs';

/** Every indexable page of the site (pt then en for each pair) plus the 404 document. */
export const PAGES: string[] = [...ROUTE_PAIRS.flatMap((p: { pt: string; en: string }) => [p.pt, p.en])];
// Cloudflare Pages redirects /404.html -> /404 (200); the real error page is what any unknown URL returns, with a 404 status.
export const NOT_FOUND = '/this-page-does-not-exist/';
export const ALL_PAGES: string[] = [...PAGES, NOT_FOUND];

export const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 800 },
  { width: 1920, height: 1080 },
] as const;

export const PAIRS = ROUTE_PAIRS as Array<{ pt: string; en: string }>;

export const isEn = (route: string): boolean => route.startsWith('/en/');

/** Equivalent page in the other language. */
export function otherLocale(route: string): string {
  const pair = PAIRS.find((p) => p.pt === route || p.en === route);
  if (!pair) throw new Error(`no pair for ${route}`);
  return pair.pt === route ? pair.en : pair.pt;
}

export const NAV_HASHES = ['quem-sou', 'numeros', 'jornada', 'projetos', 'servicos', 'perguntas', 'contato'] as const;

/** Collects everything a clean page load must not produce. */
export interface Probe {
  console: string[];
  pageErrors: string[];
  failed: string[];
  csp: string[];
}

export async function attachProbe(page: Page, opts: { ignoreDocumentStatus?: string } = {}): Promise<Probe> {
  const probe: Probe = { console: [], pageErrors: [], failed: [], csp: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // the browser logs "Failed to load resource" for an expected 404 document; it is not a page defect
    if (opts.ignoreDocumentStatus && m.location().url.endsWith(opts.ignoreDocumentStatus)) return;
    probe.console.push(m.text());
  });
  page.on('pageerror', (e) => probe.pageErrors.push(e.message));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(f)) return; // navigation cancel / lazy image aborted by scroll: not a server failure
    probe.failed.push(`${r.method()} ${r.url()} ${f}`);
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (opts.ignoreDocumentStatus && r.url().endsWith(opts.ignoreDocumentStatus)) return;
    probe.failed.push(`${r.status()} ${r.url()}`);
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} <- ${e.blockedURI}`));
  });
  return probe;
}

export async function drainCsp(page: Page, probe: Probe): Promise<void> {
  const v = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
  probe.csp.push(...v);
}

/** Scroll the whole page top to bottom in viewport-sized steps so lazy images and reveals run, then return to top. */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.9));
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await wait(45);
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await wait(80);
    window.scrollTo({ top: 0, behavior: 'instant' });
    await wait(40);
  });
}

/**
 * The first real interaction. Interaction-only work (the late sheet, scroll motion, the extra font faces) loads on the
 * first pointer, wheel, touch, key or scroll event (lazy.ts onEngage). A Shift key press is the most inert one.
 */
export async function engage(page: Page): Promise<void> {
  await page.keyboard.press('Shift');
}

/** content-visibility sections above can resize while scrolling in: wait until the element stops moving. */
export async function settle(page: Page, track: Locator): Promise<void> {
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
