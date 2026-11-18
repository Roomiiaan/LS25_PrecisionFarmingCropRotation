// Liest die LS25-Mods (nur lesen) und schreibt data/data.json.
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const MODS = process.env.LS25_MODS ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'My Games', 'FarmingSimulator2025', 'mods');
const OUT = path.join(__dirname, '..', 'data', 'data.json');

// Deutsche Namen der Basisspiel-Früchte (stehen nicht in den Mods).
const FALLBACK_DE = {
  WHEAT: 'Weizen', WINTERWHEAT: 'Winterweizen', BARLEY: 'Gerste', SUMMERBARLEY: 'Sommergerste',
  WINTERBARLEY: 'Wintergerste', OAT: 'Hafer', CANOLA: 'Raps', MAIZE: 'Mais', SILAGEMAIZE: 'Silomais',
  SUNFLOWER: 'Sonnenblumen', SOYBEAN: 'Sojabohnen', POTATO: 'Kartoffeln', SUGARBEET: 'Zuckerrüben',
  BEETROOT: 'Rote Bete', CARROT: 'Karotten', PARSNIP: 'Pastinaken', GREENBEAN: 'Grüne Bohnen',
  PEA: 'Erbsen', SPINACH: 'Spinat', SORGHUM: 'Hirse', OILSEEDRADISH: 'Ölrettich', RYE: 'Roggen',
  TRITICALE: 'Triticale', SPELT: 'Dinkel', VETCHRYE: 'Wickroggen', GREENRYE: 'Grünroggen',
  HUMUSACTIVE: 'Humusaktiv', MUSTARD: 'Senf', FLOWERINGCATCHCROP: 'Blühende Zwischenfrucht',
  ALFALFA: 'Luzerne', CLOVER: 'Klee', FIELDGRASS: 'Ackergras', GRASS: 'Gras', MEADOW: 'Wiese',
  RICE: 'Reis', RICELONGGRAIN: 'Langkornreis', SUGARCANE: 'Zuckerrohr', COTTON: 'Baumwolle',
  ONION: 'Zwiebeln', BUCKWHEAT: 'Buchweizen', SUMMERWHEAT: 'Sommerweizen',
};

const zip = (n) => new AdmZip(path.join(MODS, n));
const text = (z, p) => {
  const e = z.getEntry(p);
  if (!e) throw new Error(`Datei fehlt im ZIP: ${p}`);
  return e.getData().toString('utf8');
};
const attrs = (s) => {
  const o = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};
const tags = (xml, name) =>
  [...xml.matchAll(new RegExp(`<${name}\\b([^>]*?)/?>`, 'g'))].map((m) => attrs(m[1]));
// Bricht laut ab, wenn eine Auswertung zu wenige Treffer liefert (z. B. nach einem Mod-Update mit anderem Format).
const must = (value, what, min = 1) => {
  const n = Array.isArray(value) ? value.length : Object.keys(value).length;
  if (n < min) throw new Error(`Extraktion fehlgeschlagen: ${what} - nur ${n} Treffer (erwartet mindestens ${min}). Hat sich das Mod-Format geändert?`);
  return value;
};
const list = (s) => (s || '').split(/\s+/).filter(Boolean);
const nums = (s) => list(s).map(Number);
const version = (xml) => (xml.match(/<version>([^<]+)<\/version>/) || [])[1];

