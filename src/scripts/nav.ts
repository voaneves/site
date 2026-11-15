import { onIdle } from './lazy';

// Deferred sections (content-visibility: auto in render-cost.css) hold only seeded heights until rendered.
// Before any in-page jump, render them all, so the browser resolves the target against the real layout
// (the jump is the click's default action, which runs after this capture listener). Same for a hash on load.
function renderAll(): void {
  document.documentElement.classList.add('vn-cv-off');
}

export function init(): void {
  if (location.hash) renderAll();
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
    if (a && a.hash && a.pathname === location.pathname) renderAll();
  }, { capture: true });
  addEventListener('hashchange', renderAll);
  const navAnchors = [...document.querySelectorAll<HTMLAnchorElement>('.vn-navbar__link[data-nav-hash]')];
  const sections = navAnchors
    .map((a) => document.getElementById(a.dataset.navHash || ''))
    .filter((el): el is HTMLElement => Boolean(el));
  if (sections.length > 0 && 'IntersectionObserver' in window) {
    const navObs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const a of navAnchors) {
          const match = a.dataset.navHash === entry.target.id;
          a.classList.toggle('is-active', match);
        }
      }
    }, { rootMargin: '-38% 0px -54% 0px' });
    sections.forEach((sec) => navObs.observe(sec));
  }
  onIdle(groundFlip);
}

// Header ground flip: a 1px line at the header's mid-height copies the ground under it onto the navbar.
function groundFlip(): void {
  const nav = document.querySelector<HTMLElement>('.vn-navbar');
  const secs = document.querySelectorAll('main > section, main > article > section, .vn-site-footer');
  if (!nav || !secs.length) return;
  let cur: Element | undefined;
  let io: IntersectionObserver;
  const ch = (x: string) => x.match(/\d+/g)!.slice(0, 3).map(Number);
  const opaque = (bg: string) => {
    const a = bg.match(/\(([^)]+)\)/)?.[1].split(/[,/\s]+/).filter(Boolean)[3];
    return bg !== 'transparent' && (a === undefined || parseFloat(a) > 0);
  };
  // Sections without their own background (404, privacy, case body) take the first painted ancestor.
  const ground = (el: Element): string | undefined => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (opaque(bg)) return bg;
    }
  };
  const apply = () => {
    if (!cur) return;
    const bg = ground(cur);
    if (!bg) return;
    const c = getComputedStyle(cur);
    const s = nav.style;
    for (const p of ['--vn-text', '--vn-text-muted', '--vn-line']) s.setProperty(p, c.getPropertyValue(p));
    s.setProperty('--vn-surface', bg);
    s.color = c.color;
    s.colorScheme = ch(c.color).reduce((a, n) => a + n) < 382 ? 'light' : 'dark';
    const hex = '#' + ch(bg).map((n) => (n + 256).toString(16).slice(1)).join('');
    document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', hex));
  };
  const build = () => {
    io?.disconnect();
    const t = Math.round(nav.offsetHeight / 2);
    io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { cur = e.target; apply(); }
    }, { rootMargin: `-${t}px 0px -${innerHeight - t - 1}px` });
    secs.forEach((e) => io.observe(e));
  };
  build();
  nav.dataset.flip = ''; // ready: tests wait on this instead of guessing when load + idle has passed
  let lastH = innerHeight, lastN = nav.offsetHeight, raf = 0;
  addEventListener('resize', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (innerHeight === lastH && nav.offsetHeight === lastN) return;
      lastH = innerHeight; lastN = nav.offsetHeight;
      build();
    });
  });
  addEventListener('transitionend', (e) => e.target === cur && apply());
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
