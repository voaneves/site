export function init(): void {
  const drawer = document.getElementById('vn-mobile-drawer') as HTMLDialogElement | null;
  const menuBtn = document.getElementById('vn-menu-btn');
  const closeDrawer = () => {
    drawer?.close();
    menuBtn?.setAttribute('aria-expanded', 'false');
  };
  menuBtn?.addEventListener('click', () => {
    if (!drawer) return;
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
