const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const data = require('../data/data.json');

const root = path.join(__dirname, '..');
execFileSync('node', [path.join(root, 'scripts', 'build.js')], { cwd: root });
const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');

test('dist/index.html ist eine einzelne Datei ohne externe Ressourcen', () => {
  assert.ok(!/(src|href)\s*=\s*["']https?:/i.test(html));
  assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html));
  assert.ok(!/<script[^>]+src=/i.test(html));
});

test('Seite enthält Titel, Versionsstempel und eingebettete Daten', () => {
  assert.ok(html.includes('Fruchtfolge-Planer'));
  assert.ok(html.includes(data.meta.versions.cropRotation));
  assert.ok(html.includes('WINTERWHEAT'));
});

test('Eingaben stehen in der Reihenfolge: Vorletzte, Letzte, Monat', () => {
  const a = html.indexOf('id="prev"');
  const b = html.indexOf('id="last"');
  const c = html.indexOf('id="month"');
  assert.ok(a > 0 && b > a && c > b);
});

test('Theme-Umschalter ist vorhanden', () => {
  assert.ok(html.includes('id="theme-toggle"'));
  assert.ok(html.includes('data-theme'));
});
