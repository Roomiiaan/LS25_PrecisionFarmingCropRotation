# Abgleich mit dem Spiel (Task 6)

## Teil 1: Fruchtfolge (Crop Rotation) – ERLEDIGT

Quelle: Screenshot des Fruchtfolgeplaners im Spiel (Gülzow), 5 Felder, 15 Werte, siehe `img.png`.
Test: `test/game-verification.test.js` (läuft mit `npm test`).

Ergebnis: **15 von 15 Werten stimmen exakt** mit `calc.rotationFactor` überein.

Das bestätigt:
- die 1:1-Portierung von `YieldCalculator.lua` (Monokultur, Anbaupause, Vorfrüchte sehr gut/gut/schlecht),
- die Zwischenfrucht (Ölrettich vor Hafer: +15 %),
- die Fruchtfolge als Kreis (Position 1 bekommt Frucht 3 und 2 als letzte/vorletzte Frucht).

Erkenntnisse:
- „Weizen" im Spiel ist `WHEAT` (nicht `WINTERWHEAT`). Mit `WINTERWHEAT` weichen 5 Werte um 5 Prozentpunkte ab.
- Namen im Spiel: `WHEAT` = „Weizen", `SORGHUM` = „Hirse" (in der Seite angepasst).

## Teil 2: Precision Farming (Bodenart, pH, Stickstoff) – OFFEN

Noch nicht gegen das Spiel geprüft:
- pH-Faktor (Interpolation über Stufen von 0,125 um das Optimum der Bodenart),
- Stickstoff-Faktor (Zielwert je Frucht und Bodenart, Interpolation),
- Stickstoff-Zuordnung für Sorten ohne eigene PF-Werte (Winterweizen → Weizen usw.).

### Fall 1: Feld 34, Mais (`img_1.png`, `img_2.png`) – erste Messung, noch nicht abschließend

Spiel: Boden Sandiger Lehm, pH 6,500 / 6,500 (Perfekt), Stickstoff 155 / 160 kg/ha (Perfekt), Fruchtfolgen-Ertrag 105 % (Mais nach Mais, vorletzte Hafer, keine Zwischenfrucht), **Erwarteter Ertrag 99 % | 11,9 t/ha**, **Ertragspotenzial 100 % | 12,0 t/ha**.

| Größe | Spiel | Rechenkern |
|---|---|---|
| Fruchtfolge | 105 % | 105 % ✔ |
| Bodenfaktor Sandiger Lehm | 100 % (Potenzial) | 1,00 ✔ |
| pH-Faktor (6,5 = Optimum) | 100 % | 1,00 ✔ |
| Stickstoff-Faktor (155 bei Ziel 160) | ca. 99 % (11,9 / 12,0 = 99,2 %) | 0,975 ✘ (ca. 1–2 Punkte zu niedrig) |

Befunde:
- Das Spiel zeigt die PF-Werte (Erwartet / Potenzial) **ohne** die Fruchtfolge. Die Fruchtfolge (105 %) steht getrennt. Der Rechenkern multipliziert beides, ob das Spiel am Ende genauso multipliziert, ist damit noch nicht belegt.
- Abweichung beim Stickstoff bei −5 kg/ha: Die Mod-XML würde linear zwischen −10 (0,95) und 0 (1,00) interpolieren, also 0,975. Das Spiel zeigt rund 0,99. Mögliche Ursachen: angezeigter Wert gerundet, andere Interpolation oder Gewichtung nach den gemischten Bodenarten des Feldes (54 % Sandiger Lehm, 14 % Lehm, 29 % Schluffiger Ton). Der PF-Code ist kompiliert, daher nicht nachlesbar.
- Es wurde absichtlich noch nichts am Rechenkern geändert: Ein Messpunkt reicht nicht, um die Ursache zu klären.

### Fall 2: Feld 23, Luzerne (`img_3.png`, `img_4.png`)

Spiel: Boden Schluffiger Ton, pH 7,000 / 7,000 (Perfekt), Stickstoff 115 / 40 kg/ha (Schlecht, überdüngt), Fruchtfolge 100 %, **Erwarteter Ertrag 96 % | 14,4 t/ha**, **Ertragspotenzial 99 % | 14,9 t/ha**. Feld-Ertragspotenzial (Bodenverteilung 47 % Sandiger Lehm, 41 % Lehm, 10 % Schluffiger Ton): ca. 108 %.

Rechenkern: Stickstoff-Faktor bei +75 kg/ha = 0,8975, also 10 % Abzug. Das Spiel zeigt nur ca. 3,4 % Abzug (14,4 / 14,9 = 0,966).

**Muster über beide Fälle:** Der Stickstoff-Abzug im Spiel ist jeweils etwa **ein Drittel** des Abzugs aus der Mod-XML.
- Fall 1: Abzug XML 2,5 % → ein Drittel = 0,83 %, Spiel 0,83 % (11,9 / 12,0).
- Fall 2: Abzug XML 10,25 % → ein Drittel = 3,4 %, Spiel 3,4 % (14,4 / 14,9).
Zwei unabhängige Punkte mit demselben Faktor sind ein starker Hinweis, aber noch keine Bestätigung (unbekannt: gilt das auch für pH und für sehr niedrigen Stickstoff?).

