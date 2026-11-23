# Projekt-Tagebuch: Mein Fitness-Tracker

## 1. Worum es geht

Eine persönliche Fitness-App für das Handy. Sie läuft im Browser (Chrome auf dem
Samsung-Smartphone) und speichert alle Daten **nur auf dem Gerät** (im Browser-Speicher
„localStorage“), nicht im Internet.

Menü unten (seit 23.11.2026): **5 Hauptbereiche**, oben jeweils Unter-Knöpfe:
- 🏠 **Heute**: Übersicht (Startseite: Schritte, Gewicht-Trend mit Eingabe, Serie,
  Ernährung mit ✓/✗, Schnell-Knöpfe) · Schritte · Ernährung
- 📋 **Plan**: „Mein Trainingsplan“ (KI-Plan über die Claude-API: Profil, Schwerpunkte,
  Plan 1/2 Wochen, Abhaken, Check-in, Verlauf, KI-Zugang)
- 🏋️ **Training**: Kraft (Studio) · Cardio (Studio) · Bodyweight · Laufen · Dehnen
- 📈 **Fortschritt**: Motivation (Serien, Wochen-Herausforderung, „Warum“, Abzeichen) ·
  Gewicht (Trend, Diagramm, Etappenziele, Wochen-Ø, Tageswerte) · Statistik (Gesamtbilanz,
  Verlauf, Übungs-Entwicklung, Tages-Archiv)
- 👤 **Profil**: Alter, Datensicherung (Backup speichern/laden), App-Version & Updates

Der Nutzer trägt alles **abends von Hand** ein (bewusste Entscheidung, hält den Fokus).
Nur die Schritte kommen automatisch aus der eigenen Android-App.

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
- `test/` – automatische Prüfungen (Update-Suche, Gewicht, Trainingsplan, Bedienung).

Wichtige Details in `index.html`:
- Gespeicherte Daten (localStorage-Schlüssel, alle mit Endung `V2`), z. B.
  `gymStrengthWorkoutsV2`, `gymCardioWorkoutsV2`, `bwWorkoutsV2`, `stretchWorkoutsV2`,
  `runningLogsV2`, `stepsHistoryV2`, `dailyStepGoalV2`, `nutritionHistoryV2`,
  `nutritionGoalsV2`, `trainingProfileV2`, `trainingPlansV2`, `aiUsageV2`, `aiApiKeyV2`
  (nur auf dem Gerät, **nie im Backup**), `userWeightV2`, `userGoalWeightV2`, `userBodyFatV2` (nur noch
  still gespeichert, nicht angezeigt), `bodyMetricsLogV2`, `weightMilestonesV2`, `userDobV2`,
  `personalWhyV2`, `activeDatesV2`.
  **Diese Namen nicht ändern**, sonst sind bestehende Daten auf dem Handy „weg“.
- Navigation: `NAV_GROUPS` (Hauptbereich → Unterseiten), `switchGroup(...)` für die
  Knöpfe unten, `switchTab(...)` für eine Unterseite (Namen wie die Bereiche `tab-...`).
  Die App öffnet direkt auf `overview` (kein Begrüßungsbildschirm mehr).
- Ernährung: pro Tag in `nutritionHistoryV2` Einträge `{id, name, kcal, protein, carbs, fat}`
  (werden zusammengezählt). Ziele in `nutritionGoalsV2`: je Wert `{value, mode}` mit
  `mode` = `max` („höchstens“ → ✓ solange darunter) oder `min` („mindestens“ → ✓ ab Erreichen).
  Leeres Ziel = keine Bewertung. Tag wählbar (‹ Heute ›), auch zum Nachtragen.
- Laufen: Distanz + Zeit („32:15“, „1:05:30“ oder Minuten). `durationMin` wird mit
  Nachkommastellen gespeichert. Pro Lauf werden Pace (min/km) und km/h berechnet.
  Tag wählbar (‹ Heute ›), keine Zukunft.
