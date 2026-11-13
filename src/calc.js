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

  const api = { FALLOW, rotationFactor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
