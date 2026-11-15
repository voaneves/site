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
  const btn = document.getElementById('vn-theme-toggle');
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const r = btn.getBoundingClientRect();
      const s = document.documentElement.style;
      s.setProperty('--vt-x', `${r.left + r.width / 2}px`);
      s.setProperty('--vt-y', `${r.top + r.height / 2}px`);
      doc.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
  });
}
