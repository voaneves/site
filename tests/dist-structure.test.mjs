// Per-page document structure and accessibility invariants over the built dist.
import assert from 'node:assert/strict';
import { eachPage, distTest } from './lib/each.mjs';
import { ROUTES, loadPage } from './lib/dist.mjs';
import { all, textOf, ancestors, hasAncestor } from './lib/html.mjs';

const HEADING = /^h[1-6]$/;
const headings = (p) => p.q((e) => HEADING.test(e.tag));
const level = (e) => Number(e.tag[1]);
const isHidden = (e) => e.attrs['aria-hidden'] === 'true' || e.attrs.hidden !== undefined || hasAncestor(e, (a) => a.attrs['aria-hidden'] === 'true');

/** Accessible name per the subset of accname the markup uses: aria-labelledby, aria-label, text, img alt, title. */
function accName(p, el) {
  if (el.attrs['aria-labelledby']) {
    return el.attrs['aria-labelledby']
      .split(/\s+/)
      .map((id) => all(p.root, (e) => e.attrs.id === id)[0])
      .filter(Boolean)
      .map((t) => textOf(t))
      .join(' ')
      .trim();
  }
  if (el.attrs['aria-label']?.trim()) return el.attrs['aria-label'].trim();
  let out = textOf(el, { skipHidden: true });
  for (const img of all(el, 'img')) if (!isHidden(img)) out += ` ${img.attrs.alt ?? ''}`;
  for (const svg of all(el, 'svg')) {
    if (svg.attrs['aria-hidden'] === 'true') continue;
    const t = all(svg, 'title')[0];
    if (t) out += ` ${textOf(t)}`;
  }
  return (out || el.attrs.title || '').trim();
}

eachPage('has exactly one <h1> with text', (p) => {
  const h1 = p.q('h1');
  assert.equal(h1.length, 1, `found ${h1.length} h1`);
  assert.ok(textOf(h1[0]).length > 1, 'h1 text is empty');
});

eachPage('the h1 is not hidden from assistive tech', (p) => {
  assert.ok(!isHidden(p.q('h1')[0]));
});

eachPage('the first heading in document order is the h1', (p) => {
  assert.equal(headings(p)[0].tag, 'h1');
});

eachPage('heading levels never skip downwards (h2 -> h4 is a skip)', (p) => {
  let prev = 0;
  const bad = [];
  for (const h of headings(p)) {
    if (level(h) > prev + 1) bad.push(`${h.tag} "${textOf(h).slice(0, 30)}" after h${prev}`);
    prev = level(h);
  }
  assert.deepEqual(bad, []);
});

eachPage('no empty headings', (p) => {
  const empty = headings(p).filter((h) => !textOf(h) && !all(h, 'img').some((i) => i.attrs.alt));
  assert.equal(empty.length, 0);
});

eachPage('has exactly one <main id="main"> and the skip link targets it', (p) => {
  const mains = p.q('main');
  assert.equal(mains.length, 1);
  assert.equal(mains[0].attrs.id, 'main');
  const skip = p.q((e) => e.tag === 'a' && e.attrs.href === '#main');
  assert.ok(skip.length >= 1, 'skip link missing');
  assert.ok(textOf(skip[0]).length > 3, 'skip link needs text');
});

eachPage('the skip link is the first focusable element in the body', (p) => {
  const first = p.q((e) => ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(e.tag) || e.attrs.tabindex !== undefined).find((e) => p.body.pos < e.pos);
  assert.equal(first.attrs.href, '#main');
});

eachPage('landmarks: one banner, one contentinfo, labelled <nav>s with unique labels', (p) => {
  assert.equal(p.q('header').filter((h) => h.parent.tag === 'body').length, 1, 'one top-level header');
  assert.equal(p.q('footer').filter((h) => h.parent.tag === 'body').length, 1, 'one top-level footer');
  const navs = p.q('nav');
  assert.ok(navs.length >= 2);
  const labels = navs.map((n) => n.attrs['aria-label'] ?? n.attrs['aria-labelledby']);
  assert.ok(labels.every(Boolean), 'every <nav> needs aria-label');
  assert.equal(new Set(labels).size, labels.length, `duplicate nav labels: ${labels}`);
});

eachPage('no duplicate ids', (p) => {
  const dup = p.ids.filter((id, i) => p.ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dup)], []);
});

eachPage('ids are valid (no whitespace, not empty)', (p) => {
  assert.deepEqual(p.ids.filter((id) => !id || /\s/.test(id)), []);
});

