const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const applyTheme = (next: string) => {
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0a0a0a' : '#f4ead4');
  try {
    localStorage.setItem('vn-theme', next);
  } catch {
    /* ignore storage error */
  }
};

export function init(): void {
  document.getElementById('vn-theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const startVt = (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition;
    if (startVt && !reduced) {
      startVt.call(document, () => applyTheme(next));
    } else {
      applyTheme(next);
    }
  });
}
