const R = 24;
const els = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')];
const c = (v: number) => Math.max(-6, Math.min(6, v));
let ev: PointerEvent | null = null;

export function magnetTarget(el: Element): { x: number; y: number } | null {
  if (!el.hasAttribute('data-magnetic')) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

for (const el of els) {
  const t = getComputedStyle(el).transition;
  el.style.transition = `${t}, translate 450ms ease-out`;
}

addEventListener('pointermove', (e) => {
  if (!ev) requestAnimationFrame(() => {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const x = ev!.clientX - r.left - r.width / 2;
      const y = ev!.clientY - r.top - r.height / 2;
      const on = Math.abs(x) < r.width / 2 + R && Math.abs(y) < r.height / 2 + R;
      el.style.translate = on ? `${c(x * 0.25)}px ${c(y * 0.25)}px` : '';
    }
    ev = null;
  });
  ev = e;
}, { passive: true });
