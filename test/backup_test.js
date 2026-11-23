// Prüft Teil 4 „Export/Import“ (Backup) im Browser (Playwright/Chromium):
//  - JEDER Speicher-Name, den die App benutzt, ist im Backup (außer bewusst ausgenommenen
//    wie dem KI-Schlüssel) – schlägt an, wenn eine neue Funktion vergessen wird
//  - Rundreise: alles befüllen → Backup speichern → alles löschen → Backup laden → jeder Wert gleich
//  - KI-Schlüssel nie in der Datei, bleibt beim Laden auf dem Gerät
//  - Rückfrage mit Überblick; „Abbrechen“ ändert nichts; „Rückgängig“ stellt den alten Stand her
//  - Ungültige Datei: Meldung, nichts geändert; altes Backup (nur Teil der Daten) lässt den Rest stehen
//  - Anzeige „Letztes Backup“
// Aufruf: node test/backup_test.js   (Exit-Code 1 bei Fehler)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const file = path.resolve(__dirname, '..', 'index.html');
const url = 'file://' + file;
const KEY = 'sk-ant-test-' + 'k'.repeat(30);
// Bewusst nicht im Backup:
const AUSGENOMMEN = ['aiApiKeyV2', 'lastBackupV2', 'lastImportUndoV2', 'gymWorkoutsV2', 'waterV2', 'waterHistoryV2'];
let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

