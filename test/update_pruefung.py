#!/usr/bin/env python3
"""Prüft die Update-Suche der Android-App (ohne Handy).

1. Passen Release-Name (Workflow), Versionsnummer (build.gradle) und die Regeln in
   UpdateVersion.java zusammen? Sucht die App dieselbe APK-Datei, die GitHub veröffentlicht?
2. KEINE Erlaubnis REQUEST_INSTALL_PACKAGES (sonst blockiert Google Play Protect die App,
   so geschehen beim Fisch-Fang-Tracker 1.0.6).
3. App sucht beim Start von selbst; Webseite hat den Knopf im Profil.
4. Java-Test test/UpdateVersionTest.java (wenn Java installiert ist).
5. Echter Abruf bei GitHub: neuestes Release hat passenden Namen und die APK (braucht Internet,
   sonst nur Hinweis).

Aufruf (im Projektordner):  python3 test/update_pruefung.py
"""
import json, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = ROOT / "android/app/src/main/java/de/fitnesstracker/app"
fehler = 0


def pruefe(ok, was):
    global fehler
    print(("  OK     " if ok else "  FEHLER ") + was)
    if not ok:
        fehler += 1


lies = lambda p: (ROOT / p).read_text(encoding="utf-8")
checker = (PKG / "UpdateChecker.java").read_text(encoding="utf-8")
version = (PKG / "UpdateVersion.java").read_text(encoding="utf-8")
main = (PKG / "MainActivity.java").read_text(encoding="utf-8")
wf = lies(".github/workflows/android-app.yml")
gradle = lies("android/app/build.gradle")
manifest = lies("android/app/src/main/AndroidManifest.xml")
html = lies("index.html")

print("Versionsnummern und Release-Namen:")
prefix = re.search(r'TAG_PREFIX = "([^"]+)"', version).group(1)
tag = re.search(r'TAG="([^"]+)"', wf)
pruefe(tag is not None and tag.group(1) == prefix + "${GITHUB_RUN_NUMBER}",
       f"Release-Name im Workflow = {prefix}<Bau-Nummer> (wie die App ihn erwartet)")
pruefe("versionCode buildNumber" in gradle and 'versionName "1.0.${buildNumber}"' in gradle
       and "GITHUB_RUN_NUMBER" in gradle,
       "App-Version kommt aus derselben Bau-Nummer (versionCode = N, versionName = 1.0.N)")
apk = re.search(r'APK_NAME = "([^"]+)"', checker).group(1)
pruefe(f'gh release create "$TAG" {apk}' in wf, f"App sucht dieselbe Datei, die GitHub veröffentlicht ({apk})")
pruefe('REPO = "marchens1977/Fitness-Tracker"' in checker, "App fragt das richtige GitHub-Projekt")
pruefe("--latest" in wf, "Neuester Bau wird als „latest“ markiert (das fragt die App ab)")

print("Sicherheit:")
pruefe("REQUEST_INSTALL_PACKAGES" not in manifest,
       "KEINE Erlaubnis „andere Apps installieren“ (sonst blockiert Play Protect)")
pruefe("PackageInstaller" not in checker, "Keine Selbst-Installation, Download nur über den Browser")
pruefe("INTERNET" in manifest, "Internet-Erlaubnis vorhanden (für die Abfrage bei GitHub)")
pruefe(not re.search(r"(?i)(token|authorization|password)", checker), "Kein Schlüssel/Passwort im Update-Code")

print("App-Name:")
pruefe('<string name="app_name">Fitness-Tracker</string>' in lies("android/app/src/main/res/values/strings.xml"),
       "Name unter dem App-Symbol ist „Fitness-Tracker“")
print("Anbindung App <-> Webseite:")
pruefe(main.count("updates.autoCheck()") >= 2, "App sucht beim Start und beim Zurückkehren von selbst")
pruefe("public String getVersion()" in main and "public void checkUpdate()" in main,
       "App bietet der Webseite getVersion() und checkUpdate() an")
pruefe('id="appUpdateCard"' in html and "Nach Updates suchen" in html and "window.AndroidApp.checkUpdate()" in html,
       "Webseite: Knopf „Nach Updates suchen“ im Profil ruft die App")

print("Erinnerungen (Android):")
reminder = (PKG / "ReminderReceiver.java").read_text(encoding="utf-8")
pruefe("android.permission.POST_NOTIFICATIONS" in manifest, "Erlaubnis für Benachrichtigungen im Manifest")
pruefe('android:name=".ReminderReceiver"' in manifest, "Erinnerungs-Empfänger angemeldet")
pruefe("android.permission.USE_EXACT_ALARM" in manifest and 'SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32"' in manifest,
       "Pünktliche Erinnerungen: genaue Wecker erlaubt (Android 13+ automatisch, Android 12 über SCHEDULE_EXACT_ALARM)")