eachPage('aria-labelledby / aria-describedby / aria-controls / for reference existing ids', (p) => {
  const bad = [];
  for (const el of p.q(() => true)) {
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'for', 'list']) {
      if (el.attrs[attr] === undefined) continue;
      for (const id of el.attrs[attr].split(/\s+/).filter(Boolean)) {
        if (!p.idSet.has(id)) bad.push(`<${el.tag}> ${attr}="${id}"`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

eachPage('every <button> has an accessible name and an explicit type', (p) => {
  const bad = [];
  for (const b of p.q('button')) {
    if (!accName(p, b)) bad.push(`button#${b.attrs.id ?? '?'} has no name`);
    if (!['button', 'submit', 'reset'].includes(b.attrs.type)) bad.push(`button#${b.attrs.id ?? '?'} has no type`);
  }
  assert.deepEqual(bad, []);
});

eachPage('every link has an accessible name', (p) => {
  const bad = p.q((e) => e.tag === 'a' && e.attrs.href !== undefined).filter((a) => !accName(p, a)).map((a) => a.attrs.href);
  assert.deepEqual(bad, []);
});

eachPage('no link or button name is a vague placeholder ("click here", "link", "more")', (p) => {
  const vague = /^(click here|clique aqui|here|aqui|link|more|mais|read more|saiba mais)$/i;
  const bad = p.q((e) => e.tag === 'a' || e.tag === 'button').filter((e) => vague.test(accName(p, e))).map((e) => accName(p, e));
  assert.deepEqual(bad, []);
});

eachPage('aria-label on a link is contained in its visible text (WCAG 2.5.3 label-in-name)', (p) => {
  const bad = [];
  for (const a of p.q((e) => (e.tag === 'a' || e.tag === 'button') && e.attrs['aria-label'])) {
    const visible = textOf(a, { skipHidden: true }).toLowerCase();
    if (/\p{L}/u.test(visible) && !a.attrs['aria-label'].toLowerCase().includes(visible)) bad.push(`"${a.attrs['aria-label']}" vs visible "${visible}"`);
  }
  assert.deepEqual(bad, []);
});

eachPage('decorative inline <svg> are aria-hidden or named', (p) => {
  const bad = [];
  for (const svg of p.q('svg')) {
    if (svg.parent.tag === 'symbol' || hasAncestor(svg, (a) => a.tag === 'svg' || a.tag === 'symbol')) continue;
    const named = svg.attrs['aria-hidden'] === 'true' || svg.attrs['aria-label'] || svg.attrs['aria-labelledby'] || all(svg, 'title').length;
    const inNamedParent = ancestors(svg).some((a) => a.attrs['aria-hidden'] === 'true' || a.attrs['aria-label']);
    if (!named && !inNamedParent) bad.push(svg.attrs.class ?? 'svg');
  }
  assert.deepEqual(bad, []);
});

eachPage('aria-hidden content contains no focusable element', (p) => {
  const bad = [];
  for (const h of p.q((e) => e.attrs['aria-hidden'] === 'true')) {
    for (const f of all(h, (e) => (e.tag === 'a' && e.attrs.href !== undefined) || e.tag === 'button' || e.tag === 'input' || e.tag === 'select' || e.tag === 'textarea' || (e.attrs.tabindex !== undefined && e.attrs.tabindex !== '-1'))) {
      bad.push(`<${f.tag}> inside aria-hidden <${h.tag} class="${h.attrs.class ?? ''}">`);
    }
  }
  assert.deepEqual(bad, []);
});

eachPage('no positive tabindex', (p) => {
  const bad = p.q((e) => e.attrs.tabindex !== undefined && Number(e.attrs.tabindex) > 0);
  assert.equal(bad.length, 0);
});

eachPage('aria-expanded/aria-pressed values are valid booleans', (p) => {
  const bad = [];
  for (const e of p.q((x) => x.attrs['aria-expanded'] !== undefined || x.attrs['aria-pressed'] !== undefined)) {
    for (const k of ['aria-expanded', 'aria-pressed']) {
      if (e.attrs[k] !== undefined && !['true', 'false', 'mixed'].includes(e.attrs[k])) bad.push(`${k}="${e.attrs[k]}"`);
    }
  }
  assert.deepEqual(bad, []);
});

eachPage('the mobile drawer is a named <dialog> with a close button and a labelled nav', (p) => {
  const d = p.q('dialog');
  assert.equal(d.length, 1);
  assert.ok(d[0].attrs['aria-label'] || d[0].attrs['aria-labelledby']);
  assert.ok(all(d[0], (e) => e.tag === 'button' && e.attrs.id === 'vn-drawer-close').length === 1);
  assert.ok(all(d[0], 'nav').length === 1);
  const btn = p.q((e) => e.tag === 'button' && e.attrs.id === 'vn-menu-btn')[0];
  assert.equal(btn.attrs['aria-controls'], d[0].attrs.id);
  assert.equal(btn.attrs['aria-expanded'], 'false');
});

eachPage('the language switch link is labelled with its visible text and uses the target language', (p) => {
  const sw = p.q((e) => e.tag === 'a' && e.attrs['aria-label'] && /^(EN|PT)$/.test(textOf(e))).filter((a) => ancestors(a).some((x) => x.tag === 'header'))[0];
  assert.ok(sw, 'language switch missing from header');
  assert.equal(textOf(sw), p.locale === 'en' ? 'PT' : 'EN');
  assert.ok(sw.attrs['aria-label'].startsWith(textOf(sw)));
});

eachPage('no empty paragraphs / list items / table cells headers', (p) => {
  const bad = p.q((e) => ['p', 'li', 'dt', 'dd', 'figcaption', 'summary'].includes(e.tag)).filter((e) => !textOf(e) && !all(e, (x) => x.tag === 'img' || x.tag === 'svg').length);
  assert.equal(bad.length, 0, `${bad.length} empty elements`);
});

eachPage('lists contain only <li>; <dl> contains only dt/dd groups; tables have caption/headers', (p) => {
  for (const l of p.q((e) => e.tag === 'ul' || e.tag === 'ol')) {
    assert.deepEqual(l.children.filter((c) => c.tag && c.tag !== 'li' && c.tag !== 'script' && c.tag !== 'template'), [], 'non-li child of list');
  }
  for (const t of p.q('table')) {
    assert.ok(all(t, 'th').length > 0, 'table without <th>');
    assert.ok(all(t, 'caption').length === 1 || t.attrs['aria-label'] || t.attrs['aria-labelledby'], 'table without caption or label');
  }
});

eachPage('<details> elements have a <summary> as first child', (p) => {
  for (const d of p.q('details')) {
    assert.equal(d.children.find((c) => c.tag)?.tag, 'summary');
  }
});

eachPage('page text has no raw template leftovers ({{ }} / ${ } / undefined)', (p) => {
  const text = textOf(p.body);
  assert.doesNotMatch(text, /\{\{|\}\}|\$\{|\bundefined\b|\[object Object\]|\bNaN\b/);
});

eachPage('visible text has no double spaces typos, stray HTML entities or mojibake', (p) => {
  const text = textOf(p.body);
  assert.doesNotMatch(text, /Ã[\u0080-¿]|â€|&amp;|&lt;|&gt;|�/);
});

eachPage('exactly one <header> banner contains the brand link home', (p) => {
  const brand = p.q((e) => e.tag === 'a' && e.attrs.class?.includes('vn-navbar__brand'))[0];
  assert.ok(brand);
  assert.equal(brand.attrs.href, p.locale === 'en' ? '/en/' : '/');
  assert.ok(brand.attrs['aria-label']);
});

// ---- Home-only structure -----------------------------------------------------------------------------
const HOMES = ['/', '/en/'];
const NAV_ORDER = ['quem-sou', 'numeros', 'jornada', 'projetos', 'servicos', 'perguntas', 'contato'];

eachPage('every primary nav hash target exists as a <section id> in the same order', (p) => {
  const hashes = p.q((e) => e.tag === 'a' && e.attrs['data-nav-hash']).map((a) => a.attrs['data-nav-hash']);
  assert.deepEqual(hashes, NAV_ORDER);
  const sections = p.q((e) => e.tag === 'section' && NAV_ORDER.includes(e.attrs.id)).map((s) => s.attrs.id);
  assert.deepEqual(sections, NAV_ORDER, 'sections order must follow the nav');
  for (const h of hashes) assert.ok(p.idSet.has(h), `#${h}`);
}, { routes: HOMES });

eachPage('every drawer link mirrors a nav link (same hashes, same order)', (p) => {
  const drawer = p.q((e) => e.tag === 'a' && e.attrs['data-drawer-link'] !== undefined && e.attrs.href.startsWith('#') && e.attrs.href !== '#contato').map((a) => a.attrs.href.slice(1));
  assert.deepEqual(drawer.slice(0, 6), NAV_ORDER.slice(0, 6));
}, { routes: HOMES });

eachPage('each numbered home section has exactly one h2 and data-section counts 01, 02, ... in order', (p) => {
  const secs = p.q((e) => e.tag === 'section' && e.attrs['data-section'] !== undefined);
  assert.ok(secs.length >= 8);
  secs.forEach((s, i) => {
    assert.equal(all(s, 'h2').length, 1, `#${s.attrs.id} must have exactly one h2`);
    assert.equal(s.attrs['data-section'], String(i + 1).padStart(2, '0'));
  });
}, { routes: HOMES });

eachPage('home has the hero section first and a footer last inside <body>', (p) => {
  const main = p.q('main')[0];
  assert.equal(main.children.find((c) => c.tag)?.attrs.id, 'inicio');
  const lastEl = p.body.children.filter((c) => c.tag && c.tag !== 'script').at(-1);
  assert.equal(lastEl.tag, 'footer');
}, { routes: HOMES });

eachPage('FAQ items are <details>, each with a question and an answer', (p) => {
  const faq = p.q((e) => e.tag === 'section' && e.attrs.id === 'perguntas')[0];
  const items = all(faq, 'details');
  assert.ok(items.length >= 4);
  for (const d of items) {
    assert.ok(textOf(all(d, 'summary')[0]).length > 10);
    assert.ok(textOf(d).length > textOf(all(d, 'summary')[0]).length + 20, 'answer missing');
  }
}, { routes: HOMES });

eachPage('the contact section exposes WhatsApp, calendar and mail actions', (p) => {
  const c = p.q((e) => e.tag === 'section' && e.attrs.id === 'contato')[0];
  const hrefs = all(c, 'a').map((a) => a.attrs.href);
  assert.ok(hrefs.some((h) => h.startsWith('https://wa.me/')));
  assert.ok(hrefs.some((h) => h.startsWith('https://koalendar.com/')));
  assert.ok(hrefs.some((h) => h.startsWith('mailto:')));
}, { routes: HOMES });

// ---- Project pages -----------------------------------------------------------------------------------
const PROJECTS = ROUTES.filter((r) => r.includes('/proje') && r.split('/').filter(Boolean).length >= 2 && !r.endsWith('/projetos/'));

eachPage('case study: breadcrumb, one h1, hero image, KPIs, prev/next navigation and a CTA', (p) => {
  const crumb = p.q((e) => e.tag === 'nav' && e.attrs.class?.includes('vn-case-crumb'))[0];
  assert.ok(crumb, 'breadcrumb');
  assert.equal(all(crumb, (e) => e.attrs['aria-current'] === 'page').length, 1);
  assert.ok(p.q('article').length === 1);
  assert.ok(all(p.q('article')[0], 'img').length >= 1);
  assert.ok(p.q((e) => e.attrs.class?.includes('vn-case-kpi')).length >= 2, 'KPIs');
  const projNav = p.q((e) => e.tag === 'nav' && /Navegação entre projetos|Project navigation/.test(e.attrs['aria-label'] ?? ''));
  assert.equal(projNav.length, 1, 'project navigation landmark');
  assert.ok(all(projNav[0], 'a').length >= 2, 'prev + next');
}, { routes: PROJECTS });

eachPage('case study: h2 sections for challenge, architecture, outcomes and deliverables', (p) => {
  assert.ok(p.q('h2').length >= 4, `only ${p.q('h2').length} h2`);
}, { routes: PROJECTS });

// ---- 404 ---------------------------------------------------------------------------------------------
distTest('404 page has the not-found copy in both languages and links home in both', () => {
  const p = loadPage('/404.html');
  const hrefs = all(p.q('main')[0], 'a').map((a) => a.attrs.href);
  assert.ok(hrefs.includes('/') && hrefs.includes('/en/'));
  assert.ok(p.q((e) => e.attrs.lang === 'en').length >= 1, 'English block must carry lang="en"');
  assert.match(textOf(p.q('h1')[0]), /Sinal perdido/);
});

distTest('the home page of each locale links to the other and to every project of its own locale', () => {
  for (const [route, prefix, other] of [['/', '/projetos/', '/en/'], ['/en/', '/en/projects/', '/']]) {
    const p = loadPage(route);
    const hrefs = p.q('a').map((a) => a.attrs.href);
    assert.ok(hrefs.includes(other), `${route} -> ${other}`);
    const projects = new Set(hrefs.filter((h) => h.startsWith(prefix)));
    assert.equal(projects.size, 6, `${route} links ${projects.size} projects`);
    assert.ok(![...hrefs].some((h) => h.startsWith(prefix === '/projetos/' ? '/en/projects/' : '/projetos/')), 'cross-locale project link');
  }
});
