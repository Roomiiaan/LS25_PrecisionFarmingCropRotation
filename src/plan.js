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

  // Farbstufe für den Ertragsbalken, nach dem angezeigten (gerundeten) Prozentwert:
  // good ab 100 %, ok ab 90 %, warn ab 75 %, sonst bad.
  function yieldLevel(total) {
    const pct = Math.round(total * 100);
    if (pct >= 100) return 'good';
    if (pct >= 90) return 'ok';
    if (pct >= 75) return 'warn';
    return 'bad';
  }

  const api = { buildPlan, yieldLevel };
  if (isNode) module.exports = api;
  else root.Plan = api;
})(typeof window !== 'undefined' ? window : globalThis);