- **Gewicht (tägliches Wiegen mit Trend, seit 23.11.2026):**
  - Ein Wert pro Tag in `bodyMetricsLogV2` (`{id, date, weightKg}`), eine Nachkommastelle.
    Zweiter Wert am selben Tag → Rückfrage „ersetzen?“ (eigenes Fenster `showModal`, kein
    Browser-`confirm`). Eingabe auf der Startseite und unter Fortschritt → Gewicht (immer „heute“).
  - Rechnen im Block `WEIGHT-CALC-START … WEIGHT-CALC-END` (`WeightCalc`, reine Funktionen):
    7-Tage-Ø = Mittel der vorhandenen Werte der letzten 7 Kalendertage (Lücken egal);
    Wochen-Ø pro Kalenderwoche Mo–So (KW nach ISO); Veränderung zur Vorwoche = 7-Tage-Ø jetzt
    minus 7-Tage-Ø der 7 Tage davor. Liegt der letzte Wert > 7 Tage zurück, gilt dessen Stand.
  - **Maßgeblich ist der Ø, nicht der Tageswert:** „Verloren (Ø)“ = Ø der ersten 7 Tage minus
    aktueller 7-Tage-Ø; Etappenziele = Weg Start-Ø → Zielgewicht in gleiche Stücke von ca. 2,5 kg,
    erreicht, wenn der (gerundete) 7-Tage-Ø darunter liegt. Feier-Fenster nur einmal je Etappe
    (`weightMilestonesV2`; neues Ziel → bereits erreichte werden nicht nochmal gefeiert).
  - Hinweise: Tageswert steigt, Trend fällt → „Normale Tagesschwankung …“; Vorwoche −0,3 bis
    −0,7 kg → „Ideales Tempo“; zwei Wochen hintereinander > 1 kg/Woche → sachlicher Hinweis
    „langsamer ist meist nachhaltiger“.
  - Diagramm (ca. 8 Wochen): Tageswerte blasse Punkte, 7-Tage-Ø orange Linie, Ziel blau gestrichelt.
  - **Für den KI-Check-in (Teil 2) vorbereitet:** `getWeightCheckinData()` liefert 7-Tage-Ø,
    Veränderung zur Vorwoche, Trend (fällt/steigt/stabil), Wochen-Ø der letzten 4 Wochen,
    Start-Ø, verloren, Ziel – **kein einzelner Tageswert**. Diese Daten bekommt die KI.
- **KI-Trainingsplan (Teil 2, seit 23.11.2026):**
  - Modell **Claude Opus 5.5** (`claude-opus-5-5`, Wahl des Nutzers), Preis 4 $ / 20 $ je 1 Mio.
    Tokens. Ein 2-Wochen-Plan ca. 0,20–0,35 $, 1 Woche ca. 0,10–0,20 $. Kosten werden nach jedem
    Plan angezeigt und in `aiUsageV2` aufsummiert.
  - Anfrage direkt aus dem Browser an `https://api.anthropic.com/v1/messages` (einfaches `fetch`,
    kein SDK – die App ist eine einzelne Datei ohne Bau-Schritt und soll keine fremden Skripte
    laden). Kopfzeilen: `x-api-key`, `anthropic-version: 2026-10-21`,
    `anthropic-dangerous-direct-browser-access: true`. Antwort Stück für Stück (`stream: true`),
    festes JSON-Format (`output_config.format` mit `PLAN_SCHEMA`), `effort: medium`,
    Ersatzmodell bei Ablehnung (`fallbacks: "default"` + Beta-Kopfzeile; meldet die API dazu
    einen 400-Fehler, wird automatisch ohne diese Funktion wiederholt).
  - **Schlüssel:** gibt der Nutzer im Plan-Bereich ein, liegt nur in `aiApiKeyV2` auf dem Gerät,
    kommt nie ins Backup, Knopf „Schlüssel löschen“. Empfehlung: eigener Schlüssel nur für die App
    mit Ausgabenlimit in der Anthropic-Konsole. Restrisiko: wer das entsperrte Handy hat, könnte ihn
    auslesen (dafür das Limit). Sicherere Alternative wäre ein eigener Zwischen-Server – bewusst
    nicht gewählt (Aufwand, private App).
  - Rechen-/Anfrage-Teil im Block `PLAN-CALC-START … PLAN-CALC-END` (`PlanCalc`): Systemanweisung
    (langsamer Wiedereinstieg, Geräte/Zeit/Einschränkungen beachten, nur Gewicht – keine Maße,
    kein Körperfett, Wochen-Ø statt Tageswert), Anfrage-Inhalt (Profil, Gewicht über
    `getWeightCheckinData()`, Ernährungsziele, Aktivität 14 Tage, letzter Plan mit erledigten
    Einheiten/Schwierigkeit/Wiederholungen, Check-in, Schwerpunkte, Tage), Datenstrom lesen,
    Plan prüfen (`normalizePlan`: jeder Tag genau einmal, fehlende Tage = Ruhetag).
  - Ablauf: Profil (einmal) → Schwerpunkte (Mehrfachauswahl + Wünsche) + 1/2 Wochen + Start
    (heute/morgen/nächster Montag) → Plan. Einheiten abhaken mit Schwierigkeit (zu leicht /
    genau richtig / schwer / zu schwer), Wiederholungen bei `tracksReps`-Übungen, Notiz; zählt
    als aktiver Tag. Nach Ablauf (oder vorzeitig) Check-in (wie lief es, zu leicht, zu schwer,
    Gewichts-Ø) → neue Schwerpunkte → nächster Plan; die KI schreibt dabei einen kurzen ehrlichen
    Wochenrückblick (`plan.review`). Alte Pläne mit Schwerpunkten und Check-in im „Verlauf“.
  - Startseite: Karte „Heute laut Plan“.
