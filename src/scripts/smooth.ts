// B4: smooth mouse wheel (side-effect module, loaded by the first wheel event on fine pointers, see main.ts).
// A wheel notch moves a target; each frame the page covers a fixed share of what is left: 1 - e^(-dt / TAU),
// the same curve as Lenis's 1 - 2^(-10 t) over one second. Only real mouse wheels are smoothed.
const TAU = 144; // ms
const MIN_DELTA = 40; // px per event; smaller steps come from a trackpad or a precision wheel: left native
const mq = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
const dbg = location.search.includes('vn-debug');

let target = 0; // where the page is heading
let cur = 0; // where we last put it (fractional)
let set = -1; // scrollY right after our last write, -1 while idle
let raf = 0;
let last = 0;

const max = () => document.documentElement.scrollHeight - innerHeight;
const flag = () => {
  if (dbg) (window as unknown as Record<string, unknown>).__vnSmooth = !!raf;
};
const disabled = () => {
  try {
    return localStorage.getItem('vn-smooth') === '0';
  } catch {
    return false;
  }
};

// True when the wheel is over something that can scroll by itself in that direction, or that opted out.
function inner(t: EventTarget | null, dy: number): boolean {
  for (let n = t as Element | null; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (n.hasAttribute('data-native-scroll')) return true;
    if (n.scrollHeight > n.clientHeight + 1) {
      const o = getComputedStyle(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
    }
  }
  return false;
}

function stop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  set = -1;
  flag();
}

function tick(now: number): void {
  const dt = Math.max(0, Math.min(64, now - last));
  last = Math.max(last, now);
  target = Math.min(Math.max(target, 0), max()); // the page may have grown or shrunk (deferred sections)
  cur += (target - cur) * (1 - Math.exp(-dt / TAU));
  if (Math.abs(target - cur) < 0.5) cur = target;
  scrollTo({ top: cur, behavior: 'instant' });
  set = scrollY;
  if (cur === target) return stop();
  raf = requestAnimationFrame(tick);
}

function onWheel(e: WheelEvent): void {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.deltaMode === 2) return;
  const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  // horizontal intent, a trackpad-sized step, the kill switch, an open dialog or an inner scroller: stay native
  if (Math.abs(e.deltaX) > Math.abs(dy) || Math.abs(dy) < MIN_DELTA || disabled() || document.querySelector('dialog[open]') || inner(e.target, dy)) {
    if (raf) stop();
    return;
  }
  e.preventDefault();
  if (!raf) {
    cur = target = scrollY;
    last = performance.now();
    raf = requestAnimationFrame(tick);
    flag();
  }
  target += dy;
}

// A scroll we did not write while animating (scroll anchoring when a deferred section renders above, a
// programmatic jump) shifts the animation by the same amount instead of fighting it.
function onScroll(): void {
  if (!raf || set < 0) return;
  const d = scrollY - set;
  if (Math.abs(d) > 1) {
    cur += d;
    target += d;
    set = scrollY;
  }
}

const opts = { passive: false } as const;
function on(): void {
  addEventListener('wheel', onWheel, opts);
  addEventListener('scroll', onScroll, { passive: true });
  // the visitor took over: keys (arrows, space, page keys, find), a press (scrollbar, link, drag), a hash jump
  addEventListener('keydown', stop);
  addEventListener('pointerdown', stop);
  addEventListener('hashchange', stop);
  flag();
}
function off(): void {
  stop();
  removeEventListener('wheel', onWheel, opts);
  removeEventListener('scroll', onScroll);
  removeEventListener('keydown', stop);
  removeEventListener('pointerdown', stop);
  removeEventListener('hashchange', stop);
}

if (mq.matches) on();
mq.addEventListener('change', () => (mq.matches ? on() : off()));
export {};
