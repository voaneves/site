// Cursor layer A: a soft Sinal-red ink trail that follows the pointer.
// Loaded lazily after the first pointer move on fine-pointer, motion-ok devices only (see main.ts).
// WebGL (half-float ping-pong, byte fallback) -> Canvas2D -> nothing. Everything is removed on OFF/pagehide.

// TUNABLES (mirror of the box in docs/WOW-PLAN.md section 2a)
export {}; // module scope (the chunk is loaded for its side effects)
const TRAIL_STOP_MS = 1500;
const TRAIL_OPACITY_MAX = 0.35;
const TRAIL_DISSIPATION = 0.97; // per frame at 60 fps, scaled by dt
const CELL_MIN_PX = 24; // simulation grid cell, CSS px (36 / DPR, never below this)
const UP = 3; // canvas pixels per simulation cell (smooth display, still tiny)
const RADIUS = 0.001; // splat radius, in aspect-corrected uv^2
const SPEED_FULL_PX = 34; // px per frame that injects full density
const GAIN = 0.9; // density -> alpha (capped by TRAIL_OPACITY_MAX)
const GAIN_DARK = 1.7; // same ink reads weaker on ink grounds
const VEL_GAIN = 22;
const VEL_DISSIPATION = 0.93;
const RED = [0.9608, 0, 0]; // #f50000
const RED_DARK = [1, 0.2196, 0.2196]; // #ff3838

type GL = WebGLRenderingContext & WebGL2RenderingContext;
interface Renderer {
  base: number; // canvas opacity when visible
  resize(): void;
  frame(x0: number, y0: number, x1: number, y1: number, dt: number, dark: boolean): void;
  clear(): void;
  destroy(): void;
}

const dbg = location.search.includes('vn-debug');
const flag = (k: string, v: unknown) => {
  if (dbg) (window as unknown as Record<string, unknown>)[k] = v;
};
const cell = () => Math.max(CELL_MIN_PX, 36 / (devicePixelRatio || 1));
const dims = () => {
  const c = cell();
  return [Math.max(2, Math.ceil(innerWidth / c)), Math.max(2, Math.ceil(innerHeight / c))];
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
    imageRendering: 'auto',
    transition: 'opacity .25s',
  });
  return c;
}

// ---------------------------------------------------------------- WebGL

const VS = 'attribute vec2 a;varying vec2 t;void main(){t=a*.5+.5;gl_Position=vec4(a,0,1);}';
// Pass 1: advect density+velocity along the stored velocity, diffuse a touch, dissipate, then splat
// a Gaussian along the pointer segment (density ~ speed, velocity = pointer motion).
const SIM = `precision mediump float;varying vec2 t;uniform sampler2D u;
uniform vec2 s,a,b,asp;uniform vec4 k;
void main(){
vec2 w=(texture2D(u,t).gb-.5)*2.;
vec2 q=t-w*s*.9;
vec4 o=texture2D(u,q);
float n=(texture2D(u,q+vec2(s.x,0.)).r+texture2D(u,q-vec2(s.x,0.)).r+texture2D(u,q+vec2(0.,s.y)).r+texture2D(u,q-vec2(0.,s.y)).r)*.25;
float d=max(mix(o.r,n,.22)*k.x-.002,0.);
vec2 v=(o.gb-.5)*2.*k.y;
v=sign(v)*max(abs(v)-.01,0.);
vec2 A=a*asp,B=b*asp,P=t*asp,e=B-A;
float h=clamp(dot(P-A,e)/max(dot(e,e),1e-6),0.,1.);
vec2 r=P-A-e*h;
float g=exp(-dot(r,r)/${RADIUS});
d=min(1.,d+g*k.z);
v=clamp(v+(b-a)*k.w*g,-1.,1.);
gl_FragColor=vec4(d,v*.5+.5,1.);}`;
// Pass 2: smooth-interpolate the density and paint it as premultiplied Sinal red, alpha <= TRAIL_OPACITY_MAX.
const DISP = `precision mediump float;varying vec2 t;uniform sampler2D u;uniform vec2 s;uniform vec4 c;
void main(){
vec2 x=t/s-.5,i=floor(x),f=x-i;f=f*f*(3.-2.*f);
float d=texture2D(u,(i+.5+f)*s).r;
float a=min(${TRAIL_OPACITY_MAX},d*c.w);
gl_FragColor=vec4(c.rgb*a,a);}`;

