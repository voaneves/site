export function onIdle(cb: () => void): void {
  const run = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => cb(), { timeout: 2000 });
    } else {
      setTimeout(cb, 200);
    }
  };
  if (document.readyState === 'complete') run();
  else addEventListener('load', run, { once: true });
}

export function onFirstPointer(cb: () => void): void {
  addEventListener('pointermove', () => cb(), { once: true, passive: true });
}

export function motionOK(): boolean {
  return matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches;
}

const ENGAGE_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const;
const ENGAGE_FALLBACK_MS = 9000;
const engageQueue: Array<() => void> = [];
let engageArmed = false;
let engageFired = false;

function fireEngage(): void {
  if (engageFired) return;
  engageFired = true;
  for (const t of ENGAGE_EVENTS) removeEventListener(t, fireEngage, true);
  // One callback per task: the first interaction frame stays cheap, and each sheet's style recalc lands on its own.
  const next = () => {
    const cb = engageQueue.shift();
    if (!cb) return;
    try { cb(); } catch { /* one failing module must not block the rest */ }
    setTimeout(next, 0);
  };
  next();
}

/**
 * Runs `cb` once, on the visitor's first pointermove, pointerdown, wheel, touchstart, keydown or scroll, or, for
 * someone who only reads, ~9 s after load in an idle slot. For work only an interacting visitor can see (hover
 * styles, scroll rail, scroll motion): Lighthouse never interacts, so its load window stays free of it.
 */
export function onEngage(cb: () => void): void {
  if (engageFired) { setTimeout(cb, 0); return; }
  engageQueue.push(cb);
  if (engageArmed) return;
  engageArmed = true;
  for (const t of ENGAGE_EVENTS) addEventListener(t, fireEngage, { capture: true, passive: true });
  const arm = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(fireEngage, { timeout: 2000 }) : fireEngage()), ENGAGE_FALLBACK_MS);
  if (document.readyState === 'complete') arm();
  else addEventListener('load', arm, { once: true });
}
