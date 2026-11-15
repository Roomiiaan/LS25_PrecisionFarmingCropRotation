// Kalender: Spielperioden (3 je Jahreszeit) <-> deutsche Monate. Keine DOM-Abhängigkeit.
(function (root) {
  // Reihenfolge wie im Spiel (März beginnt den Frühling).
  const PERIODS = [
    'EARLY_SPRING', 'MID_SPRING', 'LATE_SPRING',
    'EARLY_SUMMER', 'MID_SUMMER', 'LATE_SUMMER',
    'EARLY_AUTUMN', 'MID_AUTUMN', 'LATE_AUTUMN',
    'EARLY_WINTER', 'MID_WINTER', 'LATE_WINTER',
  ];
  const LONG = ['März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', 'Januar', 'Februar'];
  const SHORT = ['Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb'];
  // Anzeige-Reihenfolge Januar bis Dezember.
  const MONTH_ORDER = ['MID_WINTER', 'LATE_WINTER', ...PERIODS.slice(0, 10)];

  const idx = (p) => PERIODS.indexOf(p);
  const periodLabel = (p) => LONG[idx(p)];
  const periodShort = (p) => SHORT[idx(p)];

  const isPlantable = (crop, period) => Boolean(crop && crop.plantingPeriods && crop.plantingPeriods.includes(period));

  // Zusammenhängende Perioden (zyklisch) zu Läufen gruppieren; jeder Lauf ist ein Array von Perioden in Reihenfolge.
  function runs(periods) {
    const set = new Set(periods);
    if (set.size === 0) return [];
    if (set.size === PERIODS.length) return [PERIODS.slice()];
    const out = [];
    for (let i = 0; i < PERIODS.length; i++) {
      const p = PERIODS[i];
      const prev = PERIODS[(i + PERIODS.length - 1) % PERIODS.length];
      if (set.has(p) && !set.has(prev)) {
        const run = [];
        for (let j = i; set.has(PERIODS[j % PERIODS.length]) && run.length < PERIODS.length; j++) run.push(PERIODS[j % PERIODS.length]);
        out.push(run);
      }
    }
    return out;
  }

  function firstHarvestPeriod(crop) {
    const r = runs((crop && crop.harvestPeriods) || []);
    return r.length ? r[0][0] : null;
  }

  function formatWindow(periods) {
    const r = runs(periods);
    if (!r.length) return '–';
    return r.map((run) => (run.length === 1 ? periodShort(run[0]) : `${periodShort(run[0])}–${periodShort(run[run.length - 1])}`)).join(', ');
  }

  // Die Periode k Monate später (zyklisch, k >= 0).
  const shiftPeriod = (period, k) => PERIODS[(idx(period) + k) % PERIODS.length];
  // Liegt die um k verschobene Periode im folgenden Kalenderjahr (Januar bis Dezember)?
  // Anzahl der Jahreswechsel (Januar bis Dezember) bis zur um k verschobenen Periode: 0 = gleiches Jahr, 1 = nächstes Jahr, ...
  const yearsAhead = (period, k) => Math.floor((MONTH_ORDER.indexOf(period) + k) / PERIODS.length);
  const wrapsYear = (period, k) => yearsAhead(period, k) > 0;

  // Wartezeit in Monaten als Text: 'in 5 Monaten', 'in 1 Jahr 3 Monaten'.
  function formatWait(k) {
    if (k <= 0) return 'sofort';
    const y = Math.floor(k / 12), m = k % 12;
    const years = y === 1 ? '1 Jahr' : y + ' Jahren';
    const months = m === 1 ? '1 Monat' : m + ' Monaten';
    return 'in ' + (y ? years + (m ? ' ' + months : '') : months);
  }

  const api = { PERIODS, MONTH_ORDER, periodLabel, periodShort, isPlantable, firstHarvestPeriod, formatWindow, shiftPeriod, wrapsYear, yearsAhead, formatWait };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calendar = api;
})(typeof window !== 'undefined' ? window : globalThis);
