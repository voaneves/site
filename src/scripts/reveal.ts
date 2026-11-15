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
}
