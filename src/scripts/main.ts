import { init as theme } from './theme';
import { init as drawer } from './drawer';
import { init as progress } from './progress';
import { init as reveal } from './reveal';
import { init as nav } from './nav';
import { init as marquee } from './marquee';
import { init as journey } from './journey';
import { init as hero } from './hero';
import { init as afterLcp } from './after-lcp';
import { onIdle, motionOK } from './lazy';

theme();
drawer();
progress();
reveal();
nav();
marquee();
journey();
hero();
afterLcp();

// --- module registrations ---
{
  // W12: the signal-field canvas loads once the browser is idle and #contato is within one viewport.
  onIdle(() => {
    const band = document.getElementById('contato');
    if (!band || !motionOK()) return;
    new IntersectionObserver((e, o) => {
      if (!e.some((x) => x.isIntersecting)) return;
      o.disconnect();
      import('./signal-field').then((m) => m.init(band));
    }, { rootMargin: '100% 0px' }).observe(band);
  });
}
