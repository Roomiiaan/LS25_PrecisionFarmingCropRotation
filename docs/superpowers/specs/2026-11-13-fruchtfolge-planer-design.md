# Fruchtfolge-Planer für LS25 (Gülzow, Precision Farming, Crop Rotation) – Design

## Intention
Der Nutzer spielt LS25 auf der Gülzow-Map mit Precision Farming, der Crop-Rotation-Mod und eingeschalteten Jahreszeiten. Bisher probiert er im Spiel jede Frucht einzeln durch, um den Ertrag zu sehen. Die Seite ersetzt das: Er gibt vorletzte und letzte Frucht an und sieht sofort für alle Früchte der Map, was sie an Ertrag bringen und ob sie jetzt säbar sind.

## Ziele
- Eingabe: vorletzte Frucht, letzte Frucht, Spielmonat.
- Ausgabe: Liste ALLER Früchte der Gülzow-Map mit Ertragspotenzial, Saatfenster und Erntefenster.
- Säbare Früchte stehen oben, nicht säbare darunter; beide Gruppen farblich klar unterscheidbar.
- Optionale Zusatzwerte für genauere Berechnung: Bodenart, pH-Wert, Stickstoff, Zwischenfrucht, Brache.
- Alle Zahlen stammen aus den echten Mod-Dateien (keine Schätzwerte aus dem Netz).

## Nicht-Ziele
- Kein Server, kein Account, keine Anbindung an das laufende Spiel.
- Keine Wirtschaftlichkeitsrechnung (Preise, Kosten).
- Keine Nutzung ohne Jahreszeiten (Seite setzt Jahreszeiten-Modus voraus).

## Anti-Ziele
- Falsche Zahlen, die vom Spiel abweichen, sind schlimmer als fehlende Features.
- Der Nutzer soll keinen Spielmonat selbst „raten" müssen.

## Entscheidungen des Nutzers
- Monat: Dropdown für den aktuellen Spielmonat. Vorbelegt mit dem frühesten Erntemonat der letzten Frucht, jederzeit änderbar.
- Alle Früchte anzeigen, säbare zuerst, farblich getrennt.
- Bodenart, pH und Stickstoff sind optional; ohne sie wird nur die Fruchtfolge gerechnet.

## Design (vom Nutzer freigegeben)
- Zwei Themes: A hell „Feld & Erde", B dunkel „Traktor-Display"; Umschalter in der Seite (Start nach Systemeinstellung, Wahl wird gespeichert).
- Eingaben in dieser Reihenfolge: Vorletzte Frucht, Letzte Frucht, Spielmonat, Zwischenfrucht; „Genauere Werte" aufklappbar.
- Pro Frucht eine Zeile: Name + Status (✓ säbar / – nicht säbar), Ertrag in % mit Balken und Richtwert l/ha, 12-Monats-Streifen mit dreibuchstabigen Monatsnamen (Jan … Dez), Saat „S", Ernte „E".
- Säbar/nicht säbar nie nur über Farbe, sondern auch über Text und Symbol.
- Mockup: `.superpowers/brainstorm/467-1794539071/content/design-v2.html`.

## Datenquellen (alle lokal, nur lesen)
Ordner: `C:\Users\Romian\Documents\My Games\FarmingSimulator2025\mods`
- `FS25_CropRotation.zip`: `xmls/crops.xml` (pro Frucht: breakPeriods, veryGoodCrops, goodCrops, badCrops, Zwischenfrüchte), `xmls/cropRotation.xml` (Bonus/Malus-Werte), `src/YieldCalculator.lua` (Formel).
- `FS25_Guelzow.zip`: `maps/config/fruitTypes.xml` (Fruchtliste), `maps/foliage/*/*.xml` (Block `<growth><seasonal>`: Perioden mit `plantingAllowed` und Wachstumszuständen bis `harvestReady`; `<harvest litersPerSqm>`).
- `FS25_precisionFarming.zip`: `PrecisionFarming.xml` (Bodenarten mit yieldPotential, Stickstoff-`fruitRequirements` pro Frucht und Bodenart, `yieldMappings` für N, pH-Werte und pH-yieldMappings).

