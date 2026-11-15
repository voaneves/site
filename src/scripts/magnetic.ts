const R = 24;
const els = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')];
const c = (v: number) => Math.max(-6, Math.min(6, v));
const tr = els.map((el) => el.style.transition);
let ev: PointerEvent | null = null;
let raf = 0;

export function magnetTarget(el: Element): { x: number; y: number } | null {
  if (!el.hasAttribute('data-magnetic')) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

els.forEach((el) => {
  el.style.transition = `${getComputedStyle(el).transition}, translate 450ms ease-out`;
});

const move = (e: PointerEvent) => {
  if (!raf) raf = requestAnimationFrame(() => {
    raf = 0;
    const rs = els.map((el) => el.getBoundingClientRect());
    els.forEach((el, i) => {
      const r = rs[i];
      const x = ev!.clientX - r.left - r.width / 2;
      const y = ev!.clientY - r.top - r.height / 2;
      const on = Math.abs(x) < r.width / 2 + R && Math.abs(y) < r.height / 2 + R;
      el.style.translate = on ? `${c(x * 0.25)}px ${c(y * 0.25)}px` : '';
    });
  });
  ev = e;
};
addEventListener('pointermove', move, { passive: true });

const mq = matchMedia('(prefers-reduced-motion:reduce),(pointer:coarse)');
mq.addEventListener('change', () => {
  if (!mq.matches) return;
  removeEventListener('pointermove', move);
  cancelAnimationFrame(raf);
  els.forEach((el, i) => {
    el.style.translate = '';
    el.style.transition = tr[i];
  });
});
