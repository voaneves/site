// PostCSS plugin (wired in astro.config.mjs) that drops dead rules and custom properties of the shared
// @voaneves/brand CSS from the inline CSS of every page. The brand package is shared with other projects, so it
// is NOT edited: the removal happens at build time, from an EXPLICIT denylist (no automatic scanning). Anything
// not listed here is untouched. Before adding a name, prove it has zero use in src/, scripts/, public/, e2e/, tests/
// (classes: markup, JS, selectors; custom properties: var(), getPropertyValue, JS string literals).

/** Brand classes with zero use in the site. A selector that mentions any of them can never match and is dropped. */
export const DEAD_CLASSES = [
  'vn-breath',
  'vn-cursor__label',
  'vn-cursor__lens',
  'vn-drawer', // exact class only: vn-drawer__link / __close / __num and vn-mobile-drawer are in use
  'vn-field',
  'vn-field__error',
  'vn-field__input',
  'vn-field__label',
  'vn-pause',
  'vn-stat-card',
  'vn-type-code',
  'vn-type-hero',
  'vn-type-quote',
  'vn-type-wordmark',
];

/** Brand custom properties that are only declared (never read through var() or getPropertyValue). */
export const DEAD_PROPERTIES = [
  '--vn-viz-1',
  '--vn-viz-2',
  '--vn-viz-3',
  '--vn-viz-grid',
  '--vn-opacity-glass',
  '--vn-opacity-scrim',
  '--vn-dur-cursor',
  '--vn-dur-line',
  '--vn-dur-unveil',
  '--vn-dur-page',
  '--vn-stagger-line',
  '--vn-space-13',
  '--vn-layout-gutter-sm',
  '--vn-layout-gutter-md',
  '--vn-layout-gutter-lg',
  '--vn-layout-touch-min',
  '--vn-font-opsz-hero',
  '--vn-cursor-tau-dot',
  '--vn-cursor-tau-lens',
  '--vn-cursor-tau-label',
  '--vn-text-muted-on-inverse',
];

export const BRAND_DIR = '@voaneves/brand/dist/css/';
const fromBrand = (node) => (node.source?.input?.file ?? '').replaceAll('\\', '/').includes(BRAND_DIR);

const classRe = (name) => new RegExp(String.raw`\.${name}(?![\w-])`);
const DEAD_CLASS_RES = DEAD_CLASSES.map(classRe);
const DEAD_PROP_SET = new Set(DEAD_PROPERTIES);

const isDeadSelector = (sel) => DEAD_CLASS_RES.some((re) => re.test(sel));

/**
 * Parent chain cleanup: drops a rule/at-rule that the purge left empty, walking up. It stops at (and keeps) an
 * `@layer name { }` block: removing it could change the cascade layer order when it is the first mention of the name.
 */
function dropEmptyAncestors(parent) {
  while (parent && parent.type !== 'root' && parent.nodes && parent.nodes.length === 0) {
    if (parent.type === 'atrule' && parent.name === 'layer') return;
    const up = parent.parent;
    parent.remove();
    parent = up;
  }
}

export default function cssPurge() {
  return {
    postcssPlugin: 'site-css-purge',
    Once(root) {
      root.walkRules((rule) => {
        if (!fromBrand(rule)) return;
        // `:not(.vn-field)` style negations would invert the meaning; the brand has none, so fail loudly if one appears.
        if (rule.selectors.some((s) => /:(?:not|is|where|has)\([^)]*\.vn-/.test(s) && isDeadSelector(s))) {
          throw new Error(`css-purge: dead class inside a functional pseudo-class in "${rule.selector}"`);
        }
        const kept = rule.selectors.filter((s) => !isDeadSelector(s));
        if (kept.length === rule.selectors.length) return;
        if (kept.length === 0) {
          const parent = rule.parent;
          rule.remove();
          dropEmptyAncestors(parent);
        } else {
          rule.selectors = kept;
        }
      });
      root.walkDecls((decl) => {
        if (!decl.prop.startsWith('--') || !DEAD_PROP_SET.has(decl.prop) || !fromBrand(decl)) return;
        const parent = decl.parent;
        decl.remove();
        dropEmptyAncestors(parent);
      });
    },
  };
}
cssPurge.postcss = true;
