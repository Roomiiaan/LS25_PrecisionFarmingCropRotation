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

Benötigt pro Fall: Bodenart, pH, Stickstoff (kg/ha), geplante Frucht und der vom Spiel angezeigte Ertrag bzw. das Ertragspotenzial (mit Fundstelle im Spiel, am besten Screenshot).
Toleranz: ±1 Prozentpunkt.
