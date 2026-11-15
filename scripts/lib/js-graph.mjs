// Helpers to compute the first-load JS graph of a built page.

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const LINK_RE = /<link\b([^>]*)>/gi;

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

/** Returns { srcs: string[] (/_astro/*.js), inline: string[] (inline module code) }. */
export function entryScripts(html) {
  const srcs = [];
  const inline = [];
  const add = (s) => {
    if (s && /\/_astro\/[^?#]*\.js(?:[?#].*)?$/.test(s) && !srcs.includes(s)) srcs.push(s);
  };
  for (const m of html.matchAll(SCRIPT_RE)) {
    if ((attr(m[1], 'type') || '').toLowerCase() !== 'module') continue;
    const src = attr(m[1], 'src');
    if (src) add(src);
    else if (m[2].trim()) inline.push(m[2]);
  }
  for (const m of html.matchAll(LINK_RE)) {
    if ((attr(m[1], 'rel') || '').toLowerCase() === 'modulepreload') add(attr(m[1], 'href'));
  }
  return { srcs, inline };
}

/** Static import specifiers (relative/absolute .js) of a module; excludes dynamic import(). */
export function staticImports(code) {
  const out = [];
  const re = /(?:^|[^\w$.])(?:import|export)\s*(?:[\w$*{][^"'`;()]*?\s*from\s*)?(["'`])([^"'`]+?\.js)\1/g;
  for (const m of code.matchAll(re)) {
    if (!out.includes(m[2])) out.push(m[2]);
  }
  return out;
}

/** Basename of a chunk path without directory or query. */
export function baseName(p) {
  return p.split(/[?#]/)[0].split('/').pop();
}
