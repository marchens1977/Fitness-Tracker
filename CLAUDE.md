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

## 5. Offene Ideen / nächste Schritte

- Echte Anbindung für adidas Running / Yazio / Schrittzähler (aktuell nur Import per Datei).

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
