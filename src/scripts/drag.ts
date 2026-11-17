// Awards strip: a mouse can drag it sideways (touch and trackpad scroll natively; keyboard uses the focused region).
export function init(el: HTMLElement, e: PointerEvent): void {
  let x = e.clientX;
  let moved = 0;
  try { el.setPointerCapture(e.pointerId); } catch { /* released before the chunk arrived */ }
  const move = (m: PointerEvent) => {
    moved += Math.abs(m.clientX - x);
    el.scrollLeft -= m.clientX - x;
    x = m.clientX;
    if (moved > 4) el.classList.add('is-drag');
  };
  const end = () => {
    el.classList.remove('is-drag');
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
