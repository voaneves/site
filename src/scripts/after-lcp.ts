// Work that is useful but must not compete with first paint / LCP: the web fonts (swapped in over
// metric-matched fallbacks, see site.css) and the web app manifest (whose icon fetch otherwise lands
// inside the LCP window). It starts once the page has loaded and the last LCP candidate is a beat old.
const SETTLE_MS = 400;
const NO_LCP_MS = 3000;

let done = false;
let observer: PerformanceObserver | undefined;

function run(): void {
  if (done) return;
  done = true;
  observer?.disconnect();
  document.documentElement.classList.add('vn-fonts');
  // Once the fonts have been fetched they sit in the HTTP cache, so later page views apply them at
  // first paint (head script in Base.astro) instead of flashing the fallbacks again. rAF first, so
  // the style recalc has queued the font loads before we wait on `ready`; only flag real success.
  requestAnimationFrame(() =>
    document.fonts?.ready.then((set) => {
      const loaded = [...set].some((f) => f.status === 'loaded');
      const failed = [...set].some((f) => f.status === 'error');
      if (!loaded || failed) return;
      try { localStorage.setItem('vn-fonts', '1'); } catch { /* storage blocked */ }
    }),
  );
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.webmanifest';
    document.head.appendChild(link);
  }
}

export function init(): void {
  const afterLoad = (cb: () => void) => {
    if (document.readyState === 'complete') cb();
    else addEventListener('load', cb, { once: true });
  };

  afterLoad(() => {
    let timer = setTimeout(run, NO_LCP_MS);
    try {
      observer = new PerformanceObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(run, SETTLE_MS);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      clearTimeout(timer);
      setTimeout(run, SETTLE_MS);
    }
  });
}
