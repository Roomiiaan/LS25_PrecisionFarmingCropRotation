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

test('firstHarvestPeriod: Winterweizen = Frühsommer, Fenster über Jahreswechsel beginnt am Anfang', () => {
  assert.equal(cal.firstHarvestPeriod(crop('WINTERWHEAT')), 'EARLY_SUMMER');
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
