#!/usr/bin/env bash
# Schnelle Prüfung der Web-App (index.html):
#  1. Programmcode (JavaScript) auf Schreibfehler prüfen
#  2. Seite im Browser öffnen, durch Bereiche klicken, Fehler melden (Bilder in einem Temp-Ordner, Pfad wird angezeigt)
#  3. Gewichts-Berechnungen (test/gewicht_test.js: 7-Tage-Ø, Wochen-Ø, Hinweise, Etappen)
#  3b. Bedienung der App (test/app_test.js: Menü, Laufen, Ernährung, Gewicht, Schritte aus der App, Backup)
#  4. Update-Suche: Karte im Profil (test/update_web.js) und Android-Teil (test/update_pruefung.py)
# Aufruf (im Projektordner):  bash werkzeuge/pruefen.sh
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
python3 -c "import re,sys;s=open('index.html',encoding='utf-8').read();open(sys.argv[1],'w',encoding='utf-8').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))" "$TMP/app.js"
node --check "$TMP/app.js" && echo "OK: JavaScript ohne Schreibfehler"
mkdir -p "$TMP/bilder"
node werkzeuge/screenshots.js "$TMP/bilder"
node test/gewicht_test.js
node test/plan_test.js
node test/motivation_test.js
node test/app_test.js
node test/plan_web_test.js
node test/motivation_web_test.js
node test/backup_test.js
node test/update_web.js "$TMP/bilder"
python3 test/update_pruefung.py
echo "Bilder liegen in: $TMP/bilder"
