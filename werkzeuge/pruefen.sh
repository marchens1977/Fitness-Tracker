#!/usr/bin/env bash
# Schnelle Prüfung der Web-App (index.html):
#  1. Programmcode (JavaScript) auf Schreibfehler prüfen
#  2. Seite im Browser öffnen, durch Bereiche klicken, Fehler melden (Bilder in einem Temp-Ordner, Pfad wird angezeigt)
# Aufruf (im Projektordner):  bash werkzeuge/pruefen.sh
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
python3 -c "import re,sys;s=open('index.html',encoding='utf-8').read();open(sys.argv[1],'w',encoding='utf-8').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))" "$TMP/app.js"
node --check "$TMP/app.js" && echo "OK: JavaScript ohne Schreibfehler"
mkdir -p "$TMP/bilder"
node werkzeuge/screenshots.js "$TMP/bilder"
echo "Bilder liegen in: $TMP/bilder"
