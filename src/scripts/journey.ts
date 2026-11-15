export function init(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const jTrack = document.querySelector<HTMLElement>('[data-vn-journey]');
  if (!jTrack) return;
  document.querySelector('[data-journey-prev]')?.addEventListener('click', () => {
    jTrack.scrollBy({ left: -360, behavior: reduced ? 'auto' : 'smooth' });
  });
  document.querySelector('[data-journey-next]')?.addEventListener('click', () => {
    jTrack.scrollBy({ left: 360, behavior: reduced ? 'auto' : 'smooth' });
  });

  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  jTrack.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    dragging = true;
    startX = e.clientX;
    startScroll = jTrack.scrollLeft;
    jTrack.classList.add('is-dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    jTrack.scrollLeft = startScroll - (e.clientX - startX);
  }, { passive: true });
  addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    jTrack.classList.remove('is-dragging');
  });
}
