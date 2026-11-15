// Lazy "signal field": a 24px grid of ink dots behind the contact copy. Dots near the pointer
// swell and lean toward it on an underdamped spring; a press sends a shockwave through the grid.
// Exactly one dot (the signal) is creme. The rAF loop runs only while something is moving.
const G = 24; // grid pitch (px)
const R = 120; // pointer reach (px)
const PULL = 12; // max lean toward the pointer (px)
const SW = 3; // max extra swell (x radius)
const K = 0.18; // spring stiffness per frame
const D = 0.8; // damping per frame

export function init(band: HTMLElement): void {
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d');
  if (!cx) return;
  cv.className = 'vn-sf';
  cv.setAttribute('aria-hidden', 'true');
  band.prepend(cv);

  const cs = getComputedStyle(band);
  const ink = cs.color;
  const cream = cs.getPropertyValue('--vn-cream').trim() || '#f4efe6';
  const dbg = location.search.includes('vn-debug');
  let W = 0, H = 0, cols = 0, n = 0, sig = 0, dpr = 1;
  let st = new Float32Array(0); // per dot: dx, dy, swell
  let vl = new Float32Array(0);
  let px = -1e4, py = -1e4, raf = 0, last = 0;

  const flag = () => {
    if (dbg) (window as unknown as Record<string, unknown>).__vnFieldRunning = !!raf;
  };

  const draw = () => {
    if (!n) return;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = ink;
    cx.globalAlpha = 0.18;
    cx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === sig || st[i * 3 + 2] > 0.02) continue;
      const x = (i % cols + 0.5) * G, y = (((i / cols) | 0) + 0.5) * G;
      cx.moveTo(x + 1.5, y);
      cx.arc(x, y, 1.5, 0, 6.2832);
    }
    cx.fill();
    for (let i = 0; i < n; i++) {
      const s = st[i * 3 + 2];
      if (i === sig || s <= 0.02) continue;
      cx.globalAlpha = Math.min(0.85, 0.18 + s * 0.28);
      cx.beginPath();
      cx.arc((i % cols + 0.5) * G + st[i * 3], (((i / cols) | 0) + 0.5) * G + st[i * 3 + 1], 1.5 * (1 + s), 0, 6.2832);
      cx.fill();
    }
    cx.globalAlpha = 1;
    cx.fillStyle = cream;
    cx.beginPath();
    cx.arc((sig % cols + 0.5) * G + st[sig * 3], (((sig / cols) | 0) + 0.5) * G + st[sig * 3 + 1], 3.4 + st[sig * 3 + 2] * 2.4, 0, 6.2832);
    cx.fill();
  };

  const step = (t: number) => {
    const k = Math.max(0, Math.min((t - last) / 16.7 || 1, 2.5));
    const dm = D ** k;
    last = t;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const dx = px - (i % cols + 0.5) * G, dy = py - (((i / cols) | 0) + 0.5) * G;
      const d = Math.hypot(dx, dy);
      const f = d < R ? (1 - d / R) ** 2 * (i === sig ? 1.8 : 1) : 0;
      const o = i * 3;
      for (let j = 0; j < 3; j++) {
        const tg = j === 2 ? f * SW : d ? (j ? dy : dx) / d * f * PULL : 0;
        const a = tg - st[o + j];
        let v = (vl[o + j] + a * K * k) * dm;
        if (Math.abs(v) < 0.004 && Math.abs(a) < 0.004) {
          st[o + j] = tg;
          v = 0;
        } else {
          st[o + j] += v * k;
          e = Math.max(e, Math.abs(v) + Math.abs(a));
        }
        vl[o + j] = v;
      }
    }
    draw();
    raf = e > 0 ? requestAnimationFrame(step) : 0;
    flag();
  };

  const go = () => {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
    flag();
  };

  const size = () => {
    const r = band.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = (W * dpr) | 0;
    cv.height = (H * dpr) | 0;
    cols = Math.ceil(W / G);
    const rows = Math.ceil(H / G);
    n = cols * rows;
    st = new Float32Array(n * 3);
    vl = new Float32Array(n * 3);
    sig = Math.min(n - 1, Math.round(rows * 0.34) * cols + Math.round(cols * 0.74));
    draw();
  };

  const at = (e: PointerEvent) => {
    const r = band.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  };

  band.addEventListener('pointermove', (e) => { at(e); go(); }, { passive: true });
  band.addEventListener('pointerleave', () => { px = py = -1e4; go(); }, { passive: true });
  band.addEventListener('pointerdown', (e) => {
    at(e);
    for (let i = 0; i < n; i++) {
      const dx = (i % cols + 0.5) * G - px, dy = (((i / cols) | 0) + 0.5) * G - py;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R * 2) continue;
      const f = 1 - d / (R * 2);
      vl[i * 3] += dx / d * f * 9;
      vl[i * 3 + 1] += dy / d * f * 9;
      vl[i * 3 + 2] += f * 1.4;
    }
    go();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) go();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      flag();
    }
  });
  new ResizeObserver(size).observe(band);
}
