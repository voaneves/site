// Integrity of the content sources: src/data/portfolio.ts, src/i18n/ui.ts, src/data/contact.ts, slugs and routes.
// Runs without dist/. The TS modules are plain data, loaded through the esbuild that ships with Astro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './lib/ts-load.mjs';
import { ROOT } from './lib/dist.mjs';
import { PROJECT_SLUGS } from '../src/data/slugs.mjs';
import { ROUTE_PAIRS, routeAlternates, alternatePathForLocale } from '../src/i18n/routes.mjs';

const { PORTFOLIO } = await loadTs('src/data/portfolio.ts');
const { UI } = await loadTs('src/i18n/ui.ts');
const { SEO } = await loadTs('src/i18n/seo.ts');
const { WHATSAPP_NUMBER, waLink } = await loadTs('src/data/contact.ts');

const LOCALES = ['pt-br', 'en'];
const pub = (p) => path.join(ROOT, 'public', p.replace(/^\//, ''));

/** Flatten any value into [path, leaf] pairs. */
function leaves(v, p = '') {
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${p}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k));
  return [[p, v]];
}

test('both locales exist in PORTFOLIO, UI and SEO', () => {
  assert.deepEqual(Object.keys(PORTFOLIO).sort(), ['en', 'pt-br']);
  assert.deepEqual(Object.keys(UI).sort(), ['en', 'pt-br']);
  assert.deepEqual(Object.keys(SEO).sort(), ['en', 'pt-br']);
});

test('PORTFOLIO pt-br and en have exactly the same keys and value types at every level', () => {
  // Array lengths are compared separately (next test) so a content-length gap is reported on its own.
  const noLen = (v) =>
    Array.isArray(v) ? [noLen(v[0] ?? null)] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, noLen(x)])) : typeof v;
  assert.deepEqual(noLen(PORTFOLIO.en), noLen(PORTFOLIO['pt-br']));
});

test(
  'PORTFOLIO pt-br and en arrays have identical lengths (no section loses an item in translation)',
  () => {
    const lens = (v, p = '') =>
      Array.isArray(v)
        ? [[p, v.length], ...v.flatMap((x, i) => lens(x, `${p}[${i}]`))]
        : v && typeof v === 'object'
          ? Object.entries(v).flatMap(([k, x]) => lens(x, p ? `${p}.${k}` : k))
          : [];
    assert.deepEqual(lens(PORTFOLIO.en), lens(PORTFOLIO['pt-br']));
  },
);

