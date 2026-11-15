const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/data.json');
const CatchPlan = require('../src/catchplan.js');

const base = { last: 'WHEAT', prev: 'WHEAT', catchCrop: null, soilIndexes: [], nitrogen: null, ph: null };
const card = (plan, name) => plan.cards.find((c) => c.catchCrop.name === name);

test('Karten nur für jetzt säbare Zwischenfrüchte', () => {
  const winter = CatchPlan.buildCatchPlan(data, { ...base, period: 'EARLY_WINTER' });
  assert.deepEqual(winter.cards, []);            // Dezember: nichts säbar, kein Fehler
  const herbst = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' });
  assert.ok(card(herbst, 'OILSEEDRADISH'));
  assert.equal(card(herbst, 'FLOWERINGCATCHCROP'), undefined); // Blühende nur bis September
});

test('Ölrettich im Juli: gewachsen im September, Hafer im März mit +15 % (Spielwert 140 %)', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SUMMER' }), 'OILSEEDRADISH');
  assert.equal(c.readyPeriod, 'EARLY_AUTUMN');
  assert.equal(c.readyAfter, 2);
  assert.equal(c.readyWrapsYear, false);
  const hafer = c.sowable.find((s) => s.row.crop.name === 'OAT');
  assert.equal(hafer.sowPeriod, 'EARLY_SPRING');
  assert.equal(hafer.delayMonths, 8);
  assert.equal(hafer.wrapsYear, true);
  assert.equal(Math.round(hafer.row.factors.total * 100), 140);
});

test('Ölrettich im Oktober wächst im Winter nicht weiter: gewachsen erst im März (nächstes Jahr)', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' }), 'OILSEEDRADISH');
  assert.equal(c.readyPeriod, 'EARLY_SPRING');
  assert.equal(c.readyAfter, 5);
  assert.equal(c.readyWrapsYear, true);
});

test('sowable ist absteigend nach Ertrag sortiert; best ist der erste Eintrag', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SUMMER' }), 'OILSEEDRADISH');
  const t = c.sowable.map((s) => s.row.factors.total);
  assert.deepEqual(t, [...t].sort((a, b) => b - a));
  assert.equal(c.best, c.sowable[0]);
});

test('Senf verdorrt: Frucht, die erst nach dem Zeitraum säbar wird, steht unter blocked', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SPRING' }), 'MUSTARD');
  // Senf April gesät: gewachsen Juli, Zeitraum Juli–November (readyFor 5). Hafer (Saat Mär–Apr) liegt außerhalb.
  assert.ok(c.blocked.some((r) => r.crop.name === 'OAT'));
  assert.ok(!c.sowable.some((s) => s.row.crop.name === 'OAT'));
});

test('verdict und gain gegen direktes Säen', () => {
  const plan = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SUMMER' });
  assert.ok(plan.direct);
  for (const c of plan.cards) {
    if (!c.best) { assert.equal(c.verdict, 'none'); assert.equal(c.gain, null); continue; }
    const d = c.best.row.factors.total - plan.direct.factors.total;
    assert.equal(c.gain, d);
    assert.equal(c.verdict, d > 0.005 ? 'better' : 'notBetter');
  }
});

test('Mehrere Bodenarten und leere Vorfrüchte werfen nicht', () => {
  const plan = CatchPlan.buildCatchPlan(data, { last: null, prev: null, catchCrop: null, period: 'MID_SPRING', soilIndexes: [1, 3], nitrogen: 100, ph: 6.5 });
  assert.ok(plan.cards.length > 0);
  for (const c of plan.cards) for (const s of c.sowable) assert.ok(Number.isFinite(s.row.factors.total));
});

test('Direktvergleich rechnet die Zwischenfrucht aus dem Dropdown nicht mit ein', () => {
  const ohne = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SUMMER' });
  const mit = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SUMMER', catchCrop: 'OILSEEDRADISH' });
  assert.equal(mit.direct.crop.name, ohne.direct.crop.name);
  assert.equal(mit.direct.factors.total, ohne.direct.factors.total);
});

test('Saat im übernächsten Jahr wird als solche erkannt', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'EARLY_AUTUMN' }), 'FLOWERINGCATCHCROP');
  assert.equal(c.readyYearsAhead, 1); // September + 10 Monate = Juli nächstes Jahr
  assert.ok(c.sowable.some((s) => s.yearsAhead === 2));
  for (const s of c.sowable) assert.equal(s.wrapsYear, s.yearsAhead > 0);
});
