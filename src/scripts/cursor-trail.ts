// Cursor layer A: Sinal ink dropped in water.
// A coarse stable-fluids solver (splat, vorticity confinement, divergence, Jacobi pressure, gradient
// subtract, semi-Lagrangian advection) carries a premultiplied dye field painted by the pointer.
// Loaded lazily after the first pointer move on fine-pointer, motion-ok devices only (see main.ts).
// WebGL (half-float targets) -> Canvas2D -> nothing. Everything is removed on OFF/pagehide.
export {}; // module scope (the chunk is loaded for its side effects)

// TUNABLES
const STOP_MS = 1700; // keep simulating after the last move so the ink can settle, then fade and stop
const SIM_PX = 9; // CSS px per velocity cell (capped at SIM_MAX cells across)
const SIM_MAX = 176;
const DYE_PX = 3; // CSS px per dye texel
const OUT_PX = 2; // CSS px per canvas pixel (the canvas is upscaled by the compositor)
const ITER = 16; // Jacobi pressure iterations
const SWIRL = 48; // vorticity confinement
const VEL_DECAY = 2.4; // per second, e^(-k t)
const DYE_DECAY = 1.9;
const RADIUS = 0.00042; // splat radius^2, height-normalised uv
const FORCE = 0.6; // pointer velocity -> fluid velocity
const SPEED_FULL = 1100; // px/s of pointer speed that injects a full dose of ink
const V_MAX = 4200; // px/s clamp (flicks)
// Ink per ground: Sinal red on creme, a hotter red on ink, ink on the Sinal band.
const RED = [0.96, 0, 0];
const RED_HOT = [1, 0.2, 0.17];
const INK = [0.04, 0.035, 0.035];

type GL = WebGLRenderingContext & WebGL2RenderingContext;
interface Renderer {
  resize(): void;
  frame(x0: number, y0: number, x1: number, y1: number, dt: number, ink: number[]): void;
  clear(): void;
  destroy(): void;
}

const dbg = location.search.includes('vn-debug');
const flag = (k: string, v: unknown) => {
  if (dbg) (window as unknown as Record<string, unknown>)[k] = v;
};
const grid = (px: number, max = 1e4) => {
  const s = Math.max(px, innerWidth / max);
  return [Math.max(2, Math.ceil(innerWidth / s)), Math.max(2, Math.ceil(innerHeight / s))];
};

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'vn-cursor-trail';
  c.setAttribute('aria-hidden', 'true');
  // CSSOM only: no inline style attribute in markup (CSP), no stylesheet cost.
  Object.assign(c.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9997',
    transition: 'opacity .4s',
  });
  return c;
}

// ---------------------------------------------------------------- WebGL

// One vertex shader: the full-screen quad plus the four neighbour coordinates of the bound grid.
const VS = 'attribute vec2 p;uniform vec2 T;varying vec2 v,l,r,u,d;void main(){v=p*.5+.5;l=v-vec2(T.x,0);r=v+vec2(T.x,0);u=v+vec2(0,T.y);d=v-vec2(0,T.y);gl_Position=vec4(p,0,1);}';
const H = 'precision highp float;varying vec2 v,l,r,u,d;uniform sampler2D A,B;';
const FS = {
  // capsule splat along the pointer segment a->b: adds c*g, keeps dye alpha <= 1
  s: `${H}uniform vec2 a,b,k;uniform vec4 c;uniform float m;void main(){vec2 P=v*k,Q=a*k,e=b*k-Q;
float h=clamp(dot(P-Q,e)/max(dot(e,e),1e-9),0.,1.);vec2 q=P-Q-e*h;
vec4 o=texture2D(A,v)+c*exp(-dot(q,q)/${RADIUS});gl_FragColor=m>0.?o/max(1.,o.a):o;}`,
  // curl of the velocity
  c: `${H}void main(){gl_FragColor=vec4(.5*(texture2D(A,r).y-texture2D(A,l).y-texture2D(A,u).x+texture2D(A,d).x),0,0,1);}`,
  // vorticity confinement: push along the gradient of |curl|, perpendicular, to keep the swirls alive
  w: `${H}uniform float k,t;void main(){float L=abs(texture2D(B,l).x),R=abs(texture2D(B,r).x),U=abs(texture2D(B,u).x),D=abs(texture2D(B,d).x),C=texture2D(B,v).x;
vec2 f=vec2(U-D,L-R);f*=k*C/(length(f)+1e-5);gl_FragColor=vec4(texture2D(A,v).xy+f*t,0,1);}`,
  // divergence
  d: `${H}void main(){gl_FragColor=vec4(.5*(texture2D(A,r).x-texture2D(A,l).x+texture2D(A,u).y-texture2D(A,d).y),0,0,1);}`,
  // one Jacobi step for the pressure (k damps the warm start on the first step)
  j: `${H}uniform float k;void main(){gl_FragColor=vec4(k*.25*(texture2D(A,l).x+texture2D(A,r).x+texture2D(A,u).x+texture2D(A,d).x)-.25*texture2D(B,v).x,0,0,1);}`,
  // subtract the pressure gradient: the velocity becomes divergence-free
  g: `${H}void main(){gl_FragColor=vec4(texture2D(B,v).xy-.5*vec2(texture2D(A,r).x-texture2D(A,l).x,texture2D(A,u).x-texture2D(A,d).x),0,1);}`,
  // semi-Lagrangian advection of A along the velocity B (in sim cells per second)
  a: `${H}uniform vec2 S;uniform float t,k;void main(){gl_FragColor=k*texture2D(A,v-t*texture2D(B,v).xy*S);}`,
  // display: density -> alpha with a soft knee, a deeper core and a little relief from the density slope
  o: `${H}uniform vec2 S;void main(){vec4 c=texture2D(A,v);float e=c.a,x=texture2D(A,v+vec2(S.x,0)).a-texture2D(A,v-vec2(S.x,0)).a,y=texture2D(A,v+vec2(0,S.y)).a-texture2D(A,v-vec2(0,S.y)).a;
vec3 n=c.rgb/max(e,1e-4);n*=mix(1.,.72,smoothstep(.45,1.,e))*(1.+clamp(1.6*(y-x),-.18,.22));
float o=.88*(1.-exp(-4.4*e));o=max(o+(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5)-.5)/180.,0.);gl_FragColor=vec4(n*o,o);}`,
};

