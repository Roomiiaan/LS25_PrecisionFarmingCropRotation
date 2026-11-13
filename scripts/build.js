// Baut dist/index.html: Template + CSS + Daten + Skripte in einer einzigen Datei.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const data = JSON.parse(read('data/data.json'));

const scripts = ['src/calc.js', 'src/calendar.js', 'src/plan.js', 'src/tabs.js', 'src/ui.js'].map(read).join('\n');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const v = data.meta.versions;

const html = read('src/template.html')
  .replace('/*STYLE*/', () => read('src/style.css'))
  .replace('/*DATA*/', () => json)
  .replace('/*SCRIPTS*/', () => scripts.replace(/<\/script/gi, '<\\/script'))
  .replace('__CR__', v.cropRotation)
  .replace('__GZ__', v.guelzow)
  .replace('__PF__', v.precisionFarming);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB`);
