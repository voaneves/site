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
  // A5: interaction-only CSS (hover colours, case rows, nav hover, thumbnail zoom), one lazy sheet for everyone.
  onIdle(() => void import('./late').then((m) => m.init()));
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
  // U7: scroll choreography (CSS scroll timelines + word split), on idle, all pointers, never under reduced motion.
  onIdle(() => matchMedia('(prefers-reduced-motion: no-preference)').matches && void import('./scroll-fx').then((m) => m.init()));
  // W16: fluid cursor trail, only after the first real pointer move (Lighthouse never pays for it).
  onFirstPointer(() => motionOK() && import('./cursor-trail'));
  // W15: cursor dot + label pill, same trigger.
  onFirstPointer(() => motionOK() && import('./cursor'));
  // U6: hover effects (tilt, spotlight, scramble), same trigger.
  onFirstPointer(() => motionOK() && import('./hover-fx'));
  // W14: magnetic buttons, lazy, first fine-pointer move only.
  onFirstPointer(() => motionOK() && matchMedia('(pointer: fine)').matches && import('./magnetic'));
}
