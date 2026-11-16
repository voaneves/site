import hover from '../styles/late/hover.css?inline';

// Late sheet: CSS nobody needs at first paint (hover, pointer, decorative extras), adopted on idle for every
// visitor, reduced motion and touch included. Motion inside it is guarded by its own media queries.
export function init(): void {
  try {
    const sh = new CSSStyleSheet();
    sh.replaceSync(`@layer site{${hover}}`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
    document.documentElement.dataset.late = ''; // ready flag: tests wait on it
  } catch {
    /* no constructable stylesheets: the page keeps its inline styles */
  }
}
