const LIGHT = '#fdfbf6';
const DARK = '#0a0a0a';

const setMeta = (t: string) => {
  const c = t === 'dark' ? DARK : LIGHT;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c));
};

/* Theme-toggle view transition: only needed on click, so it is adopted lazily (vn-spin lives in responsive.css). */
const VT_CSS =
  '#vn-theme-toggle{view-transition-name:vn-toggle}' +
  '::view-transition-old(root){animation:none;mix-blend-mode:normal}' +
  '::view-transition-new(root){mix-blend-mode:normal}' +
  ':root[data-theme=dark]::view-transition-new(root){animation:vn-dusk .8s cubic-bezier(.25,1,.5,1)}' +
  ':root[data-theme=light]::view-transition-new(root){animation:vn-dawn .9s cubic-bezier(.25,1,.5,1)}' +
  '::view-transition-old(vn-toggle){animation:none;opacity:0}' +
  '::view-transition-new(vn-toggle){animation:vn-spin .8s cubic-bezier(.25,1,.5,1)}' +
  '@keyframes vn-dusk{from{clip-path:circle(0 at var(--vt-x,50%) var(--vt-y,50%));scale:1.04}to{clip-path:circle(var(--vt-r,150vmax) at var(--vt-x,50%) var(--vt-y,50%));scale:1}}' +
  '@keyframes vn-dawn{from{clip-path:inset(100% 0 0 0 round 50% 50% 0 0)}to{clip-path:inset(0 round 0)}}';

let vtSheet = false;
const adoptVt = () => {
  if (vtSheet) return;
  vtSheet = true;
  try {
    const sh = new CSSStyleSheet();
    sh.replaceSync(VT_CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
  } catch {
    /* no constructable sheets: plain instant switch */
  }
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
      adoptVt();
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
