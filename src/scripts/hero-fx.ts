// Hero effects, a lazy chunk loaded by hero.ts on the first real interaction: live HUD, depth parallax,
// pointer sheen and a persistent colour brush on the grayscale portrait (touch: tap/drag bloom).
// The rAF loop only runs while the pointer moves or the springs settle. Only transform/opacity are
// written; the h1 and the sub-copy are never touched.

type Painter = {
  w: number;
  h: number;
  stamp: (x: number, y: number, r: number, a: number) => void;
  flush: () => void;
};

const dbg = location.search.includes('vn-debug');
const flag = (k: string, v: unknown) => {
  if (dbg) (window as unknown as Record<string, unknown>)[k] = v;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const f = (v: number) => v.toFixed(2);
const t3 = (x: number, y: number) => `translate3d(${f(x)}px,${f(y)}px,0)`;

// The colour layer: an alpha mask that only ever accumulates (the reveal is kept until reload),
// composited with the colour photo on each flush.
function painter(canvas: HTMLCanvasElement, img: HTMLImageElement): Painter | null {
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const sprite = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  sprite.width = sprite.height = 128;
  const m = mask.getContext('2d');
  const s = sprite.getContext('2d');
  if (!ctx || !m || !s) return null;
  const g = s.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#000');
  g.addColorStop(0.4, 'rgba(0,0,0,.8)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = g;
  s.fillRect(0, 0, 128, 128);
  let dirty = false;
  let src: CanvasImageSource | null = null;
  return {
    w: canvas.width,
    h: canvas.height,
    stamp(x, y, r, a) {
      // A little jitter in size keeps the edge organic instead of a perfect tube.
      r *= 0.85 + Math.random() * 0.3;
      m.globalAlpha = a;
      m.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      dirty = true;
    },
    flush() {
      if (!dirty || !img.complete || !img.naturalWidth) return;
      dirty = false;
      if (!src) {
        // A slightly richer colour plate, rendered once, so the reveal reads against the grayscale photo.
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const cc = c.getContext('2d');
        if (cc) {
          cc.filter = 'saturate(1.35) contrast(1.06)';
          cc.drawImage(img, 0, 0, c.width, c.height);
        }
        src = cc ? c : img;
      }
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}

function stroke(p: Painter, x0: number, y0: number, x1: number, y1: number, r: number, a: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / Math.max(2, r * 0.3)));
  for (let i = 1; i <= n; i++) p.stamp(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, a);
}

// Once the visitor has found the effect, the caption bows out (opacity only).
function hintOff(wrap: HTMLElement) {
  const h = wrap.querySelector<HTMLElement>('.vn-hero-portrait__hint');
  if (!h || h.style.opacity) return;
  h.style.transition = 'opacity .6s';
  h.style.opacity = '0';
}

export function fine(
  hero: HTMLElement,
  wrap: HTMLElement,
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  at?: { x: number; y: number } | null,
) {
  const stage = wrap.parentElement!;
  const chips = [...hero.querySelectorAll<HTMLElement>('.vn-hero-chip[data-depth]')].map((el) => ({
    el,
    d: Number(el.dataset.depth) || 12,
  }));
  const badge = hero.querySelector<HTMLElement>('.vn-hero-badge');
  const grid = hero.querySelector<HTMLElement>('.vn-hero__grid');
  const hud = hero.querySelector<HTMLElement>('[data-vn-hud]');
  const live = hero.querySelector<HTMLElement>('[data-vn-hud-live]');
  const tail = live?.textContent?.slice(-4) ?? '';
  const pad = (n: number) => String(clamp(Math.round(n), 0, 9999)).padStart(4, '0');
  const layers = [wrap, badge, hud, ...chips.map((c) => c.el)].filter(Boolean) as HTMLElement[];
  const R = 300; // sheen radius
  const G = 24; // grid overscan (matches the ::before inset)

  let paint: Painter | null = null;
  let sheen: HTMLElement | null = null;
  let sheenIn: HTMLElement | null = null;
  let px = 0;
  let py = 0;
  let over = false;
  let primed = false;
  let nx = 0;
  let ny = 0;
  let glow = 0;
  let sx = 0;
  let sy = 0;
  let bx = 0;
  let by = 0;
  let raf = 0;
  let last = 0;
  let sized = false;
  let ink = 0;

  const setup = (H: DOMRect) => {
    paint = painter(canvas, img);
    sheen = document.createElement('div');
    const g = 'color-mix(in srgb,currentColor 20%,#0000) 1px,#0000 1px';
    sheenIn = document.createElement('div');
    sheen.setAttribute('aria-hidden', 'true');
    Object.assign(sheen.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${R * 2}px`,
      height: `${R * 2}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
      opacity: '0',
      borderRadius: '50%',
      background: 'radial-gradient(closest-side,rgba(255,56,56,.12),rgba(244,234,212,.04) 45%,transparent)',
      willChange: 'transform,opacity',
    });
    sheen.style.setProperty('mask-image', 'radial-gradient(closest-side,#000 20%,transparent)');
    Object.assign(sheenIn.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      backgroundImage:
        `linear-gradient(to right,${g}),linear-gradient(to bottom,${g})`,
      backgroundSize: '64px 64px',
    });
    sheen.append(sheenIn);
    // Inside the grid layer, which clips it: the sheen never extends the hero's overflow.
    (grid ?? hero).append(sheen);
    for (const el of layers) el.style.willChange = 'transform';
    sx = px - H.left;
    sy = py - H.top;
  };

  const frame = (t: number) => {
    const dt = clamp((t - last) / 1000, 0.001, 0.05);
    last = t;
    const H = hero.getBoundingClientRect();
    if (!sheen) setup(H);
    if (!sized && sheenIn) {
      sized = true;
      sheenIn.style.width = `${H.width + G * 2}px`;
      sheenIn.style.height = `${H.height + G * 2}px`;
    }
    const k1 = 1 - Math.exp(-dt * 5);
    const k2 = 1 - Math.exp(-dt * 9);
    const tx = over ? (px - H.left) / H.width - 0.5 : 0;
    const ty = over ? (py - H.top) / H.height - 0.5 : 0;
    const tg = over ? 1 : 0;
    nx += (tx - nx) * k1;
    ny += (ty - ny) * k1;
    glow += (tg - glow) * k1;
    let busy = Math.abs(tx - nx) > 5e-4 || Math.abs(ty - ny) > 5e-4 || Math.abs(tg - glow) > 0.005;

    // Brush: the pointer is projected onto the portrait from anywhere in the hero. Near the portrait it
    // clamps to the edge; further away it blends into a scaled map of the hero, so the brush keeps roaming
    // with weaker, smaller strokes instead of stopping or snapping back. Painted colour is never erased.
    if (over && paint) {
      const S = stage.getBoundingClientRect();
      const l = S.left + wrap.offsetLeft;
      const top = S.top + wrap.offsetTop;
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      if (w && h) {
        const cx = clamp(px, l, l + w);
        const cy = clamp(py, top, top + h);
        const d = Math.min(1, Math.hypot(px - cx, py - cy) / 260);
        const far = d * d * (3 - 2 * d);
        const gx = ((cx + (l + ((px - H.left) / H.width) * w - cx) * far - l) / w) * paint.w;
        const gy = ((cy + (top + ((py - H.top) / H.height) * h - cy) * far - top) / h) * paint.h;
        if (!primed) {
          primed = true;
          bx = gx;
          by = gy;
        }
        const ox = bx;
        const oy = by;
        bx += (gx - bx) * k2;
        by += (gy - by) * k2;
        const travel = Math.hypot(bx - ox, by - oy);
        if (travel > 0.25) {
          stroke(paint, ox, oy, bx, by, 46 * (1 - 0.3 * far), 0.5 * (1 - 0.85 * far));
          paint.flush();
          if ((ink += travel * (1 - far)) > 1200) hintOff(wrap);
        }
        if (Math.hypot(gx - bx, gy - by) > 0.3) busy = true;
        flag('__vnHeroBrush', { x: bx, y: by });
      }
    }

    sx += (px - H.left - sx) * k2;
    sy += (py - H.top - sy) * k2;
    if (over && Math.hypot(px - H.left - sx, py - H.top - sy) > 0.3) busy = true;

    const rest = !busy && !over;
    wrap.style.transform = rest
      ? ''
      : `perspective(900px) ${t3(-nx * 18, -ny * 18)} rotateX(${f(-ny * 9)}deg) rotateY(${f(nx * 9)}deg)`;
    for (const c of chips) c.el.style.transform = rest ? '' : t3(nx * c.d * 2.2, ny * c.d * 2.2);
    if (badge) badge.style.transform = rest ? '' : `${t3(-nx * 40, -ny * 40)} rotate(${f(nx * 14)}deg)`;
    if (grid) {
      grid.style.setProperty('--vn-gx', rest ? '0px' : `${f(-nx * G)}px`);
      grid.style.setProperty('--vn-gy', rest ? '0px' : `${f(-ny * G)}px`);
    }
    if (hud) hud.style.transform = rest ? '' : t3(nx * 10, ny * 6);
    if (sheen && sheenIn) {
      sheen.style.opacity = f(glow);
      sheen.style.transform = t3(sx - R, sy - R);
      sheenIn.style.transform = t3(R - sx - G - nx * G, R - sy - G - ny * G);
    }
    if (live && over) {
      const txt = `X ${pad(px - H.left)} · Y ${pad(py - H.top)} · ${tail}`;
      if (live.textContent !== txt) live.textContent = txt;
    }

    if (busy) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      flag('__vnHeroRunning', false);
    }
  };

  const kick = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
    flag('__vnHeroRunning', true);
  };

  hero.addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      py = e.clientY;
      over = true;
      kick();
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => {
    over = false;
    kick();
  });
  addEventListener('resize', () => (sized = false), { passive: true });
  // Replay the pointer that triggered the load, so the first stroke is not lost.
  if (at) {
    px = at.x;
    py = at.y;
    over = true;
    kick();
  }
}