- **Entfernt am 23.11.2026** (Wunsch des Nutzers, es gab noch keine echten Daten):
  Wasser-Tracker (`waterV2`/`waterHistoryV2` werden beim Start gelöscht), Sync-Knöpfe und
  Hinweise auf adidas Running/Yazio/Health Connect, die Fremd-Schnittstelle
  `FitnessHealthBridge` („fitness-bridge/1“), das Körperfett-Feld.

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
- `node test/gewicht_test.js` – prüft die Gewichts-Berechnungen ohne Browser: ein Wert pro Tag,
  7-Tage-Ø mit Lücken, Kalenderwochen Mo–So (auch Jahreswechsel), Veränderung zur Vorwoche (keine
  falschen Vergleiche über fehlende Wochen), Hinweise (Schwankung, ideales Tempo, zu schnell),
  „verloren“, Etappenziele, Daten für den KI-Check-in.
- `node test/plan_test.js` – prüft den KI-Plan-Teil ohne Browser/Internet: Zeitraum, Kosten,
  Anfrage (Modell, JSON-Format, kein Schlüssel im Inhalt, Gewicht als Ø/Trend, Schwerpunkte,
  Check-in, letzter Plan), JSON-Schema nach API-Regeln, Datenstrom lesen (Stücke, Fehler,
  Modellwechsel), Plan prüfen, Fortschritt.
- `node test/plan_web_test.js` – spielt den ganzen Plan-Ablauf im Browser durch, die Claude-API
  wird **nachgespielt** (kein Guthaben, kein echter Schlüssel): Profil, Schlüssel, Fehlermeldungen
  (falscher Schlüssel, kein Guthaben), Plan erstellen, Kopfzeilen, Abhaken, Check-in, nächster
  Plan, Verlauf, Backup ohne Schlüssel, Schlüssel löschen.
- `node test/app_test.js` – prüft die Bedienung: 5 Menü-Knöpfe und Unter-Knöpfe, Start auf
  „Übersicht“, kein Körperfett/Yazio/adidas/Wasser, Lauf-Zeit „32:15“ → Pace/km/h, Nachtragen
  für gestern, Ernährung mit Zielen (✓/✗), Gewicht, Schritte aus der Android-App
  (`FitnessNativeApp.onSteps`, Widget-Meldung `reportSteps`), Backup speichern/laden;
  Gewicht: Eingabe auf der Startseite, Runden, Rückfrage beim Ersetzen, Ø/Vorwoche/Hinweis,
  Wochenliste, Etappen-Feier (nur einmal), Gewichtswerte im Backup.