pruefe("setExactAndAllowWhileIdle" in reminder and "setWindow" in reminder and "canScheduleExactAlarms" in reminder,
       "Genauer Wecker, ohne Erlaubnis Zeitfenster (max. 10 Min.) statt bis zu 1 Std. Verspätung")
pruefe("setAndAllowWhileIdle" not in reminder, "Kein ungefährer Wecker mehr für Erinnerungen (konnte bis zu 1 Std. später kommen)")
pruefe("handledToday" in reminder and "markHandled" in reminder, "Verschobene Erinnerung wird nachgeholt, aber nie doppelt gezeigt")
pruefe("public String sendTestReminder()" in main, "App kann bei Bedarf eine Test-Benachrichtigung zeigen (Knopf in der Webseite entfernt)")
pruefe("ReminderReceiver.scheduleAll" in (PKG / "StepAlarmReceiver.java").read_text(encoding="utf-8"),
       "Nach Handy-Neustart werden Erinnerungen neu eingeplant")
pruefe("public String setReminders(String json)" in main and "openNotificationSettings" in main,
       "App bietet der Webseite setReminders() und Einstellungen an")
pruefe("window.AndroidApp.setReminders(" in html and 'id="reminderCard"' in html,
       "Webseite: Karte „Erinnerungen“ im Profil ruft die App")
pruefe((ROOT / "android/app/src/main/res/drawable/ic_notification.xml").exists(), "Symbol für Benachrichtigungen vorhanden")
pruefe("public int getReminderApi()" in main and "getReminderApi" in html,
       "Erinnerungen v2: App meldet ihre Version, Webseite fragt sie ab (ältere Apps bekommen das alte Format)")
pruefe(all(f'"{i}"' in reminder for i in ["weigh", "training", "streak", "evening", "checkin", "backup"]),
       "App kennt alle 6 Erinnerungen")

print("Java-Test der Versions-Regeln:")
if shutil.which("javac") and shutil.which("java"):
    with tempfile.TemporaryDirectory() as tmp:
        c = subprocess.run(["javac", "-d", tmp, str(PKG / "UpdateVersion.java"),
                            str(ROOT / "test/UpdateVersionTest.java")], capture_output=True, text=True)
        pruefe(c.returncode == 0, "UpdateVersion.java lässt sich übersetzen" + ("" if c.returncode == 0 else "\n" + c.stderr))
        if c.returncode == 0:
            r = subprocess.run(["java", "-cp", tmp, "de.fitnesstracker.app.UpdateVersionTest"],
                               capture_output=True, text=True)
            print(r.stdout.rstrip())
            pruefe(r.returncode == 0, "UpdateVersionTest bestanden")
    with tempfile.TemporaryDirectory() as tmp:
        c = subprocess.run(["javac", "-d", tmp, str(PKG / "ReminderPlan.java"),
                            str(ROOT / "test/ReminderPlanTest.java")], capture_output=True, text=True)
        pruefe(c.returncode == 0, "ReminderPlan.java lässt sich übersetzen" + ("" if c.returncode == 0 else "\n" + c.stderr))
        if c.returncode == 0:
            r = subprocess.run(["java", "-cp", tmp, "de.fitnesstracker.app.ReminderPlanTest"],
                               capture_output=True, text=True)
            print(r.stdout.rstrip())
            pruefe(r.returncode == 0, "ReminderPlanTest bestanden")
else:
    print("  HINWEIS Java fehlt – UpdateVersionTest/ReminderPlanTest übersprungen")

print("Echter Abruf bei GitHub (neuestes Release):")
try:
    req = urllib.request.Request("https://api.github.com/repos/marchens1977/Fitness-Tracker/releases/latest",
                                 headers={"Accept": "application/vnd.github+json", "User-Agent": "FitnessTrackerTest"})
    rel = json.load(urllib.request.urlopen(req, timeout=20))
    name = rel.get("tag_name", "")
    pruefe(re.fullmatch(re.escape(prefix) + r"\d+", name) is not None, f"Release-Name „{name}“ hat das erwartete Schema")
    pruefe(any(a.get("name") == apk for a in rel.get("assets", [])), f"Release „{name}“ enthält {apk}")
except Exception as e:
    print(f"  HINWEIS GitHub nicht erreichbar ({e}) – Abruf übersprungen")

print("Alle Update-Prüfungen bestanden." if fehler == 0 else f"{fehler} Fehler in der Update-Prüfung.")
sys.exit(1 if fehler else 0)
