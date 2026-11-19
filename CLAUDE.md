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
- `werkzeuge/` – Prüf- und Hilfsprogramme (siehe Abschnitt „Prüfungen und Werkzeuge“).
- `test/` – automatische Prüfungen der Update-Suche.

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

- Name unter dem Symbol: **„Fitness-Tracker“** (`res/values/strings.xml`, Wunsch des Nutzers 19.11.2026).
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
- **Widget** für den Startbildschirm (`StepWidget.java`, `res/layout/widget_steps.xml`):
  zeigt Schritte heute + Ziel + Balken. Wert = größerer aus Chip und Webseite
  (Webseite meldet per `AndroidApp.reportSteps(datum, schritte, ziel)` aus
  `renderSteps()`). Aktualisiert sich bei jedem Ablesen (ca. alle 15 Min.).
- Download der fertigen App:
  https://github.com/marchens1977/Fitness-Tracker/releases/latest/download/FitnessTracker.apk
  (wird bei jeder Änderung an `android/` auf `main` neu gebaut).
- **Update-Suche** (ab App 1.0.9 bzw. der ersten Version nach dem 19.11.2026, übernommen aus dem
  Fisch-Fang-Tracker): `UpdateChecker.java` fragt beim Start und beim Zurückkehren in die App
  (höchstens 1x pro Stunde) bei GitHub das neueste Release ab. Ist es neuer, erscheint
  „Update verfügbar“ → „Jetzt herunterladen“ lädt die APK im Browser → auf die Datei tippen →
  „Aktualisieren“. Im Reiter **Profil** steht unter „Datensicherung“ die Karte
  „App-Version & Updates“ mit Knopf **„Nach Updates suchen“** (nur in der App sichtbar, nicht in
  Chrome; Webseite ruft `AndroidApp.getVersion()` / `AndroidApp.checkUpdate()`).
  - Versionsnummern: Release-Name `app-v1.0.N`, App-Version `1.0.N` (N = Bau-Nummer von GitHub,
    `versionCode` = N). Verglichen wird nur N; Regeln in `UpdateVersion.java` (getestet).
  - **Keine Selbst-Installation:** Die Erlaubnis `REQUEST_INSTALL_PACKAGES` darf NICHT in die App
    (beim Fisch-Fang-Tracker hat Play Protect die App deshalb als „schädlich“ blockiert).
  - Kein Schlüssel nötig: Die GitHub-Abfrage ist öffentlich.
- Signatur-Schlüssel `android/app/app-signing.keystore` liegt bewusst im Projekt
  (Passwort steht in `app/build.gradle`), damit Updates ohne Neuinstallation
  klappen. Bei Neuinstallation (Deinstallieren) wären die App-Daten weg →
  vorher Backup!

### Prüfungen und Werkzeuge (Ordner `werkzeuge/`)

- `bash werkzeuge/pruefen.sh` – prüft die Web-App: JavaScript auf Schreibfehler
  (`node --check`), dann Seite im Browser öffnen und durch Startseite, Schritte,
  Statistik, Motivation, Krafttraining klicken. Meldet Programmfehler der Seite
  (Exit-Code 1) und speichert Bildschirmfotos (Pfad wird angezeigt).
- `python3 test/update_pruefung.py` – prüft die Update-Suche: Release-Name im Workflow, App-Version
  und `UpdateVersion.java` passen zusammen; gleiche APK-Datei; keine Erlaubnis
  `REQUEST_INSTALL_PACKAGES`; kein Schlüssel im Code; startet den Java-Test
  `test/UpdateVersionTest.java` (z. B. „app-v1.0.10“ → 10, „10 ist neuer als 9“); fragt zum Schluss
  echt bei GitHub das neueste Release ab (ohne Internet nur Hinweis).
- `node test/update_web.js [Ordner]` – spielt im Browser die Android-App nach: Update-Karte im Profil
  ist in Chrome versteckt, in der App sichtbar mit Version, Knopf ruft die App; alte App ohne
  Update-Funktion → Karte versteckt. Speichert `s-profil-update.png`.
- Beide laufen automatisch in `bash werkzeuge/pruefen.sh` mit.
- `node werkzeuge/screenshots.js [Ordner]` – nur die Bildschirmfotos/Fehlerprüfung.
  Braucht Node und Playwright mit Chromium (in Claudes Cloud-Umgebung vorhanden).
- Android-App: wird bei jeder Änderung von GitHub gebaut (Workflow oben) – ein
  erfolgreicher Bau ist die Prüfung, dass der Code übersetzbar ist.
