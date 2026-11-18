// aboutTimeline(): the 3 "Quem sou" timeline nodes derived from existing portfolio data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './lib/ts-load.mjs';

const { PORTFOLIO } = await loadTs('src/data/portfolio.ts');
const { aboutTimeline, splitPeriod, joinPeriod, yearRange } = await loadTs('src/data/about-timeline.ts');

/** Deep copy of a locale's content with `edit` applied, so a test can break one input without touching the real data. */
const variant = (locale, edit) => {
  const c = structuredClone(PORTFOLIO[locale]);
  edit(c);
  return c;
};
const item = (c, id) => c.journey.items.find((i) => i.id === id);

const EXPECTED = {
  'pt-br': { aleto: 'Mar 2026 — Atual', sebrae: 'Set 2022 — Mar 2026' },
  en: { aleto: 'Mar 2026 — Present', sebrae: 'Sep 2022 — Mar 2026' },
};

for (const [locale, exp] of Object.entries(EXPECTED)) {
  test(`aboutTimeline (${locale}): 3 nodes with the expected facts`, () => {
    const t = aboutTimeline(PORTFOLIO[locale]);
    assert.equal(t.length, 3);
    assert.deepEqual(t.map((n) => n.org), ['ALETO', 'SEBRAE Tocantins', 'DIO']);
    assert.deepEqual(t.map((n) => n.period), [exp.aleto, exp.sebrae, '2023 — 2025']);
    assert.equal(t[0].current, true);
    for (const n of t) {
      assert.ok(n.sub.length > 0);
      for (const s of n.sub) assert.ok(s.trim().length > 0);
    }
  });
}

test('aboutTimeline: same number of sub-items in pt-br and en', () => {
  const pt = aboutTimeline(PORTFOLIO['pt-br']);
  const en = aboutTimeline(PORTFOLIO.en);
  assert.deepEqual(pt.map((n) => n.sub.length), en.map((n) => n.sub.length));
});

test('aboutTimeline: pt-br and en agree on the shape (orgs, current flag, DIO period, no empty text)', () => {
  const pt = aboutTimeline(PORTFOLIO['pt-br']);
  const en = aboutTimeline(PORTFOLIO.en);
  assert.deepEqual(pt.map((n) => n.org), en.map((n) => n.org));
  assert.deepEqual(pt.map((n) => Boolean(n.current)), en.map((n) => Boolean(n.current)));
  assert.equal(pt[2].period, en[2].period);
  for (const n of [...pt, ...en]) assert.ok(n.period.trim().length > 0, `${n.org} has an empty period`);
});

test('aboutTimeline: `current` is set only on the ALETO node, taken from the journey item', () => {
  for (const locale of ['pt-br', 'en']) {
    const t = aboutTimeline(PORTFOLIO[locale]);
    assert.deepEqual(t.map((n) => Boolean(n.current)), [true, false, false]);
    const off = aboutTimeline(variant(locale, (c) => { item(c, 'aleto').current = false; }));
    assert.equal(Boolean(off[0].current), false, 'follows the data, not a constant');
    // a current flag on the SEBRAE journey items must not leak into the SEBRAE node
    const leak = aboutTimeline(variant(locale, (c) => { item(c, 'sebrae-uge').current = true; item(c, 'sebrae-ali').current = true; }));
    assert.equal(Boolean(leak[1].current), false);
  }
});

test('splitPeriod / joinPeriod: with, without and with odd separators', () => {
  assert.deepEqual(splitPeriod('Set 2022 — Out 2024'), { start: 'Set 2022', end: 'Out 2024' });
  assert.deepEqual(splitPeriod('Set 2022 – Out 2024'), { start: 'Set 2022', end: 'Out 2024' });
  assert.deepEqual(splitPeriod('Set 2022 - Out 2024'), { start: 'Set 2022', end: 'Out 2024' });
  assert.deepEqual(splitPeriod('  Set 2022 —  Out 2024 '), { start: 'Set 2022', end: 'Out 2024' });
  assert.deepEqual(splitPeriod('Set 2022'), { start: 'Set 2022', end: 'Set 2022' }, 'no separator: the whole text on both sides');
  assert.deepEqual(splitPeriod('Jan-Mar 2022'), { start: 'Jan-Mar 2022', end: 'Jan-Mar 2022' }, 'a hyphen without spaces is not a separator');
  assert.deepEqual(splitPeriod(''), { start: '', end: '' });
  assert.equal(joinPeriod('A', 'B'), 'A — B');
  assert.equal(joinPeriod('A', 'A'), 'A');
  assert.equal(joinPeriod('A', ''), 'A');
  assert.equal(joinPeriod('', 'B'), 'B');
  assert.equal(joinPeriod('', ''), '');
});

test('aboutTimeline: SEBRAE period survives journey periods without the separator (defined fallback, no "undefined")', () => {
  for (const locale of ['pt-br', 'en']) {
    const both = aboutTimeline(variant(locale, (c) => { item(c, 'sebrae-ali').period = 'Set 2022'; item(c, 'sebrae-uge').period = 'Mar 2026'; }));
    assert.equal(both[1].period, 'Set 2022 — Mar 2026');
    const oneOpen = aboutTimeline(variant(locale, (c) => { item(c, 'sebrae-uge').period = 'Out 2024'; }));
    assert.ok(oneOpen[1].period.endsWith('Out 2024'), oneOpen[1].period);
    const empty = aboutTimeline(variant(locale, (c) => { item(c, 'sebrae-ali').period = ''; item(c, 'sebrae-uge').period = ''; }));
    assert.equal(empty[1].period, '');
    for (const n of [both[1], oneOpen[1], empty[1]]) assert.ok(!/undefined|NaN/.test(n.period), n.period);
  }
});

test('yearRange: years in the texts, a single year, no years', () => {
  assert.equal(yearRange(['Santander Bootcamp 2025', 'Santander Bootcamp 2023', 'Bootcamp Nexa 2024']), '2023 — 2025');
  assert.equal(yearRange(['Bootcamp 2024', 'Outro 2024']), '2024');
  assert.equal(yearRange(['Bootcamp Nexa', 'Sem ano']), '');
  assert.equal(yearRange([]), '');
  assert.equal(yearRange(['Turma 12023 e 20245']), '', 'digits glued to other digits are not years');
});

test('aboutTimeline: DIO awards without years give an empty period, and no DIO awards give an empty sub', () => {
  for (const locale of ['pt-br', 'en']) {
    const noYears = aboutTimeline(variant(locale, (c) => {
      for (const a of c.about.awards) if (a.meta.endsWith('DIO')) a.title = a.title.replace(/\b20\d\d\b/g, '').trim();
    }));
    assert.equal(noYears[2].org, 'DIO');
    assert.equal(noYears[2].period, '');
    assert.ok(noYears[2].sub.length > 0, 'the summary does not depend on the years');
    const noDio = aboutTimeline(variant(locale, (c) => { c.about.awards = c.about.awards.filter((a) => !a.meta.endsWith('DIO')); }));
    assert.equal(noDio[2].period, '');
    assert.deepEqual(noDio[2].sub, []);
  }
});

test('aboutTimeline: a missing journey item fails loudly', () => {
  assert.throws(() => aboutTimeline(variant('pt-br', (c) => { c.journey.items = c.journey.items.filter((i) => i.id !== 'aleto'); })), /journey item "aleto" not found/);
});
