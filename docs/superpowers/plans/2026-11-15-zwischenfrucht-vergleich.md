# Zwischenfrucht-Vergleich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Bereich „Mit Zwischenfrucht" zeigt je jetzt säbarer Zwischenfrucht, wann sie gewachsen ist, welche Hauptfrüchte danach mit welchem Ertrag säbar sind und ob sich der Umweg gegenüber „direkt säen" lohnt.

**Architecture:** `scripts/extract.js` verfolgt wie bei den Erntefenstern eine Pflanze je Saatperiode und legt Saatfenster und Wachstum der Zwischenfrüchte in `data.json` ab. Ein neues reines Modul `src/catchplan.js` (ohne DOM) berechnet die Karten mit der bestehenden `Plan.buildPlan`-Logik. `src/ui.js` zeichnet sie in einen neuen Abschnitt der Seite.

**Tech Stack:** Node (`node:test`), eine statische HTML-Datei aus `scripts/build.js`, kein Framework.

**Spec:** `docs/superpowers/specs/2026-11-15-zwischenfrucht-vergleich-design.md`

## Global Constraints

- Oberfläche nur Deutsch, mit korrekten Umlauten; Monatsnamen über `Calendar.periodLabel`.
- Der Bonus der Zwischenfrucht gilt ab dem **Säen**; „gewachsen" = Stufe `harvestReady`. Der Nutzer grubbert erst nach dem Wachstum, sobald er die Hauptfrucht säen will.
- Updates der Map-Mod wirken am Periodenende (im Spiel bestätigt); eine Pflanze rückt pro Periode genau eine Stufe vor.
- Saatmonate der Zwischenfrüchte sind vom Nutzer bestätigt (März–Oktober, Blühende Zwischenfrucht März–September). Die Reifemonate sind **nicht** gegen das Spiel geprüft und werden in der Oberfläche als „aus den Mod-Daten berechnet" gekennzeichnet.
- Bestehendes Zwischenfrucht-Dropdown, die Ergebnisliste und die Feld-Tabs bleiben unverändert.
- Säbar/nicht säbar und Fazit nie nur über Farbe, sondern auch über Text oder Symbol. Beide Themes (hell/dunkel) müssen lesbar sein.
- Alle Texte aus Daten mit `esc()` ausgeben (HTML-Escaping in `src/ui.js`).
- Keine Wirtschaftlichkeitsrechnung; das Fazit vergleicht nur den Ertrag in Prozent.
- Ablauf je Task: Test zuerst, dann Code, `npm test` grün, Commit. Commit-Autor wie bisher `-c user.name=Romian -c user.email=romian.raseck@gmail.com`; Commit-Nachrichten enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Spielmonat Spätherbst/Winter: keine Zwischenfrucht säbar. Erwartet: kein Fehler, ein Hinweistext statt Karten (Task 3, Task 4).
- Reifemonat und Hauptfrucht-Saat im nächsten Kalenderjahr (Okt + 2 Monate = Dezember, Hafer erst im März). Erwartet: Anzeige „(nächstes Jahr)", Verzögerung in Monaten stimmt (Task 2, Task 3).
- Senf verdorrt, bevor die Hauptfrucht säbar wird. Erwartet: Frucht steht unter „nicht im Zeitraum säbar", nicht in der Ertragsliste (Task 3).
- Mehrere Bodenarten gewählt (Spanne). Erwartet: kein Fehler, Sortierung nach Mittelwert, Prozentanzeige als Spanne wie in der Liste (Task 3).
- Letzte/vorletzte Frucht leer. Erwartet: neutral gerechnet, keine Ausnahme (Task 3).

---

### Task 1: Wachstumsdaten der Zwischenfrüchte extrahieren

**Files:**
- Modify: `scripts/extract.js` (Funktion `foliage`, Abschnitt `catchCrops`)
- Modify: `data/data.json` (neu erzeugt mit `node scripts/extract.js`)
- Test: `test/extract.test.js`

