// Ergebnisliste: alle Ackerfrüchte der Map mit Faktoren und Kalender. Keine DOM-Abhängigkeit.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Calc = isNode ? require('./calc.js') : root.Calc;
  const Cal = isNode ? require('./calendar.js') : root.Calendar;

  // input: { last, prev, catchCrop, period, soilIndex, nitrogen, ph }
  function buildPlan(data, input) {
    const rows = data.crops
      .filter((c) => c.onMap && !c.ignoreInPlanner)
      .map((crop) => ({
        crop,
        plantable: Cal.isPlantable(crop, input.period),
        factors: Calc.totalFactor(data, {
          cropName: crop.name, last: input.last, prev: input.prev, catchCrop: input.catchCrop,
          soilIndex: input.soilIndex, nitrogen: input.nitrogen, ph: input.ph,
        }),
        plantingLabel: Cal.formatWindow(crop.plantingPeriods),
        harvestLabel: Cal.formatWindow(crop.harvestPeriods),
      }));
    rows.sort((a, b) =>
      Number(b.plantable) - Number(a.plantable) ||
      b.factors.total - a.factors.total ||
      a.crop.label.localeCompare(b.crop.label, 'de'));
    return rows;
  }

  const api = { buildPlan };
  if (isNode) module.exports = api;
  else root.Plan = api;
})(typeof window !== 'undefined' ? window : globalThis);
