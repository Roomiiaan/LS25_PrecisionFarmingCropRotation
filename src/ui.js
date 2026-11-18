// Oberfläche (Browser). Nutzt window.DATA, window.Calendar, window.Plan.
(function () {
  var data = window.DATA, Cal = window.Calendar, Plan = window.Plan, CatchPlan = window.CatchPlan, Tabs = window.Tabs;
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
  var KEYS = ['prev', 'last', 'month', 'catch'];
  // Bodenarten: optionale Mehrfachauswahl, gespeichert als "1,3" (leer = keine Angabe).
  function soilList(s) { return s ? s.split(',').map(Number).filter(function (n) { return isFinite(n) && n > 0; }) : []; }
  function renderSoil() {
    var sel = soilList(state.soil);
    $('soil').innerHTML = data.pf.soilTypes.map(function (s) {
      return '<button type="button" class="chip-soil" data-soil="' + s.index + '" aria-pressed="' + (sel.indexOf(s.index) >= 0) + '">' + esc(s.name) + '</button>';
    }).join('');
  }
  // Je Bodenart eigene Werte (Anteil, pH, Stickstoff): gespeichert als JSON { "<Bodenart>": { share, ph, nitrogen } }.
  function soilData(s) { try { var d = JSON.parse(s || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
  var SOIL_FIELDS = [
    { key: 'share', label: 'Anteil (%)', step: 5, min: 0, max: 100, mode: 'numeric', ph: 'z. B. 50' },
    { key: 'ph', label: 'pH-Wert', step: 0.125, min: 3, max: 9, mode: 'decimal', ph: 'z. B. 6,5' },
    { key: 'nitrogen', label: 'Stickstoff (kg/ha)', step: 5, min: 0, max: 400, mode: 'numeric', ph: 'z. B. 120' },
  ];
  // Eine Eingabezeile je gewählter Bodenart. Wird nur beim Wechsel von Feld oder Auswahl neu gebaut (Fokus bleibt beim Tippen).
  function renderSoilRows() {
    var sel = soilList(state.soil), d = soilData(state.soilData);
    $('soil-rows').innerHTML = sel.map(function (n) {
      var t = data.pf.soilTypes.filter(function (x) { return x.index === n; })[0];
      if (!t) return '';
      var v = d[n] || {};
      return '<div class="soil-row" role="group" aria-label="Werte für ' + esc(t.name) + '"><span class="soil-name">' + esc(t.name) + '</span>' +
        SOIL_FIELDS.map(function (f) {
          var id = 'soil-' + n + '-' + f.key;
          return '<div><label for="' + id + '">' + f.label + '</label><input id="' + id + '" data-soil="' + n + '" data-key="' + f.key + '" type="number" step="' + f.step + '" min="' + f.min + '" max="' + f.max + '" inputmode="' + f.mode + '" placeholder="' + f.ph + '" value="' + esc(v[f.key] === undefined ? '' : v[f.key]) + '"></div>';
        }).join('') + '</div>';
    }).join('');
  }
  // Eingaben der gewählten Bodenarten für die Rechnung.
  function soilInputs() {
    var d = soilData(state.soilData);
    return soilList(state.soil).map(function (n) {
      var v = d[n] || {};
      return { index: n, share: num(v.share), ph: num(v.ph), nitrogen: num(v.nitrogen) };
    });
  }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var store = Tabs.load(read(KEY), read(LEGACY_KEY));
  var state = null; // das aktive Feld
  function save() { try { localStorage.setItem(KEY, Tabs.serialize(store)); } catch (e) {} }
  function activeField() { return store.fields.filter(function (f) { return f.id === store.active; })[0]; }

  function renderTabs() {
    $('tablist').innerHTML = store.fields.map(function (f) {
      var sel = f.id === store.active;
      return '<button type="button" role="tab" class="tab" data-id="' + esc(f.id) + '" aria-selected="' + sel + '" draggable="true" tabindex="' + (sel ? 0 : -1) + '" title="' + esc(f.name) + '">' + esc(f.name) + '</button>';
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
    renderSoilRows();
    document.querySelector('.more').open = Boolean(state.soil);
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

  // ---- Zwischenfrucht-Vergleich (Tabs je Zwischenfrucht, darunter Tabelle der Folgefrüchte)
  var cpPct = function (r) { return pct(r.factors.total); };
  // Jahresangabe als kleine Marke neben dem Monat (statt Klammern im Fließtext).
  var cpYear = function (n) { return n <= 0 ? '' : ' <i class="cp-tag">' + (n === 1 ? 'nächstes Jahr' : n === 2 ? 'übernächstes Jahr' : 'in ' + n + ' Jahren') + '</i>'; };
  var cpMonth = function (period, years) { return esc(Cal.periodLabel(period)) + cpYear(years); };
  var cpTable = function (items) {
    return '<table class="cp-table"><thead><tr><th>Frucht</th><th>Ertrag</th><th>Säbar ab</th><th>Wartezeit</th></tr></thead><tbody>' +
      items.map(function (s) {
        return '<tr><td>' + esc(s.row.crop.label) + '</td><td>' + cpPct(s.row) + '</td><td><b>' + cpMonth(s.sowPeriod, s.yearsAhead) + '</b></td><td>' + esc(Cal.formatWait(s.delayMonths)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  };
  function cpSelect(name) {
    store = Tabs.updateField(store, store.active, { cptab: name });
    state = activeField();
    save();
    render();
    var t = document.querySelector('.cp-tab[aria-selected="true"]');
    if (t) t.focus();
  }
  $('catch-plan').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.cp-tab') : null;
    if (b) cpSelect(b.getAttribute('data-cc'));
  });
  $('catch-plan').addEventListener('keydown', function (e) {
    var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.cp-tab'));
    if (!dir || !tabs.length) return;
    var i = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    cpSelect(tabs[(i + dir + tabs.length) % tabs.length].getAttribute('data-cc'));
    e.preventDefault();
  });
  function renderCatchPlan(input) {
    var out = CatchPlan.buildCatchPlan(data, input);
    var month = Cal.periodLabel(input.period);
    if (!out.cards.length) {
      $('catch-plan').innerHTML = '<p class="cp-direct">Im ' + esc(month) + ' ist keine Zwischenfrucht säbar.</p>';
      return;
    }
    var direct = out.direct
      ? 'Direkt säen im ' + esc(month) + ': beste Frucht ' + esc(out.direct.crop.label) + ' mit ' + cpPct(out.direct) + '.'
      : 'Direkt ist im ' + esc(month) + ' keine Hauptfrucht säbar.';
    var wanted = state.cptab;
    var sel = out.cards.filter(function (c) { return c.catchCrop.name === wanted; })[0]
      || out.cards.filter(function (c) { return c.catchCrop.name === out.top; })[0] || out.cards[0];
    var tabs = out.cards.map(function (c) {
      var on = c === sel, b = c.best;
      var mark = c.verdict === 'better' ? '<i class="cp-mark ok" title="lohnt sich">✓</i>' : '<i class="cp-mark no" title="lohnt sich nicht">–</i>';
      var body = b
        ? '<span class="cp-tab-best">' + esc(b.row.crop.label) + ' ' + cpPct(b.row) + '</span><span class="cp-tab-sub">ab ' + cpMonth(b.sowPeriod, b.yearsAhead) + ' · ' + esc(Cal.formatWait(b.delayMonths)) + '</span>'
        : '<span class="cp-tab-best">keine Hauptfrucht säbar</span><span class="cp-tab-sub">&nbsp;</span>';
      return '<button type="button" role="tab" class="cp-tab" id="cp-tab-' + esc(c.catchCrop.name) + '" data-cc="' + esc(c.catchCrop.name) + '" aria-selected="' + on + '" aria-controls="cp-panel" tabindex="' + (on ? 0 : -1) + '">' +
        '<span class="cp-tab-name">' + esc(c.catchCrop.label) + ' ' + mark + '</span>' + body + '</button>';
    }).join('');
    var c = sel, top = c.sowable.slice(0, 8), rest = c.sowable.slice(8), verdict;
    if (c.verdict === 'none') verdict = '– Keine Hauptfrucht im Zeitraum säbar';
    else if (c.verdict === 'better') verdict = '✓ Bester Wert: ' + esc(c.best.row.crop.label) + ' ' + cpPct(c.best.row) + (out.direct ? ' statt ' + cpPct(out.direct) + ' direkt' : '') + ', ' + esc(Cal.formatWait(c.best.delayMonths));
    else verdict = '– Lohnt sich nicht: direkt säen bringt ' + cpPct(out.direct) + ' (' + esc(out.direct.crop.label) + '), mit Zwischenfrucht höchstens ' + cpPct(c.best.row) + ' (' + esc(c.best.row.crop.label) + ')';
    var panel = '<div class="cp-panel" id="cp-panel" role="tabpanel" aria-labelledby="cp-tab-' + esc(c.catchCrop.name) + '">' +
      '<div class="cp-ready"><span class="cp-step"><small>Saat</small><span>' + esc(Cal.periodLabel(c.sowPeriod)) + '</span></span><span class="cp-arrow" aria-hidden="true">→</span><span class="cp-step"><small>Gewachsen nach ' + c.readyAfter + ' Monaten</small><span>' + cpMonth(c.readyPeriod, c.readyYearsAhead) + '</span></span></div>' +
      (top.length ? cpTable(top) : '') +
      (rest.length ? '<details class="cp-more"><summary>weitere ' + rest.length + '</summary>' + cpTable(rest) + '</details>' : '') +
      (c.blocked.length ? '<div class="cp-blocked">Im Zeitraum nicht säbar: ' + c.blocked.map(function (r) { return esc(r.crop.label); }).join(', ') + '</div>' : '') +
      '<div class="cp-verdict ' + (c.verdict === 'better' ? 'ok' : 'no') + '">' + verdict + '</div></div>';
    $('catch-plan').innerHTML = '<p class="cp-direct">' + direct + '</p><div class="cp-tabs" role="tablist" aria-label="Zwischenfrüchte">' + tabs + '</div>' + panel;
  }

  // Hinweis unter den Bodenart-Zeilen, wenn die Anteile nicht zu 100 % passen.
  function renderSoilSum(soils) {
    var el = $('soil-sum'), given = soils.filter(function (s) { return s.share !== null && s.share > 0; });
    var sum = given.reduce(function (a, s) { return a + s.share; }, 0);
    var msg = '';
    if (soils.length > 1 && given.length === soils.length && Math.abs(sum - 100) > 0.001) {
      msg = 'Die Anteile ergeben ' + Math.round(sum * 10) / 10 + ' %. Die Seite rechnet sie auf 100 % um.';
    } else if (soils.length > 1 && given.length > 0 && given.length < soils.length) {
      msg = 'Bodenarten ohne Anteil teilen sich den Rest bis 100 %.';
    }
    el.textContent = msg;
    el.hidden = !msg;
  }

  // ---- Ausgabe
  function render() {
    var input = {
      last: state.last || null, prev: state.prev || null, catchCrop: state.catch || null, period: state.month,
      soils: soilInputs(),
    };
    var hasSoil = input.soils.length > 0;
    renderSoilSum(input.soils);
    var rows = Plan.buildPlan(data, input);
    renderCatchPlan(input);
    var yes = rows.filter(function (r) { return r.plantable; }).length;
    $('summary').innerHTML = '<span class="chip ok">✓ ' + yes + ' jetzt säbar</span><span class="chip no">– ' + (rows.length - yes) + ' nicht säbar</span>';
    $('rows').innerHTML = rows.map(function (r) {
      var f = r.factors, c = r.crop;
      var parts = ['Fruchtfolge ' + pct(f.rotation)];
      if (hasSoil) {
        parts.push((input.soils.length > 1 ? 'Boden Ø ' : 'Boden ') + pct(f.soil));
        if (input.soils.some(function (s) { return s.nitrogen !== null; })) parts.push(f.nitrogenKnown ? 'N ' + pct(f.nitrogen) : 'N: keine Daten');
        if (input.soils.some(function (s) { return s.ph !== null; })) parts.push('pH ' + pct(f.ph));
      }
      var lit = function (l) { return (Math.round(l / 10) * 10).toLocaleString('de-DE'); };
      var liters = f.litersPerHa ? '≈ ' + lit(f.litersPerHa) + ' l/ha · ' : '';
      var status = r.plantable ? '✓ Jetzt säbar' : '– Nicht säbar im ' + Cal.periodLabel(state.month);
      var w = function (t) { return Math.max(2, Math.min(100, (t / 1.6) * 100)).toFixed(1); };
      var bar = '<i style="width:' + w(f.total) + '%"></i>';
      return '<article class="row grid ' + (r.plantable ? 'ok' : 'no') + ' lvl-' + Plan.yieldLevel(f.total) + '">' +
        '<div><div class="nm">' + esc(c.label) + '</div><div class="st">' + status + ' · Saat ' + esc(r.plantingLabel) + '</div></div>' +
        '<div><div class="pct">' + pct(f.total) + '</div><div class="bar" aria-hidden="true">' + bar + '</div>' +
        '<div class="sub">' + liters + esc(parts.join(' · ')) + '</div></div>' +
        strip(c, state.month) + '</article>';
    }).join('');
  }

  // ---- Ereignisse
  KEYS.forEach(function (k) {
    $(k).addEventListener('change', function () {
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
    renderSoilRows();
    render();
    var again = document.querySelector('.chip-soil[data-soil="' + n + '"]');
    if (again) again.focus();
  });

  // Werte je Bodenart: Eingabe speichern und neu rechnen (Zeilen bleiben stehen, damit der Fokus nicht verloren geht).
  $('soil-rows').addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-soil')) return;
    var d = soilData(state.soilData), n = t.getAttribute('data-soil');
    d[n] = Object.assign({}, d[n], { [t.getAttribute('data-key')]: t.value });
    store = Tabs.updateField(store, store.active, { soilData: JSON.stringify(d) });
    state = activeField();
    save();
    render();
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
    if (e.altKey) { // Alt + Pfeil: aktives Feld in der Reihenfolge verschieben
      moveTab(store.active, i + dir);
      e.preventDefault();
      return;
    }
    selectTab(store.fields[(i + dir + store.fields.length) % store.fields.length].id);
    e.preventDefault();
  });
  // Reihenfolge ändern: Ziehen mit der Maus oder Alt + Pfeiltaste.
  function moveTab(id, toIndex) {
    var next = Tabs.moveField(store, id, toIndex);
    if (next === store) return;
    commit(next);
    var b = document.querySelector('.tab[data-id="' + id + '"]');
    if (b) b.focus();
  }
  var dragId = null;
  $('tablist').addEventListener('dragstart', function (e) {
    var b = e.target.closest ? e.target.closest('.tab') : null;
    if (!b) return;
    dragId = b.getAttribute('data-id');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    b.classList.add('dragging');
  });
  $('tablist').addEventListener('dragover', function (e) {
    if (!dragId) return;
    e.preventDefault();
    var over = e.target.closest ? e.target.closest('.tab') : null;
    Array.prototype.forEach.call(document.querySelectorAll('.tab.drop'), function (t) { t.classList.remove('drop'); });
    if (over && over.getAttribute('data-id') !== dragId) over.classList.add('drop');
  });
  $('tablist').addEventListener('drop', function (e) {
    if (!dragId) return;
    e.preventDefault();
    var over = e.target.closest ? e.target.closest('.tab') : null;
    var id = dragId;
    dragId = null;
    if (over) moveTab(id, store.fields.findIndex(function (f) { return f.id === over.getAttribute('data-id'); }));
  });
  $('tablist').addEventListener('dragend', function () {
    dragId = null;
    Array.prototype.forEach.call(document.querySelectorAll('.tab.dragging, .tab.drop'), function (t) { t.classList.remove('dragging', 'drop'); });
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
