// Zwischenfrucht-Vergleich: lohnt sich ein Umweg über eine Zwischenfrucht? Keine DOM-Abhängigkeit.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Plan = isNode ? require('./plan.js') : root.Plan;
  const Cal = isNode ? require('./calendar.js') : root.Calendar;

  // So viele Monate zählt der Zeitraum für die Hauptfrucht, wenn die Zwischenfrucht reif bleibt (Ölrettich).
  const OPEN_END_MONTHS = 12;
  // Ab diesem Vorsprung (Faktor, also 0,5 Prozentpunkte) gilt der Umweg als besser.
  const MIN_GAIN = 0.005;

  // input wie bei Plan.buildPlan; input.period ist der Spielmonat = Saatmonat der Zwischenfrucht.
  // Die Zwischenfrucht wird gesät, wächst bis 'harvestReady', wird untergegrubbert und danach wird die Hauptfrucht gesät.
  // Der Bonus gilt ab dem Säen. Je Hauptfrucht zählt der erste Monat im Zeitraum, in dem sie säbar ist.
  function buildCatchPlan(data, input) {
    // Direkt säen = ohne Zwischenfrucht (auch wenn im Dropdown eine gewählt ist), sonst kippt der Vergleich.
    const directRows = Plan.buildPlan(data, Object.assign({}, input, { catchCrop: null }));
    const direct = directRows.length && directRows[0].plantable ? directRows[0] : null;

    const cards = [];
    for (const cc of data.catchCrops) {
      const growth = cc.growth && cc.growth[input.period];
      if (!growth || !(cc.plantingPeriods || []).includes(input.period)) continue;
      const readyAfter = growth.readyAfter;
      const lastMonth = readyAfter + (growth.readyFor === null ? OPEN_END_MONTHS : growth.readyFor) - 1;
      const readyPeriod = Cal.shiftPeriod(input.period, readyAfter);

      const rows = Plan.buildPlan(data, Object.assign({}, input, { catchCrop: cc.name, period: readyPeriod }));
      const sowable = [];
      const blocked = [];
      for (const row of rows) {
        let found = null;
        for (let k = readyAfter; k <= lastMonth && found === null; k++) {
          if (Cal.isPlantable(row.crop, Cal.shiftPeriod(input.period, k))) found = k;
        }
        if (found === null) blocked.push(row);
        else sowable.push({ row, sowPeriod: Cal.shiftPeriod(input.period, found), delayMonths: found, wrapsYear: Cal.wrapsYear(input.period, found), yearsAhead: Cal.yearsAhead(input.period, found) });
      }
      sowable.sort((a, b) => b.row.factors.total - a.row.factors.total || a.row.crop.label.localeCompare(b.row.crop.label, 'de'));
      blocked.sort((a, b) => a.crop.label.localeCompare(b.crop.label, 'de'));

      const best = sowable.length ? sowable[0] : null;
      const gain = best && direct ? best.row.factors.total - direct.factors.total : null;
      const verdict = !best ? 'none' : (direct === null || gain > MIN_GAIN ? 'better' : 'notBetter');
      cards.push({
        catchCrop: { name: cc.name, label: cc.label },
        sowPeriod: input.period,
        readyPeriod,
        readyAfter,
        readyWrapsYear: Cal.wrapsYear(input.period, readyAfter),
        readyYearsAhead: Cal.yearsAhead(input.period, readyAfter),
        sowable,
        blocked,
        best,
        verdict,
        gain,
      });
    }
    return { direct, cards };
  }

  const api = { buildCatchPlan };
  if (isNode) module.exports = api;
  else root.CatchPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
