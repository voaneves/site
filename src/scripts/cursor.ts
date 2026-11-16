// Cursor layer B: Sinal dot + label pill + media preview (B8 state machine, WOW-PLAN §2a).
// Lazy chunk (onFirstPointer + motionOK in main.ts). It owns the `.vn-cursor` DOM and its CSS: the
// stylesheet is adopted from here (CSSOM, CSP-safe), so the cursor costs 0 inline bytes.
// Motion: the dot chases the pointer and stretches with its speed; the pill and the media card follow it with an
// exponential lag (they trail and tilt, never overshoot), grow out of the dot, and decode their label from noise.
// The pill sits above the pointer, flips below it near the top edge and is clamped inside the viewport.

const TAU_DOT_MS = 30;
const TAU_PILL_MS = 65; // pill/media follow: the time constant of a 0.45s expo-out (lamalama's quickTo)
const TILT = 0.011; // deg per px/s of follow velocity
const DECODE_MS = 300; // every label is real text well inside 600ms
const GAP = 18; // pill to pointer (the CSS offset below)
const EDGE = 8; // viewport margin the pill keeps
const NOISE = '#$*@%01>/+';
const MEDIA_HALF_W = 168; // half of the 320px preview + 8px viewport margin
const MEDIA_MIN_Y = 262; // 220px preview + gap, so it never leaves the top of the viewport
const PULL = 0.8; // share of the way to the magnet centre ...
const PULL_MAX = 36; // ... capped in px, so wide buttons pull gently and small ones snap

const SPRING = 'cubic-bezier(.3,1.55,.5,1)';
const OUT = 'cubic-bezier(.2,.8,.2,1)';
const E = 'cubic-bezier(.25,1,.5,1)'; // era's "Out"
const IDLE_MS = 1400; // how long a rotating idle label stays up
const CSS = `.vn-cursor{--b:#0a0a0a;--t:#f4ead4;--d:var(--vn-signal);opacity:0;transition:opacity .25s .35s;&:not([data-state=hidden]){opacity:1}&:not([data-state=hidden]),&[data-f]{transition:opacity .05s}:root[data-theme=dark] &,&[data-ground=ink]{--b:#f4ead4;--t:#0a0a0a}&[data-ground=signal]{--b:#0a0a0a;--t:#f4ead4;--d:#0a0a0a}&[data-state=link]{--k:3;&:not([data-ground=signal]){mix-blend-mode:difference;--d:#fff}}&:is([data-state=label],[data-state=media]){--k:0}&[data-l]:is([data-state=label],[data-state=media]){.vn-cursor__pill{opacity:1;scale:1}span{translate:0}}&[data-state=media] .vn-cursor__media{opacity:1;scale:1;clip-path:inset(0);img{scale:1}}&[data-idle][data-l]{.vn-cursor__pill{opacity:1;scale:1}span{translate:0}}&[data-state=idle]{&[data-zone=ring]{--k:.5;.vn-cursor__dot::before{inset:-36px;border:2px solid var(--b);border-radius:50%;opacity:1;scale:1}}&[data-zone=read]{--k:.75;--d:#fff;mix-blend-mode:difference}&[data-zone=plus] .vn-cursor__dot{background:transparent;&::before,&::after{left:-7px;top:3px;width:22px;height:2px;background:var(--d);opacity:1;scale:1}&::after{rotate:90deg}}&[data-zone=drag] .vn-cursor__dot{&::before,&::after{font:600 16px/8px var(--vn-font-mono);color:var(--d);opacity:1;scale:1}&::before{content:'‹';right:14px}&::after{content:'›';left:14px}}&[data-zone=signal]{--k:1.75;.vn-cursor__dot{background:transparent;box-shadow:inset 0 0 0 .7px var(--b)}}&[data-zone=drag][data-pressed] .vn-cursor__dot{&::before{translate:-10px}&::after{translate:10px}}}&[data-zone=plus][data-state=link] .vn-cursor__dot{rotate:90deg;&::before,&::after{left:-7px;top:3px;width:22px;height:2px;background:#000;opacity:1;scale:.25 .4}}&[data-pressed]{--p:.6;.vn-cursor__pill{scale:.9}}}.vn-cursor__dot{top:-4px;left:-4px;transform:none;scale:calc(var(--k,1)*var(--p,1));background:var(--d);transition:scale .4s ${SPRING},rotate .4s ${E},background .4s ${E},box-shadow .4s ${E};&::before,&::after{content:'';position:absolute;opacity:0;scale:.3;transition:opacity .4s ${E},scale .8s ${E},translate .4s ${E}}}.vn-cursor__pill,.vn-cursor__media{opacity:0;scale:0;transform-origin:0 0;transition:opacity .2s,scale .5s ${SPRING}}.vn-cursor__pill{position:fixed;top:0;left:0;z-index:var(--vn-cursor-z-label);transform:translate(-50%,calc(-100% - ${GAP}px));padding:7px 14px;color:var(--t);font:600 11px/16px var(--vn-font-mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;&[data-b]{transform:translate(-50%,${GAP}px)}b{position:absolute;inset:0;z-index:-1;border-radius:99px;background:var(--b)}div{overflow:hidden}span{display:block;translate:0 110%;transition:translate .45s .04s ${SPRING}}}.vn-cursor__media{transform:translate(-50%,calc(-100% - 33px));background:#141414;scale:.85;clip-path:inset(100% 0 0);transition:opacity .2s,scale .6s ${SPRING},clip-path .55s ${OUT};img{display:block;width:100%;height:100%;object-fit:cover;scale:1.3;transition:scale .9s ${OUT}}}`;

