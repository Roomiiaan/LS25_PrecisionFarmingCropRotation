# Fruchtfolge-Planer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine offline nutzbare HTML-Seite, die für vorletzte/letzte Frucht und Spielmonat den Ertrag aller Gülzow-Früchte (Fruchtfolge + optional Precision Farming) und deren Saat-/Erntekalender zeigt.

**Architecture:** Ein Node-Extraktionsskript liest die drei Mod-ZIPs und schreibt `data/data.json`. Eine reine Rechenbibliothek (`src/calc.js`, ohne DOM) portiert `YieldCalculator.lua` und die Precision-Farming-Faktoren. `build.js` bettet Daten, Rechenlogik und UI zu einer einzigen `dist/index.html` zusammen.

**Tech Stack:** Node.js (>=18), `node:test`, `adm-zip` (einzige Abhängigkeit), Vanilla JS/HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-11-13-fruchtfolge-planer-design.md`

## Global Constraints

- Mods (nur lesen): `C:\Users\Romian\Documents\My Games\FarmingSimulator2025\mods\` → `FS25_CropRotation.zip`, `FS25_Guelzow.zip`, `FS25_precisionFarming.zip`.
- Oberfläche ausschließlich Deutsch; Namen aus den `l10n`/`translations`-Dateien der Mods.
- Keine Server, keine Netzwerkzugriffe zur Laufzeit; `dist/index.html` ist eine einzelne Datei.
- `YieldCalculator.lua` ist maßgeblich und wird 1:1 portiert; Rotation- und PF-Faktor werden multipliziert.
- Liter/ha = `litersPerSqm` × 10000 × Gesamtfaktor, als „Richtwert" gekennzeichnet.
- Fehlende optionale Eingabe (Bodenart/pH/N) ⇒ Faktor 1,0. Stickstoff in kg/ha.
- Versionsstempel (Mod-Versionen aus `modDesc.xml`) im Seitenfuß.

## Review Focus

- Vorfrucht „Brache" (Häkchen) darf nicht als Frucht in den Listen gelten und gibt +5 % je Brache-Slot.
- Frucht, die in keiner Periode `plantingAllowed` hat (z. B. Zuckerrohr): als „nicht säbar" statt Absturz.
- Saatfenster über Jahreswechsel (Herbst bis Frühling) muss als „säbar" erkannt werden.
- Stickstoff/pH außerhalb des Tabellenbereichs (z. B. N=999, pH=3): auf Grenzwert klemmen, kein NaN.
- Gleiche Frucht als letzte und vorletzte (Monokultur): Malus nur einmal gemäß Lua-Logik.

---

### Task 1: Projekt-Setup und Mod-Extraktion

**Files:**
- Create: `package.json`, `scripts/extract.js`, `test/extract.test.js`, `data/data.json` (generiert)

**Interfaces:**
- Produces: `data/data.json` mit dieser Form:
  `{ meta: {versions:{cropRotation,guelzow,precisionFarming}}, settings: {monoculturePenalty, breakPeriodsPenalty, foreCropsPenalties:number[], foreCropsVeryGoodBonuses:number[], foreCropsGoodBonuses:number[], fallowStateBonus, veryGoodCatchCropBonus, goodCatchCropBonus, badCatchCropPenalty}, crops: Crop[], catchCrops: CatchCrop[], pf: {soilTypes:{index,name,yieldPotential}[], nitrogenYieldMappings:{difference,yieldFactor}[], nitrogenRegularLevel, nitrogenRequirements: Record<fruit,{soil:number,targetLevel,reduction,yieldPotential}[]>, phMappings:{levelDifference,yieldFactor}[], phOptimal: Record<soilIndex,number>, phValuePerState:number} }`
  - `Crop = { name:string (z. B. "WINTERWHEAT"), label:string (deutsch), breakPeriods:number, veryGoodCrops:string[], goodCrops:string[], badCrops:string[], plantingPeriods:string[], harvestPeriods:string[], litersPerSqm:number }`; Perioden heißen wie im Spiel (`EARLY_SPRING` … `LATE_WINTER`).
  - `CatchCrop = { name, label, veryGoodCrops, goodCrops, badCrops }`.

- [ ] **Step 1: `npm init`, `npm i adm-zip`, `git init` (Ordner ist noch kein Repo), `.gitignore` mit `node_modules`**
- [ ] **Step 2: Failing test `test/extract.test.js`** – lädt `data/data.json` und prüft: `settings.foreCropsPenalties` deep-equals `[-0.25,-0.2]`; `settings.monoculturePenalty === -0.05`; Crop `WINTERWHEAT` hat `breakPeriods===1`, `plantingPeriods` enthält `EARLY_AUTUMN` und `MID_AUTUMN`, `harvestPeriods` enthält `EARLY_SUMMER`; `pf.soilTypes[2].yieldPotential===1.25`; `nitrogenRequirements.WHEAT` Bodenart 2 hat `targetLevel===180`; `catchCrops` enthält `MUSTARD`.
- [ ] **Step 3: Run** `node --test test/` – erwartet FAIL (Datei fehlt).
- [ ] **Step 4: Implementiere `scripts/extract.js`** (`node scripts/extract.js`). Quellen laut Spec-Abschnitt „Datenquellen". `plantingPeriods` = Perioden mit `plantingAllowed="true"` in `foliage/<crop>.xml`; `harvestPeriods` = Perioden, in denen ein `update` `endState="harvestReady"` hat oder `startState="harvestReady"` vorkommt, ohne `endState="dead"`-Periode. Fruchtnamen↔Foliage-Datei über `fruitTypes.xml` der Map. Deutsche Labels aus `translations_de.xml`/`l10n_de.xml`; Fallback: Fruchtname.
- [ ] **Step 5: Run** `node --test test/` – erwartet PASS.
- [ ] **Step 6: Commit** `feat: Mod-Daten extrahieren`

### Task 2: Rechenkern Fruchtfolge (Port von YieldCalculator.lua)

**Files:**
- Create: `src/calc.js`, `test/calc.test.js`

**Interfaces:**
- Consumes: `data.json` (Task 1).
- Produces (`src/calc.js`, CommonJS-Export):
  - `rotationFactor(data, {cropName:string, last:string|null, prev:string|null, catchCrop:string|null}) -> number`
  - `last`/`prev` sind Fruchtnamen oder `"FALLOW"` oder `null` (unbekannt).

- [ ] **Step 1: Failing tests** mit Werten aus `crops.xml`/`cropRotation.xml`:
  - `WINTERWHEAT` nach last=`SOYBEAN`(sehr gut, +0,15), prev=`PEA`(sehr gut, +0,10) ⇒ `1.25`.
  - `WINTERWHEAT` nach last=`WINTERWHEAT`, prev=`WINTERWHEAT` ⇒ Monokultur −0,05, Anbaupause −0,1 (nur Slot 1, `breakPeriods=1`), Vorfrucht schlecht −0,25 −0,2 ⇒ `0.4`.
  - Brache in beiden Slots ⇒ `1.10`.
  - Zwischenfrucht `MUSTARD` vor `MAIZE` (sehr gut) ⇒ `1.15`.
  - Unbekannte Frucht (nicht in crops) ⇒ `1.0`.
- [ ] **Step 2: Run** – FAIL.
- [ ] **Step 3: Implementiere `rotationFactor`** nach `YieldCalculator.lua` (Monokultur nur wenn `breakPeriods>0` und alle History-Slots gleich der Frucht; Anbaupause pro Slot `i-1 < breakPeriods`; Vorfrüchte je Slot-Index; Brache `+fallowStateBonus` je Slot; Zwischenfrucht überschreibt wie im Lua, bad > good > veryGood).
- [ ] **Step 4: Run** – PASS.
- [ ] **Step 5: Commit** `feat: Fruchtfolge-Rechenkern`

### Task 3: Precision-Farming-Faktoren

**Files:**
- Modify: `src/calc.js`, `test/calc.test.js`

**Interfaces:**
- Produces:
  - `soilFactor(data, soilIndex:number|null) -> number` (null ⇒ 1,0)
  - `nitrogenFactor(data, {cropName, soilIndex:number|null, nitrogen:number|null}) -> number` – `difference = nitrogen − targetLevel` (kg/ha), lineare Interpolation in `nitrogenYieldMappings`, an Tabellenenden geklemmt; fehlende Eingabe ⇒ 1,0.
  - `phFactor(data, {soilIndex:number|null, ph:number|null}) -> number` – `levelDifference = round((ph − phOptimal[soil]) / phValuePerState)`, geklemmt, über `phMappings`.
  - `totalFactor(data, input) -> {rotation, soil, nitrogen, ph, total, litersPerHa:number|null}` mit `total = rotation*soil*nitrogen*ph`.
  - `input = {cropName, last, prev, catchCrop, soilIndex, nitrogen, ph}`.

- [ ] **Step 1: Failing tests:** `soilFactor(data,3)===1.25`; `nitrogenFactor` WHEAT, Bodenart 2, N=180 ⇒ `1.0`; N=160 (Diff −20) ⇒ `0.90`; N=999 ⇒ Wert des höchsten Tabelleneintrags (kein NaN); `phFactor` mit ph=3 ⇒ endlicher Wert ≥0; `totalFactor` ohne PF-Eingaben ⇒ `total === rotation`.
- [ ] **Step 2: Run** – FAIL.
- [ ] **Step 3: Implementiere** die vier Funktionen. Vor dem Schreiben `PrecisionFarming.xml` (pH-`yieldMappings`, `nitrogenMap/fruitRequirements`) gegen Task-1-Daten abgleichen; weichen Formeln ab, ist die Mod-Datei maßgeblich und die Abweichung im Test-Kommentar zu notieren.
- [ ] **Step 4: Run** – PASS.
- [ ] **Step 5: Commit** `feat: Precision-Farming-Faktoren`

### Task 4: Kalender-Logik und Ergebnisliste

**Files:**
- Create: `src/calendar.js`, `src/plan.js`, `test/plan.test.js`

**Interfaces:**
- Produces:
  - `src/calendar.js`: `PERIODS: string[]` (12 Perioden in Spielreihenfolge `EARLY_SPRING`…`LATE_WINTER`), `periodLabel(p:string) -> string` (`EARLY_SPRING`→„März", `MID_SPRING`→„April", `LATE_SPRING`→„Mai", … `LATE_WINTER`→„Februar"), `isPlantable(crop, period) -> boolean`, `firstHarvestPeriod(crop) -> string|null` (erste Periode des Erntefensters, jahresübergreifend korrekt).
  - `src/plan.js`: `buildPlan(data, {last, prev, catchCrop, period, soilIndex, nitrogen, ph}) -> Row[]` mit `Row = {crop:Crop, plantable:boolean, factors:ReturnType<totalFactor>, plantingLabel:string, harvestLabel:string}`; sortiert: `plantable` zuerst, innerhalb nach `total` absteigend. Berücksichtigt nur Ackerfrüchte (ohne `ignoreInPlanner`, Gras/Wiese/Pappel/Zuckerrohr, Zwischenfrüchte).

- [ ] **Step 1: Failing tests:** `periodLabel('EARLY_SPRING')==='März'`; `isPlantable(WINTERWHEAT,'MID_AUTUMN')===true`, `'MID_SPRING'===false`; Saatfenster Herbst→Frühling wird für `LATE_WINTER` korrekt (je nach Daten) behandelt; `firstHarvestPeriod(WINTERWHEAT)==='EARLY_SUMMER'`; `buildPlan` in `MID_AUTUMN`: erste Zeile `plantable===true`, alle `plantable`-Zeilen vor allen nicht-`plantable`; Liste enthält kein `GRASS`/`MEADOW`.
- [ ] **Step 2: Run** – FAIL.
- [ ] **Step 3: Implementiere** beide Module wie in Interfaces beschrieben.
- [ ] **Step 4: Run** – PASS.
- [ ] **Step 5: Commit** `feat: Kalender und Ergebnisliste`

### Task 5: UI und Build der Einzeldatei

**Files:**
- Create: `src/ui.js`, `src/template.html`, `src/style.css`, `scripts/build.js`, `test/build.test.js`; erzeugt `dist/index.html`

**Interfaces:**
- Consumes: `buildPlan`, `periodLabel`, `PERIODS`, `firstHarvestPeriod`, `data.json`.
- Produces: `node scripts/build.js` ⇒ `dist/index.html` (alles inline, keine externen Requests).

- [ ] **Step 1: Failing test `test/build.test.js`:** nach `build.js` enthält `dist/index.html` weder `http://` noch `https://` in `src=`/`href=`-Attributen, enthält „Fruchtfolge-Planer" und den Versionsstempel (`data.meta.versions.cropRotation`).
- [ ] **Step 2: Run** – FAIL.
- [ ] **Step 3: Implementiere UI** nach dem freigegebenen Mockup `.superpowers/brainstorm/467-1794539071/content/design-v2.html` (zwei Themes: A hell „Feld & Erde", B dunkel „Traktor-Display", per CSS-Variablen). **Theme-Umschalter** im Kopf (Sonne/Mond-Button, `aria-pressed`), Startwert aus `prefers-color-scheme`, Wahl in `localStorage`. **Reihenfolge der Eingaben: erst Vorletzte Frucht, dann Letzte Frucht**, dann Monat, Zwischenfrucht. **Kalenderstreifen mit dreibuchstabigen Monatsnamen** (Jan, Feb, Mär, Apr, Mai, Jun, Jul, Aug, Sep, Okt, Nov, Dez), Saat „S" und Ernte „E" in den Zellen, gewählter Monat umrandet. Dropdowns letzte/vorletzte Frucht (gleiche Liste, deutsche Labels), Monat-Dropdown (12 Einträge via `periodLabel`; beim Wechsel der letzten Frucht automatisch auf `firstHarvestPeriod(last)` setzen, danach frei änderbar), Häkchen Brache (je Slot), Zwischenfrucht-Dropdown, optionaler Bereich „Genauere Werte" (Bodenart-Dropdown, pH, Stickstoff kg/ha). Ergebnistabelle: Frucht, Ertrag in % (Gesamtfaktor×100), Richtwert Liter/ha, Saatfenster, Erntefenster, Aufschlüsselung (Fruchtfolge/Boden/N/pH) als Tooltip. Säbare Zeilen grün, nicht säbare grau-rot, beschriftet („säbar"/„nicht säbar"), farbunabhängig lesbar. Eingaben in `localStorage` speichern. Fuß mit Versionsstempel.
- [ ] **Step 4: Implementiere `scripts/build.js`** (liest Template, inlined CSS, `calc.js`, `calendar.js`, `plan.js`, `ui.js`, `data.json`).
- [ ] **Step 5: Run** `node --test test/` und `node scripts/build.js` – PASS.
- [ ] **Step 6: Im Browser prüfen** (`dist/index.html` öffnen): letzte Frucht „Sojabohne", vorletzte „Erbse", Monat Herbst ⇒ Winterweizen oben mit ≈125 %; Konsole ohne Fehler; Screenshot ablegen.
- [ ] **Step 7: Commit** `feat: UI und Einzeldatei-Build`

### Task 6: Abgleich mit dem echten Spiel

**Files:**
- Create: `docs/verification.md`

- [ ] **Step 1:** Mit dem Nutzer 3 Felder aus dem Spiel nehmen (letzte/vorletzte Frucht, Bodenart, pH, N, angezeigter Ertrag im Spiel) und die Seite dagegen vergleichen.
- [ ] **Step 2:** Abweichungen in `docs/verification.md` notieren; Formel in `src/calc.js` korrigieren und Test ergänzen, bis Werte übereinstimmen (Toleranz ±1 Prozentpunkt).
- [ ] **Step 3: Commit** `docs: Abgleich mit Spiel`
