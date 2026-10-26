# Team Progress · Version 0.2

Mobile Web-App, nach den Bildreferenzen gestaltet, für spätere Verpackung mit Capacitor vorbereitet. Der ursprüngliche V11-Split bleibt der unveränderte Startplan.

## Start und Prüfung

Node.js 22+ und Python 3, keine externen Laufzeitabhängigkeiten:

```sh
npm run dev     # http://localhost:3000, lokales Training ohne Cloud
npm run check
npm run build   # Worker mit eingebetteten Assets nach build/server/index.js
npm test        # 16 Logik-/API-Tests; Python/SQLite für API-Tests
```

## Funktionen

- Eigene Pläne und Übungen anlegen, Pläne kopieren/ändern/aktivieren. Trainingstage, Übungsreihenfolge, Sätze, Zielwiederholungen, RIR und Pausen je Übung bearbeiten.
- Drei begründete, nach Tagen/Erfahrung/Ziel/Ausrüstung filterbare Gym-Vorlagen (3, 4, 5 Tage). Übernahme als eigene Kopie; Aktivierung erfolgt bewusst separat.
- Laufende und gespeicherte Trainings enthalten einen Plan-Snapshot. Änderungen am Plan beeinflussen deren Übungen oder Zielwerte nicht.
- Satzprotokoll, Vorwerte, Notizen und Pausentimer. Individuelle Pause pro Übung; manuelle Anpassung während des Trainings übersteuert sie für diese Einheit. Die Standardpause bleibt unverändert.
- Warm-up nach V11: erste gewichtete Übung pro Muskelgruppe, 50 % × 5–6 und 90 % × 2–3 Wdh., auf 2,5 kg gerundet. Separat abhaken, ohne Einfluss auf Arbeitsvolumen.
- Nachträgliche Korrektur von Datum, Dauer, Sätzen und Notizen. Rekorde und Statistiken werden aus tatsächlichen, korrigierten Daten berechnet.
- Trainingsvergleich mit der letzten gleichen Einheit: Sätze, Wiederholungen und Volumen. Mehr Volumen ist nicht automatisch mehr Kraft.
- Persönliche Rekorde für Gewicht, Satzwiederholungen und Einheitsvolumen. Bei Körpergewicht zählt ausschließlich eingetragenes Zusatzgewicht.
- Monatskalender: tatsächliche Trainings sehen, Tagesplanung ändern, Einheiten verschieben und Tagesausnahmen zurücksetzen. Abgeschlossene Einheiten werden nicht mit verschoben.
- Laufen und Mobility separat protokollieren: Dauer, Distanz, Laufart (frei/Zone 2/HIIT), Notizen, Pace. Keine automatisch ergänzten Mobility- oder Laufprogramme.
- JSON-Sicherung/-Import mit Migration bestehender V1-Daten und Zusammenführung von Plänen, Einheiten, Aktivitäten und Kalender.
- Optionaler Cloud-Abgleich in den Einstellungen. Auf jedem Gerät separat aktivieren, dasselbe ChatGPT-Konto und dieselbe App-Adresse verwenden.

## Daten und Synchronisierung

`dist/` bleibt der eigenständige Web-Client und Capacitor-`webDir`. `domain.js` enthält Berechnungen, Migration/Validierung und Zusammenführung. `features.js` enthält Planeditor, Kalender, Aktivitäten und Verlaufsbearbeitung; `sync.js` den Abgleich. LocalStorage-Schlüssel bleibt `team-progress:v1`, das Datenformat ist Version 2.

Der Worker authentifiziert ausschließlich über die von Sites bereitgestellte Nutzer-ID. D1 speichert einen versionierten Datenstand je Nutzer-ID; jede Abfrage bindet diese serverseitige ID. Schreibzugriffe verlangen denselben Origin. Revisionen verhindern blindes Überschreiben parallel gespeicherter Daten. Einzelne Datensätze werden über ID/Änderungszeit zusammengeführt, Löschmarkierungen verhindern Wiederherstellung gelöschter Einträge durch ein anderes Gerät. Gleichzeitige Änderungen am selben Eintrag lösen nach dem neuesten Änderungszeitpunkt auf (Geräteuhren sollten stimmen). Laufende Trainings und Timer bleiben auf dem jeweiligen Gerät.

Die DB-Migration liegt in `drizzle/0000_training_states.sql`; keine Schemaänderungen zur Laufzeit. Der Worker-Build bleibt unabhängig vom statischen Client, der weiter lokal und später in Capacitor nutzbar ist.

Nach erfolgreicher Ersteinrichtung unterstützt der Service Worker den Offline-Start. Cloud-Abgleich braucht Netz; lokale Änderungen bleiben erhalten. Auf iOS: Safari → Teilen → Zum Home-Bildschirm. Native iOS-Veröffentlichung, Health, Watch, Hintergrundbenachrichtigungen und 3D-Animationen sind weiterhin nicht enthalten. Safari/iOS auf einem realen Gerät noch prüfen.