**Interfaces:**
- Produces: jeder Eintrag in `data.catchCrops` hat zusätzlich
  - `plantingPeriods: string[]` (Perioden mit `plantingAllowed`)
  - `growth: { [sowPeriod: string]: { readyAfter: number, readyFor: number | null } }`
  - `readyAfter` = Anzahl Perioden von der Saatperiode bis zum ersten Beginn in reifem Zustand; `readyFor` = Anzahl aufeinanderfolgender reifer Perioden ab da, `null` wenn die Pflanze bis zum Ende der Verfolgung (24 Perioden) reif bleibt. Nur Saatperioden, in denen die Pflanze reif wird, haben einen Eintrag.
  - `foliage()` liefert dieselben zwei Felder (`planting` bleibt wie bisher, neu `growth`).

- [ ] **Step 1: Failing test schreiben** in `test/extract.test.js` (unten anfügen; `data` und `crop` sind dort schon definiert, `Cal` ist neu zu requiren):

```js
const Cal = require('../src/calendar.js');
const cc = (n) => data.catchCrops.find((c) => c.name === n);

test('Zwischenfrüchte: Saatfenster aus den Map-Dateien (vom Nutzer bestätigt)', () => {
  assert.equal(Cal.formatWindow(cc('OILSEEDRADISH').plantingPeriods), 'Mär–Okt');
  assert.equal(Cal.formatWindow(cc('MUSTARD').plantingPeriods), 'Mär–Okt');
  assert.equal(Cal.formatWindow(cc('HUMUSACTIVE').plantingPeriods), 'Mär–Okt');
  assert.equal(Cal.formatWindow(cc('FLOWERINGCATCHCROP').plantingPeriods), 'Mär–Sep');
});

test('Zwischenfrüchte: Wachstum (Updates wirken am Periodenende)', () => {
  assert.deepEqual(cc('OILSEEDRADISH').growth.MID_SPRING, { readyAfter: 2, readyFor: null });
  assert.deepEqual(cc('MUSTARD').growth.MID_SPRING, { readyAfter: 3, readyFor: 5 });
  assert.equal(cc('MUSTARD').growth.EARLY_SPRING.readyAfter, 4); // im frühen Frühling fehlt ein Update
  assert.equal(cc('HUMUSACTIVE').growth.MID_SPRING.readyAfter, 3);
  assert.ok(cc('HUMUSACTIVE').growth.MID_SPRING.readyFor >= 5);
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen:** `node --test test/extract.test.js` → FAIL (`plantingPeriods` fehlt / `growth` undefined).

- [ ] **Step 3: Implementieren in `scripts/extract.js`.** Die Verfolgung einer Pflanze aus `foliage()` in eine Hilfsfunktion `follow(periods, ready, sowIndex, startState)` herausziehen, die für jede der bis zu 24 Perioden ab der Saat `{ k, period, ready }` liefert und endet, sobald die Pflanze nach der Reife den reifen Zustand verlässt. `foliage()` bildet daraus wie bisher die Menge `harvest` und zusätzlich `growth` (erste reife `k` = `readyAfter`, Anzahl reifer Einträge = `readyFor`, `null` wenn der letzte Eintrag der Verfolgung (k = 23) noch reif ist). Der Rückgabewert von `foliage` bekommt das Feld `growth`. In `main()` bei `catchCrops` zusätzlich `plantingPeriods: fol[c.fruitName] ? fol[c.fruitName].planting : []` und `growth: fol[c.fruitName] ? fol[c.fruitName].growth : {}` setzen. Das Verhalten der Erntefenster darf sich nicht ändern (bestehende Kalender-Tests bleiben grün).

- [ ] **Step 4: Daten neu erzeugen und prüfen:** `node scripts/extract.js && npm test` → alle Tests grün (außer dem bekannten `todo`); `git diff --stat data/data.json` zeigt nur neue Felder bei `catchCrops` (die `crops`-Fenster bleiben unverändert).

- [ ] **Step 5: Commit**

```bash
git add scripts/extract.js data/data.json test/extract.test.js
git -c user.name=Romian -c user.email=romian.raseck@gmail.com commit -m "feat: Saatfenster und Wachstum der Zwischenfrüchte aus den Map-Dateien"
```

---

### Task 2: Kalender-Hilfen für Monatsverschiebung

**Files:**
- Modify: `src/calendar.js`
- Test: `test/plan.test.js` (dort liegen die Kalender-Tests; `cal` ist dort schon geladen)

**Interfaces:**
- Produces in `Calendar`:
  - `shiftPeriod(period: string, k: number): string` — die Periode `k` Monate später (zyklisch, k ≥ 0).
  - `wrapsYear(period: string, k: number): boolean` — `true`, wenn die um `k` verschobene Periode im folgenden Kalenderjahr (Reihenfolge Januar–Dezember, `MONTH_ORDER`) liegt, also `k ≥ 12` oder ihr Index in `MONTH_ORDER` kleiner ist als der der Ausgangsperiode.

- [ ] **Step 1: Failing test** in `test/plan.test.js`:

```js
test('shiftPeriod: Monate später, zyklisch', () => {
  assert.equal(cal.shiftPeriod('MID_SPRING', 3), 'MID_SUMMER');
  assert.equal(cal.shiftPeriod('MID_AUTUMN', 2), 'EARLY_WINTER');
  assert.equal(cal.shiftPeriod('MID_AUTUMN', 5), 'EARLY_SPRING');
  assert.equal(cal.shiftPeriod('LATE_WINTER', 0), 'LATE_WINTER');
});

