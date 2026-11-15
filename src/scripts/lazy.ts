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
