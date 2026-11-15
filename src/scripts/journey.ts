const pad = (n: number) => String(n).padStart(2, '0');

export function init(): void {
  const track = document.querySelector<HTMLElement>('[data-vn-journey]');
  if (!track) return;
  const cards = Array.from(track.querySelectorAll<HTMLElement>('.vn-journey-card'));
  const count = document.querySelector<HTMLElement>('[data-journey-count]');
  const behavior = (): ScrollBehavior =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  // One step = one card width plus the flex gap, measured, never hard-coded.
  const step = (): number => {
    const w = cards[0]?.offsetWidth ?? track.clientWidth;
    return w + (parseFloat(getComputedStyle(track).columnGap) || 0);
  };
  const go = (dir: 1 | -1) => track.scrollBy({ left: dir * step(), behavior: behavior() });

  document.querySelector('[data-journey-prev]')?.addEventListener('click', () => go(-1));
  document.querySelector('[data-journey-next]')?.addEventListener('click', () => go(1));

  track.addEventListener('keydown', (e) => {
    if (e.target !== track || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });

  // Live counter: updates on scrollend, with a throttled scroll fallback.
  let shown = -1;
  const update = () => {
    if (!count || !cards.length) return;
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    let idx = cards.length - 1;
    if (!atEnd) {
      const base = cards[0].offsetLeft;
      let best = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - base - track.scrollLeft);
        if (d < best) { best = d; idx = i; }
      });
    }
    if (idx === shown) return;
    shown = idx;
    count.textContent = `${pad(idx + 1)} / ${pad(cards.length)}`;
  };
  if ('onscrollend' in window) {
    track.addEventListener('scrollend', update);
  } else {
    let t = 0;
    track.addEventListener('scroll', () => {
      clearTimeout(t);
      t = window.setTimeout(update, 120);
    }, { passive: true });
  }
  update();

  // Mouse drag (touch and pen scroll natively).
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  track.addEventListener('dragstart', (e) => e.preventDefault());
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return;
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add('is-dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    track.scrollLeft = startScroll - (e.clientX - startX);
  }, { passive: true });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}
