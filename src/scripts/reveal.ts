// U4: group the .vn-w words of a [data-enter=mask|lines] block into rendered lines (--l), so lines rise in turn.
function lines(el: Element): void {
  let top = -1e9;
  let l = -1;
  el.querySelectorAll<HTMLElement>('.vn-w').forEach((w) => {
    if (w.offsetTop > top + 4) {
      top = w.offsetTop;
      l++;
    }
    w.style.setProperty('--l', String(l));
  });
}

export function init(): void {
  // U4 choreography: a lone [data-enter], or a [data-stagger] group, enters once when it is ~10% into the viewport.
  const enterEls = document.querySelectorAll('[data-stagger], [data-enter]:not([data-stagger] > *)');
  const enter = (el: Element) => {
    if (el.classList.contains('is-in')) return;
    for (const m of [el, ...el.children]) if (m.matches('[data-enter=mask], [data-enter=lines]')) lines(m);
    el.classList.add('is-in');
    // Longest transition (1.2s) + stagger/line delays; then motion.css stops owning the element's transition.
    setTimeout(() => el.classList.add('is-done'), 3200);
  };
  if ('IntersectionObserver' in window) {
    const enterObs = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          enter(entry.target);
          obs.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    enterEls.forEach((el) => enterObs.observe(el));
    // Page end: the last rows never reach the 90% line, so at the bottom of the page enter whatever is on screen.
    // A scroll-end check (not a footer ratio) also holds when the footer is taller than the viewport.
    const atEnd = () => {
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
        enterEls.forEach((el) => el.getBoundingClientRect().top < innerHeight && enter(el));
      }
    };
    addEventListener('scroll', atEnd, { passive: true });
    atEnd();
  } else {
    enterEls.forEach(enter);
  }
}