function foliage(xml) {
  const gi = xml.indexOf('<growth>');
  if (gi < 0) throw new Error('<growth> fehlt in einer Foliage-Datei');
  // Erntereife Zustände heißen je Frucht anders (z. B. harvestReady3); sie tragen isHarvestReady="true".
  const ready = new Set(
    tags(xml.slice(0, gi), 'foliageState')
      .filter((s) => s.isHarvestReady === 'true' || s.name === 'harvestReady').map((s) => s.name));
  const periods = [...xml.slice(gi).matchAll(/<period\b([^>]*?)(\/>|>([\s\S]*?)<\/period>)/g)].map((m) => ({
    name: attrs(m[1]).name, planting: attrs(m[1]).plantingAllowed === 'true', updates: tags(m[3] || '', 'update'),
  }));
  const planting = periods.filter((p) => p.planting).map((p) => p.name);
  // Eine Pflanze je Saatperiode von 'invisible' an durch die Jahre verfolgen (Abgleich mit dem Anbaukalender im
  // Spiel): Die Updates einer Periode wirken an ihrem Ende, pro Periode rückt eine Pflanze genau eine Stufe vor.
  // Erntereif ist eine Periode, wenn die Pflanze bei ihrem Beginn in einem reifen Zustand steht. Das Erntefenster
  // ist die Vereinigung über alle Saatperioden; eine Pflanze endet, sobald sie nach der Reife den reifen Zustand verlässt.
  const usesInvisible = periods.some((p) => p.updates.some((u) => u.startState === 'invisible'));
  // Liefert die Perioden ab der Saat als [{ k, period, ready }]; endet nach der Reife beim ersten nicht reifen Zustand
  // (dann steps.ended = true), sonst nach 24 Perioden.
  function follow(sowIndex) {
    const sow = periods[sowIndex];
    // Frisch gesäte Pflanzen starten in 'invisible'; Früchte ohne diesen Zustand (Reis) starten mit dem ersten Update der Saatperiode.
    let state = usesInvisible ? 'invisible' : (sow.updates[0] || {}).startState;
    const steps = [];
    steps.ended = false;
    let wasReady = false;
    for (let k = 0; k < periods.length * 2; k++) {
      const p = periods[(sowIndex + k) % periods.length];
      const isReady = ready.has(state);
      if (!isReady && wasReady) { steps.ended = true; break; }
      wasReady = wasReady || isReady;
      steps.push({ k, period: p.name, ready: isReady });
      const u = p.updates.find((x) => x.startState === state);
      if (u) state = u.endState;
    }
    return steps;
  }
  const harvest = new Set();
  // growth: je Saatperiode, nach wie vielen Perioden die Pflanze reif ist (readyAfter) und wie viele Perioden lang (readyFor; null = bleibt reif).
  const growth = {};
  periods.forEach((sow, s) => {
    if (!sow.planting) return;
    const steps = follow(s);
    const readySteps = steps.filter((x) => x.ready);
    readySteps.forEach((x) => harvest.add(x.period));
    if (readySteps.length) {
      growth[sow.name] = { readyAfter: readySteps[0].k, readyFor: steps.ended ? readySteps.length : null };
    }
  });
  const liters = (xml.match(/<harvest\b[^>]*litersPerSqm="([\d.]+)"/) || [])[1];
  const name = (xml.match(/<fruitType\s+name="(\w+)"/) || [])[1];
  return { name: name && name.toUpperCase(), planting, growth, harvest: periods.map((p) => p.name).filter((n) => harvest.has(n)), litersPerSqm: liters ? Number(liters) : 0 };
}