// Touch and other coarse pointers: tap blooms colour where the finger lands, a sideways drag paints a
// stroke (vertical swipes still scroll). `first` is the pointerdown that loaded this chunk, replayed as a tap.
// With `auto` it blooms by itself once (D3).
export function touch(wrap: HTMLElement, canvas: HTMLCanvasElement, img: HTMLImageElement, first?: PointerEvent, auto = false) {
  let paint: Painter | null = null;
  let blooms: { x: number; y: number; t: number }[] = [];
  let down = false;
  let lx = 0;
  let ly = 0;
  let raf = 0;
  let taps = 0;
  const at = (e: PointerEvent) => {
    const r = wrap.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
  };
  const frame = (t: number) => {
    blooms = blooms.filter((b) => {
      const age = clamp((t - b.t) / 900, 0, 1);
      paint!.stamp(b.x, b.y, 16 + 104 * (1 - (1 - age) ** 3), 0.13);
      return age < 1;
    });
    paint!.flush();
    raf = blooms.length ? requestAnimationFrame(frame) : 0;
    flag('__vnHeroRunning', !!raf);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
    flag('__vnHeroRunning', true);
  };
  const onDown = (e: PointerEvent, live = true) => {
    if (!paint) {
      paint = painter(canvas, img);
      if (!paint) return;
      canvas.style.display = 'block';
    }
    [lx, ly] = at(e);
    down = live;
    blooms.push({ x: lx, y: ly, t: performance.now() });
    if (++taps > 2) hintOff(wrap);
    kick();
  };
  wrap.addEventListener('pointerdown', (e) => onDown(e));
  wrap.addEventListener(
    'pointermove',
    (e) => {
      if (!down || !paint) return;
      const [x, y] = at(e);
      stroke(paint, lx, ly, x, y, 40, 0.35);
      lx = x;
      ly = y;
      kick();
    },
    { passive: true },
  );
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) wrap.addEventListener(type, () => (down = false));
  if (first) onDown(first, false);
  else if (auto) {
    // D3: three blooms down the portrait, 180 ms apart, so most of it turns to colour once
    [0.3, 0.55, 0.8].forEach((fy, i) =>
      setTimeout(() => {
        const r = wrap.getBoundingClientRect();
        onDown({ clientX: r.left + r.width * (i === 1 ? 0.42 : 0.58), clientY: r.top + r.height * fy } as PointerEvent, false);
      }, i * 180),
    );
  }
}
