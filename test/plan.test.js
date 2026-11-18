const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/data.json');
const cal = require('../src/calendar.js');
const { buildPlan } = require('../src/plan.js');

const crop = (n) => data.crops.find((c) => c.name === n);

test('periodLabel: Spielperiode wird deutscher Monat', () => {
  assert.equal(cal.periodLabel('EARLY_SPRING'), 'März');
  assert.equal(cal.periodLabel('MID_WINTER'), 'Januar');
  assert.equal(cal.periodShort('LATE_AUTUMN'), 'Nov');
  assert.equal(cal.PERIODS.length, 12);
  assert.equal(cal.MONTH_ORDER[0], 'MID_WINTER');
  assert.equal(cal.MONTH_ORDER[11], 'EARLY_WINTER');
});

test('isPlantable: Winterweizen im Herbst ja, im Frühling nein', () => {
  assert.equal(cal.isPlantable(crop('WINTERWHEAT'), 'MID_AUTUMN'), true);
  assert.equal(cal.isPlantable(crop('WINTERWHEAT'), 'MID_SPRING'), false);
});

test('isPlantable: Saatfenster über den Jahreswechsel (Sommerweizen Spätwinter und Frühfrühling)', () => {
  assert.equal(cal.isPlantable(crop('WHEAT'), 'LATE_WINTER'), true);
  assert.equal(cal.isPlantable(crop('WHEAT'), 'EARLY_SPRING'), true);
});

test('isPlantable: Frucht ohne Saatfenster ist nie säbar und wirft nicht', () => {
  assert.equal(cal.isPlantable({ plantingPeriods: [] }, 'EARLY_SPRING'), false);
});

test('firstHarvestPeriod: Winterweizen = Hochsommer, Fenster über Jahreswechsel beginnt am Anfang', () => {
  assert.equal(cal.firstHarvestPeriod(crop('WINTERWHEAT')), 'MID_SUMMER');
  assert.equal(cal.firstHarvestPeriod({ harvestPeriods: ['EARLY_SPRING', 'LATE_WINTER'] }), 'LATE_WINTER');
  assert.equal(cal.firstHarvestPeriod({ harvestPeriods: [] }), null);
});

test('formatWindow: Bereiche, Einzelmonate und Jahreswechsel', () => {
  assert.equal(cal.formatWindow(['EARLY_AUTUMN', 'MID_AUTUMN']), 'Sep–Okt');
  assert.equal(cal.formatWindow(['MID_SUMMER']), 'Jul');
  assert.equal(cal.formatWindow(['LATE_WINTER', 'EARLY_SPRING']), 'Feb–Mär');
  assert.equal(cal.formatWindow([]), '–');
});

test('buildPlan: säbare zuerst, innerhalb nach Ertrag absteigend, keine Gras-Früchte', () => {
  const rows = buildPlan(data, { last: 'SOYBEAN', prev: 'PEA', catchCrop: null, period: 'MID_AUTUMN', soilIndex: null, nitrogen: null, ph: null });
  const firstNo = rows.findIndex((r) => !r.plantable);
  assert.ok(firstNo > 0 && rows.slice(firstNo).every((r) => !r.plantable));
  const yes = rows.slice(0, firstNo);
  for (let i = 1; i < yes.length; i++) assert.ok(yes[i - 1].factors.total >= yes[i].factors.total);
  assert.ok(!rows.some((r) => ['GRASS', 'MEADOW', 'FIELDGRASS', 'SUGARCANE', 'POPLAR'].includes(r.crop.name)));
  const ww = rows.find((r) => r.crop.name === 'WINTERWHEAT');
  assert.equal(ww.plantable, true);
  assert.ok(Math.abs(ww.factors.total - 1.25) < 1e-9);
  assert.equal(ww.plantingLabel, 'Sep–Okt');
});

test('buildPlan: Monokultur (gleiche Frucht zweimal) ergibt Malus ohne Absturz', () => {
  const rows = buildPlan(data, { last: 'WINTERWHEAT', prev: 'WINTERWHEAT', catchCrop: null, period: 'MID_AUTUMN', soilIndex: 2, nitrogen: 9999, ph: 2 });
  const ww = rows.find((r) => r.crop.name === 'WINTERWHEAT');
  assert.ok(Number.isFinite(ww.factors.total) && ww.factors.total < 1);
});

