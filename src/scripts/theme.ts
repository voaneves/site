const LIGHT = '#fdfbf6';
const DARK = '#0a0a0a';

const setMeta = (t: string) => {
  const c = t === 'dark' ? DARK : LIGHT;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c));
};

const applyTheme = (next: string) => {
  document.documentElement.dataset.theme = next;
  setMeta(next);
  try {
    localStorage.setItem('vn-theme', next);
  } catch {
    /* ignore storage error */
  }
};

export function init(): void {
  setMeta(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const btn = document.getElementById('vn-theme-toggle');
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const s = document.documentElement.style;
      s.setProperty('--vt-x', `${x}px`);
      s.setProperty('--vt-y', `${y}px`);
      s.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
      doc.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
  });
}
