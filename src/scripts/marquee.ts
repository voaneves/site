export function init(): void {
  const mqToggle = document.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
  const mqRoot = document.querySelector<HTMLElement>('[data-vn-marquee-root]');
  mqToggle?.addEventListener('click', () => {
    if (!mqRoot) return;
    const paused = mqRoot.classList.toggle('is-paused');
    mqToggle.setAttribute('aria-pressed', String(paused));
    mqToggle.textContent = paused
      ? (mqToggle.dataset.labelResume || 'Resume')
      : (mqToggle.dataset.labelPause || 'Pause');
  });
}
