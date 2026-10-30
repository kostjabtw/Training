# Supabase-Vorbereitung

Projekt: https://cigbalsmzvojxjdzbvcs.supabase.co

## Jetzt: Datenbank einrichten

1. Im Supabase-Projekt **SQL Editor → New query** öffnen.
2. Den gesamten Inhalt von `001_account_storage.sql` einfügen und **Run** wählen.
3. Erwartetes Ergebnis: **Success. No rows returned**.

Die Migration einmal ausführen. Sie wird in einer Transaktion ausgeführt und überschreibt keine bestehende Tabelle. Falls bereits eine Tabelle `progress_states` existiert, zuerst deren Herkunft prüfen; nicht löschen.

Die Tabelle speichert einen versionierten Datenstand je Konto mit Training, Plänen, Habits und Einstellungen. Angemeldete Nutzer können nur ihre eigene Zeile lesen. Schreiben erfolgt über `save_progress`, das die Nutzer-ID ausschließlich aus der angemeldeten Sitzung bezieht. Gäste erhalten keinen Zugriff. Ein veralteter Datenstand wird zurückgewiesen, damit der Client ihn zunächst zusammenführen kann.

## Danach: Anmeldung vorbereiten

- Unter Authentication die E-Mail-Anmeldung und E-Mail-Bestätigung aktivieren.
- Die endgültige Site URL und erlaubte Redirect URLs erst nach Festlegung der unabhängigen App-Adresse setzen.
- Für Registrierung, Passwort-Zurücksetzen und Anmeldelinks an die anderen Nutzer eigenen SMTP-Versand konfigurieren. Supabases eingebauter Testversand ist kein zuverlässiger Versand für beliebige Nutzer.
- Google und Apple benötigen jeweils zusätzliche Provider-Konfiguration.

## Noch ausstehend

Der lokale Web-Client verwendet jetzt Supabase Auth (PKCE) und die Tabelle progress_states. Die veröffentlichte App verwendet bis zur gesondert freigegebenen Veröffentlichung weiterhin Sites-Anmeldung und D1. Die Worker-API bleibt für die bisherige Veröffentlichung im Repository, wird vom neuen Client aber nicht aufgerufen. Google/Apple sind noch nicht eingerichtet. Vor dem Kontowechsel die bisherigen Daten exportieren und im neuen Konto importieren; alte Sites-IDs werden nicht automatisch Supabase-Konten zugeordnet.

Der Publishable Key ist für den Browser vorgesehen und ersetzt keine Zugriffsregeln. Datenbankpasswort, Secret Key und Service-Role-Key gehören nicht in den Client oder ins Repository.

## Lokale Prüfung

`npm ci`, dann `npm run bundle:auth`, `npm run check`, `npm run build` und `npm test`. Der Supabase-Client wird lokal gebündelt; kein CDN zur Laufzeit. `npm run dev` startet die Oberfläche. Für echte E-Mail-Tests die konkrete lokale URL als Redirect URL erlauben. PKCE-E-Mail-Links im selben Browser öffnen, in dem sie angefordert wurden.

Die 20 bestehenden Logik-/API-Tests bestehen. Zusätzlich wurden im mobilen Browser mit simulierten Supabase-Antworten Login, Logout, Kontentrennung, RPC-Speicherung, Registrierung, Link-Anforderung, Reset-Anforderung und das Formular zur Passwortänderung geprüft. Echte Mailzustellung, vollständiger E-Mail-Rücksprung, Token-Erneuerung und Datenbank-Zugriffsregeln mit echten Konten sind noch nicht Ende-zu-Ende geprüft.

Supabase-Konsole: Authentication → URL Configuration für Site URL/Redirect URLs, Authentication → Email/SMTP für eigenen Versand. Erst nach dessen Einrichtung und Nutzereinwilligung echte Testmails auslösen.

## Coaching additions

Personal setup with plan preview, optional load suggestions, goals, body measurements,
per-set/session notes, muscle-group set distribution, optional milestones, CSV and
printable PDF reports, and revocation of other sessions are in `dist/coaching.js`.
Goals/measurements merge by ID/update time. Existing backups remain readable.
Running workouts and their notes remain local until completed, as before.

Run `002_delete_account.sql` in the Supabase SQL editor to enable account deletion.
The function takes no user ID and deletes only `auth.uid()`; related progress is removed
by the existing foreign key cascade. The UI requires typing LÖSCHEN. No account was
deleted during development. Revoked access tokens can remain valid until expiry.

Reminders currently run only while the app is open, in the device's local time.
Closed-app Web Push needs a subscription store, scheduled sender and VAPID secrets;
these services are not configured by this change. Permission requires an explicit tap.

Validation: `npm run check`, `npm run build`, `npm run test:coaching`, existing domain
suite. Mobile Chromium smoke test uses a mock account and local storage; it does not
claim a live Supabase end-to-end test. The existing upgrade suite stalls in this
environment and was terminated after 30 seconds.
