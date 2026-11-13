// Oberfläche (Browser). Nutzt window.DATA, window.Calendar, window.Plan.
(function () {
  var data = window.DATA, Cal = window.Calendar, Plan = window.Plan;
  var KEY = 'fruchtfolge.v1', THEME_KEY = 'fruchtfolge.theme';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var cropByName = function (n) { return data.crops.filter(function (c) { return c.name === n; })[0]; };

  // ---- Theme
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var dark = t === 'dark';
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
    $('theme-icon').textContent = dark ? '☀' : '☾';
    $('theme-label').textContent = dark ? 'Hell' : 'Dunkel';
    $('theme-toggle').setAttribute('aria-label', dark ? 'Helles Design einschalten' : 'Dunkles Design einschalten');
  }
  $('theme-toggle').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  });
  applyTheme(document.documentElement.getAttribute('data-theme'));

  // ---- Auswahllisten füllen
  function fill(sel, items) {
    sel.innerHTML = items.map(function (i) { return '<option value="' + esc(i.value) + '">' + esc(i.label) + '</option>'; }).join('');
  }
  var byLabel = function (a, b) { return a.label.localeCompare(b.label, 'de'); };
  var historyCrops = data.crops.filter(function (c) { return c.onMap; })
    .map(function (c) { return { value: c.name, label: c.label }; }).sort(byLabel);
  var historyItems = [{ value: '', label: '– keine Angabe –' }, { value: 'FALLOW', label: 'Brache (nichts angebaut)' }].concat(historyCrops);
  fill($('prev'), historyItems);
  fill($('last'), historyItems);
  fill($('month'), Cal.MONTH_ORDER.map(function (p) { return { value: p, label: Cal.periodLabel(p) }; }));
  fill($('catch'), [{ value: '', label: 'keine' }].concat(data.catchCrops.map(function (c) { return { value: c.name, label: c.label }; })));
  fill($('soil'), [{ value: '', label: 'unbekannt' }].concat(data.pf.soilTypes.map(function (s) { return { value: String(s.index), label: s.name }; })));

  // ---- Zustand
  var state = { prev: '', last: '', month: 'MID_AUTUMN', catch: '', soil: '', ph: '', nitrogen: '' };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  ['prev', 'last', 'month', 'catch', 'soil', 'ph', 'nitrogen'].forEach(function (k) { $(k).value = state[k]; if ($(k).value !== state[k]) { $(k).selectedIndex = 0; state[k] = $(k).value; } });
  if (state.soil || state.ph || state.nitrogen) document.querySelector('.more').open = true;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  var pct = function (f) { return Math.round(f * 100) + ' %'; };

  // ---- Kalenderstreifen
  $('cal-head').innerHTML = Cal.MONTH_ORDER.map(function (p) { return '<span>' + esc(Cal.periodShort(p)) + '</span>'; }).join('');
  function strip(crop, selected) {
    return '<div class="cal" role="img" aria-label="Saat: ' + esc(Cal.formatWindow(crop.plantingPeriods)) + ', Ernte: ' + esc(Cal.formatWindow(crop.harvestPeriods)) + '">' +
      Cal.MONTH_ORDER.map(function (p) {
        var s = crop.plantingPeriods.indexOf(p) >= 0, e = crop.harvestPeriods.indexOf(p) >= 0;
        var cls = (s ? ' s' : '') + (e ? ' e' : '') + (p === selected ? ' now' : '');
        return '<b class="' + cls.trim() + '">' + (s && e ? 'S/E' : s ? 'S' : e ? 'E' : '') + '</b>';
      }).join('') + '</div>';
  }

  // ---- Ausgabe
  function render() {
    var input = {
      last: state.last || null, prev: state.prev || null, catchCrop: state.catch || null, period: state.month,
      soilIndex: state.soil ? Number(state.soil) : null, nitrogen: num(state.nitrogen), ph: num(state.ph),
    };
    var rows = Plan.buildPlan(data, input);
    var yes = rows.filter(function (r) { return r.plantable; }).length;
    $('summary').innerHTML = '<span class="chip ok">✓ ' + yes + ' jetzt säbar</span><span class="chip no">– ' + (rows.length - yes) + ' nicht säbar</span>';
    $('rows').innerHTML = rows.map(function (r) {
      var f = r.factors, c = r.crop;
      var parts = ['Fruchtfolge ' + pct(f.rotation)];
      if (input.soilIndex) parts.push('Boden ' + pct(f.soil));
      if (input.soilIndex && input.nitrogen !== null) parts.push(f.nitrogenKnown ? 'N ' + pct(f.nitrogen) : 'N: keine Daten');
      if (input.soilIndex && input.ph !== null) parts.push('pH ' + pct(f.ph));
      var liters = f.litersPerHa ? '≈ ' + (Math.round(f.litersPerHa / 10) * 10).toLocaleString('de-DE') + ' l/ha · ' : '';
      var status = r.plantable ? '✓ Jetzt säbar' : '– Nicht säbar im ' + Cal.periodLabel(state.month);
      var width = Math.max(2, Math.min(100, (f.total / 1.6) * 100));
      return '<article class="row grid ' + (r.plantable ? 'ok' : 'no') + '">' +
        '<div><div class="nm">' + esc(c.label) + '</div><div class="st">' + status + ' · Saat ' + esc(r.plantingLabel) + '</div></div>' +
        '<div><div class="pct">' + pct(f.total) + '</div><div class="bar" aria-hidden="true"><i style="width:' + width.toFixed(1) + '%"></i></div>' +
        '<div class="sub">' + liters + esc(parts.join(' · ')) + '</div></div>' +
        strip(c, state.month) + '</article>';
    }).join('');
  }

  // ---- Ereignisse
  ['prev', 'last', 'month', 'catch', 'soil', 'ph', 'nitrogen'].forEach(function (k) {
    $(k).addEventListener(k === 'ph' || k === 'nitrogen' ? 'input' : 'change', function () {
      state[k] = $(k).value;
      // Nach Wahl der letzten Frucht: Monat auf deren frühesten Erntemonat setzen (danach frei änderbar).
      if (k === 'last') {
        var c = cropByName(state.last), p = c && Cal.firstHarvestPeriod(c);
        if (p) { state.month = p; $('month').value = p; }
      }
      save();
      render();
    });
  });
  render();
})();
