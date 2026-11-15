export function init(): void {
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
