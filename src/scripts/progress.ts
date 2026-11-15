export function init(): void {
  const progressEl = document.getElementById('vn-scroll-progress');
  if (!progressEl) return;
  let ticking = false;
  const updateProgress = () => {
    ticking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const pct = Math.min(1, Math.max(0, scrollY / max));
    progressEl.style.transform = `scaleX(${pct.toFixed(4)})`;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  updateProgress();
}