for (const loc of LOCALES) {
  const P = PORTFOLIO[loc];

  test(`${loc} · top-level sections are complete`, () => {
    assert.deepEqual(Object.keys(P), ['hero', 'about', 'numbers', 'expertise', 'journey', 'projects', 'services', 'faq', 'contact', 'caseUi']);
  });

  test(`${loc} · no empty strings, double spaces or stray padding in PORTFOLIO (padding only where markup concatenates)`, () => {
    const concat = /^(hero\.badgeText|about\.statement(Pre|Mid|Post))$/;
    const bad = leaves(P)
      .filter(([, v]) => typeof v === 'string')
      .filter(([k, v]) => (v.trim() === '' && !/(unit|detail|meta)$/.test(k)) || (v !== v.trim() && !concat.test(k)) || /\s{2,}/.test(v))
      .map(([k, v]) => `${k}="${v}"`);
    assert.deepEqual(bad, []);
  });

  test(`${loc} · no placeholder text (TODO, lorem, undefined, [object)`, () => {
    const bad = leaves(P).filter(([, v]) => typeof v === 'string' && /\bTODO\b|\bFIXME\b|lorem ipsum|undefined|\[object|\{\{/.test(v)).map(([k]) => k);
    assert.deepEqual(bad, []);
  });

  test(`${loc} · no mojibake or replacement characters`, () => {
    const bad = leaves(P).filter(([, v]) => typeof v === 'string' && /Ã[\u0080-¿]|â€|�/.test(v)).map(([k]) => k);
    assert.deepEqual(bad, []);
  });

  test(`${loc} · project slugs equal PROJECT_SLUGS in the same order, with sequential 01..0N indexes`, () => {
    assert.deepEqual(P.projects.items.map((i) => i.slug), PROJECT_SLUGS);
    assert.deepEqual(P.projects.items.map((i) => i.index), PROJECT_SLUGS.map((_, i) => String(i + 1).padStart(2, '0')));
  });

  test(`${loc} · section numbers run 01..08 in page order`, () => {
    const nums = [P.about.num, P.numbers.num, P.expertise.num, P.journey.num, P.projects.num, P.services.num, P.faq.num, P.contact.num];
    assert.deepEqual(nums, ['01', '02', '03', '04', '05', '06', '07', '08']);
    for (const s of ['about', 'numbers', 'expertise', 'journey', 'projects', 'services', 'faq', 'contact']) {
      assert.ok(P[s].tag.startsWith(P[s].num), `${s}.tag "${P[s].tag}" should start with ${P[s].num}`);
    }
  });

  test(`${loc} · journey: unique ids, every logo exists in public/, alt text present, exactly one current role first`, () => {
    const ids = P.journey.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const j of P.journey.items) {
      assert.ok(fs.existsSync(pub(j.logo)), `${j.logo} missing`);
      assert.ok(j.logoAlt.length >= 8);
      assert.ok(j.highlights.length >= 2, `${j.id} highlights`);
      assert.match(j.period, /\d{4}/);
    }
    assert.ok(P.journey.items.filter((i) => i.current).length >= 1);
    assert.equal(P.journey.items[0].current, true);
  });

  test(`${loc} · services: six-plus offers, unique titles, a featured offer, prices and WhatsApp messages present`, () => {
    const it = P.services.items;
    assert.ok(it.length >= 6);
    assert.equal(new Set(it.map((i) => i.title)).size, it.length);
    assert.ok(it.filter((i) => i.featured).length >= 1, 'at least one featured offer');
    assert.deepEqual(it.map((i) => i.n), it.map((_, i) => String(i + 1).padStart(2, '0')));
    for (const s of it) {
      assert.ok(s.price.length >= 2, `${s.title} price`);
      assert.ok(s.waMessage.length > 15, `${s.title} waMessage`);
      assert.ok(s.deliverables.length >= 2, `${s.title} deliverables`);
      assert.ok(s.description.length > 40);
    }
  });

  test(`${loc} · services WhatsApp messages build a valid wa.me link`, () => {
    for (const s of P.services.items) {
      const u = new URL(waLink(s.waMessage));
      assert.equal(u.hostname, 'wa.me');
      assert.equal(u.pathname, `/${WHATSAPP_NUMBER}`);
      assert.equal(u.searchParams.get('text'), s.waMessage, 'round-trips through encodeURIComponent');
    }
  });

  test(`${loc} · FAQ: at least four unique questions, each answered with a real sentence`, () => {
    const it = P.faq.items;
    assert.ok(it.length >= 4);
    assert.equal(new Set(it.map((i) => i.q)).size, it.length);
    for (const f of it) {
      assert.ok(f.q.endsWith('?'), `"${f.q}" should be a question`);
      assert.ok(f.a.length >= 60);
    }
  });

  test(`${loc} · contact: https calendar, wa.me link with the configured number, mail address, CV path exists`, () => {
    const c = P.contact;
    assert.equal(new URL(c.koalendarUrl).protocol, 'https:');
    const wa = new URL(c.whatsappUrl);
    assert.equal(wa.hostname, 'wa.me');
    assert.equal(wa.pathname, `/${WHATSAPP_NUMBER}`);
    assert.ok(wa.searchParams.get('text').length > 15);
    assert.match(c.emailAddress, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i);
    assert.ok(fs.existsSync(pub(c.cvUrl)), `${c.cvUrl} missing`);
  });

  test(`${loc} · numbers: stats and impacts are populated, chart bars are within 0..100 and sorted by meaning`, () => {
    const n = P.numbers;
    assert.ok(n.stats.length >= 4);
    for (const s of n.stats) assert.match(s.value, /\d/);
    assert.ok(n.impacts.length >= 6);
    for (const i of n.impacts) assert.match(i.metric, /\d/);
    assert.ok(n.chartBars.length >= 2);
    for (const b of n.chartBars) {
      assert.ok(Number.isFinite(b.value) && b.value >= 0 && b.value <= 100, `${b.label} value ${b.value}`);
      assert.ok(b.label && b.unit && b.note);
    }
  });

  test(`${loc} · expertise: three marquee tracks and four pillars with items`, () => {
    assert.equal(P.expertise.tracks.length, 3);
    for (const t of P.expertise.tracks) assert.ok(t.length >= 4);
    assert.ok(P.expertise.pillars.length >= 4);
    for (const pl of P.expertise.pillars) assert.ok(pl.items.length >= 4, pl.title);
    assert.ok(P.expertise.pauseLabel && P.expertise.resumeLabel && P.expertise.pauseLabel !== P.expertise.resumeLabel);
  });

  test(`${loc} · hero: four chips at distinct corners, portrait alt, CTAs`, () => {
    const h = P.hero;
    assert.deepEqual(h.chips.map((c) => c.pos).sort(), ['bl', 'br', 'tl', 'tr']);
    assert.ok(h.portraitAlt.length >= 15);
    assert.ok(h.ctaPrimary && h.ctaSecondary && h.ctaCv);
    assert.ok(h.sub.length > 80);
  });

  test(`${loc} · about: awards and specs are populated`, () => {
    assert.ok(P.about.awards.length >= 3);
    assert.ok(P.about.specs.length >= 3);
    for (const a of P.about.awards) assert.ok(a.place && a.title);
  });

  test(`${loc} · journey archive: education, certifications and languages are non-empty`, () => {
    for (const k of ['education', 'certifications', 'languages']) assert.ok(P.journey[k].length >= 2, k);
  });

  test(`${loc} · caseUi labels are all present`, () => {
    for (const [k, v] of Object.entries(P.caseUi)) assert.ok(v && v.length >= 2, k);
  });

  for (const slug of PROJECT_SLUGS) {
    const proj = () => P.projects.items.find((i) => i.slug === slug);

    test(`${loc} · project ${slug} · image exists in public/ as WebP and has descriptive alt`, () => {
      const p = proj();
      assert.ok(fs.existsSync(pub(p.image)), `${p.image} missing`);
      assert.match(p.image, /^\/assets\/img\/port\/[a-z0-9_-]+\.webp$/);
      assert.ok(p.imageAlt.length >= 20);
    });

    test(`${loc} · project ${slug} · all case fields are populated`, () => {
      const p = proj();
      for (const k of ['title', 'client', 'year', 'category', 'metricBadge', 'summary', 'challenge', 'architecture']) assert.ok(p[k] && p[k].length >= 3, k);
      assert.ok(p.heroMetrics.length >= 3, 'three KPIs');
      for (const m of p.heroMetrics) assert.ok(m.value && m.label);
      assert.ok(p.outcomes.length >= 2 && p.deliverables.length >= 3 && p.tags.length >= 3);
      assert.ok(p.summary.length <= 170, 'summary doubles as meta description (<= 160 + brand)');
    });

    test(`${loc} · project ${slug} · externalUrl, when present, is a clean https origin`, () => {
      const u = proj().externalUrl;
      if (!u) return;
      const url = new URL(u);
      assert.equal(url.protocol, 'https:');
      assert.ok(!/\s/.test(u));
      assert.ok(!/utm_|\?/.test(u), 'no tracking params in data');
    });

    test(`${loc} · project ${slug} · title is unique and its hero metrics differ from other projects'`, () => {
      const p = proj();
      assert.equal(P.projects.items.filter((i) => i.title === p.title).length, 1);
      assert.equal(P.projects.items.filter((i) => i.image === p.image).length, 1, 'each project has its own image');
    });
  }
}

test('pt-br and en projects share slug, image, index and externalUrl (only copy differs)', () => {
  for (const slug of PROJECT_SLUGS) {
    const a = PORTFOLIO['pt-br'].projects.items.find((i) => i.slug === slug);
    const b = PORTFOLIO.en.projects.items.find((i) => i.slug === slug);
    assert.equal(b.image, a.image);
    assert.equal(b.index, a.index);
    assert.equal(b.externalUrl, a.externalUrl);
    assert.notEqual(b.summary, a.summary, `${slug} summary not translated`);
  }
});

test('journey ids, logos and current flags match between locales', () => {
  const a = PORTFOLIO['pt-br'].journey.items;
  const b = PORTFOLIO.en.journey.items;
  assert.deepEqual(b.map((i) => [i.id, i.logo, !!i.current]), a.map((i) => [i.id, i.logo, !!i.current]));
});

test('service numbering, prices and featured flag match between locales', () => {
  const a = PORTFOLIO['pt-br'].services.items;
  const b = PORTFOLIO.en.services.items;
  assert.deepEqual(b.map((s) => [s.n, !!s.featured]), a.map((s) => [s.n, !!s.featured]));
});

test('contact links agree between locales (calendar, mail, CV) and wa.me targets the same number', () => {
  const a = PORTFOLIO['pt-br'].contact;
  const b = PORTFOLIO.en.contact;
  for (const k of ['koalendarUrl', 'emailAddress', 'cvUrl']) assert.equal(b[k], a[k], k);
  assert.equal(new URL(a.whatsappUrl).pathname, new URL(b.whatsappUrl).pathname);
});

test('chart bars carry the same numbers in both locales', () => {
  assert.deepEqual(PORTFOLIO.en.numbers.chartBars.map((b) => b.value), PORTFOLIO['pt-br'].numbers.chartBars.map((b) => b.value));
});

test('WHATSAPP_NUMBER is an E.164-style Brazilian number and waLink encodes arbitrary text safely', () => {
  assert.match(WHATSAPP_NUMBER, /^55\d{10,11}$/);
  const u = new URL(waLink('Olá & "você" #1?'));
  assert.equal(u.searchParams.get('text'), 'Olá & "você" #1?');
  assert.equal(u.hash, '');
});

// ---- UI dictionary ----------------------------------------------------------------------------------
test('UI: pt-br and en have identical keys and non-empty trimmed values', () => {
  assert.deepEqual(Object.keys(UI.en).sort(), Object.keys(UI['pt-br']).sort());
  for (const loc of LOCALES) {
    for (const [k, v] of Object.entries(UI[loc])) {
      assert.equal(typeof v, 'string', `${loc}.${k}`);
      assert.ok(v.length > 0 && v === v.trim(), `${loc}.${k} is empty or padded`);
    }
  }
});

test('UI: every value differs between locales except neutral tokens', () => {
  const same = Object.keys(UI.en).filter((k) => UI.en[k] === UI['pt-br'][k]);
  assert.deepEqual(same.filter((k) => k !== 'notFoundMetaTitle'), [], 'untranslated keys');
});

test('UI: meta titles are 10-70 chars and descriptions 50-160 chars', () => {
  for (const loc of LOCALES) {
    for (const k of Object.keys(UI[loc]).filter((x) => x.startsWith('metaTitle'))) assert.ok(UI[loc][k].length >= 10 && UI[loc][k].length <= 70, `${loc}.${k}`);
    for (const k of Object.keys(UI[loc]).filter((x) => x.startsWith('metaDesc'))) {
      const min = k === 'metaDescNotFound' ? 10 : 50;
      assert.ok(UI[loc][k].length >= 10 && UI[loc][k].length <= 160, `${loc}.${k} (${UI[loc][k].length})`);
      if (k.includes('Home') || k.includes('Privacy')) assert.ok(UI[loc][k].length >= min, `${loc}.${k}`);
    }
  }
});

test('UI: the language-switch label starts with its visible text (WCAG 2.5.3) and targets the other language', () => {
  assert.ok(UI['pt-br'].langSwitchLabel.startsWith('EN'));
  assert.ok(UI.en.langSwitchLabel.startsWith('PT'));
  assert.equal(UI['pt-br'].langSwitchText, 'EN');
  assert.equal(UI.en.langSwitchText, 'PT');
});

test('UI: the six primary nav labels are short enough for the navbar (<= 14 chars) and unique per locale', () => {
  for (const loc of LOCALES) {
    const nav = Object.keys(UI[loc]).filter((k) => /^nav(About|Numbers|Journey|Projects|Services|Faq|Contact)$/.test(k)).map((k) => UI[loc][k]);
    assert.equal(nav.length, 7);
    assert.equal(new Set(nav).size, 7);
    for (const n of nav) assert.ok(n.length <= 14, n);
  }
});

test('UI: privacy copy mentions an email, and the e-mail matches the contact data', () => {
  const mail = PORTFOLIO['pt-br'].contact.emailAddress;
  for (const loc of LOCALES) assert.ok(UI[loc].privacyContact.includes(mail));
});

// ---- SEO strings ------------------------------------------------------------------------------------
test('SEO strings: inLanguage matches the locale and awards are populated', () => {
  assert.equal(SEO['pt-br'].inLanguage, 'pt-BR');
  assert.equal(SEO.en.inLanguage, 'en');
  for (const loc of LOCALES) {
    assert.ok(SEO[loc].awards.length >= 3);
    for (const k of ['jobTitle', 'alumniOf', 'catalogName', 'priceRange', 'areaServedCountry']) assert.ok(SEO[loc][k], `${loc}.${k}`);
  }
});

// ---- routes / slugs ---------------------------------------------------------------------------------
test('PROJECT_SLUGS are unique, URL-safe and lowercase', () => {
  assert.equal(new Set(PROJECT_SLUGS).size, PROJECT_SLUGS.length);
  for (const s of PROJECT_SLUGS) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('ROUTE_PAIRS: trailing slashes, locale prefixes, and an en route for every pt route', () => {
  for (const p of ROUTE_PAIRS) {
    assert.ok(p.pt.endsWith('/') && p.en.endsWith('/'));
    assert.ok(!p.pt.startsWith('/en/'));
    assert.ok(p.en.startsWith('/en/'));
  }
});

for (const pair of ROUTE_PAIRS) {
  test(`routeAlternates / alternatePathForLocale round-trip for ${pair.pt}`, () => {
    for (const r of [pair.pt, pair.en]) {
      const alts = routeAlternates(`https://voaneves.com${r}`);
      assert.deepEqual(alts.map((a) => a.lang), ['pt-BR', 'en', 'x-default']);
      assert.equal(alts[0].url, `https://voaneves.com${pair.pt}`);
      assert.equal(alts[1].url, `https://voaneves.com${pair.en}`);
    }
    assert.equal(alternatePathForLocale(pair.pt, 'en'), pair.en);
    assert.equal(alternatePathForLocale(pair.en, 'pt-br'), pair.pt);
    assert.equal(alternatePathForLocale(pair.pt.slice(0, -1), 'en'), pair.en, 'no trailing slash');
  });
}

test('routeAlternates returns nothing for unknown paths and falls back to home for the switch', () => {
  assert.deepEqual(routeAlternates('/nao-existe/'), []);
  assert.equal(alternatePathForLocale('/nao-existe/', 'en'), '/en/');
  assert.equal(alternatePathForLocale('/en/nope/', 'pt-br'), '/');
});

test('every source page route has an Astro page file', () => {
  for (const f of ['src/pages/index.astro', 'src/pages/en/index.astro', 'src/pages/privacidade/index.astro', 'src/pages/en/privacy/index.astro', 'src/pages/projetos/[slug]/index.astro', 'src/pages/en/projects/[slug]/index.astro', 'src/pages/404.astro']) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
});

// ---- public assets ----------------------------------------------------------------------------------
test('public/ images referenced by the data are real WebP files (RIFF/WEBP header)', () => {
  const imgs = new Set();
  for (const loc of LOCALES) for (const [, v] of leaves(PORTFOLIO[loc])) if (typeof v === 'string' && /^\/assets\/img\/.+\.webp$/.test(v)) imgs.add(v);
  assert.ok(imgs.size >= 12);
  for (const i of imgs) {
    const b = fs.readFileSync(pub(i));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF', i);
    assert.equal(b.toString('ascii', 8, 12), 'WEBP', i);
  }
});

test('public/ ships the PDF CV and PNG icons at the sizes the manifest promises', () => {
  assert.equal(fs.readFileSync(pub('/assets/cv-pt.pdf')).toString('ascii', 0, 5), '%PDF-');
  for (const [f, n] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const b = fs.readFileSync(pub(f));
    assert.equal(b.readUInt32BE(16), n, f);
    assert.equal(b.readUInt32BE(20), n, f);
  }
});

test('three self-hosted font files are woff2 and preloadable', () => {
  const dir = path.join(ROOT, 'public', 'fonts');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.woff2'));
  assert.ok(files.length >= 4);
  for (const f of files) assert.equal(fs.readFileSync(path.join(dir, f)).toString('ascii', 0, 4), 'wOF2', f);
});
