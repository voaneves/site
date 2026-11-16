import handoff from '../styles/fx/handoff.css?inline';
import parallax from '../styles/fx/parallax.css?inline';
import text from '../styles/fx/text.css?inline';
import moments from '../styles/fx/moments.css?inline';
import cases from '../styles/fx/case.css?inline';

// U7a: scroll choreography engine. Loaded on idle under prefers-reduced-motion: no-preference (all pointers).
// One constructable sheet in @layer site, assembled from src/styles/fx/*.css. BASE is every top-level rule;
// TL is every top-level @supports (animation-timeline) block, kept only when view timelines exist.
export function init(): void {
  const tl = CSS.supports('animation-timeline: view()');
  const S = new CSSStyleSheet();
  S.replaceSync(`@layer site{${handoff}${parallax}${text}${moments}${cases}}`);
  if (!tl) {
    const rules = (S.cssRules[0] as CSSLayerBlockRule).cssRules;
    for (let i = rules.length; i--; ) {
      if ((rules[i] as CSSSupportsRule).conditionText?.includes('animation-timeline')) (S.cssRules[0] as CSSLayerBlockRule).deleteRule(i);
    }
  }
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, S];
  document.documentElement.dataset.scrollFx = tl ? 'tl' : 'base';
  // C6: index the words of the About statement for the scroll inking (fx/text.css). 26% of the stage's
  // cover range is shared between the words, so the last one is full ink while the statement is still on screen.
  const st = document.querySelector<HTMLElement>('.vn-about-statement');
  if (st && tl) {
    const ws = st.querySelectorAll<HTMLElement>('.vn-w');
    st.style.setProperty('--ws', `${(26 / Math.max(1, ws.length)).toFixed(2)}%`);
    ws.forEach((w, i) => w.style.setProperty('--w', String(i)));
  }
  // Reduced motion switched on at runtime: drop the sheet, so every timeline and clip goes with it.
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', () => {
    if (!mq.matches) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== S);
    delete document.documentElement.dataset.scrollFx;
  });

  // [data-enter=lines]: wrap each word in .vn-w (text nodes and spaces kept, so textContent and the accessible name hold).
  document.querySelectorAll('[data-enter=lines]:not(.is-in)').forEach((el) => {
    if (el.querySelector('.vn-w')) return;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n as Text);
    for (const n of nodes) {
      if (!n.data.trim()) continue;
      const f = document.createDocumentFragment();
      for (const p of n.data.split(/(\s+)/)) {
        if (!p) continue;
        if (/^\s+$/.test(p)) f.append(p);
        else {
          // One span per piece that can end a line (after - / hyphen, en and em dash; before an em dash):
          // a clip-path on an inline box split across two lines paints only the first fragment.
          for (const q of p.split(/(?<=[-/‐–—])|(?=—)/)) {
            const w = document.createElement('span');
            w.className = 'vn-w';
            w.textContent = q;
            f.append(w);
          }
        }
      }
      n.replaceWith(f);
    }
  });
}
