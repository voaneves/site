// Drawer styling is only needed once the menu opens, so it is adopted lazily (keeps it out of the inline critical CSS).
const DRAWER_CSS =
  '@layer site{.vn-mobile-drawer__head svg{display:block;block-size:1.75rem;inline-size:auto}.vn-mobile-drawer__head text{font-family:var(--vn-font-mono)}'+
'.vn-mobile-drawer[open]{position:fixed;inset:0 0 0 auto;margin:0 0 0 auto;z-index:var(--vn-z-drawer);width:min(100vw,420px);height:100dvh;max-height:100dvh;border:0;padding:var(--vn-space-6);background:var(--vn-ref-ink-950);color:var(--vn-cream);box-shadow:var(--vn-shadow-drawer);display:flex;flex-direction:column;justify-content:space-between;gap:var(--vn-space-6)}.vn-mobile-drawer::backdrop{background:rgba(10,10,10,0.72);backdrop-filter:blur(4px)}.vn-mobile-drawer__head{display:flex;align-items:center;justify-content:space-between}.vn-drawer-close{color:var(--vn-cream);border-color:rgba(244,234,212,0.3);font-size:24px;line-height:1}.vn-mobile-drawer__nav{display:flex;flex-direction:column}.vn-drawer__link{color:var(--vn-cream);border-color:rgba(244,234,212,0.14)}.vn-drawer-num{color:var(--vn-ref-red-400)}.vn-mobile-drawer__foot{display:flex;flex-wrap:wrap;gap:var(--vn-space-3)}.vn-drawer-btn-light{color:var(--vn-cream);border-color:rgba(244,234,212,0.45);opacity:1}'+
  '}';
let drawerSheet = false;
const adoptDrawer = () => {
  if (drawerSheet) return;
  drawerSheet = true;
  try {
    const sh = new CSSStyleSheet();
    sh.replaceSync(DRAWER_CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
  } catch {
    /* no constructable sheets: the dialog opens unstyled */
  }
};

export function init(): void {
  const drawer = document.getElementById('vn-mobile-drawer') as HTMLDialogElement | null;
  const menuBtn = document.getElementById('vn-menu-btn');
  const closeDrawer = () => {
    drawer?.close();
    menuBtn?.setAttribute('aria-expanded', 'false');
  };
  menuBtn?.addEventListener('click', () => {
    if (!drawer) return;
    adoptDrawer();
    drawer.showModal();
    menuBtn.setAttribute('aria-expanded', 'true');
  });
  document.getElementById('vn-drawer-close')?.addEventListener('click', closeDrawer);
  drawer?.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });
  drawer?.addEventListener('close', () => menuBtn?.setAttribute('aria-expanded', 'false'));
  drawer?.querySelectorAll('[data-drawer-link]').forEach((el) => {
    el.addEventListener('click', closeDrawer);
  });
}
