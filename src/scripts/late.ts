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
    const sh = new CSSStyleSheet();
    sh.replaceSync(`@layer site{${hover}${rail}${footer}}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
    document.documentElement.dataset.late = ''; // ready flag: tests wait on it
    // D1: Palmas local time in the footer (the static "UTC−3" stays if the time zone is unknown)
    const clock = document.querySelector<HTMLElement>('[data-vn-clock]');
    if (clock) {
      try {
        const f = new Intl.DateTimeFormat(document.documentElement.lang, { timeZone: 'America/Araguaina', hour: '2-digit', minute: '2-digit', hour12: false });
        const tick = () => { clock.textContent = f.format(new Date()); };
        tick();
        setInterval(tick, 30_000);
      } catch {
        /* keep the static offset */
      }
    }
  } catch {
    /* no constructable stylesheets: the page keeps its inline styles */
  }
}
