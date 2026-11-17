// aboutTimeline(): the 3 "Quem sou" timeline nodes derived from existing portfolio data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './lib/ts-load.mjs';

const { PORTFOLIO } = await loadTs('src/data/portfolio.ts');
const { aboutTimeline } = await loadTs('src/data/about-timeline.ts');

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
