// Referenzwerte aus dem echten Spiel: Fruchtfolgeplaner der Crop-Rotation-Mod (Screenshot img.png, Gülzow).
// Die Fruchtfolge ist ein Kreis: für Position i sind letzte Frucht = Position i-1, vorletzte = Position i-2.
const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/data.json');
const calc = require('../src/calc.js');

const OS = 'OILSEEDRADISH';
const felder = {
  'Feld 005': [['WHEAT', null, 90], ['WHEAT', null, 70], ['OAT', OS, 140]],
  'Feld 033': [['CANOLA', null, 120], ['WHEAT', null, 120], ['OAT', OS, 135]],
  'Feld 036': [['POTATO', null, 115], ['WHEAT', null, 120], ['OAT', OS, 135]],
  'Feld 035': [['RYE', null, 125], ['OAT', null, 95], ['OAT', OS, 90]],
  'Feld 004': [['SORGHUM', null, 120], ['ALFALFA', null, 100], ['OAT', OS, 130]],
};

for (const [feld, rot] of Object.entries(felder)) {
  test(`Spielwerte ${feld}: Fruchtfolgeplaner stimmt mit dem Rechenkern überein`, () => {
    const n = rot.length;
    rot.forEach(([cropName, catchCrop, spiel], i) => {
      const last = rot[(i + n - 1) % n][0];
      const prev = rot[(i + n - 2) % n][0];
      const mine = Math.round(calc.rotationFactor(data, { cropName, last, prev, catchCrop }) * 100);
      assert.equal(mine, spiel, `${feld} Position ${i + 1} (${cropName}): Spiel ${spiel} %, berechnet ${mine} %`);
    });
  });
}

test('Namen wie im Spiel: Weizen und Hirse', () => {
  const label = (n) => data.crops.find((c) => c.name === n).label;
  assert.equal(label('WHEAT'), 'Weizen');
  assert.equal(label('SORGHUM'), 'Hirse');
  assert.equal(label('CANOLA'), 'Raps');
  assert.equal(label('ALFALFA'), 'Luzerne');
});
