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

/** Runs `cb` once, the first time `el` comes within one viewport of the screen (the shared "load when near" trigger). */
export function whenNear(el: Element | null, cb: () => void): void {
  if (!el) return;
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    cb();
  }, { rootMargin: '100% 0px' });
  io.observe(el);
}

export function motionOK(): boolean {
  return matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches;
}

const ENGAGE_EVENTS = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'] as const;
const ENGAGE_FALLBACK_MS = 9000;
const engageQueue: Array<() => void> = [];
let engageArmed = false;
let engageFired = false;
/** The event type of the interaction that engaged the page ('' when the idle fallback did): accents can decide on it. */
export let engagedBy = '';

function onUserEngage(e: Event): void {
  // Chromium on Linux (headless and Lighthouse included) dispatches a trusted pointermove at exactly (0,0) with zero
  // movement once layout settles, with nobody at the mouse: that is not an interaction. A real first move also has zero
  // movement but lands anywhere else, and a real pointer at the corner keeps streaming, so only this fingerprint is ignored.
  if (e.type === 'pointermove') {
    const p = e as PointerEvent;
    if (!p.clientX && !p.clientY && !p.movementX && !p.movementY) return;
  }
  engagedBy = e.type;
  fireEngage();
}

function fireEngage(): void {
  if (engageFired) return;
  engageFired = true;
  for (const t of ENGAGE_EVENTS) removeEventListener(t, onUserEngage, true);
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
  for (const t of ENGAGE_EVENTS) addEventListener(t, onUserEngage, { capture: true, passive: true });
  const arm = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(fireEngage, { timeout: 2000 }) : fireEngage()), ENGAGE_FALLBACK_MS);
  if (document.readyState === 'complete') arm();
  else addEventListener('load', arm, { once: true });
}
