// Cursor layer B: Sinal dot + label pill + media preview (B8 state machine, WOW-PLAN §2a).
// Lazy chunk (onFirstPointer + motionOK in main.ts). It owns the `.vn-cursor` DOM and its CSS: the
// stylesheet is adopted from here (CSSOM, CSP-safe), so the cursor costs 0 inline bytes.
const TAU_DOT_MS = 30;
const TAU_PILL_MS = 150;
const SETTLE_EPS_PX = 0.1;
const MEDIA_HALF_W = 168; // half of the 320px preview + 8px viewport margin
const MEDIA_MIN_Y = 274; // 220px preview + pill + gaps, so it never leaves the top of the viewport
const SNAP_MAX_W = 240; // [data-magnetic] snapping only for small targets

const CSS = `.vn-cursor{&:not([data-state=hidden]){opacity:1}
&:not([data-state=hidden]),&[data-f]{transition-duration:.05s;transition-delay:0s}
:root[data-theme=dark] &,&[data-ground=ink]{--b:#f4ead4;--t:#0a0a0a}
&[data-ground=signal][data-state]{--b:#0a0a0a;--t:#f4ead4}
&[data-state=link]{--k:3;&:not([data-ground=signal]){mix-blend-mode:difference}}
&[data-pressed]{--p:.85}
&[data-ground=signal] .vn-cursor__dot{background:var(--b)}
&[data-state=link]:not([data-ground=signal]) .vn-cursor__dot{background:#fff}
&:is([data-state=label],[data-state=media]){.vn-cursor__pill{opacity:1;scale:1}span{translate:0}}
&[data-state=media] .vn-cursor__media{opacity:1;scale:1}}`;

const OK = '(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)';
const TXT = 'input,textarea,select,[contenteditable]';
// Grounds that invert the pill: the signal band, and the always-dark sections (hero, inverse bands, case hero).
const GROUND = '[data-ground],[data-surface=signal],[data-surface=inverse],.vn-hero,.vn-case-hero';
const SIGNAL = '[data-ground=signal],[data-surface=signal]';
const LNK = 'a,button,[data-cursor]';

function init(): void {
  const mq = matchMedia(OK);
  if (!mq.matches) return;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const root = document.createElement('div');
  root.className = 'vn-cursor';
  root.setAttribute('aria-hidden', 'true');
  root.dataset.state = 'hidden';
  root.innerHTML = '<i class="vn-cursor__dot"></i><div class="vn-cursor__pill"><span></span></div><div class="vn-cursor__media"><img alt=""></div>';
  document.body.append(root);
  const [dot, pill, media] = [...root.children] as HTMLElement[];
  const lab = pill.firstChild as HTMLElement;
  const img = media.firstChild as HTMLImageElement;

  const ac = new AbortController();
  const opt = { signal: ac.signal, passive: true };
  let st = 'hidden';
  let cur: EventTarget | null = null;
  let mag: Element | null = null;
  let lx = -1, ly = -1, tx = 0, ty = 0, dx = 0, dy = 0, px = 0, py = 0;
  let raf = 0, last = 0;

  const put = () => {
    dot.style.translate = `${dx}px ${dy}px`;
    pill.style.translate = `${px}px ${py}px`;
    media.style.translate = `${Math.min(Math.max(px, MEDIA_HALF_W), innerWidth - MEDIA_HALF_W)}px ${Math.max(py, MEDIA_MIN_Y)}px`;
  };
  const tick = (t: number) => {
    const dt = Math.min(t - last, 64);
    last = t;
    const a = 1 - Math.exp(-dt / TAU_DOT_MS);
    const b = 1 - Math.exp(-dt / TAU_PILL_MS);
    dx += (tx - dx) * a; dy += (ty - dy) * a;
    px += (tx - px) * b; py += (ty - py) * b;
    const live = Math.max(Math.abs(tx - dx), Math.abs(ty - dy), Math.abs(tx - px), Math.abs(ty - py)) >= SETTLE_EPS_PX;
    if (!live) { dx = px = tx; dy = py = ty; }
    put();
    raf = live ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  const aim = () => {
    const r = mag?.getBoundingClientRect();
    [tx, ty] = r && r.width < SNAP_MAX_W ? [r.left + r.width / 2, r.top + r.height / 2] : [lx, ly];
  };
  const hide = (fast = false) => {
    root.dataset.state = st = 'hidden';
    root.toggleAttribute('data-f', fast);
    root.removeAttribute('data-pressed');
  };
  const ev = (el: Element | null) => {
    if (!el || el.closest(TXT)) return hide(true);
    const m = el.closest<HTMLElement>('[data-cursor-media]');
    const l = el.closest<HTMLElement>('[data-cursor-label]');
    const k = el.closest(LNK);
    const s = m ? 'media' : l ? 'label' : k ? 'link' : 'idle';
    mag = s === 'link' || s === 'label' ? el.closest('[data-magnetic]') : null;
    if (l) lab.textContent = l.dataset.cursorLabel!;
    if (m) img.src = m.dataset.cursorMedia!;
    const g = el.closest(GROUND);
    root.dataset.ground = !g ? '' : g.matches(SIGNAL) ? 'signal' : 'ink';
    root.dataset.state = st = s;
    root.removeAttribute('data-f');
  };
  const off = () => {
    ac.abort();
    cancelAnimationFrame(raf);
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const was = st;
    lx = e.clientX; ly = e.clientY;
    if (e.target !== cur || st === 'hidden') ev((cur = e.target) as Element);
    aim();
    if (was === 'hidden' || st === 'hidden') { dx = px = tx; dy = py = ty; put(); }
    else kick();
  }, opt);
  document.addEventListener('pointerdown', () => root.toggleAttribute('data-pressed', true), opt);
  document.addEventListener('pointerup', () => root.removeAttribute('data-pressed'), opt);
  document.addEventListener('pointerout', (e) => e.relatedTarget || hide(), opt);
  document.addEventListener('keydown', () => hide(true), opt);
  document.addEventListener('scrollend', () => {
    if (lx < 0 || st === 'hidden') return;
    ev(document.elementFromPoint(lx, ly));
    aim();
    kick();
  }, opt);
  addEventListener('blur', () => hide(), opt); // also fires when the tab goes to the background
  mq.addEventListener('change', () => mq.matches || off(), { signal: ac.signal });
}

try { init(); } catch { /* no constructable stylesheets or DOM: stay silent, the native cursor remains */ }
