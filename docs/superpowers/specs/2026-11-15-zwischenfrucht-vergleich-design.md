# Zwischenfrucht-Vergleich – Design (kleine Änderung)

## Intention
Heute ist die Zwischenfrucht nur eine Eingabe, die den Ertragsfaktor der Hauptfrüchte ändert. Der Nutzer will vor dem Säen entscheiden, ob sich ein Umweg über eine Zwischenfrucht lohnt: Er sät sie, wartet bis sie gewachsen ist, grubbert sie unter (erst wenn er die Hauptfrucht säen will) und sät dann die Hauptfrucht. Die Seite soll zeigen, ab wann das geht, was er dann säen kann und was es bringt, im Vergleich zu „direkt säen".

## Ziele
- Neuer Bereich „Mit Zwischenfrucht" (Variante B, vom Nutzer gewählt): pro jetzt säbarer Zwischenfrucht eine Karte.
- Karte zeigt: Saatmonat (= gewählter Spielmonat), Reifemonat, die ab dem Reifemonat säbaren Hauptfrüchte mit Ertrag inklusive Zwischenfrucht-Bonus, die bis dahin aus dem Saatfenster fallenden Hauptfrüchte, ein Fazit (bester Wert mit vs. direkt).
- Zum Vergleich: beste Hauptfrucht „direkt jetzt" (ohne Zwischenfrucht).
- Zahlen kommen aus den Mod-Dateien; die Saatmonate der Zwischenfrüchte sind vom Nutzer bestätigt.

## Nicht-Ziele
- Keine Wirtschaftlichkeit (Saatgutkosten, Arbeitszeit).
- Das bestehende Zwischenfrucht-Dropdown und die Liste bleiben unverändert.

## Anti-Ziele
- Falsche Monate sind schlimmer als fehlende Anzeige: Reifezeiten sind noch nicht gegen das Spiel geprüft und werden so gekennzeichnet, bis der Nutzer sie bestätigt.

## Was die Mod-Dateien hergeben (geprüft)
- Der Bonus wird beim **Säen** der Zwischenfrucht gesetzt, nicht beim Wachsen (`FSDensityMapUtilExtension.lua`); Letzte/vorletzte Frucht ändern sich dabei nicht, die Brache wird zurückgesetzt.
- Wachstum: Updates wirken am Periodenende (wie bei den Erntefenstern, im Spiel bestätigt). Ölrettich: 2 Monate bis `harvestReady`, bleibt reif. Senf, Humusaktiv, Blühende Zwischenfrucht: 3 Monate; Senf verdorrt später, die anderen im Winter.
- Saat März–Oktober (Blühende Zwischenfrucht März–September).

## Meine Entscheidungen (bitte prüfen)
- „Gewachsen" = Stufe `harvestReady` (letzte Stufe). Der Nutzer grubbert, sobald er die Hauptfrucht säen will, aber erst nach dem Wachstum.
- Das Hauptfrucht-Fenster beginnt am Reifemonat und endet, wenn die Zwischenfrucht verdorrt (Senf); bei den anderen bleibt es bis zum Verdorren/Jahresende offen. Das Ende der Hauptfrucht-Saatzeit begrenzt es ohnehin.
- Der Reifemonat kann im nächsten Kalenderjahr liegen (über den Jahreswechsel); die Anzeige nennt das.
- Wenn die Hauptfrucht im Reifemonat nicht säbar ist, erscheint sie unter „nicht mehr säbar bis dahin", nicht in der Ertragsliste.
- Berechnung mit der bestehenden `buildPlan`-Logik: pro Zwischenfrucht ein Aufruf mit `catchCrop` und `period = Reifemonat`, danach Filter auf säbar.
- Zwischenfrucht-Saatfenster und Wachstumsdauer kommen aus `scripts/extract.js` (je Saatperiode eine Pflanze verfolgen, wie bei den Erntefenstern) und werden in `data.json` je Zwischenfrucht abgelegt (`plantingPeriods`, `growMonths`, `readyPeriods`).

## Dem Builder überlassen
Layout der Karten (zwei Themes beachten, Status nie nur über Farbe), Texte, Tests (Reife-Monate als Spielwerte-Test, sobald der Nutzer sie bestätigt hat), Platzierung im Seitenaufbau.

## Approaches
- A: Zwischenfrüchte als zusätzliche Zeilen in der Liste: wenig Aufwand, aber kein Vergleich, Liste wird unübersichtlich.
- **B (gewählt):** eigener Bereich mit Karten: zeigt Reife, Folgefrüchte und das Fazit „lohnt sich oder nicht".
- C: nur Knopf „Monat auf Reife setzen": minimal, sagt aber nicht, ob es sich lohnt.

## Nachtrag: Tabs statt Karten (vom Nutzer gewünscht und bestätigt)
- Jede jetzt säbare Zwischenfrucht ist ein Tab mit Kurzfassung (beste Folgefrucht, Ertrag, frühester Saatmonat, Wartezeit, ✓ bei „lohnt sich" / – sonst). Darunter steht für den gewählten Tab Saat → Gewachsen und eine Tabelle (Frucht, Ertrag, Säbar ab, Wartezeit) über die volle Breite.
- Wartezeit als Text: „in 5 Monaten", ab 12 Monaten „in 1 Jahr 3 Monaten". Die Jahresangabe steht als Marke neben dem Monat, nicht in Klammern.
- Beste Folgefrucht: höchster Ertrag, bei Gleichstand der frühere Monat. Voreingestellter Tab: der mit dem besten Ertrag (`top`). Die Auswahl wird je Feld gespeichert (`cptab`).
- Direktvergleich rechnet ohne Zwischenfrucht aus dem Dropdown; Datenfeld heißt `growth` (nicht `growMonths`/`readyPeriods`).