function webgl(canvas: HTMLCanvasElement): Renderer | null {
  const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' as const };
  const gl2 = canvas.getContext('webgl2', opts) as WebGL2RenderingContext | null;
  const gl = (gl2 || canvas.getContext('webgl', opts)) as GL | null;
  if (!gl) return null;

  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const progs: WebGLProgram[] = [];
  const program = (fs: string) => {
    const p = gl.createProgram()!;
    const v = shader(gl.VERTEX_SHADER, VS);
    const f = shader(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    progs.push(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const sim = program(SIM);
  const disp = program(DISP);
  const buf = gl.createBuffer();
  const free = () => {
    progs.forEach((p) => gl.deleteProgram(p));
    gl.deleteBuffer(buf);
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // release the context slot (also on failed init)
  };
  if (!sim || !disp) return free(), null;

  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Half-float targets only when they are renderable AND linearly filterable; otherwise bytes.
  let halfType = 0;
  let halfInternal = gl.RGBA as number;
  if (gl2) {
    if (gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float')) {
      halfType = gl.HALF_FLOAT;
      halfInternal = gl2.RGBA16F;
    }
  } else {
    const h = gl.getExtension('OES_texture_half_float');
    if (h && gl.getExtension('OES_texture_half_float_linear') && gl.getExtension('EXT_color_buffer_half_float')) {
      halfType = h.HALF_FLOAT_OES;
    }
  }

  let [W, H] = dims();
  const tex: WebGLTexture[] = [];
  const fbo: WebGLFramebuffer[] = [];
  let cur = 0;

  const drop = () => {
    tex.splice(0).forEach((t) => gl.deleteTexture(t));
    fbo.splice(0).forEach((f) => gl.deleteFramebuffer(f));
  };
  const alloc = (type: number, internal: number): boolean => {
    drop();
    for (let n = 0; n < 2; n++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, W, H, 0, gl.RGBA, type, null);
      for (const [p, v] of [
        [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
        [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
        [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      ]) {
        gl.texParameteri(gl.TEXTURE_2D, p, v);
      }
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      tex.push(t);
      fbo.push(f);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError()) return false;
    }
    return true;
  };
  const wipe = () => {
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, W, H);
    fbo.forEach((f) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.clearColor(0, 0.5, 0.5, 1); // zero density, zero velocity (encoded at 0.5)
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  const resize = () => {
    [W, H] = dims();
    canvas.width = W * UP;
    canvas.height = H * UP;
    if (!(halfType && alloc(halfType, halfInternal))) {
      if (!alloc(gl.UNSIGNED_BYTE, gl.RGBA)) return false;
    }
    cur = 0;
    wipe();
    return true;
  };
  if (!resize()) return drop(), free(), null;

  const bind = (p: WebGLProgram) => {
    gl.useProgram(p);
    const loc = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  const uSim = { u: U(sim, 'u'), s: U(sim, 's'), a: U(sim, 'a'), b: U(sim, 'b'), asp: U(sim, 'asp'), k: U(sim, 'k') };
  const uDisp = { u: U(disp, 'u'), s: U(disp, 's'), c: U(disp, 'c') };

  const onLost = (e: Event) => {
    e.preventDefault();
    off();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    base: 1,
    resize,
    frame(x0, y0, x1, y1, dt, dark) {
      const sp = Math.hypot(x1 - x0, y1 - y0);
      const w = innerWidth;
      const h = innerHeight;
      // (1)+(2) advect + splat into the other texture
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
      gl.viewport(0, 0, W, H);
      bind(sim);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.uniform1i(uSim.u, 0);
      gl.uniform2f(uSim.s, 1 / W, 1 / H);
      gl.uniform2f(uSim.a, x0 / w, 1 - y0 / h);
      gl.uniform2f(uSim.b, x1 / w, 1 - y1 / h);
      gl.uniform2f(uSim.asp, w / h, 1);
      gl.uniform4f(uSim.k, Math.pow(TRAIL_DISSIPATION, dt / 16.67), Math.pow(VEL_DISSIPATION, dt / 16.67), Math.min(1, sp / SPEED_FULL_PX) * 0.9, VEL_GAIN);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      cur = 1 - cur;
      // (3) display
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      bind(disp);
      gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
      gl.uniform1i(uDisp.u, 0);
      gl.uniform2f(uDisp.s, 1 / W, 1 / H);
      const c = dark ? RED_DARK : RED;
      gl.uniform4f(uDisp.c, c[0], c[1], c[2], dark ? GAIN_DARK : GAIN);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    clear: wipe,
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      drop();
      free();
    },
  };
}

// ---------------------------------------------------------------- Canvas2D fallback

function canvas2d(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const resize = () => {
    const [W, H] = dims();
    canvas.width = W * UP;
    canvas.height = H * UP;
  };
  resize();
  return {
    base: TRAIL_OPACITY_MAX,
    resize,
    frame(x0, y0, x1, y1, dt, dark) {
      const kx = canvas.width / innerWidth;
      const ky = canvas.height / innerHeight;
      // decay (globalAlpha on destination-out) ...
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1 - Math.pow(TRAIL_DISSIPATION, dt / 16.67);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // ... then fading red circles along the segment
      ctx.globalCompositeOperation = 'source-over';
      const sp = Math.hypot(x1 - x0, y1 - y0);
      const rad = (cell() * 1.1 + Math.min(sp, 40) * 0.5) * kx;
      const n = Math.max(1, Math.ceil(sp / (cell() * 0.4)));
      const c = dark ? RED_DARK : RED;
      const rgb = `${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;
      ctx.globalAlpha = Math.min(1, sp / SPEED_FULL_PX) * 0.55;
      for (let i = 1; i <= n; i++) {
        const x = (x0 + ((x1 - x0) * i) / n) * kx;
        const y = (y0 + ((y1 - y0) * i) / n) * ky;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${rgb},1)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 6.2832);
        ctx.fill();
      }
      ctx.fillStyle = '#000';
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
let dark = false;
let lastEl: Element | null | undefined;
let sig = false;
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
    const m = getComputedStyle(n).backgroundColor.match(/[d.]+/g);
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
  if (now - lastMove > TRAIL_STOP_MS) {
    // fade out instead of clearing abruptly (the canvas already transitions opacity)
    raf = 0;
    canvas.style.opacity = '0';
    fade = window.setTimeout(stop, 300);
    return;
  }
  const dt = Math.max(0, Math.min(50, now - lastT)) || 16.67;
  lastT = now;
  // The ground check (hit test + computed style) only runs after the pointer moved > 24px, or every 6th frame.
  const th = document.documentElement.dataset.theme;
  if (Math.hypot(px - gx, py - gy) > 24 || gn++ % 6 === 0 || th !== theme) {
    gx = px;
    gy = py;
    ground(th);
  }
  r.frame(qx, qy, px, py, dt, dark);
  qx = px;
  qy = py;
  raf = requestAnimationFrame(tick);
}

function ground(th: string | undefined) {
  if (!r || !canvas) return;
  const el = document.elementFromPoint(px, py);
  if (el !== lastEl || th !== theme) {
    lastEl = el;
    theme = th;
    // hide the trail over the Sinal contact band (a red trail on red would read as noise)
    sig = !!el?.closest('[data-ground="signal"]');
    // Ink colour and gain follow the ground under the pointer, not the theme: the hero is ink in both themes.
    // Plain alpha blending (not multiply/screen): a single canvas has one blend mode, and multiply on ink or
    // screen on creme would erase the trail whenever the pointer crosses a different ground.
    dark = groundDark(el, th === 'dark');
    canvas.style.opacity = sig ? '0' : String(r.base);
  }
}

function onMove(e: PointerEvent) {
  if (hidden) return;
  px = e.clientX;
  py = e.clientY;
  lastMove = performance.now();
  if (fade) {
    // moved again during the fade-out: wipe now and restore the opacity on the next ground check
    stop();
    lastEl = undefined;
  }
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
