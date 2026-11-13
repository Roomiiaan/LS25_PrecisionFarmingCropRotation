// Auswahlliste mit Suche (Browser). Ersetzt ein <select> optisch; das <select> bleibt die Datenquelle
// und bekommt bei Auswahl ein "change"-Ereignis. Nutzt window.Search.
(function (root) {
  var Search = root.Search;
  var uid = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function enhance(select) {
    var id = select.id;
    var n = ++uid;
    var wrap = el('div', 'combo');
    var btn = el('button', 'combo-btn');
    btn.type = 'button';
    btn.id = id + '-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var btnText = el('span', 'combo-text');
    btn.appendChild(btnText);
    btn.appendChild(el('span', 'combo-chev', '▾'));

    var panel = el('div', 'combo-panel');
    panel.hidden = true;
    var input = el('input', 'combo-search');
    input.type = 'search';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-label', 'Suchen');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'Tippen zum Suchen …';
    var list = el('ul', 'combo-list');
    list.id = 'combo-list-' + n;
    list.setAttribute('role', 'listbox');
    input.setAttribute('aria-controls', list.id);
    panel.appendChild(input);
    panel.appendChild(list);

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    select.style.display = 'none';
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    var label = document.querySelector('label[for="' + id + '"]');
    if (label) label.setAttribute('for', btn.id);

    var items = [];
    var shown = [];
    var active = 0;

    function readItems() {
      items = [].map.call(select.options, function (o) { return { value: o.value, label: o.textContent }; });
    }
    function refresh() {
      var o = select.options[select.selectedIndex];
      btnText.textContent = o ? o.textContent : '';
    }
    function setActive(i) {
      active = Math.max(0, Math.min(i, shown.length - 1));
      var opts = list.children;
      for (var k = 0; k < opts.length; k++) opts[k].classList.toggle('active', k === active);
      var cur = opts[active];
      if (cur && cur.id) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
    }
    function renderList() {
      shown = Search.filterItems(items, input.value);
      list.innerHTML = '';
      if (!shown.length) {
        list.appendChild(el('li', 'combo-empty', 'Keine Treffer'));
        input.removeAttribute('aria-activedescendant');
        return;
      }
      shown.forEach(function (it, i) {
        var li = el('li', 'combo-opt', it.label);
        li.id = list.id + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(it.value === select.value));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
        li.addEventListener('mousemove', function () { if (active !== i) setActive(i); });
        list.appendChild(li);
      });
      var cur = -1;
      if (!input.value.trim()) cur = shown.findIndex(function (it) { return it.value === select.value; });
      setActive(cur >= 0 ? cur : 0);
    }
    function open(seed) {
      readItems();
      input.value = seed || '';
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      renderList();
      input.focus();
    }
    function close(focusBtn) {
      if (panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    }
    function choose(i) {
      var it = shown[i];
      if (!it) return;
      select.value = it.value;
      refresh();
      close(true);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    btn.addEventListener('click', function () { if (panel.hidden) open(''); else close(true); });
    // Direkt lostippen, ohne vorher zu klicken: Tastatureingabe öffnet die Suche mit diesem Zeichen.
    btn.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && e.key !== ' ') { e.preventDefault(); open(e.key); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(''); }
    });
    input.addEventListener('input', renderList);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
    });
    document.addEventListener('mousedown', function (e) { if (!wrap.contains(e.target)) close(false); });

    refresh();
    select._combo = { refresh: refresh };
    return select._combo;
  }

  root.Combo = { enhance: enhance };
})(typeof window !== 'undefined' ? window : globalThis);
