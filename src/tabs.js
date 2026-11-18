// Feld-Tabs: unveränderlicher Zustand {fields:[{id,name,prev,last,month,catch,soil,soilData,catchWorked,cptab}; soilData = JSON {"<Bodenart>":{share,ph,nitrogen}}], active:id}.
// Keine DOM-Abhängigkeit; Speichern/Laden bekommt Strings, damit es testbar bleibt.
(function (root) {
  const FIELD_KEYS = ['prev', 'last', 'month', 'catch', 'soil', 'soilData', 'catchWorked', 'cptab'];

  const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function makeField(name, values) {
    return Object.assign(
      { id: newId(), name, prev: '', last: '', month: 'MID_AUTUMN', catch: '', soil: '', soilData: '', catchWorked: '', cptab: '' },
      values || {},
    );
  }

  function nextName(fields) {
    let n = fields.length + 1;
    while (fields.some((f) => f.name === 'Feld ' + n)) n++;
    return 'Feld ' + n;
  }

  // Früher gab es ein gemeinsames pH/N je Feld: in die Werte jeder gewählten Bodenart übernehmen.
  function migrate(f) {
    if (!f || typeof f.soilData === 'string' || (!f.ph && !f.nitrogen) || !f.soil) return f;
    const data = {};
    String(f.soil).split(',').filter(Boolean).forEach((i) => { data[i] = { share: '', ph: f.ph || '', nitrogen: f.nitrogen || '' }; });
    return Object.assign({}, f, { soilData: JSON.stringify(data) });
  }

  const pick = (o) => FIELD_KEYS.reduce((acc, k) => (typeof o[k] === 'string' ? Object.assign(acc, { [k]: o[k] }) : acc), {});

  function fresh(values) {
    const f = makeField('Feld 1', values);
    return { fields: [f], active: f.id };
  }

  const parse = (raw) => {
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };

  // raw = Inhalt von fruchtfolge.v2, legacyRaw = Inhalt von fruchtfolge.v1 (Einzelfeld-Stand aus der ersten Version)
  function load(raw, legacyRaw) {
    const s = parse(raw);
    if (s && Array.isArray(s.fields) && s.fields.length) {
      const fields = s.fields.filter((f) => f && typeof f.id === 'string').map((f) =>
        Object.assign(makeField(typeof f.name === 'string' && f.name.trim() ? f.name : 'Feld', pick(migrate(f))), { id: f.id }));
      if (fields.length) {
        return { fields, active: fields.some((f) => f.id === s.active) ? s.active : fields[0].id };
      }
    }
    const legacy = parse(legacyRaw);
    return fresh(legacy && typeof legacy === 'object' ? pick(migrate(legacy)) : undefined);
  }

  const serialize = (state) => JSON.stringify(state);

  function addField(state) {
    const f = makeField(nextName(state.fields));
    return { fields: state.fields.concat(f), active: f.id };
  }

  const updateField = (state, id, patch) =>
    Object.assign({}, state, { fields: state.fields.map((f) => (f.id === id ? Object.assign({}, f, pick(patch)) : f)) });

  function renameField(state, id, name) {
    const n = String(name || '').trim();
    if (!n) return state;
    return Object.assign({}, state, { fields: state.fields.map((f) => (f.id === id ? Object.assign({}, f, { name: n }) : f)) });
  }

  function removeField(state, id) {
    const i = state.fields.findIndex((f) => f.id === id);
    if (i < 0) return state;
    const fields = state.fields.filter((f) => f.id !== id);
    if (!fields.length) return fresh();
    const active = state.active === id ? fields[Math.min(i, fields.length - 1)].id : state.active;
    return { fields, active };
  }

  const setActive = (state, id) => (state.fields.some((f) => f.id === id) ? Object.assign({}, state, { active: id }) : state);

  // Feld an die Position toIndex setzen (wird auf 0..Anzahl-1 begrenzt); aktives Feld bleibt.
  function moveField(state, id, toIndex) {
    const from = state.fields.findIndex((f) => f.id === id);
    if (from < 0) return state;
    const to = Math.max(0, Math.min(state.fields.length - 1, toIndex));
    if (to === from) return state;
    const fields = state.fields.slice();
    fields.splice(to, 0, fields.splice(from, 1)[0]);
    return Object.assign({}, state, { fields });
  }

  const api = { load, serialize, addField, updateField, renameField, removeField, setActive, moveField };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tabs = api;
})(typeof window !== 'undefined' ? window : globalThis);
