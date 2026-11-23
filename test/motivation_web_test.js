// Prüft Teil 3 „Motivation“ im Browser (Playwright/Chromium):
//  - Serie: feste Ruhetage unterbrechen nicht, Hinweis auf der Startseite
//  - „Heute ohne Süßes“ (auch gestern nachtragen) mit eigener Serie
//  - 10-Minuten-Mini-Einheit zählt als aktiver Tag
//  - Bestwerte-Seite und „Neuer Rekord!“ (nur bei Verbesserung, nicht nach Backup laden)
//  - Erinnerungen: in Chrome versteckt, mit (nachgespielter) Android-App sichtbar; die App bekommt
//    Einstellungen, offene Trainingstage und den letzten Wiege-Tag
// Aufruf: node test/motivation_web_test.js   (Exit-Code 1 bei Fehler)
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

    // ---------- Chrome (ohne App) ----------
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForTimeout(300);
    const today = await page.evaluate(() => getLocalDateKey());
    const shift = n => page.evaluate(n => shiftDateKey(getLocalDateKey(), n), n);

    console.log('Serie mit festen Ruhetagen:');
    // aktiv vorgestern und vor 3 Tagen, gestern nicht → ohne Ruhetag ist die Serie 0
    await page.evaluate(([a, b]) => { localStorage.setItem('activeDatesV2', JSON.stringify([a, b])); initApp(); }, [await shift(-3), await shift(-2)]);
    pruefe(await page.evaluate(() => calculateStreaks().current) === 0, 'Ohne Ruhetag: gestern nichts → Serie 0');
    await page.evaluate(() => switchTab('motivation'));
    const yWd = await page.evaluate(() => MotivCalc.weekdayIndex(shiftDateKey(getLocalDateKey(), -1)));
    await page.click(`#restWeekdayChips .chip[data-weekday="${yWd}"]`);
    pruefe(await page.evaluate(() => calculateStreaks().current) === 2, 'Gestern als fester Ruhetag → Serie 2 bleibt');
    if (yWd !== 6) pruefe(await page.locator('#weekMatrix .day-pill.rest').count() >= 1, 'Ruhetag in der Wochenansicht markiert');
    const others = [0, 1, 2, 3, 4, 5, 6].filter(n => n !== yWd).slice(0, 3);
    for (const n of others) await page.click(`#restWeekdayChips .chip[data-weekday="${n}"]`);
    pruefe(await page.evaluate(() => getRestWeekdays().length) === 3, 'Höchstens 3 feste Ruhetage');
    await page.evaluate(() => switchTab('overview'));
    const info = await page.locator('#ovStreakInfo').innerText();
    pruefe(info.length > 5, 'Startseite zeigt Hinweis zur Serie');

    console.log('Mini-Einheit:');
    await page.click('#ovMiniToggle');
    pruefe(await page.locator('#ovMiniList .plan-ex').count() >= 5, 'Übungen der Mini-Einheit sichtbar');
    await page.click('#ovMiniDone');
    pruefe(await page.evaluate(t => getActiveDatesSet().has(t), today), 'Mini-Einheit → heute aktiver Tag');
    pruefe(await page.evaluate(() => calculateStreaks().current) === 3, 'Serie wächst auf 3');
    pruefe((await page.locator('#ovMiniDone').innerText()).includes('erledigt'), 'Knopf zeigt „Heute erledigt“');
    await page.click('#ovMiniDone');
    pruefe(!(await page.evaluate(t => getActiveDatesSet().has(t), today)), 'Rückgängig → heute wieder offen');
    await page.click('#ovMiniDone');

    console.log('Ohne Süßes:');
    await page.click('#sweetsYesterdayBtn');
    await page.click('#sweetsTodayBtn');
    pruefe((await page.locator('#ovSweetsStreak').innerText()) === '2 Tage', 'Gestern + heute → Serie 2 Tage');
    pruefe((await page.locator('#sweetsTodayBtn').innerText()).startsWith('✓'), 'Heute-Knopf zeigt Haken');
    await page.click('#sweetsTodayBtn');
    pruefe((await page.locator('#ovSweetsStreak').innerText()) === '1 Tag', 'Heute zurückgenommen → 1 Tag (gestern zählt)');
    pruefe((await page.locator('#ovSweetsBest').innerText()) === '1 Tag', 'Zurückgenommener Tag zählt auch nicht für den Rekord');

    console.log('Bestwerte & neuer Rekord:');
    await page.evaluate(() => switchTab('bodyweight'));
    await page.selectOption('#bwExerciseSelect', 'bw_pullup');
    await page.fill('#bwRepsInput', '5');
    await page.click('#tab-bodyweight button:has-text("Satz speichern")');
    pruefe(!(await page.locator('#appModal').isVisible()), 'Erster Wert: keine Feier (noch kein Vergleich)');
    await page.fill('#bwRepsInput', '4');
    await page.click('#tab-bodyweight button:has-text("Satz speichern")');
    pruefe(!(await page.locator('#appModal').isVisible()), 'Schlechterer Satz: keine Feier');
    await page.fill('#bwRepsInput', '7');
    await page.click('#tab-bodyweight button:has-text("Satz speichern")');
    pruefe(await page.locator('#appModal').isVisible() && (await page.locator('#appModalText').innerText()).includes('7 Wdh. (vorher 5 Wdh.)'), '„Neuer Rekord!“ bei 7 statt 5 Klimmzügen');
    await page.click('#appModalYes');
    await page.evaluate(() => switchTab('records'));
    pruefe(await page.locator('#recordsList .record-card').count() === 5, 'Bestwerte-Seite mit 5 Werten');
    const pull = await page.locator('#recordsList [data-record="pullups"]').innerText();
    pruefe(pull.includes('7 Wdh.') && !pull.includes('Verlauf'), 'Klimmzüge: 7 (mehrere Verbesserungen am selben Tag = ein Eintrag)');
    pruefe((await page.locator('#recordsList [data-record="runKm"]').innerText()).includes('noch kein Wert'), 'Ohne Lauf: „noch kein Wert“');

    console.log('Backup laden feiert nicht:');
    await page.evaluate(() => { window.__saved = null; window.AndroidApp = { saveFile: (n, t) => { window.__saved = t; } }; exportBackup(); delete window.AndroidApp; });
    const backup = JSON.parse(await page.evaluate(() => window.__saved));
    pruefe(Array.isArray(backup.sweetsFreeV2) && Array.isArray(backup.miniSessionsV2) && backup.restWeekdaysV2.length === 3 && backup.recordsSeenV2.pullups === 7, 'Backup enthält Süßes, Mini, Ruhetage, Rekorde');
    const b2 = JSON.parse(JSON.stringify(backup));
    delete b2.recordsSeenV2;
    b2.bwWorkoutsV2[today].exercises[0].sets.push({ id: 1, reps: 12 });
    await page.setInputFiles('#importFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(b2)) });
    await page.waitForTimeout(700);
    pruefe(!(await page.locator('#appModal').isVisible()), 'Nach Backup laden keine Rekord-Feier');
    pruefe(await page.evaluate(() => JSON.parse(localStorage.getItem('recordsSeenV2')).pullups) === 12, 'Rekord still übernommen');

    console.log('Erinnerungen in Chrome:');
    await page.evaluate(() => switchTab('profile'));
    pruefe(await page.locator('#reminderCard').isHidden(), 'In Chrome keine Erinnerungs-Karte');
    await page.close();

    // ---------- Mit nachgespielter Android-App ----------
    const app = await browser.newPage({ viewport: { width: 412, height: 860 } });
    app.on('pageerror', e => errors.push(e.message));
    await app.addInitScript(() => {
        window.__rem = [];
        window.__notify = 'off';
        window.AndroidApp = {
            setReminders: j => { window.__rem.push(JSON.parse(j)); return window.__notify; },
            getNotificationState: () => window.__notify,
            openNotificationSettings: () => { window.__openedSettings = true; },
            reportSteps: () => {}
        };
    });
    await app.goto(url);
    await app.waitForTimeout(300);
    console.log('Erinnerungen in der App:');
    pruefe(await app.evaluate(() => window.__rem.length) >= 1, 'App bekommt beim Start die Einstellungen');
    await app.evaluate(() => {
        const t = getLocalDateKey();
        setDailyWeight(t, 90.2);
        const dates = PlanCalc.periodDates(t, 1);
        const plan = PlanCalc.normalizePlan({ title: 'P', summary: '', review: '', nutritionTips: [], safetyNotes: [],
            days: dates.map((d, i) => i % 2 === 0 ? { date: d, type: 'training', title: 'Ganzkörper ' + i, durationMin: 30, warmup: '', cooldown: '', notes: '', exercises: [{ name: 'Kniebeugen', sets: 3, reps: '10', restSec: 60, explanation: '', tracksReps: false }] }
                : { date: d, type: 'ruhe', title: 'Ruhetag', durationMin: 0, warmup: '', exercises: [], cooldown: '', notes: '' }) }, dates);
        localStorage.setItem('trainingPlansV2', JSON.stringify([{ id: 'p', dates, weeks: 1, focus: { options: [] }, plan, progress: { [dates[0]]: { done: true, difficulty: 2, reps: {}, doneOn: t } }, checkin: null }]));
        switchTab('profile');
    });
    pruefe(await app.locator('#reminderCard').isVisible(), 'Erinnerungs-Karte sichtbar');
    await app.selectOption('#remWeighOn', '1');
    await app.fill('#remWeighTime', '06:45');
    await app.selectOption('#remTrainOn', '1');
    await app.click('#reminderCard button:has-text("Erinnerungen speichern")');
    const last = await app.evaluate(() => window.__rem[window.__rem.length - 1]);
    pruefe(last.weigh.on && last.weigh.time === '06:45' && last.training.on && last.training.time === '17:00', 'Einstellungen an die App (Wiegen 06:45, Training 17:00)');
    pruefe(last.weighedOn === today, 'App weiß: heute schon gewogen');
    pruefe(last.trainingDays.length === 3 && !last.trainingDays.some(d => d.date === today), 'Nur offene Trainingstage (heute erledigt, Ruhetage nicht)');
    pruefe(last.trainingDays[0].title.startsWith('Ganzkörper'), 'Mit Titel der Einheit');
    pruefe((await app.locator('#remStatus').innerText()).includes('ausgeschaltet') && await app.locator('#remSettingsBtn').isVisible(), 'Benachrichtigungen aus → Hinweis + Knopf zu den Einstellungen');
    await app.click('#remSettingsBtn');
    pruefe(await app.evaluate(() => window.__openedSettings === true), 'Knopf öffnet Android-Einstellungen');
    await app.evaluate(() => { window.__notify = 'ok'; renderReminderCard(); });
    pruefe((await app.locator('#remStatus').innerText()).startsWith('✓ Aktiv'), 'Erlaubt → „✓ Aktiv“');
    await app.evaluate(() => switchTab('weight'));
    await app.fill('#profWeightInput', '90,0');
    await app.click('#tab-weight button:has-text("Speichern") >> nth=0');
    await app.click('#appModalYes');
    pruefe(await app.evaluate(() => window.__rem[window.__rem.length - 1].weighedOn) === today, 'Nach dem Wiegen wird die App informiert');

    await browser.close();
    if (errors.length) {
        console.log('FEHLER auf der Seite:\n- ' + errors.join('\n- '));
        fehler++;
    }
    console.log(fehler ? `motivation_web_test: ${fehler} FEHLER` : 'motivation_web_test: alles OK');
    process.exit(fehler ? 1 : 0);
})();
