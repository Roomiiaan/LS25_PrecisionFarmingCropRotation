// Ergebnisliste: alle Ackerfrüchte der Map mit Faktoren und Kalender. Keine DOM-Abhängigkeit.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Calc = isNode ? require('./calc.js') : root.Calc;
  const Cal = isNode ? require('./calendar.js') : root.Calendar;

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // input: { last, prev, catchCrop, period, soilIndexes: number[] (optional), soilIndex (alt. einzeln), nitrogen, ph }
  // 0 Bodenarten = nur Fruchtfolge, 1 = Einzelwert, 2+ = Spanne (range) mit Mittelwert als Gesamtwert.
  function buildPlan(data, input) {
    const soils = input.soilIndexes && input.soilIndexes.length ? input.soilIndexes
      : (input.soilIndex ? [input.soilIndex] : []);
    const rows = data.crops
      .filter((c) => c.onMap && !c.ignoreInPlanner)
      .map((crop) => {
        const perSoil = (soils.length ? soils : [null]).map((soilIndex) => ({
          soilIndex,
          factors: Calc.totalFactor(data, {
            cropName: crop.name, last: input.last, prev: input.prev, catchCrop: input.catchCrop,
            soilIndex, nitrogen: input.nitrogen, ph: input.ph,
          }),
        }));
        let factors = perSoil[0].factors;
        let range = null;
        if (perSoil.length > 1) {
          const totals = perSoil.map((p) => p.factors.total);
          const total = mean(totals);
          const liters = crop.litersPerSqm > 0 ? (t) => crop.litersPerSqm * 10000 * t : () => null;
          factors = Object.assign({}, factors, {
            soil: mean(perSoil.map((p) => p.factors.soil)),
            nitrogen: mean(perSoil.map((p) => p.factors.nitrogen)),
            ph: mean(perSoil.map((p) => p.factors.ph)),
            total, litersPerHa: liters(total),
          });
          range = { min: Math.min(...totals), max: Math.max(...totals), litersMin: liters(Math.min(...totals)), litersMax: liters(Math.max(...totals)) };
        }
        return {
          crop,
          plantable: Cal.isPlantable(crop, input.period),
          factors,
          range,
          perSoil,
          plantingLabel: Cal.formatWindow(crop.plantingPeriods),
          harvestLabel: Cal.formatWindow(crop.harvestPeriods),
        };
      });
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