## Berechnung
Fruchtfolge (aus YieldCalculator.lua): Faktor = 1,0 + Monokultur + Anbaupause + Vorfrucht-Effekte (letzte und vorletzte Frucht je nach sehr gut/gut/schlecht, Werte aus `cropRotation.xml`) + Brache + Zwischenfrucht.
Mit Precision Farming (nur wenn eingegeben): Bodenart-Potenzial × Stickstoff-Faktor (Differenz zum Zielwert) × pH-Faktor.

## Technik (Vorgabe: Entscheidung des Builders)
Einzelne statische HTML-Datei (offline nutzbar). Daten werden einmalig per Skript aus den Mod-ZIPs in ein eingebettetes JSON extrahiert. Gewählte Werte (z. B. Monat) lokal gespeichert.

## Dem Builder überlassen
Layout, Farbgebung, Tests, Extraktionsskript, genaue Umsetzung der pH-Formel.

## Meine Entscheidungen (bitte prüfen)
- Ertragsanzeige als Prozentwert relativ zum Basisertrag; zusätzlich geschätzte Liter pro Hektar aus `litersPerSqm`.
- Zwischenfrüchte und Brache sind ebenfalls optionale Eingaben.
- Früchte ohne Ertragsdaten in der Mod (z. B. Zwischenfrüchte als Hauptfrucht) werden als „nicht berechenbar" markiert.

## Ergänzungen nach Prüfung (alle meine Entscheidungen)
- **Maßgeblich:** `YieldCalculator.lua` ist die Wahrheit und wird 1:1 portiert (inkl. Sonderfälle). 100 % = Faktor 1,0 (keine Fruchtfolge-Wirkung), Werte über 100 % sind Bonus. Rotation- und Precision-Farming-Faktoren werden multipliziert; der Builder prüft das gegen die Mod-Dateien und meldet Abweichungen.
- **Monat:** Das Spiel kennt 12 Perioden (früh/mitte/spät je Jahreszeit, z. B. `EARLY_SPRING`). Das Dropdown zeigt diese als deutsche Monatsnamen (Frühling früh = März usw.). „Säbar" heißt: `plantingAllowed` in der gewählten Periode.
- **Fenster:** Saatfenster = Perioden mit `plantingAllowed`, Erntefenster = Perioden, in denen `harvestReady` erreicht ist und noch nicht `dead`. Fenster dürfen über den Jahreswechsel laufen. Bei Mehrfachernte (Gras) zählt der erste Schnitt für den Standard-Monat.
- **Fehlende Eingaben:** Fehlt Bodenart, pH oder Stickstoff, wird der jeweilige Faktor als 1,0 gerechnet. Liter/ha = `litersPerSqm` × 10000 × Gesamtfaktor, nur als Richtwert gekennzeichnet. Stickstoff in kg/ha, pH als Zahl (die Seite rundet auf die Spielstufen).
- **Brache und Zwischenfrucht:** Brache als Häkchen (zählt nicht als Frucht in der Liste), Zwischenfrucht als Dropdown aus den `catchCrops` der Mod.
- **Fruchtliste:** Alle Ackerfrüchte aus `crops.xml`, die auf der Gülzow-Map existieren; Gras, Wiese, Pappel, Zuckerrohr und Zwischenfrüchte sind keine Hauptfrucht-Ziele. Beide Dropdowns (letzte/vorletzte Frucht) nutzen dieselbe Liste. Deutsche Namen aus den l10n-Dateien der Mods.
- **Aktualität:** Einmaliger Snapshot mit Versionsstempel im Seitenfuß; das Extraktionsskript ist wiederholbar.
- **Sprache:** Oberfläche nur Deutsch.
