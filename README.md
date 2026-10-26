# Training

Grundlage für eine persönliche Trainings-App für Gym, Calisthenics, Mobility und Lauftraining.

## Projektkontext

- [Bestätigte Nutzerwünsche und offene Fragen](docs/APP_KONTEXT.md)
- [Zusammenfassung der Trainingsvorlage](docs/Arbeitsmappen-Kontext/Team_Progress_V11_Merknotizen.md)
- [Ausgelesene Zellwerte, Formeln und Blattmetadaten](docs/Arbeitsmappen-Kontext/Team_Progress_V11_Inhalte.json)

Der bestehende Split bleibt unverändert: Montag Push, Dienstag Pull, Mittwoch Legs + Core, Donnerstag Upper, Freitag Lower. Sämtliche Übungen gibt der Nutzer selbst vor.

Die erste mobile Web-App liegt in [app/](app/README.md). Sie enthält Wochenplan, Trainingserfassung, Pausentimer, Verlauf, Fortschritt und automatische Cloud-Speicherung je Nutzerkonto. Die Anmeldung erfolgt mit dem eigenen ChatGPT-Konto; lokale Daten werden ebenfalls pro Konto getrennt. Die Struktur ist für eine spätere Verpackung mit Capacitor als iOS-App vorbereitet. Die in den Unterlagen genannten lokalen Quellpfade dokumentieren die Herkunft und sind auf anderen Geräten nicht verfügbar.