test('yieldLevel: Stufen nach angezeigtem Prozentwert (grün ab 100, gelb ab 90, orange ab 75, sonst rot)', () => {
  const { yieldLevel } = require('../src/plan.js');
  assert.equal(yieldLevel(1.6), 'good');
  assert.equal(yieldLevel(1.0), 'good');
  assert.equal(yieldLevel(0.996), 'good'); // wird als 100 % angezeigt
  assert.equal(yieldLevel(0.99), 'ok');
  assert.equal(yieldLevel(0.9), 'ok');
  assert.equal(yieldLevel(0.89), 'warn');
  assert.equal(yieldLevel(0.75), 'warn');
  assert.equal(yieldLevel(0.74), 'bad');
  assert.equal(yieldLevel(0), 'bad');
});

// ---- Mehrere Bodenarten mit eigenen Werten und Flächenanteilen
const calcMod = require('../src/calc.js');
const { soilWeights } = require('../src/plan.js');
const baseIn = { last: 'BARLEY', prev: 'WINTERWHEAT', catchCrop: null, period: 'EARLY_SPRING' };
const rowOf = (rows, n) => rows.find((r) => r.crop.name === n);
const tot = (soilIndex, nitrogen, ph) => calcMod.totalFactor(data, { ...baseIn, cropName: 'WHEAT', soilIndex, nitrogen, ph }).total;

test('alte Eingabeform (soilIndexes + gemeinsames pH/N) rechnet wie soils mit einer Bodenart', () => {
  const a = rowOf(buildPlan(data, { ...baseIn, soilIndexes: [2], nitrogen: 150, ph: 6.25 }), 'WHEAT');
  const b = rowOf(buildPlan(data, { ...baseIn, soils: [{ index: 2, nitrogen: 150, ph: 6.25 }] }), 'WHEAT');
  assert.ok(Math.abs(a.factors.total - b.factors.total) < 1e-9);
  assert.ok(Math.abs(a.factors.total - tot(2, 150, 6.25)) < 1e-9);
});

test('keine Bodenart: nur Fruchtfolge', () => {
  const r = rowOf(buildPlan(data, { ...baseIn, soils: [] }), 'WHEAT');
  assert.ok(Math.abs(r.factors.total - r.factors.rotation) < 1e-9);
});

test('zwei Bodenarten: jede mit eigenem pH/N, Gesamtwert nach Flächenanteil gewichtet', () => {
  const r = rowOf(buildPlan(data, { ...baseIn, soils: [
    { index: 1, share: 70, ph: 6.0, nitrogen: 100 },
    { index: 3, share: 30, ph: 7.0, nitrogen: 200 },
  ] }), 'WHEAT');
  const t1 = tot(1, 100, 6.0), t3 = tot(3, 200, 7.0);
  assert.ok(Math.abs(t1 - t3) > 1e-6);
  assert.ok(Math.abs(r.factors.total - (0.7 * t1 + 0.3 * t3)) < 1e-9);
  assert.equal(r.perSoil.length, 2);
  assert.equal(r.range, undefined);
});

test('Anteile ohne Angabe: gleich gewichtet; leeres pH/N wird für die Bodenart nicht mitgerechnet', () => {
  const r = rowOf(buildPlan(data, { ...baseIn, soils: [
    { index: 1, share: null, ph: null, nitrogen: null },
    { index: 3, share: null, ph: 7.0, nitrogen: null },
  ] }), 'WHEAT');
  assert.ok(Math.abs(r.factors.total - (tot(1, null, null) + tot(3, null, 7.0)) / 2) < 1e-9);
});

test('soilWeights: Normierung, Rest auf fehlende Anteile, alles leer = gleich', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
  near(soilWeights([{ share: 50 }, { share: 50 }])[0], 0.5);
  near(soilWeights([{ share: 30 }, { share: 30 }])[0], 0.5); // Summe 60 -> proportional
  const m = soilWeights([{ share: 40 }, { share: null }, { share: null }]); // Rest 60 geteilt
  near(m[0], 0.4); near(m[1], 0.3); near(m[2], 0.3);
  near(soilWeights([{ share: null }, { share: 0 }])[0], 0.5);
});

test('Sortierung nach gewichtetem Wert, säbare zuerst, auch bei mehreren Bodenarten', () => {
  const rows = buildPlan(data, { ...baseIn, period: 'MID_AUTUMN', soils: [{ index: 1, share: 50 }, { index: 3, share: 50 }] });
  const firstNo = rows.findIndex((r) => !r.plantable);
  const yes = firstNo < 0 ? rows : rows.slice(0, firstNo);
  for (let i = 1; i < yes.length; i++) assert.ok(yes[i - 1].factors.total >= yes[i].factors.total);
});