test('wrapsYear: Verschiebung ins nächste Kalenderjahr (Jan–Dez)', () => {
  assert.equal(cal.wrapsYear('MID_SPRING', 3), false);   // April + 3 = Juli
  assert.equal(cal.wrapsYear('MID_AUTUMN', 2), false);   // Oktober + 2 = Dezember
  assert.equal(cal.wrapsYear('MID_AUTUMN', 5), true);    // Oktober + 5 = März
  assert.equal(cal.wrapsYear('EARLY_SPRING', 12), true);
});
```

- [ ] **Step 2:** `node --test test/plan.test.js` → FAIL (`cal.shiftPeriod is not a function`).

- [ ] **Step 3: Implementieren** `shiftPeriod` und `wrapsYear` in `src/calendar.js` (auf `PERIODS` und `MONTH_ORDER` aufbauen) und im `api`-Objekt exportieren.

- [ ] **Step 4:** `npm test` → grün.

- [ ] **Step 5: Commit**

```bash
git add src/calendar.js test/plan.test.js
git -c user.name=Romian -c user.email=romian.raseck@gmail.com commit -m "feat: Kalender-Hilfen shiftPeriod und wrapsYear"
```

---

### Task 3: Rechenmodul `catchplan.js`

**Files:**
- Create: `src/catchplan.js`
- Create: `test/catchplan.test.js`
- Modify: `scripts/build.js` (`src/catchplan.js` in die Skriptliste direkt nach `src/plan.js`)

**Interfaces:**
- Consumes: `Plan.buildPlan(data, input)` → Zeilen `{ crop, plantable, factors: { total, ... }, range, ... }`; `Calendar.isPlantable(crop, period)`, `Calendar.shiftPeriod`, `Calendar.wrapsYear`; `data.catchCrops[i].plantingPeriods` / `.growth` (Task 1).
- Produces: `CatchPlan.buildCatchPlan(data, input)` mit `input` wie bei `buildPlan` (`period` = Spielmonat = Saatmonat der Zwischenfrucht). Rückgabe:

```js
{
  direct: Row | null,            // beste jetzt säbare Zeile von buildPlan(data, input), sonst null
  cards: [{
    catchCrop: { name, label },
    sowPeriod: string,           // = input.period
    readyPeriod: string,         // shiftPeriod(sowPeriod, readyAfter)
    readyAfter: number,          // Monate bis gewachsen
    readyWrapsYear: boolean,     // wrapsYear(sowPeriod, readyAfter)
    sowable: [{ row: Row, sowPeriod: string, delayMonths: number, wrapsYear: boolean }], // nach row.factors.total absteigend
    blocked: Row[],              // Hauptfrüchte, die im Zeitraum nie säbar sind (Label-Reihenfolge)
    best: { row, sowPeriod, delayMonths, wrapsYear } | null,   // sowable[0] oder null
    verdict: 'better' | 'notBetter' | 'none',  // better: best.row.factors.total > direct.factors.total + 0.005 (direct null -> better); none: sowable leer
    gain: number | null,         // best.total - direct.total in Faktor-Einheiten, null ohne direct/best
  }],
}
```

  Ein Eintrag in `cards` entsteht nur für Zwischenfrüchte, die in `input.period` säbar sind **und** für diese Saatperiode einen `growth`-Eintrag haben. Der Zeitraum für die Hauptfrucht-Saat ist `delayMonths` von `readyAfter` bis `readyAfter + (readyFor ?? 12) - 1`; je Hauptfrucht zählt der erste Monat im Zeitraum, in dem `Calendar.isPlantable` wahr ist. Erträge je Hauptfrucht: `Plan.buildPlan(data, { ...input, catchCrop: name, period: readyPeriod })` (Fruchtfolge hängt nicht vom Monat ab; es zählt nur die Säbarkeit aus dem Zeitraum). Zwischenfrüchte und `ignoreInPlanner`-Früchte erscheinen wie in `buildPlan` nicht.

- [ ] **Step 1: Failing tests** in `test/catchplan.test.js` (Grundgerüst wie die anderen Tests: `node:test`, `assert/strict`, `data` aus `../data/data.json`, `CatchPlan = require('../src/catchplan.js')`, `cal = require('../src/calendar.js')`):

```js
const base = { last: 'WHEAT', prev: 'WHEAT', catchCrop: null, soilIndexes: [], nitrogen: null, ph: null };
const card = (plan, name) => plan.cards.find((c) => c.catchCrop.name === name);

