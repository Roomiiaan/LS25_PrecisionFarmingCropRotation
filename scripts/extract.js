// Liest die LS25-Mods (nur lesen) und schreibt data/data.json.
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const MODS = process.env.LS25_MODS ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'My Games', 'FarmingSimulator2025', 'mods');
const OUT = path.join(__dirname, '..', 'data', 'data.json');

// Deutsche Namen der Basisspiel-Früchte (stehen nicht in den Mods).
const FALLBACK_DE = {
  WHEAT: 'Sommerweizen', WINTERWHEAT: 'Winterweizen', BARLEY: 'Gerste', SUMMERBARLEY: 'Sommergerste',
  WINTERBARLEY: 'Wintergerste', OAT: 'Hafer', CANOLA: 'Raps', MAIZE: 'Mais', SILAGEMAIZE: 'Silomais',
  SUNFLOWER: 'Sonnenblumen', SOYBEAN: 'Sojabohnen', POTATO: 'Kartoffeln', SUGARBEET: 'Zuckerrüben',
  BEETROOT: 'Rote Bete', CARROT: 'Karotten', PARSNIP: 'Pastinaken', GREENBEAN: 'Grüne Bohnen',
  PEA: 'Erbsen', SPINACH: 'Spinat', SORGHUM: 'Sorghum', OILSEEDRADISH: 'Ölrettich', RYE: 'Roggen',
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
  // Zustand über zwei Jahre simulieren (Wrap): erntereif ab der Periode mit Update in einen reifen Zustand,
  // nicht mehr erntereif in der Periode, in der ein reifer Zustand zu einem nicht reifen wechselt (dead/geerntet).
  const harvest = new Set();
  let isReady = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const p of periods) {
      if (p.updates.some((u) => ready.has(u.startState) && !ready.has(u.endState))) isReady = false;
      else if (p.updates.some((u) => ready.has(u.endState))) isReady = true;
      if (isReady && pass === 1) harvest.add(p.name);
    }
  }
  const liters = (xml.match(/<harvest\b[^>]*litersPerSqm="([\d.]+)"/) || [])[1];
  const name = (xml.match(/<fruitType\s+name="(\w+)"/) || [])[1];
  return { name: name && name.toUpperCase(), planting, harvest: periods.map((p) => p.name).filter((n) => harvest.has(n)), litersPerSqm: liters ? Number(liters) : 0 };
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
  for (const [, k, v] of text(gz, 'translations/l10n_de.xml').matchAll(/<text\s+name="fillType_(\w+)"\s+text="([^"]*)"/g)) {
    l10n[k.toUpperCase()] = v;
  }
  const label = (n) => l10n[n] || FALLBACK_DE[n] || n;
  const fol = {};
  for (const f of tags(text(gz, 'maps/config/fruitTypes.xml'), 'fruitType')) {
    if (!f.filename || f.filename.startsWith('$')) continue;
    const entry = gz.getEntry(f.filename);
    if (!entry) continue;
    const info = foliage(entry.getData().toString('utf8'));
    if (info.name) fol[info.name] = info;
  }

  const crops = tags(mainXml, 'crop').map((c) => {
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
  const catchCrops = tags(catchXml, 'catchCrop').map((c) => ({
    name: c.fruitName,
    label: label(c.fruitName),
    veryGoodCrops: list(c.veryGoodCrops),
    goodCrops: list(c.goodCrops),
    badCrops: list(c.badCrops),
  }));

  // --- Precision Farming
  const pf = text(pz, 'PrecisionFarming.xml');
  const block = (xml, tag) => xml.slice(xml.indexOf(`<${tag}`), xml.indexOf(`</${tag}>`));
  const pfL10n = {};
  for (const [, k, v] of text(pz, 'l10n/l10n_de.xml').matchAll(/<e\s+k="(\w+)"\s+v="([^"]*)"/g)) pfL10n[k] = v;
  const soilTypes = tags(block(pf, 'soilTypes'), 'soilType').map((s, i) => ({
    index: i + 1, name: pfL10n[s.name.replace('$l10n_', '')] || s.name, yieldPotential: Number(s.yieldPotential),
  }));
  const nBlock = block(pf, 'nitrogenMap');
  const nYield = block(nBlock, 'yieldMappings');
  const nitrogenYieldMappings = tags(nYield, 'yieldMapping').map((m) => ({
    difference: Number(m.difference), yieldFactor: Number(m.yieldFactor),
  }));
  const nitrogenRegularLevel = Number(attrs(nBlock.match(/<yieldMappings\b([^>]*)>/)[1]).regularLevel);
  const nitrogenRequirements = {};
  const nitrogenIgnoreOverfertilization = [];
  for (const m of nBlock.matchAll(/<fruitRequirement\s+fruitTypeName="(\w+)"([^>]*)>([\s\S]*?)<\/fruitRequirement>/g)) {
    const key = m[1].toUpperCase();
    if (attrs(m[2]).ignoreOverfertilization === 'true') nitrogenIgnoreOverfertilization.push(key);
    nitrogenRequirements[key] = tags(m[3], 'soil').map((s) => ({
      soil: Number(s.soilTypeIndex),
      targetLevel: Number(s.targetLevel),
      reduction: Number(s.reduction),
      yieldPotential: Number(s.yieldPotential),
    }));
  }
  const pHBlock = block(pf, 'pHMap');
  const phValuePerState = Number(attrs(pHBlock.match(/<pHValues\b([^>]*)>/)[1]).pHValuePerState);
  const vt = pf.slice(pf.indexOf('<valueTransformations'), pf.indexOf('</valueTransformations>'));
  const phOptimal = {};
  for (const m of vt.matchAll(/<valueTransformation\s+soilTypeIndex="(\d+)">([\s\S]*?)<\/valueTransformation>/g)) {
    phOptimal[m[1]] = Number(attrs(m[2].match(/<optimalValue\b([^>]*?)\/>/)[1]).value);
  }
  const afterVt = pf.slice(pf.indexOf('</valueTransformations>'));
  const phYield = afterVt.slice(afterVt.indexOf('<yieldMappings>'), afterVt.indexOf('</yieldMappings>'));
  const phMappings = tags(phYield, 'yieldMapping').map((m) => ({
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
    pf: { soilTypes, nitrogenYieldMappings, nitrogenRegularLevel, nitrogenRequirements, nitrogenIgnoreOverfertilization, phMappings, phOptimal, phValuePerState },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`data.json: ${crops.length} Früchte (${crops.filter((c) => c.onMap).length} auf der Map), ${catchCrops.length} Zwischenfrüchte`);
}

main();
