// Every page at six viewport widths (group 4/4): layout sanity, console/network/CSP cleanliness.
import { ALL_PAGES } from './lib/site';
import { registerSweeps } from './lib/sweep';

registerSweeps(ALL_PAGES.filter((_, i) => i % 4 === 3));