test('Karten nur für jetzt säbare Zwischenfrüchte', () => {
  const winter = CatchPlan.buildCatchPlan(data, { ...base, period: 'EARLY_WINTER' });
  assert.deepEqual(winter.cards, []);            // Dezember: nichts säbar, kein Fehler
  const herbst = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' });
  assert.ok(card(herbst, 'OILSEEDRADISH'));
  assert.equal(card(herbst, 'FLOWERINGCATCHCROP'), undefined); // Blühende nur bis September
});

test('Ölrettich im Oktober: gewachsen im Dezember, Hafer im März mit +15 % (Spielwert 140 %)', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' }), 'OILSEEDRADISH');
  assert.equal(c.readyPeriod, 'EARLY_WINTER');
  assert.equal(c.readyAfter, 2);
  assert.equal(c.readyWrapsYear, false);
  const hafer = c.sowable.find((s) => s.row.crop.name === 'OAT');
  assert.equal(hafer.sowPeriod, 'EARLY_SPRING');
  assert.equal(hafer.delayMonths, 5);
  assert.equal(hafer.wrapsYear, true);
  assert.equal(Math.round(hafer.row.factors.total * 100), 140);
});

test('sowable ist absteigend nach Ertrag sortiert; best ist der erste Eintrag', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' }), 'OILSEEDRADISH');
  const t = c.sowable.map((s) => s.row.factors.total);
  assert.deepEqual(t, [...t].sort((a, b) => b - a));
  assert.equal(c.best, c.sowable[0]);
});

