const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/data.json');
const calc = require('../src/calc.js');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} erwartet ${b}, war ${a}`);

test('Winterweizen nach Sojabohne (sehr gut) und Erbse (sehr gut) = 1,25', () => {
  near(calc.rotationFactor(data, { cropName: 'WINTERWHEAT', last: 'SOYBEAN', prev: 'PEA', catchCrop: null }), 1.25);
});

test('Winterweizen nach Winterweizen zweimal: Monokultur, Anbaupause, schlechte Vorfrüchte = 0,4', () => {
  near(calc.rotationFactor(data, { cropName: 'WINTERWHEAT', last: 'WINTERWHEAT', prev: 'WINTERWHEAT', catchCrop: null }), 0.4);
});

test('Brache in beiden Slots gibt +10 % und zählt nicht als Frucht', () => {
  near(calc.rotationFactor(data, { cropName: 'WINTERWHEAT', last: 'FALLOW', prev: 'FALLOW', catchCrop: null }), 1.1);
});

test('Zwischenfrucht Senf vor Mais (sehr gut) = 1,15', () => {
  near(calc.rotationFactor(data, { cropName: 'MAIZE', last: null, prev: null, catchCrop: 'MUSTARD' }), 1.15);
});

test('Unbekannte Frucht ergibt 1,0', () => {
  near(calc.rotationFactor(data, { cropName: 'GIBTESNICHT', last: 'WHEAT', prev: null, catchCrop: null }), 1.0);
});

test('Weizen nach Weizen und Gerste: Monokultur gilt nur, wenn beide Slots gleich sind', () => {
  // WINTERWHEAT: last=WINTERWHEAT (schlecht -0,25, Pause -0,1), prev=BARLEY (gut +0,05) -> 0,7
  near(calc.rotationFactor(data, { cropName: 'WINTERWHEAT', last: 'WINTERWHEAT', prev: 'BARLEY', catchCrop: null }), 0.7);
});

// ---- Precision Farming
test('soilFactor: Bodenart 3 = 1,25, ohne Eingabe = 1', () => {
  near(calc.soilFactor(data, 3), 1.25);
  near(calc.soilFactor(data, null), 1);
});

test('nitrogenFactor: Zielwert = 1,0, 20 kg darunter = 0,90', () => {
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: 180 }), 1.0);
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: 160 }), 0.9);
});

test('nitrogenFactor: Extremwerte klemmen auf Tabellenrand, kein NaN', () => {
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: 999 }), 0.79);
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: 0 }), 0.01);
});

test('nitrogenFactor: Kartoffeln ignorieren Überdüngung', () => {
  near(calc.nitrogenFactor(data, { cropName: 'POTATO', soilIndex: 2, nitrogen: 400 }), 1.0);
});

test('nitrogenFactor: Winterweizen nutzt die Werte von Weizen', () => {
  near(calc.nitrogenFactor(data, { cropName: 'WINTERWHEAT', soilIndex: 2, nitrogen: 160 }), 0.9);
});

test('nitrogenFactor: fehlende Eingabe oder unbekannte Frucht = 1,0', () => {
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: null, nitrogen: 100 }), 1);
  near(calc.nitrogenFactor(data, { cropName: 'WHEAT', soilIndex: 2, nitrogen: null }), 1);
  near(calc.nitrogenFactor(data, { cropName: 'SPELT', soilIndex: 2, nitrogen: 100 }), 1);
});

test('phFactor: Optimum = 1, 3 Stufen darunter = 0,9, Zwischenwert wird interpoliert', () => {
  near(calc.phFactor(data, { soilIndex: 2, ph: 6.5 }), 1);
  near(calc.phFactor(data, { soilIndex: 2, ph: 6.125 }), 0.9);
  near(calc.phFactor(data, { soilIndex: 2, ph: 7.0 }), 0.9);
});

test('phFactor: extremer pH bleibt endlich, ohne Eingabe = 1', () => {
  const f = calc.phFactor(data, { soilIndex: 2, ph: 3 });
  assert.ok(Number.isFinite(f) && f >= 0 && f <= 1);
  near(calc.phFactor(data, { soilIndex: 2, ph: null }), 1);
  near(calc.phFactor(data, { soilIndex: null, ph: 6 }), 1);
});

test('totalFactor ohne PF-Eingaben = Fruchtfolge-Faktor', () => {
  const input = { cropName: 'WINTERWHEAT', last: 'SOYBEAN', prev: 'PEA', catchCrop: null, soilIndex: null, nitrogen: null, ph: null };
  const r = calc.totalFactor(data, input);
  near(r.total, r.rotation);
  near(r.total, 1.25);
  near(r.litersPerHa, 0.525 * 10000 * 1.25);
});

test('totalFactor multipliziert Fruchtfolge, Boden, Stickstoff und pH', () => {
  const input = { cropName: 'WINTERWHEAT', last: 'SOYBEAN', prev: 'PEA', catchCrop: null, soilIndex: 3, nitrogen: 200, ph: 6.75 };
  near(calc.totalFactor(data, input).total, 1.25 * 1.25);
});

test('totalFactor meldet, ob für die Frucht Stickstoffwerte vorliegen', () => {
  const base = { last: null, prev: null, catchCrop: null, soilIndex: 2, nitrogen: 150, ph: null };
  assert.equal(calc.totalFactor(data, { ...base, cropName: 'WINTERWHEAT' }).nitrogenKnown, true);
  assert.equal(calc.totalFactor(data, { ...base, cropName: 'RYE' }).nitrogenKnown, false);
});
