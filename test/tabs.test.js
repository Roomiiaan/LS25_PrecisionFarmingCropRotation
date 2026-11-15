const test = require('node:test');
const assert = require('node:assert/strict');
const Tabs = require('../src/tabs.js');

test('load: leerer Speicher ergibt ein Feld "Feld 1" mit Standardwerten', () => {
  const s = Tabs.load(null, null);
  assert.equal(s.fields.length, 1);
  assert.equal(s.fields[0].name, 'Feld 1');
  assert.equal(s.active, s.fields[0].id);
  assert.equal(s.fields[0].month, 'MID_AUTUMN');
});

test('load: kaputtes JSON fällt auf Standard zurück, kein Absturz', () => {
  const s = Tabs.load('{kaputt', null);
  assert.equal(s.fields.length, 1);
});

test('load: alter v1-Stand wird als erstes Feld übernommen', () => {
  const s = Tabs.load(null, JSON.stringify({ prev: 'PEA', last: 'SOYBEAN', month: 'EARLY_SUMMER', catch: '', soil: '2', ph: '6.5', nitrogen: '120' }));
  assert.equal(s.fields[0].last, 'SOYBEAN');
  assert.equal(s.fields[0].soil, '2');
  assert.equal(s.fields[0].name, 'Feld 1');
});

test('save/load: Rundlauf behält Felder und aktiven Tab', () => {
  let s = Tabs.load(null, null);
  s = Tabs.addField(s);
  s = Tabs.updateField(s, s.active, { last: 'MAIZE' });
  const again = Tabs.load(Tabs.serialize(s), null);
  assert.equal(again.fields.length, 2);
  assert.equal(again.fields[1].last, 'MAIZE');
  assert.equal(again.active, s.active);
});

test('addField: neues Feld wird aktiv, Name zählt weiter und ist eindeutig', () => {
  let s = Tabs.load(null, null);
  s = Tabs.addField(s);
  s = Tabs.addField(s);
  assert.deepEqual(s.fields.map((f) => f.name), ['Feld 1', 'Feld 2', 'Feld 3']);
  assert.equal(s.active, s.fields[2].id);
  assert.equal(new Set(s.fields.map((f) => f.id)).size, 3);
});

test('updateField ändert nur das gewählte Feld', () => {
  let s = Tabs.addField(Tabs.load(null, null));
  const [a, b] = s.fields;
  s = Tabs.updateField(s, a.id, { last: 'WHEAT' });
  assert.equal(s.fields[0].last, 'WHEAT');
  assert.equal(s.fields[1].last, b.last);
});

test('renameField: Leerzeichen werden entfernt, leerer Name wird ignoriert', () => {
  let s = Tabs.load(null, null);
  const id = s.fields[0].id;
  s = Tabs.renameField(s, id, '  Nordacker  ');
  assert.equal(s.fields[0].name, 'Nordacker');
  s = Tabs.renameField(s, id, '   ');
  assert.equal(s.fields[0].name, 'Nordacker');
});

test('removeField: aktiver Tab rückt auf Nachbarn, letztes Feld wird durch leeres ersetzt', () => {
  let s = Tabs.addField(Tabs.load(null, null));
  const [a, b] = s.fields;
  s = Tabs.removeField(s, b.id);
  assert.equal(s.fields.length, 1);
  assert.equal(s.active, a.id);
  s = Tabs.removeField(s, a.id);
  assert.equal(s.fields.length, 1);
  assert.notEqual(s.fields[0].id, a.id);
  assert.equal(s.active, s.fields[0].id);
});

test('setActive: unbekannte ID wird ignoriert', () => {
  const s = Tabs.load(null, null);
  assert.equal(Tabs.setActive(s, 'gibt-es-nicht').active, s.active);
});

test('cptab (gewählter Zwischenfrucht-Tab) wird je Feld gespeichert', () => {
  let s = Tabs.load(null, null);
  s = Tabs.updateField(s, s.active, { cptab: 'MUSTARD' });
  const again = Tabs.load(Tabs.serialize(s), null);
  assert.equal(again.fields[0].cptab, 'MUSTARD');
  assert.equal(Tabs.load(null, null).fields[0].cptab, '');
});
