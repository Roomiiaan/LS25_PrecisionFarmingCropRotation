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
