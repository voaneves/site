import hover from '../styles/late/hover.css?inline';
import rail from '../styles/late/rail.css?inline';

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
    sh.replaceSync(`@layer site{${hover}${rail}}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
    document.documentElement.dataset.late = ''; // ready flag: tests wait on it
  } catch {
    /* no constructable stylesheets: the page keeps its inline styles */
  }
}
