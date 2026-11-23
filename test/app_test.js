// Prüft die Bedienung der Web-App (index.html) mit Playwright/Chromium:
//  - Menü: 5 Hauptbereiche, Unter-Knöpfe, App öffnet direkt auf „Heute → Übersicht“
//  - Grundsatz „nur Gewicht“: kein Körperfett-Feld, keine Hinweise auf Yazio/adidas/Sync, kein Wasser
//  - Laufen: Zeit „32:15“ wird verstanden, Pace und km/h stimmen, Nachtragen für gestern
//  - Ernährung: Kalorien + Makros, Ziele „höchstens/mindestens“ → grüner Haken / rotes X
//  - Gewicht speichern (ohne Körperfett) erscheint auf Gewicht-Seite und Übersicht
//  - Android-Schrittzähler: FitnessNativeApp.onSteps kommt an, Widget-Meldung reportSteps läuft
//  - Backup: enthält Ernährungsziele, kein Wasser; Laden stellt Daten wieder her
// Aufruf: node test/app_test.js   (Exit-Code 1 bei Fehler)
const path = require('path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // Android-App nachspielen (nur die Teile, die die Webseite aufruft)
    await page.addInitScript(() => {
        window.__reported = [];
        window.AndroidApp = {
            reportSteps: (d, s, g) => window.__reported.push([d, s, g]),
            saveFile: (name, text) => { window.__savedFile = { name, text }; }
        };
    });
    await page.goto(url);
    await page.waitForTimeout(300);

    console.log('Menü & Startseite:');
    pruefe(await page.locator('#tab-overview').evaluate(e => e.classList.contains('active')), 'App öffnet direkt auf „Übersicht“');
    pruefe(await page.locator('.bottom-nav .nav-item').count() === 5, 'Unten genau 5 Knöpfe');
    const navText = await page.locator('.bottom-nav').innerText();
    pruefe(['Heute', 'Plan', 'Training', 'Fortschritt', 'Profil'].every(t => navText.includes(t)), 'Knöpfe: Heute, Plan, Training, Fortschritt, Profil');
    pruefe(await page.locator('#welcomeScreen').count() === 0, 'Kein Begrüßungsbildschirm mehr');
    await page.click('.bottom-nav [data-group="training"]');
    pruefe(await page.locator('#tab-gym-strength').evaluate(e => e.classList.contains('active')), 'Training öffnet Krafttraining');
    pruefe((await page.locator('#subNav .chip').allInnerTexts()).join('|') === 'Kraft|Cardio|Bodyweight|Laufen|Dehnen', 'Unter-Knöpfe Training richtig');
    await page.click('#subNav .chip[data-tab="running"]');
    pruefe(await page.locator('#tab-running').evaluate(e => e.classList.contains('active')), 'Unter-Knopf „Laufen“ funktioniert');
    await page.click('.bottom-nav [data-group="fortschritt"]');
    pruefe((await page.locator('#subNav .chip').allInnerTexts()).join('|') === 'Motivation|Bestwerte|Gewicht|Statistik', 'Unter-Knöpfe Fortschritt richtig');
    await page.click('.bottom-nav [data-group="training"]');
    pruefe(await page.locator('#tab-running').evaluate(e => e.classList.contains('active')), 'Bereich merkt sich zuletzt gewählte Unterseite');

    console.log('Grundsatz „nur Gewicht“ / keine fremden Apps / kein Wasser:');
    const allText = await page.evaluate(() => {
        const c = document.body.cloneNode(true);
        c.querySelectorAll('script').forEach(x => x.remove());
        return c.textContent + ' ' + DAILY_TIPS.join(' ');
    });
    pruefe(!/Körperfett|KFA/.test(allText), 'Kein Körperfett auf der Seite');
    pruefe(!/Yazio|adidas|Firebase|Health Sync|Health Connect/i.test(allText), 'Keine Hinweise auf Yazio/adidas/Sync');
    pruefe(!/Wasser/.test(allText), 'Kein Wasser-Tracker');
    pruefe(await page.locator('.sync-btn-small:has-text("Sync")').count() === 0, 'Keine Sync-Knöpfe');

    console.log('Laufen:');
    const calc = await page.evaluate(() => ({
        a: parseRunDuration('32:15'), b: parseRunDuration('1:05:30'), c: parseRunDuration('30'),
        d: parseRunDuration('5:75'), e: parseRunDuration('abc'),
        pace: formatPace(5, 30), speed: formatSpeed(5, 30), dur: formatRunDuration(32.25)
    }));
    pruefe(Math.abs(calc.a - 32.25) < 1e-9, '„32:15“ = 32,25 Minuten');
    pruefe(Math.abs(calc.b - 65.5) < 1e-9, '„1:05:30“ = 65,5 Minuten');
    pruefe(calc.c === 30, '„30“ = 30 Minuten');
    pruefe(isNaN(calc.d) && isNaN(calc.e), 'Ungültige Zeit wird abgelehnt');
    pruefe(calc.pace === '6:00 min/km', '5 km in 30 Min → Pace 6:00 min/km');
    pruefe(calc.speed === '10,0 km/h', '5 km in 30 Min → 10,0 km/h');
    pruefe(calc.dur === '32:15 min', 'Anzeige der Zeit „32:15 min“');
    await page.evaluate(() => switchTab('running'));
    await page.click('#tab-running .step-btn[aria-label="Vorheriger Tag"]');
    await page.fill('#runDistanceInput', '10,5');
    await page.fill('#runDurationInput', '52:30');
    pruefe((await page.locator('#runLivePreview').innerText()).includes('5:00 min/km'), 'Vorschau zeigt Pace beim Tippen');
    await page.click('#tab-running button:has-text("Lauf speichern")');
    const run = await page.evaluate(() => getRuns()[0]);
    const gestern = await page.evaluate(() => shiftDateKey(getLocalDateKey(), -1));
    pruefe(run && run.date === gestern, 'Lauf für gestern nachgetragen');
    pruefe((await page.locator('#runHistoryList').innerText()).includes('12,0 km/h'), 'Liste zeigt km/h (10,5 km in 52:30 → 12,0 km/h)');
    await page.click('#tab-running .step-btn[aria-label="Nächster Tag"]');
    await page.click('#tab-running .step-btn[aria-label="Nächster Tag"]');
    pruefe((await page.locator('#runDateLabel').innerText()).startsWith('Heute'), 'Kein Datum in der Zukunft');

    console.log('Ernährung:');
    await page.evaluate(() => switchTab('nutrition'));
    await page.fill('#nutGoal_kcal', '2000');
    await page.selectOption('#nutGoalMode_kcal', 'max');
    await page.fill('#nutGoal_protein', '180');
    await page.selectOption('#nutGoalMode_protein', 'min');
    await page.click('#tab-nutrition button:has-text("Ziele speichern")');
    await page.fill('#nutKcalInput', '1500');
    await page.fill('#nutProteinInput', '120');
    await page.fill('#nutCarbsInput', '150,5');
    await page.fill('#nutFatInput', '40');
    await page.click('#tab-nutrition button:has-text("Hinzufügen")');
    const mark = k => page.locator(`#nutGoalRows .goal-row[data-nutrient="${k}"] .goal-mark`).getAttribute('class');
    pruefe((await mark('kcal')).includes('ok'), '1500 von max. 2000 kcal → grüner Haken');
    pruefe((await mark('protein')).includes('bad'), '120 von min. 180 g Eiweiß → rotes X');
    pruefe((await mark('carbs')).includes('none'), 'Kohlenhydrate ohne Ziel → keine Bewertung');
    await page.fill('#nutKcalInput', '700');
    await page.fill('#nutProteinInput', '70');
    await page.click('#tab-nutrition button:has-text("Hinzufügen")');
    pruefe((await mark('kcal')).includes('bad'), '2200 von max. 2000 kcal → rotes X');
    pruefe((await mark('protein')).includes('ok'), '190 von min. 180 g Eiweiß → grüner Haken');
    pruefe((await page.locator('#nutGoalRows').innerText()).includes('150,5 g'), 'Kohlenhydrate mit Komma gespeichert (150,5 g)');
    await page.click('#tab-nutrition button:has-text("Hinzufügen")');
    pruefe(await page.evaluate(() => getNutritionEntries(getLocalDateKey()).length) === 2, 'Leerer Eintrag wird nicht gespeichert');
    await page.evaluate(() => switchTab('overview'));
    pruefe(await page.locator('#ovNutritionGoals .goal-mark.ok').count() === 1 && await page.locator('#ovNutritionGoals .goal-mark.bad').count() === 1, 'Übersicht zeigt Haken/X der Ernährung');

    console.log('Gewicht (täglich, Trend):');
    await page.evaluate(() => switchTab('weight'));
    await page.fill('#profGoalWeightInput', '85');
    await page.click('#tab-weight button:has-text("Ziel speichern")');
    // Vorgeschichte: 2 Wochen mit Lücken, Trend fällt (direkt in den Speicher geschrieben)
    await page.evaluate(() => {
        const t = getLocalDateKey();
        const vals = { 13: 93.6, 11: 93.4, 9: 93.2, 7: 92.9, 5: 92.8, 4: 92.6, 2: 92.5, 1: 92.0 };
        const log = Object.keys(vals).map(k => ({ id: 'x' + k, date: shiftDateKey(t, -Number(k)), weightKg: vals[k], bodyFatPct: null }));
        log.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem('bodyMetricsLogV2', JSON.stringify(log));
        switchTab('overview');
    });
    pruefe(await page.locator('#ovWeightInput').isVisible(), 'Gewicht direkt auf der Startseite eintragbar');
    await page.fill('#ovWeightInput', '92,46');
    await page.click('#ovWeightCard button:has-text("Speichern")');
    pruefe(await page.evaluate(() => getBodyMetricsLog().filter(m => m.date === getLocalDateKey())[0].weightKg) === 92.5, 'Wert auf eine Nachkommastelle gerundet (92,5)');
    pruefe((await page.locator('#ovWeightAvg').innerText()).startsWith('Ø 92,'), 'Startseite zeigt groß den 7-Tage-Ø');
    pruefe((await page.locator('#ovWeightChange').innerText()).includes('zur Vorwoche') && (await page.locator('#ovWeightChange').innerText()).includes('−'), 'Startseite zeigt Veränderung zur Vorwoche (−)');
    pruefe((await page.locator('#ovWeightDay').innerText()) === 'Heute: 92,5 kg', 'Tageswert klein daneben');
    pruefe(await page.locator('#ovWeightHints [data-hint="fluctuation"]').count() === 1, 'Hinweis „Normale Tagesschwankung“ (Tag steigt, Trend fällt)');
    pruefe((await page.locator('#ovWeightProgress').innerText()).includes('Nächstes Etappenziel'), 'Nächstes Etappenziel angezeigt');
    await page.fill('#ovWeightInput', '92,1');
    await page.click('#ovWeightCard button:has-text("Speichern")');
    pruefe(await page.locator('#appModal').isVisible(), 'Zweiter Wert am selben Tag → Rückfrage');
    await page.click('#appModalNo');
    pruefe(await page.evaluate(() => getBodyMetricsLog().find(m => m.date === getLocalDateKey()).weightKg) === 92.5, 'Abbrechen → alter Wert bleibt');
    await page.click('#ovWeightCard button:has-text("Speichern")');
    await page.click('#appModalYes');
    const heute = await page.evaluate(() => getBodyMetricsLog().filter(m => m.date === getLocalDateKey()));
    pruefe(heute.length === 1 && heute[0].weightKg === 92.1, 'Ersetzen → genau ein Wert für heute (92,1)');
    await page.evaluate(() => switchTab('weight'));
    pruefe((await page.locator('#profDayWeight').innerText()) === '92,1 kg', 'Gewicht-Seite: Tageswert');
    pruefe(await page.locator('#weightWeekList .set-row').count() >= 2, 'Wochen-Durchschnitte (Mo–So) aufgelistet');
    pruefe(await page.locator('#milestoneList .milestone-chip').count() >= 3, 'Etappenziele angezeigt');
    pruefe(await page.locator('#bodyMetricsHistoryList .set-row').count() === 9, 'Tageswerte-Liste (9 Tage)');
    const ci = await page.evaluate(() => getWeightCheckinData());
    pruefe(ci.hasData && ci.trend === 'fällt' && ci.lastWeeks.length >= 2, 'Daten für den KI-Check-in: Ø, Trend, Wochen');
    // Etappe erreichen → Feier (einmalig)
    await page.evaluate(() => {
        const t = getLocalDateKey();
        const log = getBodyMetricsLog().filter(m => m.date < shiftDateKey(t, -6));
        localStorage.setItem('bodyMetricsLogV2', JSON.stringify(log));
        localStorage.removeItem('weightMilestonesV2');
        renderWeightPage();
    });
    await page.fill('#profWeightInput', '90,5');
    await page.click('#tab-weight button:has-text("Speichern") >> nth=0');
    pruefe(await page.locator('#appModal').isVisible() && (await page.locator('#appModalTitle').innerText()).includes('Etappenziel'), 'Etappenziel erreicht → Feier');
    await page.click('#appModalYes');
    await page.evaluate(() => checkWeightMilestones());
    pruefe(!(await page.locator('#appModal').isVisible()), 'Feier kommt nur einmal');

    console.log('Android-Schrittzähler:');
    await page.evaluate(() => window.FitnessNativeApp.onSteps([{ date: getLocalDateKey(), steps: 8123 }], 'ok'));
    pruefe((await page.locator('#ovStepsCount').innerText()) === '8.123', 'Schritte aus der App erscheinen auf der Übersicht');
    pruefe((await page.locator('#stepsTodayCount').innerText()) === '8.123', 'Schritte aus der App erscheinen bei „Schritte“');
    const last = await page.evaluate(() => window.__reported[window.__reported.length - 1]);
    pruefe(last && last[1] === 8123, 'Widget-Meldung reportSteps erhält 8123');
    pruefe(await page.evaluate(() => calculateStreaks().current) >= 1, 'Serie zählt heute als aktiv');

    console.log('Backup:');
    await page.evaluate(() => exportBackup());
    const backup = JSON.parse(await page.evaluate(() => window.__savedFile.text));
    pruefe(backup.nutritionGoalsV2 && backup.nutritionGoalsV2.protein.value === 180 && backup.nutritionGoalsV2.protein.mode === 'min', 'Backup enthält Ernährungsziele');
    pruefe(!('waterV2' in backup) && !('waterHistoryV2' in backup), 'Backup ohne Wasser');
    pruefe(Object.values(backup.nutritionHistoryV2)[0][0].carbs === 150.5, 'Backup enthält Makros');
    pruefe(Array.isArray(backup.bodyMetricsLogV2) && backup.bodyMetricsLogV2.length >= 2 && backup.userGoalWeightV2 === '85.0', 'Backup enthält alle Gewichtswerte und Ziel');
    pruefe(backup.weightMilestonesV2 && backup.weightMilestonesV2.celebrated >= 1, 'Backup enthält gefeierte Etappen');
    await page.evaluate(() => localStorage.clear());
    await page.setInputFiles('#importFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForSelector('#appModal', { state: 'visible' });
    await page.click('#appModalYes');
    await page.waitForTimeout(300);
    pruefe(await page.evaluate(() => getNutritionGoals().kcal.value) === 2000, 'Backup laden stellt Ziele wieder her');
    pruefe(await page.evaluate(() => getRuns().length) === 1, 'Backup laden stellt Läufe wieder her');
    pruefe(await page.evaluate(() => getBodyMetricsLog().length) === backup.bodyMetricsLogV2.length, 'Backup laden stellt Gewichtswerte wieder her');

    await browser.close();
    if (errors.length) {
        console.log('FEHLER auf der Seite:\n- ' + errors.join('\n- '));
        fehler++;
    }
    console.log(fehler ? `app_test: ${fehler} FEHLER` : 'app_test: alles OK');
    process.exit(fehler ? 1 : 0);
})();
