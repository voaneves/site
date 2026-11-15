// Minimal, dependency-free HTML parser for the (well-formed, minified) Astro output in dist/.
// It builds a tiny DOM: elements {tag, attrs, children, parent} and text nodes {text}.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[n]);
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue; // first wins, like browsers
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
    if (m[2] !== undefined || m[3] !== undefined || m[4] !== undefined) attrs[name] = decodeEntities(attrs[name]);
  }
  return attrs;
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      cur.children.push({ text: html.slice(i), parent: cur });
      break;
    }
    if (lt > i) cur.children.push({ text: html.slice(i, lt), parent: cur });
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = html.indexOf('>', lt);
      const tag = html.slice(lt + 2, end).trim().toLowerCase();
      // pop to the matching open element (tolerates implicitly closed ones)
      let p = cur;
      while (p && p.tag !== tag) p = p.parent;
      if (p) cur = p.parent ?? root;
      i = end + 1;
      continue;
    }
    // open tag: find the closing '>' while respecting quotes
    let j = lt + 1;
    let quote = null;
    while (j < n) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    const inner = html.slice(lt + 1, j);
    const nameMatch = inner.match(/^([a-zA-Z][^\s/>]*)/);
    if (!nameMatch) {
      cur.children.push({ text: '<', parent: cur });
      i = lt + 1;
      continue;
    }
    const tag = nameMatch[1].toLowerCase();
    const el = { tag, attrs: parseAttrs(inner.slice(nameMatch[0].length)), children: [], parent: cur, pos: lt };
    cur.children.push(el);
    i = j + 1;
    if (VOID.has(tag) || /\/\s*$/.test(inner) && !RAW.has(tag)) continue;
    if (RAW.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const end = close === -1 ? n : close;
      el.children.push({ text: html.slice(i, end), parent: el, raw: tag === 'script' || tag === 'style' });
      const gt = html.indexOf('>', end);
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    cur = el;
  }
  return root;
}

export function walk(node, fn) {
  for (const c of node.children ?? []) {
    if (c.tag) {
      fn(c);
      walk(c, fn);
    }
  }
}

export function all(node, pred = () => true) {
  const out = [];
  walk(node, (el) => {
    if (typeof pred === 'string' ? el.tag === pred : pred(el)) out.push(el);
  });
  return out;
}

export function textOf(node, { skipHidden = false } = {}) {
  let out = '';
  const rec = (n) => {
    if (n.text !== undefined) {
      if (!n.raw) out += decodeEntities(n.text);
      return;
    }
    if (['script', 'style'].includes(n.tag)) return;
    if (skipHidden && n.attrs?.['aria-hidden'] === 'true') return;
    for (const c of n.children) rec(c);
  };
  rec(node);
  return out.replace(/\s+/g, ' ').trim();
}

export function ancestors(el) {
  const out = [];
  for (let p = el.parent; p && p.tag !== '#root'; p = p.parent) out.push(p);
  return out;
}

export const hasAncestor = (el, pred) => ancestors(el).some(pred);
