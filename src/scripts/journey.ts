const pad = (n: number) => String(n).padStart(2, '0');

export function init(): void {
  const track = document.querySelector<HTMLElement>('[data-vn-journey]');
  if (!track) return;
  const cards = Array.from(track.querySelectorAll<HTMLElement>('.vn-journey-card'));
  const count = document.querySelector<HTMLElement>('[data-journey-count]');
  const bar = document.querySelector<HTMLElement>('[data-journey-bar]');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = (): ScrollBehavior => (reduced() ? 'auto' : 'smooth');
  if (!cards.length) return;

  // Snap offsets (scrollLeft of each card), measured and clamped to the scroll range, never hard-coded.
  let snaps: number[] = [];
  const measure = () => {
    const max = track.scrollWidth - track.clientWidth;
    const base = cards[0].offsetLeft;
    snaps = cards.map((c) => Math.min(Math.max(c.offsetLeft - base, 0), max));
  };
  const nearest = (x: number) =>
    snaps.reduce((b, s, i) => (Math.abs(s - x) < Math.abs(snaps[b] - x) ? i : b), 0);

  let shown = -1;
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const atEnd = max > 0 && track.scrollLeft >= max - 2;
    const idx = atEnd ? cards.length - 1 : nearest(track.scrollLeft);
    if (bar) {
      const p = max > 0 ? Math.min(track.scrollLeft / max, 1) : 1;
      bar.style.transform = `scaleX(${(1 / cards.length + (1 - 1 / cards.length) * p).toFixed(4)})`;
    }
    if (count && idx !== shown) count.textContent = `${pad(idx + 1)} / ${pad(cards.length)}`;
    shown = idx;
  };
  let raf = 0;
  track.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
  }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); update(); }).observe(track);
  measure();
  update();

  // Buttons and arrows go card by card (the single-pointer alternative to dragging, WCAG 2.5.7).
  const go = (dir: 1 | -1) => {
    stop();
    const i = Math.min(Math.max(shown + dir, 0), cards.length - 1);
    track.scrollTo({ left: snaps[i], behavior: behavior() });
  };
  document.querySelector('[data-journey-prev]')?.addEventListener('click', () => go(-1));
  document.querySelector('[data-journey-next]')?.addEventListener('click', () => go(1));
  track.addEventListener('keydown', (e) => {
    if (e.target !== track || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });

  // Mouse drag with inertia: the release is projected along the flick velocity, then eased onto a card.
  // Touch and pen scroll natively (snap included); the wheel is never touched.
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let samples: Array<[number, number]> = [];
  let glide = 0;
  const stop = () => { cancelAnimationFrame(glide); glide = 0; track.classList.remove('is-dragging'); };

  track.addEventListener('dragstart', (e) => e.preventDefault());
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType !== 'mouse') return;
    stop();
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    samples = [[e.timeStamp, e.clientX]];
    track.classList.add('is-dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    track.scrollLeft = startScroll - (e.clientX - startX);
    samples.push([e.timeStamp, e.clientX]);
    if (samples.length > 8) samples.shift();
  }, { passive: true });
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const [t0, x0] = samples.find(([t]) => e.timeStamp - t < 100) ?? samples[0];
    const v = e.timeStamp > t0 ? (x0 - e.clientX) / (e.timeStamp - t0) : 0; // px/ms, scroll direction
    const from = track.scrollLeft;
    const to = snaps[nearest(from + Math.max(-2, Math.min(2, v)) * 260)];
    if (reduced() || Math.abs(to - from) < 1) {
      track.scrollLeft = to;
      return stop();
    }
    const dur = Math.min(260 + Math.abs(to - from) * 0.6, 640);
    const t = performance.now();
    const tick = (now: number) => {
      const k = Math.min((now - t) / dur, 1);
      track.scrollLeft = from + (to - from) * (1 - (1 - k) ** 3);
      if (k < 1) glide = requestAnimationFrame(tick);
      else stop();
    };
    glide = requestAnimationFrame(tick);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}
