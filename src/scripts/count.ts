// U4: count the [data-count] stats up from 0 once they are on screen. The real text never changes (screen readers
// and layout keep the final value); an aria-hidden overlay shows the running number and is removed at the end.
export function init(root: Element): void {
  const io = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(target);
      const txt = target.textContent ?? '';
      const m = /\d+/.exec(txt);
      if (!m) continue;
      const ghost = document.createElement('span');
      ghost.className = 'vn-count';
      ghost.setAttribute('aria-hidden', 'true');
      target.append(ghost);
      target.classList.add('is-counting');
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1600);
        ghost.textContent = txt.replace(m[0], String(Math.round(+m[0] * (1 - (1 - p) ** 4))));
        if (p < 1) requestAnimationFrame(tick);
        else {
          ghost.remove();
          target.classList.remove('is-counting');
        }
      };
      requestAnimationFrame(tick);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  root.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
}