- `node test/update_web.js [Ordner]` – spielt im Browser die Android-App nach: Update-Karte im Profil
  ist in Chrome versteckt, in der App sichtbar mit Version, Knopf ruft die App; alte App ohne
  Update-Funktion → Karte versteckt. Speichert `s-profil-update.png`.
- Alle laufen automatisch in `bash werkzeuge/pruefen.sh` mit.
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

- **Grundsatz Körperdaten (23.11.2026): Als Körperwert wird NUR das Gewicht erfasst.**
  Keine Körpermaße (z. B. Bauchumfang), kein Körperfett, keine Vorher-Nachher-Fotos –
  weder einbauen noch vorschlagen. Fortschritt wird zusätzlich über Leistung sichtbar
  (Bestwerte, Serien – kommt mit Teil 3).
- **Keine Anbindung an fremde Apps** (Yazio, adidas Running o. Ä.). Alles wird von Hand
  eingetragen; nur die Schritte kommen automatisch aus der eigenen Android-App.
- Änderungen speichert Claude in diesem Projekt **direkt auf `main`** (Entscheidung des
  Nutzers, 23.11.2026), trotzdem vorher kurz fragen.

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

- 23.11.2026 – Teil 1 „Aufräumen“: Menü von 10 auf 5 Knöpfe (Heute, Plan, Training,
  Fortschritt, Profil) mit Unter-Knöpfen; neue Startseite „Übersicht“; Begrüßungsbildschirm
  weg; Gewicht auf einer Seite zusammengelegt (Fortschritt → Gewicht), Körperfett-Feld weg;
  Wasser, Sync-Knöpfe und Fremd-Schnittstelle entfernt; Ernährung neu (kcal, Eiweiß,
  Kohlenhydrate, Fett, Ziele mit ✓/✗, Tag wählbar); Laufen mit Min:Sek, Pace und km/h,
  Tag wählbar. Neuer Test `test/app_test.js`.

- 23.11.2026 – Tägliches Wiegen mit Trend: ein Wert pro Tag (ersetzen mit Rückfrage), Eingabe
  auf der Startseite, 7-Tage-Ø groß + Veränderung zur Vorwoche, Tageswert klein, Hinweise
  (Schwankung / ideales Tempo / zu schnell), neues Diagramm, Wochen-Ø (Mo–So), Etappenziele
  mit Feier (aus Teil 3 vorgezogen), „verloren“ nach Ø, Daten für den KI-Check-in vorbereitet.
  Neuer Test `test/gewicht_test.js`. Wiege-Erinnerung: später zusammen mit Teil 3 (eine APK-Runde).

- 23.11.2026 – Teil 2 „KI-Trainingsplan“: Modell Claude Opus 5.5 (Wahl des Nutzers), direkt auf
  `main`. Profil, Schwerpunkte, Plan 1/2 Wochen, Abhaken mit Schwierigkeit/Wiederholungen,
  Check-in mit KI-Wochenrückblick, Verlauf, Kosten-Anzeige, Schlüssel nur lokal.
  Neue Tests `test/plan_test.js`, `test/plan_web_test.js`. **Echte KI-Anfrage noch ungetestet**
  (Claude hat keinen Schlüssel des Nutzers und verbraucht kein fremdes Guthaben).

### Test-Liste Teil 2 „KI-Trainingsplan“ (zum Abhaken am Handy)
- [ ] In der Anthropic-Konsole eigenen Schlüssel für die App anlegen + Ausgabenlimit (z. B. 5 $/Monat).
- [ ] Plan → unten „KI-Zugang“: Schlüssel einfügen → „✓ Schlüssel gespeichert (…xxxx)“.
- [ ] Trainingsprofil ausfüllen und speichern → kurze Zusammenfassung erscheint.
- [ ] Schwerpunkte wählen, 1 Woche, „Plan von der KI erstellen lassen“ → nach 1–3 Min. steht der Plan da
      (App währenddessen offen lassen). **Erster echter Test der KI-Anbindung!**