test('shiftPeriod: Monate später, zyklisch', () => {
  assert.equal(cal.shiftPeriod('MID_SPRING', 3), 'MID_SUMMER');
  assert.equal(cal.shiftPeriod('MID_AUTUMN', 2), 'EARLY_WINTER');
  assert.equal(cal.shiftPeriod('MID_AUTUMN', 5), 'EARLY_SPRING');
  assert.equal(cal.shiftPeriod('LATE_WINTER', 0), 'LATE_WINTER');
});

test('wrapsYear: Verschiebung ins nächste Kalenderjahr (Jan–Dez)', () => {
  assert.equal(cal.wrapsYear('MID_SPRING', 3), false);   // April + 3 = Juli
  assert.equal(cal.wrapsYear('MID_AUTUMN', 2), false);   // Oktober + 2 = Dezember
  assert.equal(cal.wrapsYear('MID_AUTUMN', 5), true);    // Oktober + 5 = März
  assert.equal(cal.wrapsYear('EARLY_SPRING', 12), true);
});

test('yearsAhead: Zahl der Jahreswechsel (Jan–Dez)', () => {
  assert.equal(cal.yearsAhead('MID_SPRING', 3), 0);
  assert.equal(cal.yearsAhead('MID_AUTUMN', 5), 1);
  assert.equal(cal.yearsAhead('EARLY_AUTUMN', 17), 2); // September + 17 Monate = Februar im übernächsten Jahr
  assert.equal(cal.yearsAhead('EARLY_AUTUMN', 10), 1);
});

test('formatWait: Wartezeit in Monaten und Jahren', () => {
  assert.equal(cal.formatWait(0), 'sofort');
  assert.equal(cal.formatWait(1), 'in 1 Monat');
  assert.equal(cal.formatWait(5), 'in 5 Monaten');
  assert.equal(cal.formatWait(12), 'in 1 Jahr');
  assert.equal(cal.formatWait(15), 'in 1 Jahr 3 Monaten');
  assert.equal(cal.formatWait(13), 'in 1 Jahr 1 Monat');
  assert.equal(cal.formatWait(24), 'in 2 Jahren');
  assert.equal(cal.formatWait(26), 'in 2 Jahren 2 Monaten');
});

// ---- Stickstoff-Ziel und Zwischenfrucht-Bonus
test('nitrogenTarget: Weizen auf Sandigem Lehm will 180, Sorten ohne PF-Werte nutzen die Art, Ölrettich braucht 0', () => {
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'WHEAT', soilIndex: 2 }).target, 180);
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'WINTERWHEAT', soilIndex: 3 }).target, 200);
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'OILSEEDRADISH', soilIndex: 2 }).target, 0);
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'WHEAT', soilIndex: null }), null);
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'SPELT', soilIndex: 2 }), null);
  assert.equal(calcMod.nitrogenTarget(data, { cropName: 'POTATO', soilIndex: 2 }).ignoreOver, true);
});

test('Zwischenfrucht untergearbeitet: +25 N werden zum eingegebenen Wert gerechnet und von der Düngung abgezogen', () => {
  const soils = [{ index: 2, nitrogen: 150 }];
  const adv = (extra) => rowOf(buildPlan(data, { ...baseIn, ...extra, soils }), 'WHEAT').perSoil[0].advice;
  assert.equal(adv({ catchCrop: 'OILSEEDRADISH', catchWorked: false }).need, 30);   // 180 - 150
  const w = adv({ catchCrop: 'OILSEEDRADISH', catchWorked: true });
  assert.equal(w.need, 5);                                                            // 180 - 175
  assert.equal(w.nitrogen, 175);
  assert.equal(w.bonus, 25);
  assert.equal(adv({ catchCrop: null, catchWorked: true }).need, 30);                 // ohne Zwischenfrucht kein Bonus
  assert.equal(rowOf(buildPlan(data, { ...baseIn, soils: [{ index: 2 }] }), 'WHEAT').perSoil[0].advice, null); // ohne N-Wert keine Empfehlung
});

test('Überdüngung: need ist negativ, Ertragsfaktor nutzt den Wert inklusive Bonus', () => {
  const soils = [{ index: 2, nitrogen: 170 }];
  const without = rowOf(buildPlan(data, { ...baseIn, catchCrop: 'OILSEEDRADISH', catchWorked: false, soils }), 'WHEAT');
  const withB = rowOf(buildPlan(data, { ...baseIn, catchCrop: 'OILSEEDRADISH', catchWorked: true, soils }), 'WHEAT');
  assert.equal(withB.perSoil[0].advice.need, -15);
  assert.ok(withB.factors.nitrogen < 1 && without.factors.nitrogen < 1);
  assert.ok(Math.abs(withB.factors.nitrogen - calcMod.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: 195 })) < 1e-9);
});
