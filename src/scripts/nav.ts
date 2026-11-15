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
}