const OK = '(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)';
const TXT = 'input,textarea,select,[contenteditable]';
// Grounds that invert the pill: the signal band, and the always-dark sections (hero, inverse bands, case hero).
const GROUND = '[data-ground],[data-surface=signal],[data-surface=inverse],.vn-hero,.vn-case-hero';
const SIGNAL = '[data-ground=signal],[data-surface=signal]';
const LNK = 'a,button,[data-cursor]';

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

function init(): void {
  const mq = matchMedia(OK);
  if (!mq.matches) return;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  document.body.insertAdjacentHTML(
    'beforeend',
    '<div class="vn-cursor" aria-hidden="true" data-state="hidden"><i class="vn-cursor__dot"></i><div class="vn-cursor__media"><img alt=""></div><div class="vn-cursor__pill"><b></b><div><span></span></div></div></div>',
  );
  const root = document.body.lastElementChild as HTMLElement;
  const [dot, media, pill] = [...root.children] as HTMLElement[];
  const bg = pill.firstChild as HTMLElement;
  const lab = pill.querySelector('span')!;
  const img = media.firstChild as HTMLImageElement;

  const ac = new AbortController();
  const opt = { signal: ac.signal, passive: true };
  let st = 'hidden';
  let cur: EventTarget | null = null;
  let mag: Element | null = null;
  let lx = -1, ly = -1, tx = 0, ty = 0, dx = 0, dy = 0, px = 0, py = 0, vx = 0, vy = 0, sx = 0, pw = 0, ph = 0;
  let raf = 0, last = 0;
  let txt = '', t0 = 0;
  let zone: Element | null = null, it = 0;
  const rot = new Map<Element, number>();

  const put = () => {
    dot.style.translate = `${dx}px ${dy}px`;
    // keep the pill on screen: flip below the pointer when there is no room above, clamp to every edge
    const hw = pw / 2 + EDGE;
    const top = ph + GAP + EDGE;
    const up = ty >= top;
    pill.toggleAttribute('data-b', !up);
    pill.style.translate = `${Math.max(hw, Math.min(px, innerWidth - hw))}px ${up ? Math.max(py, top) : Math.min(py, innerHeight - top)}px`;
    pill.style.rotate = media.style.rotate = `${clamp(-vx * TILT, 9)}deg`;
    media.style.translate = `${Math.min(Math.max(px, MEDIA_HALF_W), innerWidth - MEDIA_HALF_W)}px ${Math.max(py, MEDIA_MIN_Y)}px`;
  };
  // the label decodes from noise into its text, left to right (signal out of noise)
  const decode = (t: number) => {
    const k = (t - t0) / DECODE_MS;
    let s = '';
    for (let i = 0; i < txt.length; i++) {
      s += k * 1.4 - 0.4 > i / txt.length || txt[i] === ' ' ? txt[i] : NOISE[(Math.random() * NOISE.length) | 0];
    }
    lab.textContent = k < 1 ? s : txt;
    return k < 1;
  };
  const tick = (t: number) => {
    const ms = Math.max(0, Math.min(t - last, 64));
    last = t;
    const a = 1 - Math.exp(-ms / TAU_DOT_MS);
    const ex = dx;
    const ey = dy;
    dx += (tx - dx) * a;
    dy += (ty - dy) * a;
    // pill: exponential follow (lags, never overshoots); vx/vy are kept for the tilt and the settle test
    const b = 1 - Math.exp(-ms / TAU_PILL_MS);
    const qx = px;
    const qy = py;
    px += (tx - px) * b;
    py += (ty - py) * b;
    vx = ms ? ((px - qx) / ms) * 1000 : 0;
    vy = ms ? ((py - qy) / ms) * 1000 : 0;
    // dot stretch along its own velocity (liquid drop)
    const sp = ms ? Math.hypot(dx - ex, dy - ey) / ms : 0;
    sx += (Math.min(sp * 0.14, 0.8) - sx) * 0.35;
    dot.style.transform = `rotate(${Math.atan2(dy - ey, dx - ex)}rad) scale(${1 + sx},${1 - sx * 0.45})`;
    const dec = txt !== lab.textContent && decode(t);
    const live = dec || Math.hypot(tx - dx, ty - dy, tx - px, ty - py, vx / 30, vy / 30, sx * 9) >= 0.1;
    if (!live) settle();
    put();
    raf = live ? requestAnimationFrame(tick) : 0;
  };
  const settle = () => {
    dx = px = tx;
    dy = py = ty;
    vx = vy = sx = 0;
    dot.style.transform = '';
  };
  const kick = () => {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  const aim = () => {
    // the live centre of the [data-magnetic] target, as magnetic.ts magnetTarget() reports it (inlined: importing
    // that chunk from here would add a preload map to the entry), so the dot rides the button as it drifts
    const m = mag?.getBoundingClientRect();
    const ox = m ? (m.x + m.width / 2 - lx) * PULL : 0;
    const oy = m ? (m.y + m.height / 2 - ly) * PULL : 0;
    const k = Math.min(1, PULL_MAX / (Math.hypot(ox, oy) || 1));
    tx = lx + ox * k;
    ty = ly + oy * k;
  };
  const hide = (fast = false) => {
    zone = null;
    clearTimeout(it);
    root.removeAttribute('data-idle');
    root.dataset.state = st = 'hidden';
    root.toggleAttribute('data-f', fast);
  };
  const say = (s: string) => {
    const vis = st === 'label' || st === 'media';
    if (s === txt && vis) return; // re-entering from outside decodes the label again
    const w0 = pw;
    txt = s;
    t0 = performance.now();
    lab.textContent = s; // measure the final width, then decode
    pw = pill.offsetWidth;
    ph = pill.offsetHeight;
    // morph the pill background from its old width to the new one (scale only, no layout animation)
    if (vis && w0 && s) bg.animate({ scale: [`${w0 / pw} 1`, '1 1'] }, { duration: 500, easing: SPRING });
    decode(t0);
  };
  const ev = (el: Element | null) => {
    if (!el || el.closest(TXT)) return hide(true);
    const m = el.closest<HTMLElement>('[data-cursor-media]');
    const l = el.closest<HTMLElement>('[data-cursor-label]');
    const k = el.closest(LNK);
    const s = m ? 'media' : l ? 'label' : k ? 'link' : 'idle';
    mag = s === 'link' || s === 'label' ? el.closest('[data-magnetic]') : null;
    // keep the old text while the pill shrinks away; a media card without a label shows no pill
    if (l || m) say(l?.dataset.cursorLabel ?? '');
    root.toggleAttribute('data-l', !!txt);
    const src = m?.dataset.cursorMedia;
    if (src && img.getAttribute('src') !== src) {
      const swap = st === 'media';
      img.src = src;
      // a new project while the card is open: the new image slides in
      if (swap) img.animate({ translate: ['0 30%', '0 0'] }, { duration: 500, easing: OUT });
    }
    const g = el.closest(GROUND);
    root.dataset.ground = !g ? '' : g.matches(SIGNAL) ? 'signal' : 'ink';
    root.dataset.state = st = s;
    root.removeAttribute('data-f');
    // zones: one closest(), written for the CSS; entering a new zone on an idle pointer rotates its idle label in
    const z = el.closest<HTMLElement>('[data-cursor-zone]');
    root.dataset.zone = z?.dataset.cursorZone ?? '';
    const L = z?.dataset.cursorIdle?.split('|');
    if (s !== 'idle') {
      clearTimeout(it);
      root.removeAttribute('data-idle');
    } else if (z !== zone && L) {
      const n = rot.get(z!) ?? 0;
      rot.set(z!, n + 1);
      say(L[n % L.length]);
      root.toggleAttribute('data-l', true);
      root.toggleAttribute('data-idle', true);
      clearTimeout(it);
      it = window.setTimeout(() => root.removeAttribute('data-idle'), IDLE_MS);
    } else if (z !== zone) {
      clearTimeout(it);
      root.removeAttribute('data-idle');
    }
    zone = z;
  };
  const settleAt = () => {
    aim();
    settle();
    put();
  };
  const off = () => {
    ac.abort();
    cancelAnimationFrame(raf);
    clearTimeout(it);
    rot.clear();
    root.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const was = st;
    lx = e.clientX;
    ly = e.clientY;
    if (e.target !== cur || st === 'hidden') ev((cur = e.target) as Element);
    aim();
    if (was === 'hidden' || st === 'hidden') settleAt();
    if (st !== 'hidden') kick();
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

try {
  init();
} catch {
  /* no constructable stylesheets or DOM: stay silent, the native cursor remains */
}
