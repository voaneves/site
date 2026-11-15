export function init(): void {
  const revealEls = document.querySelectorAll('.vn-reveal');
  if (revealEls.length > 0 && 'IntersectionObserver' in window) {
    const revObs = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px 40px 0px' });
    revealEls.forEach((el) => revObs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // .vn-sr / .vn-unveil: CSS owns them when scroll-driven animations exist.
  const srEls = document.querySelectorAll('.vn-sr, .vn-unveil');
  if (srEls.length === 0) return;
  if (CSS.supports('animation-timeline: view()')) {
    srEls.forEach((el) => el.classList.add('is-in'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    srEls.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const srObs = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      }
    }
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
  srEls.forEach((el) => srObs.observe(el));
}
