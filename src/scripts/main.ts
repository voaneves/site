import { init as theme } from './theme';
import { init as drawer } from './drawer';
import { init as progress } from './progress';
import { init as reveal } from './reveal';
import { init as nav } from './nav';
import { init as marquee } from './marquee';
import { init as hero } from './hero';
import { init as afterLcp } from './after-lcp';
import { onIdle, onFirstPointer, motionOK } from './lazy';

theme();
drawer();
progress();
reveal();
nav();
marquee();
hero();
afterLcp();

// --- module registrations ---
{
  // button hover colours (pointer-only), kept out of the inline critical CSS
  onIdle(() => {
    const sh = new CSSStyleSheet();
    sh.replaceSync(
      '@layer site{.vn-hero-btn-ghost:hover:not(:disabled){background-color:var(--hero-btn-fg);border-color:var(--hero-btn-fg);color:var(--g-bg)}' +
      '.vn-hero-btn-cv:hover:not(:disabled){background-color:color-mix(in srgb,var(--hero-btn-fg) 12%,transparent);color:var(--hero-btn-fg)}' +
      '[data-surface="signal"] .vn-btn--primary:hover:not(:disabled){background-color:var(--vn-cream);color:var(--vn-ink);box-shadow:var(--vn-shadow-lift)}' +
      '.vn-contact-secondary:hover:not(:disabled){background-color:var(--vn-ink);border-color:var(--vn-ink);color:var(--vn-cream)}}'
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
  });
  // case pages: spec-row wipe and pager lift (interaction-only), kept out of the inline critical CSS
  onIdle(() => {
    if (!document.querySelector('.vn-case')) return;
    const e = 'cubic-bezier(.25,1,.5,1)';
    const sh = new CSSStyleSheet();
    sh.replaceSync(
      '@layer site{.vn-case .vn-spec-list__row{position:relative}' +
      `.vn-case .vn-spec-list__row::after{content:"";position:absolute;inset:auto 0 -1px;height:1px;background:var(--vn-signal-ink);transform:scaleX(0);transform-origin:left}` +
      '.vn-case .vn-spec-list__row:hover::after,.vn-case .vn-spec-list__row:focus-within::after{transform:scaleX(1)}' +
      '.vn-case .vn-spec-list__row:hover dt,.vn-case .vn-spec-list__row:focus-within dt{transform:translateX(8px)}' +
      '.vn-case-pager__link:hover,.vn-case-pager__link:focus-visible{transform:translateY(-3px)}' +
      '@media(prefers-reduced-motion:no-preference){' +
      `.vn-case .vn-spec-list__row::after{transition:transform .8s ${e}}.vn-case .vn-spec-list__row dt,.vn-case-pager__link{transition:transform .4s ${e}}}}`
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
  });
  // faq: the details open/close transition (no inline CSS cost) is adopted once #perguntas is within one viewport
  onIdle(() => {
    const sec = document.getElementById('perguntas');
    if (!sec || matchMedia('(prefers-reduced-motion:reduce)').matches || !CSS.supports('selector(::details-content)')) return;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const sh = new CSSStyleSheet();
      sh.replaceSync(
        '@layer site{.vn-faq-item{interpolate-size:allow-keywords}' +
        '.vn-faq-item::details-content{height:0;overflow:clip;opacity:0;translate:0 -.5rem;transition:opacity .4s var(--vn-ease-out),translate .4s var(--vn-ease-out),height .4s var(--vn-ease-out),content-visibility .4s allow-discrete}' +
        '.vn-faq-item[open]::details-content{opacity:1;translate:0 0;height:auto}}'
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
    }, { rootMargin: '100% 0px' });
    io.observe(sec);
  });
  // journey: load only once #jornada is within one viewport
  onIdle(() => {
    const sec = document.getElementById('jornada');
    if (!sec) return;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void import('./journey').then((m) => m.init());
    }, { rootMargin: '100% 0px' });
    io.observe(sec);
  });
  // W12: the signal-field canvas loads once the browser is idle and #contato is within one viewport.
  onIdle(() => {
    const band = document.getElementById('contato');
    if (!band || !motionOK()) return;
    new IntersectionObserver((e, o) => {
      if (!e.some((x) => x.isIntersecting)) return;
      o.disconnect();
      void import('./signal-field').then((m) => m.init(band));
    }, { rootMargin: '100% 0px' }).observe(band);
  });
  // U4: stat count-up, lazy, once #numeros is within one viewport (not under reduced motion).
  onIdle(() => {
    const sec = document.getElementById('numeros');
    if (!sec || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    new IntersectionObserver((e, o) => {
      if (!e.some((x) => x.isIntersecting)) return;
      o.disconnect();
      void import('./count').then((m) => m.init(sec));
    }, { rootMargin: '100% 0px' }).observe(sec);
  });
  // W16: fluid cursor trail, only after the first real pointer move (Lighthouse never pays for it).
  onFirstPointer(() => motionOK() && import('./cursor-trail'));
  // W15: cursor dot + label pill, same trigger.
  onFirstPointer(() => motionOK() && import('./cursor'));
  // U6: hover effects (tilt, spotlight, scramble), same trigger.
  onFirstPointer(() => motionOK() && import('./hover-fx'));
  // W14: magnetic buttons, lazy, first fine-pointer move only.
  onFirstPointer(() => motionOK() && matchMedia('(pointer: fine)').matches && import('./magnetic'));
}