Offen bleibt der **Bodenfaktor**: Das Spiel zeigt für Schluffigen Ton ein Potenzial von 99 %, die XML sagt 0,9. Für Sandigen Lehm stimmt es (100 %). Das Feld-Potenzial von 108 % passt dagegen zur ungedämpften Mischung der XML-Werte (ca. 109 %). Ursache unklar (Potenzial pro Pixel statt pro Bodenart, Gewichtung, oder crop-spezifischer Wert).

### Fall 3: Feld 23, andere Stelle (`img_5.png`)

Spiel: Boden Lehm, pH 6,750 / 6,750 (Perfekt), Stickstoff 85 / 60 kg/ha (Gut, +25), Luzerne, Fruchtfolge 100 %, **Erwartet 123 % | 18,4 t/ha**, **Potenzial 125 % | 18,6 t/ha**.

- Bodenfaktor Lehm: Spiel 125 %, XML 1,25 ✔ (ungedämpft).
- Stickstoff bei +25: XML-Abzug 2,5 %, ein Drittel = 0,83 % → Verhältnis 0,9917. Spiel: 18,4 / 18,6 = 0,989 (Rundungsbereich 0,984–0,995) ✔. Mit dem ungedämpften XML-Wert (0,975) läge es außerhalb.
- Damit passt „Abzug = ein Drittel" nun in 3 von 3 Fällen (−5, +25, +75 kg/ha).
- Bodenfaktor Schluffiger Ton bleibt der einzige Ausreißer (Spiel 99 %, XML 0,9; die XML-Werte wurden nochmals gegen `PrecisionFarming.xml` geprüft, korrekt extrahiert).

### Fall 4: Feld 23, Schluffiger Ton, pH daneben (`img_6.png`)

Spiel: Luzerne, Ton, pH **6,750 / 7,000** (Gut, −0,25), Stickstoff 115 / 40, **Erwartet 95 % | 14,3 t/ha**, **Potenzial 99 % | 14,9 t/ha**. Gleiches Feld, gleiche Stelle wie Fall 2, nur pH 0,25 niedriger (dort 7,000: 96 % | 14,4 t/ha).

- Der pH-Abzug im Spiel ist nur ca. 0,7 % (14,3 / 14,4 = 0,993; Rundungsbereich 0,986–1,0).
- Rechenkern: 0,25 / 0,125 = 2 Stufen → Faktor 0,95 (5 % Abzug). Mit der „ein Drittel"-Regel 0,983 → 14,15 t/ha statt 14,3. Knapp außerhalb.
- Zwei Deutungen passen: (a) der pH-Abzug ist stärker gedämpft (ca. 1/7), oder (b) eine Stufe entspricht 0,25 statt 0,125 (dann −1 Stufe = 0,975, ein Drittel = 0,992 ✔). Ein Punkt unterscheidet sie nicht, dafür braucht es einen Fall mit größerer pH-Abweichung (z. B. −0,75).
- Das Potenzial bleibt 99 % (Ton), unabhängig vom pH: Der Boden-Ausreißer ist also kein pH-Effekt.

### Fall 5: Feld 23, pH 6,375 / 7,000 (`img_7.png`) und Umsetzung

Spiel: Ton, Luzerne, pH **6,375 / 7,000** (Schlecht, −0,625), N 115 / 40, **Erwartet 92 % | 13,8 t/ha** (Potenzial 99 % | 14,9). Verhältnis zu Fall 2 (pH perfekt): 13,8 / 14,4 = 0,958 → pH-Abzug nur ca. 4,2 %.