- **Tests, die nur der Nutzer machen kann** (echtes Handy):
  - Zählt die App im Hintergrund, landen Schritte am richtigen Tag (Mitternacht)?
  - Aktualisiert sich das Widget (ca. alle 15 Min.)?
  - Backup speichern/laden in der App (Speicherort-Auswahl).
- **Test-Liste Update-Suche** (zum Abhaken am Handy):
  - [ ] Neue APK einmal von Hand installieren (Link oben) – die alte 1.0.8 kann noch nicht selbst suchen.
  - [ ] App öffnen → Reiter „Profil“ → ganz unten Karte „App-Version & Updates“ mit „App-Version 1.0.N“.
  - [ ] „Nach Updates suchen“ tippen → Meldung „Du hast schon die neueste Version (1.0.N)“.
  - [ ] Flugmodus an → „Nach Updates suchen“ → Meldung „Update-Suche nicht möglich. Bitte Internet prüfen.“
  - [ ] In Chrome (ohne App) ist die Karte NICHT zu sehen.
  - [ ] Beim nächsten App-Update: Beim Öffnen erscheint „Update verfügbar“ → „Jetzt herunterladen“ →
        Download im Browser → Datei antippen → „Aktualisieren“ → Schritte und Trainings sind noch da.
  - [ ] Play Protect blockiert die neue Version nicht („App scannen“ reicht).
  - [ ] Nach dem nächsten Update steht unter dem App-Symbol „Fitness-Tracker“ (evtl. „Fitness-Trac…“, wenn zu lang).

## 3. Regeln und Entscheidungen

- Alles bleibt in **einer Datei** (`index.html`), damit die App einfach zu öffnen ist.
- App-Sprache ist Deutsch, dunkles Design in **New-York-Mets-Farben** (Wunsch des
  Nutzers, großer Mets-Fan): Hauptfarbe Orange `#ff5910`, Zweitfarbe helles Blau
  `#6e9bff`, Hintergründe dunkelblau (z. B. `#0e1324`). Kein Mets-Logo (geschützt).
- Daten bleiben lokal auf dem Gerät; Sicherung über Backup-Datei.
- Keine persönlichen oder geheimen Daten (E-Mail, Passwörter, API-Schlüssel) ins
  Projekt schreiben.
- **Hilfsprogramme und Tests gehören ins Projekt** (Wunsch des Nutzers):
  1. Automatische Prüfungen (Tests) und Hilfsprogramme, die über eine einzelne
     Aufgabe hinaus nützlich sind, werden im Projekt gespeichert (Ordner
     `werkzeuge/` oder `test/`) – nicht nur im Arbeitsbereich der Sitzung, der beim
     Archivieren verloren geht.
  2. Im Tagebuch steht, wie man sie startet und was sie prüfen.
  3. Nach jeder Code-Änderung die vorhandenen Prüfungen laufen lassen; bei neuen
     Funktionen passende Prüfpunkte ergänzen.
  4. Gibt es noch keine automatische Prüfung, bei der nächsten Code-Änderung eine
     einfache anlegen.
  5. Was Claude nicht selbst testen kann (echte Anmeldungen, das echte Handy, den
     Raspberry Pi), im Tagebuch als Test für den Nutzer vermerken.

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
- 17.11.2026 – App-Symbol geändert: Hantel in New-York-Mets-Farben (Orange `#FF5910`
  auf Blau `#002D72`) statt Fußabdrücke
  (`android/app/src/main/res/drawable/ic_launcher_foreground.xml`).
- 17.11.2026 – Ganze App auf Mets-Farben umgestellt (vorher Türkis/Lila/Grau).
- 17.11.2026 – Startbildschirm-Widget „Schritte heute“ eingebaut.
- 18.11.2026 – Regel „Hilfsprogramme und Tests gehören ins Projekt“ übernommen;
  vorhandene Prüfprogramme nach `werkzeuge/` gesichert.
- 19.11.2026 – Update-Suche aus dem Fisch-Fang-Tracker übernommen (Wunsch des Nutzers):
  Knopf „Nach Updates suchen“ im Profil unter „Datensicherung“ (es gibt keine Einstellungs-Seite;
  Ort vom Nutzer gewählt), automatische Suche beim Start. Versionsschema `app-v1.0.N` war schon
  einheitlich, nichts umbenannt. Tests in `test/`.
- 19.11.2026 – Nutzer: Update-Suche funktioniert. Name unter dem App-Symbol „Fitness“ → „Fitness-Tracker“.

## 5. Offene Ideen / nächste Schritte

- **Update-Suche am Handy testen** (Test-Liste oben). Ungetestet sind: Fenster/Meldungen der App,
  Download im Browser, Installation über die alte Version – das geht nur am echten Handy.
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