interface Tgt {
  t: WebGLTexture;
  f: WebGLFramebuffer;
  w: number;
  h: number;
}

function webgl(canvas: HTMLCanvasElement): Renderer | null {
  const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' as const };
  const gl2 = canvas.getContext('webgl2', opts) as WebGL2RenderingContext | null;
  const gl = (gl2 || canvas.getContext('webgl', opts)) as GL | null;
  if (!gl) return null;

  // Signed, filterable, renderable half floats, or no WebGL path at all (the 2D fallback takes over).
  let type = 0;
  let internal = gl.RGBA as number;
  if (gl2) {
    if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) {
      type = gl.HALF_FLOAT;
      internal = gl2.RGBA16F;
    }
  } else {
    const h = gl.getExtension('OES_texture_half_float');
    if (h && gl.getExtension('OES_texture_half_float_linear')) type = h.HALF_FLOAT_OES;
  }

  const progs: WebGLProgram[] = [];
  const buf = gl.createBuffer();
  let all: Tgt[] = [];
  const dropAll = () => {
    all.forEach((x) => (gl.deleteTexture(x.t), gl.deleteFramebuffer(x.f)));
    all = [];
  };
  const free = () => {
    dropAll();
    progs.forEach((p) => gl.deleteProgram(p));
    gl.deleteBuffer(buf);
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the context slot (also on failed init)
    return null;
  };
  if (!type) return free();

  const shader = (t: number, src: string) => {
    const s = gl.createShader(t)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const P: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }> = {};
  for (const [k, src] of Object.entries(FS)) {
    const p = gl.createProgram()!;
    const a = shader(gl.VERTEX_SHADER, VS);
    const b = shader(gl.FRAGMENT_SHADER, src);
    gl.attachShader(p, a);
    gl.attachShader(p, b);
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    gl.deleteShader(a);
    gl.deleteShader(b);
    progs.push(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return free();
    P[k] = { p, u: {} };
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);

  const target = (w: number, h: number): Tgt | null => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const x = { t, f, w, h };
    all.push(x);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? x : null;
  };
  // ping-pong pair: [read, write]
  const pair = (w: number, h: number) => {
    const a = target(w, h);
    const b = target(w, h);
    return a && b ? [a, b] : null;
  };
  let vel: Tgt[], dye: Tgt[], prs: Tgt[], div: Tgt, crl: Tgt;
  let SW = 0;
  let SH = 0;

  // one draw: program k into `out` (or the canvas), textures A/B, float uniforms by arity
  const run = (k: string, out: Tgt | null, A: Tgt, B: Tgt | null, U: Record<string, number[]>) => {
    const { p, u } = P[k];
    gl.useProgram(p);
    const loc = (n: string) => (n in u ? u[n] : (u[n] = gl.getUniformLocation(p, n)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.uniform1i(loc('A'), 0);
    if (B) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, B.t);
      gl.uniform1i(loc('B'), 1);
    }
    const g = out || { w: SW, h: SH };
    gl.uniform2f(loc('T'), 1 / g.w, 1 / g.h);
    for (const n in U) {
      const x = U[n];
      const l = loc(n);
      if (x.length === 1) gl.uniform1f(l, x[0]);
      else if (x.length === 2) gl.uniform2f(l, x[0], x[1]);
      else gl.uniform4f(l, x[0], x[1], x[2], x[3]);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.f : null);
    gl.viewport(0, 0, out ? out.w : canvas.width, out ? out.h : canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const swap = (x: Tgt[]) => x.reverse();

  const wipe = () => {
    for (const x of all) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, x.f);
      gl.viewport(0, 0, x.w, x.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  const resize = () => {
    const [w, h] = grid(SIM_PX, SIM_MAX);
    const [dw, dh] = grid(DYE_PX);
    const [cw, ch] = grid(OUT_PX);
    SW = cw;
    SH = ch;
    canvas.width = cw;
    canvas.height = ch;
    dropAll();
    const v = pair(w, h);
    const y = pair(dw, dh);
    const q = pair(w, h);
    const a = target(w, h);
    const b = target(w, h);
    if (!v || !y || !q || !a || !b) return false;
    [vel, dye, prs, div, crl] = [v, y, q, a, b];
    wipe();
    return true;
  };
  if (!resize()) return free();

  const onLost = (e: Event) => {
    e.preventDefault();
    off();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    resize,
    frame(x0, y0, x1, y1, dt, ink) {
      const t = dt / 1000;
      const w = innerWidth;
      const h = innerHeight;
      const sx = vel[0].w / w; // sim cells per CSS px
      const S = [1 / vel[0].w, 1 / vel[0].h];
      const sp = Math.hypot(x1 - x0, y1 - y0) / t;
      const cap = Math.min(1, V_MAX / (sp || 1)) / t; // px/s, clamped for flicks
      const mx = (x1 - x0) * cap;
      const my = (y1 - y0) * cap;
      if (sp > 1) {
        const seg = { a: [x0 / w, 1 - y0 / h], b: [x1 / w, 1 - y1 / h], k: [w / h, 1] };
        const f = FORCE * sx;
        run('s', vel[1], vel[0], null, { ...seg, c: [mx * f, -my * f, 0, 0], m: [0] });
        swap(vel);
        const q = Math.min(1, sp / SPEED_FULL) * 0.42;
        run('s', dye[1], dye[0], null, { ...seg, c: [ink[0] * q, ink[1] * q, ink[2] * q, q], m: [1] });
        swap(dye);
      }
      run('c', crl, vel[0], null, {});
      run('w', vel[1], vel[0], crl, { k: [SWIRL], t: [t] });
      swap(vel);
      run('d', div, vel[0], null, {});
      for (let i = 0; i < ITER; i++) {
        run('j', prs[1], prs[0], div, { k: [i ? 1 : 0.8] });
        swap(prs);
      }
      run('g', vel[1], prs[0], vel[0], {});
      swap(vel);
      run('a', vel[1], vel[0], vel[0], { S, t: [t], k: [Math.exp(-VEL_DECAY * t)] });
      swap(vel);
      run('a', dye[1], dye[0], vel[0], { S, t: [t], k: [Math.exp(-DYE_DECAY * t)] });
      swap(dye);
      run('o', null, dye[0], null, { S: [1 / dye[0].w, 1 / dye[0].h] });
    },
    clear: wipe,
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      free();
    },
  };
}

// ---------------------------------------------------------------- Canvas2D fallback

function canvas2d(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const resize = () => {
    [canvas.width, canvas.height] = grid(OUT_PX * 2);
  };
  resize();
  return {
    resize,
    frame(x0, y0, x1, y1, dt, ink) {
      const k = canvas.width / innerWidth;
      // decay ...
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1 - Math.exp(-DYE_DECAY * 2 * (dt / 1000));
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // ... then soft discs along the segment
      ctx.globalCompositeOperation = 'source-over';
      const len = Math.hypot(x1 - x0, y1 - y0);
      const sp = len / (dt / 1000);
      const rad = (22 + Math.min(sp, 2000) / 90) * k;
      const n = Math.max(1, Math.ceil(len / 8));
      const rgb = ink.map((c) => Math.round(c * 255)).join();
      ctx.globalAlpha = Math.min(1, sp / SPEED_FULL) * 0.42;
      for (let i = 1; i <= n && len > 0; i++) {
        const x = (x0 + ((x1 - x0) * i) / n) * k;
        const y = (y0 + ((y1 - y0) * i) / n) * k;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${rgb},.9)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    },
    clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    destroy() {
      canvas.width = canvas.height = 0;
    },
  };
}

// ---------------------------------------------------------------- controller

let canvas: HTMLCanvasElement | null = null;
let r: Renderer | null = null;
let raf = 0;
let lastT = 0;
let lastMove = 0;
let px = 0;
let py = 0;
let qx = 0;
let qy = 0;
let ink = RED;
let lastEl: Element | null | undefined;
let theme: string | undefined;
let hidden = false;
let fade = 0;
let gx = 0;
let gy = 0;
let gn = 0;
let resizeRaf = 0;
const mql = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');

// Luminance of the first opaque background up the tree; falls back to the theme.
function groundDark(el: Element | null, fallback: boolean): boolean {
  for (let n = el; n; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
    if (m && (m[3] === undefined || +m[3] > 0.5)) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.45;
  }
  return fallback;
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  clearTimeout(fade);
  fade = 0;
  r?.clear();
  flag('__vnTrailRunning', false);
}

function tick(now: number) {
  if (!r || !canvas) return;
  if (now - lastMove > STOP_MS) {
    // fade the settled ink out, then wipe the fields and park the loop
    raf = 0;
    canvas.style.opacity = '0';
    fade = window.setTimeout(stop, 420);
    return;
  }
  const dt = Math.max(4, Math.min(34, now - lastT)) || 16.67;
  lastT = now;
  // The ground check (hit test + computed style) only runs after the pointer moved > 24px, or every 6th frame.
  const th = document.documentElement.dataset.theme;
  if (Math.hypot(px - gx, py - gy) > 24 || gn++ % 6 === 0 || th !== theme) {
    gx = px;
    gy = py;
    ground(th);
  }
  r.frame(qx, qy, px, py, dt, ink);
  qx = px;
  qy = py;
  raf = requestAnimationFrame(tick);
}

function ground(th: string | undefined) {
  const el = document.elementFromPoint(px, py);
  if (el === lastEl && th === theme) return;
  lastEl = el;
  theme = th;
  // The ink colour follows the ground under the pointer, not the theme (the hero is ink in both themes).
  // It is baked into the dye as it is dropped, so a trail that crosses grounds keeps each colour where it fell.
  ink = el?.closest('[data-ground="signal"]') ? INK : groundDark(el, th === 'dark') ? RED_HOT : RED;
  flag('__vnTrailInk', ink.join());
}

function onMove(e: PointerEvent) {
  if (hidden || !canvas) return;
  px = e.clientX;
  py = e.clientY;
  lastMove = performance.now();
  if (fade) {
    // moved again during the fade-out: keep the ink, bring the canvas back
    clearTimeout(fade);
    fade = 0;
  }
  if (canvas.style.opacity !== '1') canvas.style.opacity = '1';
  if (!raf) {
    qx = px;
    qy = py;
    lastT = lastMove;
    gn = 0;
    flag('__vnTrailRunning', true);
    raf = requestAnimationFrame(tick);
  }
}

const onHidden = () => {
  hidden = document.visibilityState === 'hidden';
  if (hidden) stop();
};
const onResize = () => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    r?.resize();
  });
};
const onMq = (e: MediaQueryListEvent) => {
  if (!e.matches) off();
};

function off() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  stop();
  removeEventListener('pointermove', onMove);
  removeEventListener('blur', stop);
  removeEventListener('pagehide', off);
  removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onHidden);
  mql.removeEventListener('change', onMq);
  r?.destroy();
  canvas?.remove();
  r = canvas = null;
}

function start() {
  const force2d = dbg && location.search.includes('vn-trail=2d');
  let c = makeCanvas();
  r = force2d ? null : webgl(c);
  flag('__vnTrailMode', r ? 'webgl' : '2d');
  if (!r) {
    c = makeCanvas(); // a canvas that tried WebGL cannot hand out a 2D context
    r = canvas2d(c);
    flag('__vnTrailMode', r ? '2d' : 'none');
  }
  if (!r) return; // nothing works: do nothing
  canvas = c;
  document.body.appendChild(c);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('blur', stop);
  addEventListener('pagehide', off);
  addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onHidden);
  mql.addEventListener('change', onMq);
}

if (mql.matches) start();
