import { onFirstPointer, motionOK } from './lazy';

// Hero bootstrap (first-load). The interaction code lives in the lazy hero-fx chunk, fetched only on the
// first real interaction: the first fine-pointer move (Lighthouse never pays for it) or the first touch on
// the portrait. The triggering pointer position is handed over so the first stroke is not lost.
// Under reduced motion nothing is attached.
export function init(): void {
  const hero = document.querySelector<HTMLElement>('.vn-hero');
  const wrap = hero?.querySelector<HTMLElement>('[data-vn-portrait-wrap]');
  const canvas = wrap?.querySelector<HTMLCanvasElement>('.vn-hero-portrait__canvas');
  const img = wrap?.querySelector<HTMLImageElement>('.vn-hero-portrait__img');
  if (!hero || !wrap || !canvas || !img || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let at: { x: number; y: number } | null = null;
    // Registered before onFirstPointer's listener, so the first event's position is already known.
    const track = (e: PointerEvent) => {
      at = hero.contains(e.target as Node) ? { x: e.clientX, y: e.clientY } : null;
    };
    addEventListener('pointermove', track, { passive: true });
    onFirstPointer(() => {
      if (!motionOK()) return removeEventListener('pointermove', track);
      void import('./hero-fx').then((m) => {
        removeEventListener('pointermove', track);
        m.fine(hero, wrap, canvas, img, at);
      });
    });
  } else {
    // Must be set before the gesture starts: sideways drags paint, vertical swipes still scroll.
    wrap.style.touchAction = 'pan-y pinch-zoom';
    let started = false;
    // One entry point: a tap on the portrait (e) paints where the finger is; without e the colour blooms by itself.
    const start = (e?: PointerEvent) => {
      if (started) return;
      started = true;
      removeEventListener('scroll', arm);
      removeEventListener('touchstart', arm);
      void import('./hero-fx').then((m) => m.touch(wrap, canvas, img, e, !e));
    };
    // D3: after the visitor's first scroll or touch, bloom once when the portrait is mostly on screen.
    const arm = () => {
      removeEventListener('scroll', arm);
      removeEventListener('touchstart', arm);
      const io = new IntersectionObserver(
        (es) => {
          if (!es.some((x) => x.isIntersecting)) return;
          io.disconnect();
          start();
        },
        { threshold: 0.6 },
      );
      io.observe(wrap);
    };
    wrap.addEventListener('pointerdown', (e) => start(e), { once: true });
    addEventListener('scroll', arm, { passive: true });
    addEventListener('touchstart', arm, { passive: true });
  }
}