function main() {
  const cr = zip('FS25_CropRotation.zip');
  const gz = zip('FS25_Guelzow.zip');
  const pz = zip('FS25_precisionFarming.zip');

  // --- Crop Rotation
  const rot = attrs(text(cr, 'xmls/cropRotation.xml').match(/<settings\b([^>]*?)\/>/)[1]);
  const settings = {
    monoculturePenalty: Number(rot.monoculturePenalty),
    breakPeriodsPenalty: Number(rot.breakPeriodsPenalty),
    foreCropsPenalties: nums(rot.foreCropsPenalties),
    foreCropsVeryGoodBonuses: nums(rot.foreCropsVeryGoodBonuses),
    foreCropsGoodBonuses: nums(rot.foreCropsGoodBonuses),
    fallowStateBonus: Number(rot.fallowStateBonus),
    veryGoodCatchCropBonus: Number(rot.veryGoodCatchCropBonus),
    goodCatchCropBonus: Number(rot.goodCatchCropBonus),
    badCatchCropPenalty: Number(rot.badCatchCropPenalty),
  };
  const cropsXml = text(cr, 'xmls/crops.xml');
  const catchXml = cropsXml.slice(cropsXml.indexOf('<catchCrops>'));
  const mainXml = cropsXml.slice(0, cropsXml.indexOf('<catchCrops>'));

  // --- Gülzow: Foliage pro Frucht + deutsche Namen
  const l10n = {};
  for (const a of tags(text(gz, 'translations/l10n_de.xml'), 'text')) {
    if (a.name && a.name.startsWith('fillType_')) l10n[a.name.slice('fillType_'.length).toUpperCase()] = a.text;
  }
  must(l10n, 'Gülzow: deutsche Fruchtnamen (fillType_*)', 5);
  const label = (n) => l10n[n] || FALLBACK_DE[n] || n;
  const fol = {};
  for (const f of tags(text(gz, 'maps/config/fruitTypes.xml'), 'fruitType')) {
    if (!f.filename || f.filename.startsWith('$')) continue;
    const entry = gz.getEntry(f.filename);
    if (!entry) continue;
    const info = foliage(entry.getData().toString('utf8'));
    if (info.name) fol[info.name] = info;
  }

  must(fol, 'Gülzow: Foliage-Dateien der Früchte', 20);
  const crops = must(tags(mainXml, 'crop'), 'Crop Rotation: crops.xml <crop>', 20).map((c) => {
    const f = fol[c.fruitName];
    return {
      name: c.fruitName,
      label: label(c.fruitName),
      onMap: Boolean(f),
      ignoreInPlanner: c.ignoreInPlanner === 'true' || c.ignoreOnStartup === 'true',
      breakPeriods: Number(c.breakPeriods),
      veryGoodCrops: list(c.veryGoodCrops),
      goodCrops: list(c.goodCrops),
      badCrops: list(c.badCrops),
      plantingPeriods: f ? f.planting : [],
      harvestPeriods: f ? f.harvest : [],
      litersPerSqm: f ? f.litersPerSqm : 0,
    };
  });
  const catchCrops = must(tags(catchXml, 'catchCrop'), 'Crop Rotation: <catchCrop>').map((c) => ({
    name: c.fruitName,
    label: label(c.fruitName),
    veryGoodCrops: list(c.veryGoodCrops),
    goodCrops: list(c.goodCrops),
    badCrops: list(c.badCrops),
    plantingPeriods: fol[c.fruitName] ? fol[c.fruitName].planting : [],
    growth: fol[c.fruitName] ? fol[c.fruitName].growth : {},
  }));

  // --- Precision Farming
  const pf = text(pz, 'PrecisionFarming.xml');
  const block = (xml, tag) => xml.slice(xml.indexOf(`<${tag}`), xml.indexOf(`</${tag}>`));
  const pfL10n = {};
  for (const a of tags(text(pz, 'l10n/l10n_de.xml'), 'e')) if (a.k) pfL10n[a.k] = a.v;
  const soilTypes = must(tags(block(pf, 'soilTypes'), 'soilType'), 'Precision Farming: Bodenarten', 4).map((s, i) => ({
    index: i + 1, name: pfL10n[s.name.replace('$l10n_', '')] || s.name, yieldPotential: Number(s.yieldPotential),
  }));
  const nBlock = block(pf, 'nitrogenMap');
  const nYield = block(nBlock, 'yieldMappings');
  const nitrogenYieldMappings = must(tags(nYield, 'yieldMapping'), 'Precision Farming: Stickstoff-yieldMapping', 10).map((m) => ({
    difference: Number(m.difference), yieldFactor: Number(m.yieldFactor),
  }));
  const nitrogenRegularLevel = Number(attrs(nBlock.match(/<yieldMappings\b([^>]*)>/)[1]).regularLevel);
  const catchCropNitrogen = Number(attrs(nBlock.match(/<catchCrops\b([^>]*?)\/>/)[1]).increase);
  const choppedStrawNitrogen = Number(attrs(nBlock.match(/<choppedStraw\b([^>]*?)\/>/)[1]).increase);
  const nitrogenRequirements = {};
  const nitrogenIgnoreOverfertilization = [];
  for (const m of nBlock.matchAll(/<fruitRequirement\b([^>]*)>([\s\S]*?)<\/fruitRequirement>/g)) {
    const fa = attrs(m[1]);
    if (!fa.fruitTypeName) continue;
    const key = fa.fruitTypeName.toUpperCase();
    if (fa.ignoreOverfertilization === 'true') nitrogenIgnoreOverfertilization.push(key);
    nitrogenRequirements[key] = tags(m[2], 'soil').map((s) => ({
      soil: Number(s.soilTypeIndex),
      targetLevel: Number(s.targetLevel),
      reduction: Number(s.reduction),
      yieldPotential: Number(s.yieldPotential),
    }));
  }
  must(nitrogenRequirements, 'Precision Farming: Stickstoff-fruitRequirement', 10);
  const pHBlock = block(pf, 'pHMap');
  const phValuePerState = Number(attrs(pHBlock.match(/<pHValues\b([^>]*)>/)[1]).pHValuePerState);
  const vt = pf.slice(pf.indexOf('<valueTransformations'), pf.indexOf('</valueTransformations>'));
  const phOptimal = {};
  for (const m of vt.matchAll(/<valueTransformation\b([^>]*)>([\s\S]*?)<\/valueTransformation>/g)) {
    const opt = m[2].match(/<optimalValue\b([^>]*?)\/>/);
    if (opt && attrs(m[1]).soilTypeIndex) phOptimal[attrs(m[1]).soilTypeIndex] = Number(attrs(opt[1]).value);
  }
  must(phOptimal, 'Precision Farming: pH-Optimum je Bodenart', 4);
  const afterVt = pf.slice(pf.indexOf('</valueTransformations>'));
  const phYield = afterVt.slice(afterVt.indexOf('<yieldMappings>'), afterVt.indexOf('</yieldMappings>'));
  const phMappings = must(tags(phYield, 'yieldMapping'), 'Precision Farming: pH-yieldMapping', 10).map((m) => ({
    levelDifference: Number(m.levelDifference), yieldFactor: Number(m.yieldFactor),
  }));

  const data = {
    meta: {
      versions: {
        cropRotation: version(text(cr, 'modDesc.xml')),
        guelzow: version(text(gz, 'modDesc.xml')),
        precisionFarming: version(text(pz, 'modDesc.xml')),
      },
    },
    settings, crops, catchCrops,
    pf: { soilTypes, nitrogenYieldMappings, nitrogenRegularLevel, catchCropNitrogen, choppedStrawNitrogen, nitrogenRequirements, nitrogenIgnoreOverfertilization, phMappings, phOptimal, phValuePerState },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`data.json: ${crops.length} Früchte (${crops.filter((c) => c.onMap).length} auf der Map), ${catchCrops.length} Zwischenfrüchte`);
}

main();