test('Senf verdorrt: Frucht, die erst nach dem Zeitraum säbar wird, steht unter blocked', () => {
  const c = card(CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_SPRING' }), 'MUSTARD');
  // Senf April gesät: gewachsen Juli, Zeitraum Juli–November (readyFor 5). Hafer (Saat Mär–Apr) liegt außerhalb.
  assert.ok(c.blocked.some((r) => r.crop.name === 'OAT'));
  assert.ok(!c.sowable.some((s) => s.row.crop.name === 'OAT'));
});

test('verdict und gain gegen direktes Säen', () => {
  const plan = CatchPlan.buildCatchPlan(data, { ...base, period: 'MID_AUTUMN' });
  assert.ok(plan.direct);
  for (const c of plan.cards) {
    if (!c.best) { assert.equal(c.verdict, 'none'); assert.equal(c.gain, null); continue; }
    const d = c.best.row.factors.total - plan.direct.factors.total;
    assert.equal(c.gain, d);
    assert.equal(c.verdict, d > 0.005 ? 'better' : 'notBetter');
  }
});

test('Mehrere Bodenarten und leere Vorfrüchte werfen nicht', () => {
  const plan = CatchPlan.buildCatchPlan(data, { last: null, prev: null, catchCrop: null, period: 'MID_SPRING', soilIndexes: [1, 3], nitrogen: 100, ph: 6.5 });
  assert.ok(plan.cards.length > 0);
  for (const c of plan.cards) for (const s of c.sowable) assert.ok(Number.isFinite(s.row.factors.total));
});
```

- [ ] **Step 2:** `node --test test/catchplan.test.js` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren** `buildCatchPlan(data, input)` in `src/catchplan.js` im Stil von `src/plan.js` (IIFE mit `isNode`-Prüfung, `Plan`/`Calendar` per `require` bzw. `root.Plan`/`root.Calendar`, Export als `CatchPlan`). Ist der Wert der Hauptfrucht-Ertragsliste nach dem Test `Ölrettich im Oktober` anders als im Test (z. B. weil das Wachstum im Winter von der Annahme abweicht), nicht den Test anpassen, sondern stoppen und berichten.

- [ ] **Step 4:** `npm test` → grün.

- [ ] **Step 5: Commit**

```bash
git add src/catchplan.js test/catchplan.test.js scripts/build.js
git -c user.name=Romian -c user.email=romian.raseck@gmail.com commit -m "feat: Zwischenfrucht-Vergleich (Rechenmodul)"
```

---

### Task 4: Abschnitt „Mit Zwischenfrucht" in der Seite

**Files:**
- Modify: `src/template.html` (neuer Abschnitt zwischen dem Eingaben-`<section class="card">` und `<div class="sum" id="summary">`)
- Modify: `src/ui.js` (neue Funktion `renderCatchPlan(input)`, aufgerufen am Ende von `render()`)
- Modify: `src/style.css` (Karten, beide Themes)
- Modify: `docs/verification.md` (Teil 4: Reifemonate offen, Beobachtung „Ölrettich 2/3")
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `window.CatchPlan.buildCatchPlan(data, input)` (Task 3) mit demselben `input`-Objekt, das `render()` für `Plan.buildPlan` baut; `Cal.periodLabel`, `esc`, `pct`.
- Produces: Element `#catch-plan` (in `<details class="catchplan" open>` mit Überschrift „Mit Zwischenfrucht"), das bei jedem `render()` neu gefüllt wird.

- [ ] **Step 1: Failing test** in `test/build.test.js` (dort wird `dist/index.html` gebaut und geprüft; im selben Stil ergänzen):

```js
test('Seite enthält den Abschnitt „Mit Zwischenfrucht" und das Modul catchplan', () => {
  assert.ok(html.includes('id="catch-plan"'));
  assert.ok(html.includes('Mit Zwischenfrucht'));
  assert.ok(html.includes('buildCatchPlan'));
});
```

- [ ] **Step 2:** `npm test` → FAIL (Abschnitt fehlt).

- [ ] **Step 3: Umsetzen.**
  - `template.html`: `<details class="catchplan" open><summary>Mit Zwischenfrucht</summary><div id="catch-plan" aria-live="polite"></div><p class="hint">Reifemonate sind aus den Mod-Daten berechnet, noch nicht im Spiel geprüft.</p></details>`.
  - `ui.js` `renderCatchPlan(input)`: ruft `window.CatchPlan.buildCatchPlan(data, input)`; ohne Karten Text „Im <Monat> ist keine Zwischenfrucht säbar." Pro Karte: Name der Zwischenfrucht, „gesät <Saatmonat> → gewachsen im <Reifemonat>" (mit „(nächstes Jahr)", wenn `readyWrapsYear`), Liste `sowable` (Hauptfrucht, Ertrag in %, „ab <Monat>" mit „(nächstes Jahr)" bei `wrapsYear` und „+N Monate", Ertrag bei mehreren Bodenarten als Spanne wie in der Liste), Zeile „Nicht im Zeitraum säbar: …" aus `blocked`, Fazit in Worten („Beste Hauptfrucht X: N % statt M % direkt, Y Monate später" bei `better`; „Lohnt sich nicht: direkt säen bringt M % (X)" bei `notBetter`; „Keine Hauptfrucht im Zeitraum säbar" bei `none`) mit Symbol (✓ / –), plus die beste Hauptfrucht „direkt jetzt" einmal über allen Karten, wenn `direct` vorhanden. Ohne `direct` entfällt der Vergleichstext.
  - `style.css`: Karten in der Optik der `.row`-Karten (Variablen `--card`, `--line`, `--pri`, `--mut`), Fazit mit Symbol und Text, in hellem und dunklem Theme lesbar.
  - `docs/verification.md`: Teil 4 „Zwischenfrüchte" mit Ablauf (Bonus beim Säen gesetzt, Wachstumsstufen aus den Map-Dateien), Beobachtung „Ölrettich zeigt im Spiel Wachstum 2/3 (drei Stufen, passt zur kleinen Pflanze)" und der offenen Prüfung der Reifemonate (Saat- und aktueller Monat nötig).

