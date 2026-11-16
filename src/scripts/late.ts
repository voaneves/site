import hover from '../styles/late/hover.css?inline';
import rail from '../styles/late/rail.css?inline';
import footer from '../styles/late/footer.css?inline';

// Late sheet: CSS nobody needs at first paint (hover, pointer, decorative extras), adopted on idle for every
// visitor, reduced motion and touch included. Motion inside it is guarded by its own media queries.
export function init(): void {
  try {
    // --vn-p drives the rail's CSS counter; it must be a registered integer to interpolate.
    try {
      CSS.registerProperty({ name: '--vn-p', syntax: '<integer>', inherits: false, initialValue: '0' });
    } catch {
      /* already registered, or no Houdini: the number then jumps from 00 to 99 halfway, the line still fills */
    }
    // --vn-late is the stable marker tests use to tell this sheet from the motion sheets (it survives minification).
    const sh = new CSSStyleSheet();
    sh.replaceSync(`@layer site{:root{--vn-late:1}${hover}${rail}${footer}}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
    document.documentElement.dataset.late = ''; // ready flag: tests wait on it
  } catch {
    /* no constructable stylesheets: the page keeps its inline styles */
  }
  clock();
}

// D1: Palmas local time in the footer (the static "UTC−3" stays if the time zone is unknown).
// h23 so midnight is 00:xx (hour12:false gives 24:xx in en); ticks at minute boundaries, refreshed on becoming visible.
function clock(): void {
  const el = document.querySelector<HTMLElement>('[data-vn-clock]');
  if (!el) return;
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat(document.documentElement.lang, { timeZone: 'America/Araguaina', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {
    return; // keep the static offset
  }
  let timer = 0;
  const tick = () => {
    el.textContent = f.format(new Date());
    clearTimeout(timer);
    if (document.hidden) return; // resumed by visibilitychange
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  document.addEventListener('visibilitychange', tick);
  tick();
}