- [ ] Kosten-Meldung erscheint; in der Konsole stimmt der Betrag ungefähr.
- [ ] Startseite zeigt „Heute laut Plan“.
- [ ] Einheit aufklappen → „Wie schwer?“ wählen, Klimmzüge eintragen → „Als erledigt speichern“ → ✓.
- [ ] „Check-in vorzeitig machen“ → ausfüllen → neue Schwerpunkte → nächster Plan mit „KI-Rückblick“.
- [ ] Alter Plan steht im „Verlauf“ (aufklappbar, mit Check-in).
- [ ] Backup speichern → Datei enthält **keinen** Schlüssel (beginnt mit sk-ant-).
- [ ] Falls eine Fehlermeldung kommt: Text notieren und Claude zeigen.

### Test-Liste Gewicht (zum Abhaken am Handy)
- [ ] Startseite: Gewicht eintragen (z. B. 92,4) → „Heute: 92,4 kg“ klein, groß „Ø …“.
- [ ] Am selben Tag nochmal eintragen → Rückfrage „Durch … ersetzen?“; „Abbrechen“ lässt den alten Wert.
- [ ] Ab der zweiten Woche: „… zur Vorwoche“ erscheint (grün bei Abnahme, rot bei Zunahme).
- [ ] Fortschritt → Gewicht: Zielgewicht speichern → Etappenziele erscheinen.
- [ ] Diagramm: blasse Punkte (Tage), orange Linie (Ø), blaue gestrichelte Linie (Ziel).
- [ ] Wochenliste zeigt „KW …“ mit Ø und Veränderung.
- [ ] Wenn ein Etappenziel erreicht wird: Feier-Fenster erscheint genau einmal.
- [ ] Backup speichern → laden: alle Gewichtswerte sind wieder da.

### Test-Liste Teil 1 „Aufräumen“ (zum Abhaken am Handy)
- [ ] App öffnet direkt auf „Heute → Übersicht“ (kein „Start“-Knopf mehr).
- [ ] Unten 5 Knöpfe; oben wechseln die Unter-Knöpfe je nach Bereich.
- [ ] In der Android-App: Schritte erscheinen auf der Übersicht und bei „Schritte“.
- [ ] Widget zeigt weiter die Schritte (nach ca. 15 Min.).
- [ ] Ernährung: Ziele eintragen (z. B. höchstens 2000 kcal, mindestens 180 g Eiweiß),
      Werte eintragen → ✓ grün / ✗ rot stimmt.
- [ ] Ernährung: mit „‹“ auf gestern wechseln und etwas nachtragen.
- [ ] Laufen: z. B. 5 km in „30:00“ → Pace 6:00 min/km und 10,0 km/h.
- [ ] Fortschritt → Gewicht: Gewicht + Zielgewicht speichern, Verlauf erscheint.
- [ ] Profil → Backup speichern und wieder laden klappt.

## 5. Offene Ideen / nächste Schritte

- **Auftrag vom 23.11.2026 (Teile nacheinander, nach jedem Teil dem Nutzer zeigen):**
  - [x] Teil 1 – Aufräumen (Menü, Startseite, Reihenfolge) + Ernährung/Laufen manuell.
  - [x] Teil 2 – KI-Trainingsplan (23.11.; echte KI-Anfrage noch vom Nutzer zu testen).
  - [ ] Teil 3 – Motivation: Serie mit Ruhetagen, ~~Etappenziele mit Feier~~ (erledigt 23.11.),
        Bestwerte + „Neuer Rekord!“ (Wiederholungen aus dem Plan nutzen), ~~KI-Wochenrückblick~~
        (im Check-in von Teil 2 erledigt), 10-Min-Mini-Einheit,
        „heute ohne Süßes“-Serie, Erinnerungen über die Android-App (Trainingstage **und**
        morgendliche Wiege-Erinnerung, Uhrzeit wählbar – zusammen in einer APK-Runde).
  - [ ] Teil 4 – Export/Import aller neuen Daten.

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
