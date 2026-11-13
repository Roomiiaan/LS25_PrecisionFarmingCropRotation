// Suche für die Auswahllisten. Keine DOM-Abhängigkeit.
(function (root) {
  // Klein, ohne Akzente, "ae/oe/ue" wie "ä/ö/ü": "gruen" findet "Grün".
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/ae/g, 'a')
      .replace(/oe/g, 'o')
      .replace(/ue/g, 'u');
  }

  // 0 = Anfang des Namens, 1 = Anfang eines Wortes, 2 = irgendwo enthalten, -1 = kein Treffer.
  function score(label, q) {
    const i = normalize(label).indexOf(q);
    if (i < 0) return -1;
    if (i === 0) return 0;
    return /[\s\-(]/.test(normalize(label)[i - 1]) ? 1 : 2;
  }

  // items: [{value,label}] -> passende Einträge, beste Treffer zuerst, sonst Originalreihenfolge.
  function filterItems(items, query) {
    const q = normalize(query).trim();
    if (!q) return items.slice();
    return items
      .map((item, index) => ({ item, index, s: score(item.label, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s || a.index - b.index)
      .map((x) => x.item);
  }

  const api = { normalize, filterItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Search = api;
})(typeof window !== 'undefined' ? window : globalThis);
