# Projekt-Tagebuch: Mein Fitness-Tracker

## 1. Worum es geht

Eine persönliche Fitness-App für das Handy. Sie läuft im Browser (Chrome auf dem
Samsung-Smartphone) und speichert alle Daten **nur auf dem Gerät** (im Browser-Speicher
„localStorage“), nicht im Internet.

Bereiche der App:
- Training: Krafttraining (Studio), Cardio, Bodyweight (eigenes Körpergewicht), Dehnen
- Schritte: Schrittzähler, Tagesziel, Rückblick letzte 7 Tage
- Laufen: Läufe eintragen und vergleichen („adidas Running Schnittstelle“)
- Ernährung: Mahlzeiten, Wasser-Tracker („Yazio Schnittstelle“)
- Statistik: Gesamtbilanz, Verlauf, Übungs-Entwicklung, Tages-Archiv
- Motivation: Streaks, Wochen-Herausforderung, persönliches „Warum“, Abzeichen
- Körper: Waage, Gewichtsziel, Körperwerte, Alter
- Datensicherung: Backup speichern / laden (JSON-Datei)

**Online:** https://marchens1977.github.io/Fitness-Tracker/ (über GitHub Pages).
Jede Änderung, die in `main` übernommen wird, erscheint dort nach ein bis zwei
Minuten automatisch. Tipp für das Handy: Seite in Chrome neu laden, falls noch
die alte Version angezeigt wird.

## 2. Technischer Aufbau

- `index.html` – die **gesamte App in einer Datei** (Aussehen, Inhalt und Programmlogik).
- `CLAUDE.md` – dieses Tagebuch.
- `android/` – eigene **Android-App** (Schrittzähler), siehe Abschnitt „Android-App“.
- `.github/workflows/android-app.yml` – baut die App-Datei (APK) automatisch bei GitHub.

Wichtige Details in `index.html`:
- Gespeicherte Daten (localStorage-Schlüssel, alle mit Endung `V2`), z. B.
  `gymStrengthWorkoutsV2`, `gymCardioWorkoutsV2`, `bwWorkoutsV2`, `stretchWorkoutsV2`,
  `runningLogsV2`, `stepsHistoryV2`, `dailyStepGoalV2`, `nutritionV2`,
  `nutritionHistoryV2`, `waterV2`, `waterHistoryV2`, `userWeightV2`,
  `userGoalWeightV2`, `userBodyFatV2`, `bodyMetricsLogV2`, `userDobV2`,
  `personalWhyV2`, `activeDatesV2`.
  **Diese Namen nicht ändern**, sonst sind bestehende Daten auf dem Handy „weg“.
- Datenschnittstelle „fitness-bridge/1“: Fremddaten (Schritte, Gewicht, Läufe,
  Ernährung) können per JSON-Datei über „Backup laden“ oder per
  `window.FitnessHealthBridge.ingest(...)` importiert werden. Wiederholter Import
  erzeugt keine Doppelungen.
- Die „Sync“-Knöpfe bei adidas Running und Yazio zeigen bisher nur einen Hinweis
  („bereit für Firebase-Verbindung“) – eine echte Verbindung gibt es noch nicht.

### Android-App (Ordner `android/`)

- Kleine App (Java, ohne Zusatz-Bibliotheken), die die Online-Seite anzeigt
  (`MainActivity.java`) und den Schrittzähler-Chip des Handys ausliest.
- `StepStore.java` merkt sich Schritte pro Tag (Differenz zwischen zwei Ablesungen;
  Handy-Neustart wird erkannt). Gezählt wird erst **ab der Installation**.
- Im Hintergrund: Ablesen ca. alle 15 Min. (`StepJobService.java`) und kurz vor
  Mitternacht + nach Neustart (`StepAlarmReceiver.java`). Steps gehen nicht verloren,
  wenn Android das verzögert – der Chip zählt immer weiter.
- Übergabe an die Webseite: `window.FitnessNativeApp.onSteps([{date, steps}], zustand)`
  in `index.html` („größerer Wert gewinnt“). Backup speichern ruft in der App
  `window.AndroidApp.saveFile(...)` auf (Speicherort wählen).
- Download der fertigen App:
  https://github.com/marchens1977/Fitness-Tracker/releases/latest/download/FitnessTracker.apk
  (wird bei jeder Änderung an `android/` auf `main` neu gebaut).
