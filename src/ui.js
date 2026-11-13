// Oberfläche (Browser). Nutzt window.DATA, window.Calendar, window.Plan.
(function () {
  var data = window.DATA, Cal = window.Calendar, Plan = window.Plan, Tabs = window.Tabs;
  var KEY = 'fruchtfolge.v2', LEGACY_KEY = 'fruchtfolge.v1', THEME_KEY = 'fruchtfolge.theme';
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

  // Alle Auswahllisten bekommen eine Suche (direkt lostippen) und ein einheitliches Aussehen.
  var combos = ['prev', 'last', 'month', 'catch'].map(function (k) { return window.Combo.enhance($(k)); });
  function refreshCombos() { combos.forEach(function (c) { c.refresh(); }); }

  // ---- Zustand (Feld-Tabs)
  var KEYS = ['prev', 'last', 'month', 'catch', 'ph', 'nitrogen'];
  // Bodenarten: optionale Mehrfachauswahl, gespeichert als "1,3" (leer = keine Angabe).
  function soilList(s) { return s ? s.split(',').map(Number).filter(function (n) { return isFinite(n) && n > 0; }) : []; }
  function renderSoil() {
    var sel = soilList(state.soil);
    $('soil').innerHTML = data.pf.soilTypes.map(function (s) {
      return '<button type="button" class="chip-soil" data-soil="' + s.index + '" aria-pressed="' + (sel.indexOf(s.index) >= 0) + '">' + esc(s.name) + '</button>';
    }).join('');
  }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var store = Tabs.load(read(KEY), read(LEGACY_KEY));
  var state = null; // das aktive Feld
  function save() { try { localStorage.setItem(KEY, Tabs.serialize(store)); } catch (e) {} }
  function activeField() { return store.fields.filter(function (f) { return f.id === store.active; })[0]; }

  function renderTabs() {
    $('tablist').innerHTML = store.fields.map(function (f) {
      var sel = f.id === store.active;
      return '<button type="button" role="tab" class="tab" data-id="' + esc(f.id) + '" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" title="' + esc(f.name) + '">' + esc(f.name) + '</button>';
    }).join('');
  }

  // Aktives Feld in die Eingabefelder laden und neu zeichnen.
  function showField() {
    state = activeField();
    KEYS.forEach(function (k) {
      $(k).value = state[k];
      if ($(k).value !== state[k]) $(k).selectedIndex = 0; // ungültiger gespeicherter Wert
    });
    if (!$('month').value) $('month').selectedIndex = 0;
    $('month').value = Cal.MONTH_ORDER.indexOf(state.month) >= 0 ? state.month : 'MID_AUTUMN';
    refreshCombos();
    renderSoil();
    document.querySelector('.more').open = Boolean(state.soil || state.ph || state.nitrogen);
    renderTabs();
    render();
  }
  function commit(next) { store = next; save(); showField(); }
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
      soilIndexes: soilList(state.soil), nitrogen: num(state.nitrogen), ph: num(state.ph),
    };
    var hasSoil = input.soilIndexes.length > 0;
    var rows = Plan.buildPlan(data, input);
    var yes = rows.filter(function (r) { return r.plantable; }).length;
    $('summary').innerHTML = '<span class="chip ok">✓ ' + yes + ' jetzt säbar</span><span class="chip no">– ' + (rows.length - yes) + ' nicht säbar</span>';
    $('rows').innerHTML = rows.map(function (r) {
      var f = r.factors, c = r.crop;
      var multi = r.range !== null;
      var parts = ['Fruchtfolge ' + pct(f.rotation)];
      if (multi) parts.push('Spanne aus ' + input.soilIndexes.length + ' Bodenarten');
      else if (hasSoil) parts.push('Boden ' + pct(f.soil));
      if (hasSoil && !multi && input.nitrogen !== null) parts.push(f.nitrogenKnown ? 'N ' + pct(f.nitrogen) : 'N: keine Daten');
      if (hasSoil && !multi && input.ph !== null) parts.push('pH ' + pct(f.ph));
      if (multi && input.nitrogen !== null && !f.nitrogenKnown) parts.push('N: keine Daten');
      var lit = function (l) { return (Math.round(l / 10) * 10).toLocaleString('de-DE'); };
      var liters = multi ? (r.range.litersMin ? '≈ ' + lit(r.range.litersMin) + '–' + lit(r.range.litersMax) + ' l/ha · ' : '')
        : (f.litersPerHa ? '≈ ' + lit(f.litersPerHa) + ' l/ha · ' : '');
      var status = r.plantable ? '✓ Jetzt säbar' : '– Nicht säbar im ' + Cal.periodLabel(state.month);
      var w = function (t) { return Math.max(2, Math.min(100, (t / 1.6) * 100)).toFixed(1); };
      var low = multi ? r.range.min : f.total; // Farbstufe nach dem vorsichtigeren Wert
      var pctText = multi ? Math.round(r.range.min * 100) + '–' + Math.round(r.range.max * 100) + ' %' : pct(f.total);
      var bar = multi ? '<i class="max" style="width:' + w(r.range.max) + '%"></i><i style="width:' + w(r.range.min) + '%"></i>'
        : '<i style="width:' + w(f.total) + '%"></i>';
      return '<article class="row grid ' + (r.plantable ? 'ok' : 'no') + ' lvl-' + Plan.yieldLevel(low) + '">' +
        '<div><div class="nm">' + esc(c.label) + '</div><div class="st">' + status + ' · Saat ' + esc(r.plantingLabel) + '</div></div>' +
        '<div><div class="pct">' + pctText + '</div><div class="bar" aria-hidden="true">' + bar + '</div>' +
        '<div class="sub">' + liters + esc(parts.join(' · ')) + '</div></div>' +
        strip(c, state.month) + '</article>';
    }).join('');
  }

  // ---- Ereignisse
  KEYS.forEach(function (k) {
    $(k).addEventListener(k === 'ph' || k === 'nitrogen' ? 'input' : 'change', function () {
      var patch = {};
      patch[k] = $(k).value;
      // Nach Wahl der letzten Frucht: Monat auf deren frühesten Erntemonat setzen (danach frei änderbar).
      if (k === 'last') {
        var c = cropByName($(k).value), p = c && Cal.firstHarvestPeriod(c);
        if (p) { patch.month = p; $('month').value = p; refreshCombos(); }
      }
      store = Tabs.updateField(store, store.active, patch);
      state = activeField();
      save();
      render();
    });
  });

  // Bodenart-Schalter: einzeln an/aus, Mehrfachauswahl erlaubt.
  $('soil').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.chip-soil') : null;
    if (!b) return;
    var n = Number(b.getAttribute('data-soil')), sel = soilList(state.soil);
    var next = sel.indexOf(n) >= 0 ? sel.filter(function (x) { return x !== n; }) : sel.concat(n);
    next.sort();
    store = Tabs.updateField(store, store.active, { soil: next.join(',') });
    state = activeField();
    save();
    renderSoil();
    render();
    var again = document.querySelector('.chip-soil[data-soil="' + n + '"]');
    if (again) again.focus();
  });

  // ---- Feld-Tabs bedienen
  function selectTab(id) { commit(Tabs.setActive(store, id)); var b = document.querySelector('.tab[data-id="' + id + '"]'); if (b) b.focus(); }
  $('tablist').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.tab') : null;
    if (b) selectTab(b.getAttribute('data-id'));
  });
  $('tablist').addEventListener('keydown', function (e) {
    var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    var i = store.fields.findIndex(function (f) { return f.id === store.active; });
    selectTab(store.fields[(i + dir + store.fields.length) % store.fields.length].id);
    e.preventDefault();
  });
  $('tab-add').addEventListener('click', function () { commit(Tabs.addField(store)); });
  $('tab-rename').addEventListener('click', function () {
    var n = window.prompt('Name des Felds:', state.name);
    if (n !== null) commit(Tabs.renameField(store, store.active, n));
  });
  $('tab-delete').addEventListener('click', function () {
    if (window.confirm('Feld „' + state.name + '“ wirklich löschen?')) commit(Tabs.removeField(store, store.active));
  });

  showField();
})();
