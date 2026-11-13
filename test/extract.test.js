const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'data.json'), 'utf8'));
const crop = (n) => data.crops.find((c) => c.name === n);

test('Rotation-Einstellungen stimmen mit cropRotation.xml überein', () => {
  assert.deepEqual(data.settings.foreCropsPenalties, [-0.25, -0.2]);
  assert.equal(data.settings.monoculturePenalty, -0.05);
  assert.deepEqual(data.settings.foreCropsVeryGoodBonuses, [0.15, 0.1]);
});

test('Winterweizen: Regeln und Kalender', () => {
  const w = crop('WINTERWHEAT');
  assert.equal(w.breakPeriods, 1);
  assert.ok(w.veryGoodCrops.includes('SOYBEAN'));
  assert.ok(w.plantingPeriods.includes('EARLY_AUTUMN'));
  assert.ok(w.plantingPeriods.includes('MID_AUTUMN'));
  assert.ok(w.harvestPeriods.includes('EARLY_SUMMER'));
  assert.ok(w.litersPerSqm > 0);
  assert.ok(w.label && w.label !== 'WINTERWHEAT');
});

test('Precision-Farming-Daten', () => {
  assert.equal(data.pf.soilTypes[2].yieldPotential, 1.25);
  const req = data.pf.nitrogenRequirements.WHEAT.find((s) => s.soil === 2);
  assert.equal(req.targetLevel, 180);
  assert.ok(data.pf.nitrogenYieldMappings.length > 10);
  assert.ok(data.pf.phMappings.length > 10);
});

test('Zwischenfrüchte enthalten MUSTARD', () => {
  assert.ok(data.catchCrops.some((c) => c.name === 'MUSTARD'));
});

test('Stickstoffwerte auch für Früchte mit Zusatzattributen (Kartoffel, Erbse)', () => {
  const potato = data.pf.nitrogenRequirements.POTATO.find((s) => s.soil === 2);
  assert.equal(potato.targetLevel, 120);
  assert.ok(data.pf.nitrogenRequirements.PEA);
  assert.ok(data.pf.nitrogenIgnoreOverfertilization.includes('POTATO'));
  assert.ok(!data.pf.nitrogenIgnoreOverfertilization.includes('WHEAT'));
});
