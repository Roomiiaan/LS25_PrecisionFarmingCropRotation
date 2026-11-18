// Ergebnisliste: alle Ackerfrüchte der Map mit Faktoren und Kalender. Keine DOM-Abhängigkeit.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Calc = isNode ? require('./calc.js') : root.Calc;
  const Cal = isNode ? require('./calendar.js') : root.Calendar;

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // Gewichte der Bodenarten aus den Flächenanteilen (in %), Summe = 1.
  // Ohne Anteile: gleich verteilt. Fehlt nur bei einigen der Anteil, teilen sie sich den Rest bis 100 %.
  // Summiert sich alles nicht auf 100, wird proportional umgerechnet.
  function soilWeights(soils) {
    const given = soils.map((s) => (isNum(s.share) && s.share > 0 ? s.share : null));
    const sum = given.reduce((a, b) => a + (b || 0), 0);
    const missing = given.filter((g) => g === null).length;
    let raw = given;
    if (sum > 0 && missing > 0) {
      const each = Math.max(0, 100 - sum) / missing;
      raw = given.map((g) => (g === null ? each : g));
    } else if (sum === 0) {
      raw = given.map(() => 1);
    }
    const total = raw.reduce((a, b) => a + b, 0);
    return total > 0 ? raw.map((r) => r / total) : raw.map(() => 1 / raw.length);
  }

  // Neue Eingabeform: soils = [{ index, share, ph, nitrogen }]. Alt (weiter unterstützt):
  // soilIndexes / soilIndex mit gemeinsamem nitrogen und ph.
  function normalizeSoils(input) {
    if (Array.isArray(input.soils)) return input.soils;
    const idx = input.soilIndexes && input.soilIndexes.length ? input.soilIndexes
      : (input.soilIndex ? [input.soilIndex] : []);
    return idx.map((index) => ({ index, share: null, ph: input.ph, nitrogen: input.nitrogen }));
  }

  // input: { last, prev, catchCrop, catchWorked, period, soils }
  // 0 Bodenarten = nur Fruchtfolge; sonst wird der Ertrag je Bodenart mit deren pH/N gerechnet
  // und nach Flächenanteil zum Gesamtwert gewichtet.
  function buildPlan(data, input) {
    const soils = normalizeSoils(input);
    const weights = soils.length ? soilWeights(soils) : [1];
    const rows = data.crops
      .filter((c) => c.onMap && !c.ignoreInPlanner)
      .map((crop) => {
        const perSoil = (soils.length ? soils : [{ index: null }]).map((s, i) => {
          // Stickstoff zum Zeitpunkt der Saat: eingegebener Wert, plus Bonus der untergearbeiteten Zwischenfrucht.
          const bonus = input.catchWorked && input.catchCrop ? data.pf.catchCropNitrogen || 0 : 0;
          const nitrogen = isNum(s.nitrogen) ? s.nitrogen + bonus : null;
          const tgt = Calc.nitrogenTarget(data, { cropName: crop.name, soilIndex: s.index });
          return {
            soilIndex: s.index,
            weight: weights[i],
            // need > 0: so viel kg/ha müsste noch gedüngt werden; need < 0: so viel liegt über dem Ziel.
            advice: tgt && nitrogen !== null ? Object.assign({ nitrogen, bonus }, tgt, { need: tgt.target - nitrogen }) : null,
            target: tgt,
            factors: Calc.totalFactor(data, {
              cropName: crop.name, last: input.last, prev: input.prev, catchCrop: input.catchCrop,
              soilIndex: s.index, nitrogen, ph: isNum(s.ph) ? s.ph : null,
            }),
          };
        });
        const wmean = (key) => perSoil.reduce((a, p) => a + p.weight * p.factors[key], 0);
        let factors = perSoil[0].factors;
        if (perSoil.length > 1) {
          const total = wmean('total');
          factors = Object.assign({}, factors, {
            soil: wmean('soil'), nitrogen: wmean('nitrogen'), ph: wmean('ph'), total,
            litersPerHa: crop.litersPerSqm > 0 ? crop.litersPerSqm * 10000 * total : null,
            nitrogenKnown: perSoil.some((p) => p.factors.nitrogenKnown),
          });
        }
        return {
          crop,
          plantable: Cal.isPlantable(crop, input.period),
          factors,
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

  const api = { buildPlan, yieldLevel, soilWeights };
  if (isNode) module.exports = api;
  else root.Plan = api;
})(typeof window !== 'undefined' ? window : globalThis);