- [ ] **Step 4: Bauen und prüfen:** `npm test` → grün; `npm run build` → `dist/index.html` entsteht. Seite im Browser öffnen (`dist/index.html`), Monat Oktober und Juli wählen: Karten erscheinen/fehlen wie erwartet, Dezember zeigt den Hinweistext, beide Themes ansehen und per Screenshot festhalten.

- [ ] **Step 5: Commit**

```bash
git add src/template.html src/ui.js src/style.css docs/verification.md test/build.test.js
git -c user.name=Romian -c user.email=romian.raseck@gmail.com commit -m "feat: Abschnitt „Mit Zwischenfrucht“ in der Seite"
```

---

## Self-Review (erledigt)

- **Spec-Abdeckung:** Karten je säbarer Zwischenfrucht (Task 3/4), Saat-/Reifemonat (Task 3/4), Hauptfrüchte mit Bonus (Task 3), nicht säbare Hauptfrüchte (Task 3 `blocked`), Fazit und Direktvergleich (Task 3 `verdict`/`direct`), Kennzeichnung ungeprüfter Reifemonate (Task 4), Daten aus den Mod-Dateien mit bestätigten Saatmonaten (Task 1).
- **Abweichung vom Spec, bewusst:** Das Spec wertet die Hauptfrüchte im Reifemonat. Der Plan wertet den ganzen Zeitraum, in dem die Zwischenfrucht steht (je Hauptfrucht der erste säbare Monat darin), sonst würde z. B. Hafer fälschlich als „nicht mehr säbar" gelten, obwohl er im März säbar ist. Der Nutzer grubbert ohnehin erst, wenn er die Hauptfrucht säen will.
- **Typen:** `growth`, `readyAfter`, `readyFor`, `shiftPeriod`, `wrapsYear`, `buildCatchPlan`-Rückgabe sind in Task 1–3 gleich benannt und in Task 4 nur konsumiert.
- **Proportion:** Plan enthält Signaturen, Tests und Werte, keine Funktionskörper.
