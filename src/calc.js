// Rechenkern: Port von FS25_CropRotation/src/YieldCalculator.lua. Keine DOM-Abhängigkeit.
(function (root) {
  const FALLOW = 'FALLOW';

  const findCrop = (data, name) => data.crops.find((c) => c.name === name);

  // history[0] = letzte Frucht, history[1] = vorletzte Frucht (wie historyStateMap im Spiel).
  function rotationFactor(data, { cropName, last = null, prev = null, catchCrop = null }) {
    const crop = findCrop(data, cropName);
    if (!crop) return 1.0;
    const s = data.settings;
    const history = [last, prev];

    // Monokultur: nur wenn der Frucht eine Pause zugeordnet ist und ALLE Slots dieselbe Frucht sind.
    let mono = 0;
    if (crop.breakPeriods !== 0) {
      mono = s.monoculturePenalty;
      if (history.some((h) => h !== cropName)) mono = 0;
    }

    // Anbaupause: je Slot i (0-basiert) mit i < breakPeriods und gleicher Frucht.
    let pause = 0;
    history.forEach((h, i) => {
      if (i < crop.breakPeriods && h === cropName) pause += s.breakPeriodsPenalty;
    });

    // Vorfrüchte: Bonus/Malus je Slot-Position.
    let fore = 0;
    history.forEach((h, i) => {
      if (!h || h === FALLOW) return;
      if (crop.veryGoodCrops.includes(h) && s.foreCropsVeryGoodBonuses[i] !== undefined) fore += s.foreCropsVeryGoodBonuses[i];
      if (crop.goodCrops.includes(h) && s.foreCropsGoodBonuses[i] !== undefined) fore += s.foreCropsGoodBonuses[i];
      if (crop.badCrops.includes(h) && s.foreCropsPenalties[i] !== undefined) fore += s.foreCropsPenalties[i];
    });

    // Brache: Bonus je Slot.
    const fallow = history.filter((h) => h === FALLOW).length * s.fallowStateBonus;

    // Zwischenfrucht: ein Wert, bad überschreibt good überschreibt veryGood (Reihenfolge wie im Lua).
    let catchMul = 0;
    const cc = catchCrop && data.catchCrops.find((c) => c.name === catchCrop);
    if (cc) {
      if (cc.veryGoodCrops.includes(cropName)) catchMul = s.veryGoodCatchCropBonus;
      if (cc.goodCrops.includes(cropName)) catchMul = s.goodCatchCropBonus;
      if (cc.badCrops.includes(cropName)) catchMul = s.badCatchCropPenalty;
    }

    return 1.0 + mono + pause + fore + fallow + catchMul;
  }

  // Lineare Interpolation über sortierte Punkte [x, y]; außerhalb des Bereichs auf den Rand geklemmt.
  function interpolate(points, x) {
    const pts = [...points].sort((a, b) => a[0] - b[0]);
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return pts[pts.length - 1][1];
  }

  // Sorten, für die Precision Farming keine eigenen Stickstoffwerte hat, nutzen die der Art.
  const NITROGEN_ALIAS = { WINTERWHEAT: 'WHEAT', WINTERBARLEY: 'BARLEY', SUMMERBARLEY: 'BARLEY', SILAGEMAIZE: 'MAIZE' };

  // Empirisch aus dem Spiel (docs/verification.md, 5 Messpunkte): Das Spiel wirkt mit nur einem Drittel des Abzugs,
  // den die Mod-Tabellen für Stickstoff und pH nennen. Beim pH entspricht eine Tabellenstufe etwa 0,2 pH statt 0,125.
  const PF_EFFECT_WEIGHT = 1 / 3;
  const PH_EMPIRICAL_STEP = 0.2;
  const damp = (factor) => 1 - (1 - factor) * PF_EFFECT_WEIGHT;

  const has = (v) => v !== null && v !== undefined && Number.isFinite(v);

  function soilFactor(data, soilIndex) {
    if (!has(soilIndex)) return 1.0;
    const s = data.pf.soilTypes.find((t) => t.index === soilIndex);
    return s ? s.yieldPotential : 1.0;
  }

  // nitrogen in kg/ha. Unbekannte Frucht/Boden oder fehlende Eingabe => 1,0.
  function nitrogenFactor(data, { cropName, soilIndex, nitrogen }) {
    if (!has(soilIndex) || !has(nitrogen)) return 1.0;
    const key = NITROGEN_ALIAS[cropName] || cropName;
    const req = (data.pf.nitrogenRequirements[key] || []).find((r) => r.soil === soilIndex);
    if (!req) return 1.0;
    const diff = nitrogen - req.targetLevel;
    if (diff > 0 && data.pf.nitrogenIgnoreOverfertilization.includes(key)) return 1.0;
    return damp(interpolate(data.pf.nitrogenYieldMappings.map((m) => [m.difference, m.yieldFactor]), diff));
  }

  function phFactor(data, { soilIndex, ph }) {
    if (!has(soilIndex) || !has(ph)) return 1.0;
    const optimal = data.pf.phOptimal[soilIndex];
    if (optimal === undefined) return 1.0;
    const level = (ph - optimal) / PH_EMPIRICAL_STEP;
    return damp(interpolate(data.pf.phMappings.map((m) => [m.levelDifference, m.yieldFactor]), level));
  }

  function totalFactor(data, input) {
    const rotation = rotationFactor(data, input);
    const soil = soilFactor(data, input.soilIndex);
    const nitrogen = nitrogenFactor(data, input);
    const ph = phFactor(data, input);
    const total = rotation * soil * nitrogen * ph;
    const crop = findCrop(data, input.cropName);
    const litersPerHa = crop && crop.litersPerSqm > 0 ? crop.litersPerSqm * 10000 * total : null;
    const nitrogenKnown = Boolean(data.pf.nitrogenRequirements[NITROGEN_ALIAS[input.cropName] || input.cropName]);
    return { rotation, soil, nitrogen, ph, total, litersPerHa, nitrogenKnown };
  }

  const api = { FALLOW, rotationFactor, soilFactor, nitrogenFactor, phFactor, totalFactor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