- Signatur-Schlüssel `android/app/app-signing.keystore` liegt bewusst im Projekt
  (Passwort steht in `app/build.gradle`), damit Updates ohne Neuinstallation
  klappen. Bei Neuinstallation (Deinstallieren) wären die App-Daten weg →
  vorher Backup!

## 3. Regeln und Entscheidungen

- Alles bleibt in **einer Datei** (`index.html`), damit die App einfach zu öffnen ist.
- App-Sprache ist Deutsch, dunkles Design (Akzentfarbe Türkis `#03dac6`).
- Daten bleiben lokal auf dem Gerät; Sicherung über Backup-Datei.
- Keine persönlichen oder geheimen Daten (E-Mail, Passwörter, API-Schlüssel) ins
  Projekt schreiben.

## 4. Verlauf

- 15.11.2026 – App-Datei `index.html` vom Nutzer hochgeladen (erster Stand).
- 16.11.2026 – Projekt-Tagebuch `CLAUDE.md` angelegt (PR #1).
- 17.11.2026 – Online-Adresse (GitHub Pages) im Tagebuch ergänzt.
- 17.11.2026 – Entscheidung: eigener Schrittzähler als Android-App (Plan B, siehe unten).
- 17.11.2026 – Android-App gebaut (Ordner `android/`, automatischer APK-Bau).
- 17.11.2026 – Nutzer hat die App installiert (Play Protect: „App scannen“ reicht).
  Zählen bei geöffneter App funktioniert. Kein Backup nötig (noch keine Daten).
  Achtung: Nutzer hatte zuerst Chrome statt der App offen – erkennbar an der
  Adresszeile oben; die App hat keine.
- 17.11.2026 – App-Symbol geändert: türkise Hantel statt Fußabdrücke
  (`android/app/src/main/res/drawable/ic_launcher_foreground.xml`).

## 5. Offene Ideen / nächste Schritte

- **Als Nächstes: Hintergrund-Zählen prüfen** (18.11.): Zählt die App, während sie
  geschlossen ist? Landen Abend-Schritte beim richtigen Tag (Mitternacht)?
- Bei Zeitschätzungen künftig „wahrscheinlich X, schlimmstenfalls Y“ angeben
  (die erste Schätzung war deutlich zu großzügig).
- (Erledigt, Hintergrund zur Entscheidung:) eigener Schrittzähler (Plan B).
  - Hintergrund: Eine Webseite darf in Chrome nur zählen, solange sie offen und
    der Bildschirm an ist. Den vorhandenen „Live-Zähler“ (`toggleMotionStepCounter`,
    `handleDeviceMotion` in `index.html`) gibt es schon, er ist aber recht ungenau.
  - Plan: kleine eigene Android-App, die die Webseite anzeigt und den eingebauten
    Schrittzähler-Chip des Handys (Android-Sensor „Step Counter“) direkt ausliest,
    ganz ohne Samsung Health / Google Health Connect. Die Schritte kommen über
    `window.FitnessHealthBridge.ingest(...)` in die App.
  - Bau der Installationsdatei (APK) automatisch über GitHub Actions; der Nutzer
    installiert sie selbst („Apps aus unbekannten Quellen erlauben“).
  - Daten von der Webseite einmalig per Backup in die App übertragen
    (localStorage ist pro Webseite/App getrennt).
  - Schätzung: Claude bereitet vor (ca. 1–2 Std., ohne Nutzer); Nutzer braucht
    ca. 30–45 Min. zum Installieren und Testen, evtl. 1–2 kurze Korrekturrunden.
- Echte Anbindung für adidas Running / Yazio (aktuell nur Import per Datei).

## 6. Hinweise zur Zusammenarbeit

- Der Nutzer ist **Programmier-Laie**. Antworten in **einfachem Deutsch**,
  Fachbegriffe kurz erklären.
- **Kleine, nummerierte Schritte.** Immer klar sagen, was Claude übernimmt und
  was der Nutzer selbst tun muss.
- Claude übernimmt alles, was möglich ist (inkl. Pull Request anlegen und mergen).
- Hardware des Nutzers: nur **Samsung-Smartphone (Chrome)** und **Raspberry Pi 400**.
- Wenn du nicht auf Opus läufst (z. B. Fable) und eine Aufgabe abgeschlossen ist,
  erinnere den Nutzer am Ende der Antwort:
  „Tipp: Du kannst jetzt mit /model claude-opus-5-5 zurückstellen.“
- **Nach jeder größeren Änderung dieses Tagebuch aktualisieren.**
