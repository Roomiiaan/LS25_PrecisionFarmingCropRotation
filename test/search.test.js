const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, filterItems } = require('../src/search.js');

const items = [
  { value: 'SUMMERWHEAT', label: 'Sommerweizen' },
  { value: 'WHEAT', label: 'Weizen' },
  { value: 'WINTERWHEAT', label: 'Winterweizen' },
  { value: 'GREENRYE', label: 'Grünroggen' },
  { value: 'PEA', label: 'Erbsen' },
  { value: 'SOYBEAN', label: 'Sojabohnen' },
  { value: 'GREENBEAN', label: 'Grüne Bohnen' },
];
const labels = (r) => r.map((i) => i.label);

test('normalize: Groß/Klein, Umlaute und ae/oe/ue-Schreibweise werden gleich', () => {
  assert.equal(normalize('Grünroggen'), normalize('gruenroggen'));
  assert.equal(normalize('GRÜNROGGEN'), 'grunroggen');
  assert.equal(normalize('Ölrettich'), normalize('oelrettich'));
});

test('leere Eingabe liefert alle Einträge in Originalreihenfolge', () => {
  assert.deepEqual(labels(filterItems(items, '')), labels(items));
  assert.deepEqual(labels(filterItems(items, '   ')), labels(items));
});

test('Wortanfang vor Teiltreffer: "we" nennt Weizen zuerst', () => {
  const r = labels(filterItems(items, 'we'));
  assert.equal(r[0], 'Weizen');
  assert.deepEqual(r.slice().sort(), ['Sommerweizen', 'Weizen', 'Winterweizen'].sort());
});

test('Umlaute: "gruen" findet Grünroggen und Grüne Bohnen', () => {
  assert.deepEqual(labels(filterItems(items, 'gruen')), ['Grünroggen', 'Grüne Bohnen']);
});

test('Groß-/Kleinschreibung egal', () => {
  assert.deepEqual(labels(filterItems(items, 'ERB')), ['Erbsen']);
});

test('Wortbeginn mitten im Namen zählt vor Teiltreffer: "bohn" nennt Grüne Bohnen vor Sojabohnen', () => {
  assert.deepEqual(labels(filterItems(items, 'bohn')), ['Grüne Bohnen', 'Sojabohnen']);
});

test('keine Treffer ergibt leere Liste', () => {
  assert.deepEqual(filterItems(items, 'xyz'), []);
});