(async () => {
    console.log('Alle Speicher-Namen im Backup:');
    const html = fs.readFileSync(file, 'utf8');
    const used = new Set([...html.matchAll(/(?:localStorage\.(?:get|set|remove)Item|readJson|readDateList)\('([A-Za-z0-9]+)'/g)].map(m => m[1]));

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.AndroidApp = { saveFile: (n, t) => { window.__saved = { name: n, text: t }; } };
    });
    await page.goto(url);
    await page.waitForTimeout(300);

    const schema = await page.evaluate(() => BACKUP_SCHEMA.map(([k]) => k));
    const fehlend = [...used].filter(k => !AUSGENOMMEN.includes(k) && !schema.includes(k));
    pruefe(fehlend.length === 0, `Jeder benutzte Speicher-Name ist im Backup (${used.size} gefunden)${fehlend.length ? ' – FEHLT: ' + fehlend.join(', ') : ''}`);
    pruefe(!schema.includes('aiApiKeyV2'), 'KI-Schlüssel ist ausdrücklich NICHT im Backup');

    console.log('Rundreise (alles speichern → löschen → laden):');
    await page.evaluate(k => {
        const t = getLocalDateKey();
        const y = shiftDateKey(t, -1);
        const set = (key, v) => localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v));
        set('gymStrengthWorkoutsV2', { [y]: { date: y, exercises: [{ exerciseId: 'x', name: 'Bankdrücken', sets: [{ id: 1, weight: 60, reps: 8 }] }] } });
        set('gymCardioWorkoutsV2', { [y]: { date: y, entries: [{ id: 2, deviceId: 'd', deviceName: 'Rad', duration: 20, distance: 8 }] } });
        set('bwWorkoutsV2', { [t]: { date: t, exercises: [{ exerciseId: 'bw_pullup', name: 'Klimmzüge', sets: [{ id: 3, reps: 6 }] }] } });
        set('stretchWorkoutsV2', { [t]: { date: t, exercises: [{ exerciseId: 's', name: 'Dehnen', sets: [{ id: 4, value: 30 }] }] } });
        set('stepsHistoryV2', { [y]: 11234, [t]: 4321 });
        set('dailyStepGoalV2', '9000');
        set('runningLogsV2', [{ id: 'r1', date: y, distanceKm: 5.2, durationMin: 31.25, source: 'Manuell' }]);
        set('nutritionHistoryV2', { [t]: [{ id: 'n1', name: 'Abend', kcal: 700, protein: 50, carbs: 60, fat: 20 }] });
        set('nutritionGoalsV2', { kcal: { value: 2000, mode: 'max' }, protein: { value: 180, mode: 'min' }, carbs: { value: null, mode: 'max' }, fat: { value: null, mode: 'max' } });
        set('activeDatesV2', [y, t]);
        set('userDobV2', '1978-05-04');
        set('userWeightV2', '92.4');
        set('userBodyFatV2', '22.0');
        set('userGoalWeightV2', '85.0');
        set('bodyMetricsLogV2', [{ id: 'b1', date: y, weightKg: 92.8, bodyFatPct: null }, { id: 'b2', date: t, weightKg: 92.4, bodyFatPct: null }]);
        set('weightMilestonesV2', { goalKg: 85, startKg: 92.8, celebrated: 0 });
        set('trainingProfileV2', { age: 48, heightCm: 182, level: 'Einsteiger', experience: 'Fußball', equipment: ['Klimmzugstange'], equipmentOther: '', daysPerWeek: 3, minutesPerSession: 45, goals: ['Abnehmen'], limitations: '' });
        set('trainingPlansV2', [{ id: 'p1', dates: [t], weeks: 1, focus: { options: ['gym'], text: 'wenig Zeit' }, plan: { title: 'P', summary: '', review: '', days: [], nutritionTips: [], safetyNotes: [] }, progress: {}, checkin: { date: t, howItWent: 'gut', tooEasy: '', tooHard: '' } }]);
        set('aiUsageV2', { totalUsd: 0.42, calls: 2 });
        set('restWeekdaysV2', [6]);
        set('sweetsFreeV2', [y, t]);
        set('miniSessionsV2', [y]);
        set('recordsSeenV2', { pullups: 6 });
        set('remindersV2', { weigh: { on: true, time: '06:45' }, training: { on: false, time: '17:00' } });
        set('personalWhyV2', 'Fit für die Familie');
        set('aiApiKeyV2', k);
    }, KEY);
    await page.evaluate(() => initApp());
    await page.waitForTimeout(600); // App rechnet beim Start Bestwerte nach (recordsSeenV2)
    const vorher = await page.evaluate(() => {
        const o = {};
        BACKUP_SCHEMA.forEach(([k]) => { o[k] = localStorage.getItem(k); });
        return o;
    });
    const leer = Object.keys(vorher).filter(k => vorher[k] === null && k !== 'nutritionV2');
    pruefe(leer.length === 0, 'Test hat jeden Speicher befüllt' + (leer.length ? ' – leer: ' + leer.join(', ') : ''));

    await page.evaluate(() => exportBackup());
    const saved = await page.evaluate(() => window.__saved);
    const backup = JSON.parse(saved.text);
    pruefe(saved.name.startsWith('fitness_backup_') && saved.name.endsWith('.json'), 'Dateiname fitness_backup_DATUM.json');
    pruefe(backup.backupFormat === 'fitness-tracker-backup/3' && !!backup.exportedAt, 'Datei hat Kennung und Zeitpunkt');
    pruefe(!saved.text.includes(KEY) && !('aiApiKeyV2' in backup), 'KI-Schlüssel NICHT in der Datei');
    const nichtDrin = schema.filter(k => k !== 'nutritionV2' && !(k in backup));
    pruefe(nichtDrin.length === 0, 'Datei enthält jeden Speicher' + (nichtDrin.length ? ' – fehlt: ' + nichtDrin.join(', ') : ''));

    // Alles löschen (Schlüssel bleibt wie auf dem Gerät), dann laden
    await page.evaluate(() => { const k = localStorage.getItem('aiApiKeyV2'); localStorage.clear(); localStorage.setItem('aiApiKeyV2', k); initApp(); });
    await page.setInputFiles('#importFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(saved.text) });
    await page.waitForSelector('#appModal', { state: 'visible' });
    const frage = await page.locator('#appModalText').innerText();
    pruefe(frage.includes('Backup vom') && frage.includes('2 Gewichtswerte') && frage.includes('1 Lauf') && frage.includes('1 Trainingsplan'), 'Rückfrage zeigt Überblick (Datum, Gewichtswerte, Lauf, Plan)');
    await page.click('#appModalYes');
    await page.waitForTimeout(300);
    const nachher = await page.evaluate(() => {
        const o = {};
        BACKUP_SCHEMA.forEach(([k]) => { o[k] = localStorage.getItem(k); });
        return o;
    });
    const norm = v => { if (v === null) return null; try { return JSON.stringify(JSON.parse(v)); } catch (e) { return v; } };
    const anders = Object.keys(vorher).filter(k => k !== 'nutritionV2' && norm(vorher[k]) !== norm(nachher[k]));
    pruefe(anders.length === 0, 'Jeder Wert nach dem Laden gleich wie vorher' + (anders.length ? ' – anders: ' + anders.join(', ') : ''));
    pruefe(await page.evaluate(() => localStorage.getItem('aiApiKeyV2')) === KEY, 'KI-Schlüssel bleibt auf dem Gerät erhalten');
    pruefe((await page.locator('#ovWeightDay').innerText()).includes('92,4'), 'App zeigt geladene Daten (Gewicht auf der Startseite)');

    console.log('Abbrechen, Rückgängig, ungültige und alte Dateien:');
    const klein = JSON.stringify({ backupFormat: 'fitness-tracker-backup/3', exportedAt: new Date().toISOString(), runningLogsV2: [], personalWhyV2: 'Neu' });
    await page.setInputFiles('#importFile', { name: 'k.json', mimeType: 'application/json', buffer: Buffer.from(klein) });
    await page.waitForSelector('#appModal', { state: 'visible' });
    await page.click('#appModalNo');
    pruefe(await page.evaluate(() => getRuns().length) === 1 && await page.evaluate(() => localStorage.getItem('personalWhyV2')) === 'Fit für die Familie', '„Abbrechen“ ändert nichts');
    await page.setInputFiles('#importFile', { name: 'k.json', mimeType: 'application/json', buffer: Buffer.from(klein) });
    await page.waitForSelector('#appModal', { state: 'visible' });
    await page.click('#appModalYes');
    await page.waitForTimeout(200);
    pruefe(await page.evaluate(() => getRuns().length) === 0 && await page.evaluate(() => localStorage.getItem('personalWhyV2')) === 'Neu', 'Teil-Backup ersetzt nur seine Bereiche (Läufe, Warum)');
    pruefe(await page.evaluate(() => getBodyMetricsLog().length) === 2 && await page.evaluate(() => getTrainingPlans().length) === 1, 'Andere Daten bleiben stehen (Gewicht, Pläne)');
    await page.evaluate(() => switchTab('profile'));
    pruefe(await page.locator('#undoImportBtn').isVisible(), 'Knopf „Rückgängig“ sichtbar');
    await page.click('#undoImportBtn');
    await page.click('#appModalYes');
    await page.waitForTimeout(200);
    pruefe(await page.evaluate(() => getRuns().length) === 1 && await page.evaluate(() => localStorage.getItem('personalWhyV2')) === 'Fit für die Familie', '„Rückgängig“ stellt den alten Stand her');
    pruefe(await page.locator('#undoImportBtn').isHidden(), 'Danach kein „Rückgängig“ mehr');

    for (const [name, inhalt] of [['kaputt', '{kein json'], ['fremd', JSON.stringify({ hallo: 1 })], ['falscher Typ', JSON.stringify({ runningLogsV2: 'kein Array' })]]) {
        await page.setInputFiles('#importFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(inhalt) });
        await page.waitForTimeout(200);
        const toast = await page.locator('#toast').innerText();
        pruefe(toast.includes('Ungültige Backup-Datei') && !(await page.locator('#appModal').isVisible()) && await page.evaluate(() => getRuns().length) === 1, `Ungültige Datei (${name}): Meldung, nichts geändert`);
    }

    console.log('Anzeige „Letztes Backup“:');
    await page.evaluate(() => { localStorage.removeItem('lastBackupV2'); renderBackupInfo(); });
    pruefe((await page.locator('#backupInfo').innerText()).includes('Noch kein Backup'), 'Ohne Backup: Hinweis');
    await page.evaluate(() => { localStorage.setItem('lastBackupV2', shiftDateKey(getLocalDateKey(), -20)); renderBackupInfo(); });
    pruefe((await page.locator('#backupInfo').innerText()).includes('20 Tage her'), 'Altes Backup: „… Tage her, bitte neu sichern“');
    await page.evaluate(() => exportBackup());
    pruefe((await page.locator('#backupInfo').innerText()).includes('(heute) ✓'), 'Nach dem Speichern: „heute ✓“');

    await browser.close();
    if (errors.length) {
        console.log('FEHLER auf der Seite:\n- ' + errors.join('\n- '));
        fehler++;
    }
    console.log(fehler ? `backup_test: ${fehler} FEHLER` : 'backup_test: alles OK');
    process.exit(fehler ? 1 : 0);
})();
