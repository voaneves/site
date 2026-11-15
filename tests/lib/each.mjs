import test from 'node:test';
import { SKIP, ROUTES, loadPage } from './dist.mjs';

/** Register one node:test per page: `<route> · <name>`. Skips (not fails) when dist/ is missing. */
export function eachPage(name, fn, { routes = ROUTES, todo } = {}) {
  for (const route of routes) {
    test(`${route} · ${name}`, { skip: SKIP, todo }, () => fn(loadPage(route)));
  }
}

/** A single dist-dependent test. */
export function distTest(name, fn, opts = {}) {
  test(name, { skip: SKIP, ...opts }, fn);
}