Die Tabelle der Mod (Stufe 0,125 pH, −5 Stufen = 0,6) passt dazu nicht (40 % Abzug, mit „ein Drittel" immer noch 13 %). Erklärung 2 aus Fall 4 (Stufe 0,25) scheidet ebenfalls aus (ergäbe 2,5 %). Es passt: **Abzug = ein Drittel, und eine Tabellenstufe entspricht ca. 0,2 pH** (kontinuierlich interpoliert, nicht gerundet).

Umgesetzt in `src/calc.js` (`PF_EFFECT_WEIGHT = 1/3`, `PH_EMPIRICAL_STEP = 0,2`) mit Test `Spielwerte PF` (5 Fälle, Toleranz 1 Prozentpunkt), erst rot, jetzt grün; Suite 77/77.

**Wichtig:** Das ist ein empirisches Modell, an 5 Messpunkten angepasst. Belegt für Stickstoff −5 bis +75 kg/ha und pH −0,625 bis 0. Nicht belegt: sehr niedriger Stickstoff, pH über dem Optimum, Ton-Bodenfaktor.

### Fall 6: Feld 17, Lehmiger Sand, sehr wenig Stickstoff (`img_8.png`, `img_9.png`) – ABWEICHUNG

Spiel: Silage Mais, Lehmiger Sand (Feld zu ca. 90 % Lehmiger Sand), pH **5,750 / 6,000** (Gut), Stickstoff **20 / 120** (Schlecht, −100), Fruchtfolge 115 %, **Erwartet 67 % | 4,3 t/ha**, **Potenzial 80 % | 5,2 t/ha**.

- Bodenfaktor Lehmiger Sand: Spiel 80 %, Mod 0,8 ✔.
- Verhältnis Spiel: 4,3 / 5,2 = 0,827 (Rundungsbereich ca. 0,81–0,85). Modell: Stickstoff 0,80 × pH 0,99 = 0,792 ✘ (ca. 3,5 Punkte zu niedrig).
- Bei pH-Abzug ca. 1 % bleibt für Stickstoff ca. 0,84 im Spiel. Mod-XML bei −100: 0,40, „ein Drittel" ergibt 0,80. Das Spiel liegt eher bei 0,84 (Abzug ca. 16 %), also nicht ganz ein Drittel. Eine Ursache ist nicht belegt (andere Gewichtung bei großen Abweichungen, andere Zielmenge, Rundung).
- Der Test ist als `todo` eingetragen (läuft mit, bricht `npm test` aber nicht). Das Modell wurde bewusst nicht an einem Punkt nachgezogen.

Benötigt für den nächsten Schritt: ein Fall mit deutlich zu wenig Stickstoff (z. B. 80–100 kg/ha bei Ziel 160) und einer mit abweichendem pH, am besten auf einem Feld mit nur einer Bodenart.

Benötigt pro Fall: Bodenart, pH, Stickstoff (kg/ha), geplante Frucht und der vom Spiel angezeigte Ertrag bzw. das Ertragspotenzial (mit Fundstelle im Spiel, am besten Screenshot).
Toleranz: ±1 Prozentpunkt.

## Teil 3: Saat- und Erntekalender (`img_10.png`) – ERLEDIGT

Quelle: Anbaukalender im Spiel (9 Früchte: Raps, Reis, Roggen, Rote Bete, Silage Mais, Sojabohnen, Sonnenblumen, Spinat, Triticale). Test: `Spielwerte Kalender` in `test/game-verification.test.js`.

Befund: Die **Saatfenster** stimmten schon, die **Erntefenster** waren falsch (meist einen Monat zu früh, bei Silage Mais Sep–Okt statt Okt–Dez, bei Rote Bete Apr–Okt statt Aug–Nov).

Ursachen in `scripts/extract.js` (beide behoben):
1. Die Updates der Map-Mod wirken **am Ende der Periode** (steht so im Kommentar der Reis-Datei). Erntereif ist eine Periode also erst, wenn die Pflanze bei ihrem Beginn schon reif ist.
2. Es wurde ein gemeinsamer Zustand für alle Pflanzen geführt. Richtig ist: je Saatperiode eine Pflanze von der Aussaat an verfolgen (pro Periode eine Stufe), das Erntefenster ist die Vereinigung. Sonst zählen Updates für Pflanzen, die es im Jahr noch gar nicht geben kann (Rote Bete ab April).

Ergebnis: 9 von 9 Früchten stimmen in Saat und Ernte. Betroffen waren fast alle Erntefenster (z. B. Weizen, Mais, Kartoffeln, Zuckerrüben); Gras, Wiese, Luzerne und Klee haben jetzt ebenfalls Erntefenster (Apr–Nov), diese sind **nicht** gegen das Spiel geprüft.

## Teil 4: Zwischenfrüchte (Saat, Wachstum, Vergleich) – Reifemonate OFFEN

- **Bonus beim Säen:** In `FSDensityMapUtilExtension.lua` setzt `updateCropRotationForSowingArea` den Zwischenfrucht-Zustand beim **Säen** der Zwischenfrucht. Das Wachstum spielt für die Fruchtfolge-Berechnung keine Rolle; letzte/vorletzte Frucht ändern sich nicht, die Brache wird zurückgesetzt. Beim Ernten der Hauptfrucht wird der Zustand gelesen und zurückgesetzt.
- **Saatmonate** (Nutzer bestätigt): Ölrettich, Senf, Humusaktiv März–Oktober, Blühende Zwischenfrucht März–Oktober ohne Oktober (März–September).
- **Wachstum:** wie bei den Erntefenstern (Updates am Periodenende). Ölrettich: 2 Monate bis `harvestReady` (im Winter stockt es: im Oktober gesät erst nach 5 Monaten), bleibt reif. Senf, Humusaktiv, Blühende Zwischenfrucht: meist 3 Monate; Senf verdorrt später. Die Werte stehen je Saatperiode in `data.json` (`catchCrops[].growth`).
- **Beobachtung im Spiel:** Ölrettich zeigt „Wachstum 2/3". Das passt: drei Stufen (unsichtbar, klein, reif), 2/3 ist die kleine Pflanze. Die **Reifemonate** sind damit noch nicht belegt.
- **Offen:** Saatmonat und aktuellen Monat notieren, dann prüfen, wann „3/3" erreicht ist (Ölrettich: 2 Monate nach der Saat). Danach als Test unter `Spielwerte` aufnehmen.
