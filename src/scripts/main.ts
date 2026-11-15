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
  // W16: fluid cursor trail, only after the first real pointer move (Lighthouse never pays for it).
  onFirstPointer(() => motionOK() && import('./cursor-trail'));
}
