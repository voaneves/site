const E = 'cubic-bezier(.25,1,.5,1)';
const S = new CSSStyleSheet();
S.replaceSync(
  `[data-fx=tilt]{transform:perspective(800px) translateY(var(--ly,0)) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .8s ${E}}` +
  `[data-fx=tilt]:hover{--ly:-4px}` +
  `[data-fx=tilt] .vn-chip{box-shadow:0 0 0 1px transparent;transition:box-shadow .4s ${E};transition-delay:0s}` +
  `[data-fx=tilt]:hover .vn-chip{box-shadow:0 0 0 1px var(--vn-signal);transition-delay:calc(var(--i,0)*30ms)}` +
  `:where([data-fx=spot]){position:relative}` +
  `[data-fx=spot]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .4s ${E};background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--vn-signal) 30%,transparent),transparent 70%)}` +
  `[data-fx=spot]:hover::after{opacity:1}`
);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, S];

document.querySelectorAll('[data-fx=tilt]').forEach((p) =>
  p.querySelectorAll<HTMLElement>('.vn-chip').forEach((c, i) => c.style.setProperty('--i', i + ''))
);

const q = (t: EventTarget | null, k: string) => (t as Element | null)?.closest?.<HTMLElement>(`[data-fx=${k}]`) ?? null;
let cur: HTMLElement | null = null;
let ev: PointerEvent | null = null;
let raf = 0;

const clear = (el: HTMLElement) => ['--rx', '--ry'].forEach((v) => el.style.removeProperty(v));

const frame = () => {
  raf = 0;
  if (!ev) return;
  const el = q(ev.target, 'tilt');
  if (cur && cur !== el) clear(cur);
  cur = el;
  const t = q(ev.target, 'tilt') || q(ev.target, 'spot');
  if (!t) return;
  const r = t.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width;
  const y = (ev.clientY - r.top) / r.height;
  if (t.dataset.fx === 'tilt') {
    t.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
    t.style.setProperty('--ry', ((x - 0.5) * 8).toFixed(2) + 'deg');
  } else {
    t.style.setProperty('--mx', (ev.clientX - r.left).toFixed(0) + 'px');
    t.style.setProperty('--my', (ev.clientY - r.top).toFixed(0) + 'px');
  }
};

addEventListener('pointermove', (e) => {
  ev = e;
  if (!raf) raf = requestAnimationFrame(frame);
}, { passive: true });

// tilt must also reset when the pointer leaves the window or the element without another move landing on it
document.addEventListener('pointerout', (e) => {
  const el = q(e.target, 'tilt');
  if (el && !el.contains(e.relatedTarget as Node | null)) clear(el);
}, { passive: true });

// scramble: mono eyebrow decodes from noise, text restored exactly
const G = '#%&*+=<>/\_0123456789';
const busy = new WeakSet<HTMLElement>();
document.addEventListener('pointerover', (e) => {
  const el = q(e.target, 'scramble');
  if (!el || busy.has(el) || el.contains(e.relatedTarget as Node | null)) return;
  busy.add(el);
  const nodes: Text[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n as Text);
  const orig = nodes.map((n) => n.data);
  const label = el.getAttribute('aria-label');
  el.setAttribute('aria-label', el.textContent!.replace(/\s+/g, ' ').trim());
  const w0 = el.style.width;
  el.style.width = el.getBoundingClientRect().width + 'px';
  const t0 = performance.now();
  const D = 800;
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / D);
    nodes.forEach((n, i) => {
      const s = orig[i];
      const k = Math.floor(p * s.length);
      n.data = s.slice(0, k) + s.slice(k).replace(/\S/g, () => G[(Math.random() * G.length) | 0]);
    });
    if (p < 1) return void requestAnimationFrame(tick);
    nodes.forEach((n, i) => (n.data = orig[i]));
    el.style.width = w0;
    if (label == null) el.removeAttribute('aria-label');
    else el.setAttribute('aria-label', label);
    busy.delete(el);
  };
  requestAnimationFrame(tick);
}, { passive: true });
