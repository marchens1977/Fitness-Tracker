// Prüft „Mein Trainingsplan“ im Browser (Playwright/Chromium) – die Claude-API wird NACHGESPIELT,
// es wird also kein echtes Guthaben verbraucht und kein echter Schlüssel benutzt.
//  - Profil, Schlüssel (nur lokal, nicht im Backup), Schwerpunkte, Plan erstellen
//  - Anfrage: richtige Adresse, Kopfzeilen (Schlüssel, Browser-Zugriff), Modell, Check-in-Daten
//  - Einheit abhaken mit Schwierigkeit und Wiederholungen → zählt als aktiver Tag
//  - Check-in → neue Schwerpunkte → nächster Plan bekommt Check-in und Ergebnisse
//  - Verlauf, Übersicht „Heute laut Plan“, Fehlermeldungen (falscher Schlüssel, kein Guthaben)
// Aufruf: node test/plan_web_test.js   (Exit-Code 1 bei Fehler)
const path = require('path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FAKE_KEY = 'sk-ant-test-' + 'x'.repeat(30);
let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

function fakePlan(dates, review) {
    return {
        title: 'Sanfter Wiedereinstieg', summary: 'Langsam starten, Technik lernen.', review: review || '',
        days: dates.map((d, i) => i % 2 === 0
            ? { date: d, type: 'training', title: 'Ganzkörper', durationMin: 40, warmup: '5 Min. Rad', cooldown: 'Dehnen', notes: 'Ruhig angehen',
                exercises: [
                    { name: 'Klimmzüge (negativ)', sets: 3, reps: '3–5', restSec: 90, explanation: 'Langsam ablassen.', tracksReps: true },
                    { name: 'Kniebeugen', sets: 3, reps: '10', restSec: 60, explanation: 'Rücken gerade.', tracksReps: true }
                ] }
            : { date: d, type: 'ruhe', title: 'Ruhetag', durationMin: 0, warmup: '', exercises: [], cooldown: '', notes: 'Spaziergang' }),
        nutritionTips: ['Zu jeder Mahlzeit Eiweiß'], safetyNotes: []
    };
}

function sse(obj) {
    const text = JSON.stringify(obj);
    const ev = [
        { type: 'message_start', message: { model: 'claude-opus-5-5', usage: { input_tokens: 3000, output_tokens: 1 } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(0, 50) } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(50) } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10000 } },
        { type: 'message_stop' }
    ];
    return ev.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const requests = [];
    let mode = 'ok';
    await page.route('https://api.anthropic.com/v1/messages', async route => {
        const req = route.request();
        const body = JSON.parse(req.postData());
        requests.push({ headers: req.headers(), body });
        const cors = { 'access-control-allow-origin': '*' };
        if (mode === 'badkey') return route.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
        if (mode === 'nocredit') return route.fulfill({ status: 400, headers: cors, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }) });
        const content = body.messages[0].content;
        const data = JSON.parse(content.slice(content.indexOf('{')));
        const dates = data.diesmal.tage.map(t => t.slice(0, 10));
        await route.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: sse(fakePlan(dates, data.checkIn ? 'Gute Woche, Klimmzüge weiter langsam steigern.' : '')) });
    });
    await page.goto(url);
    await page.waitForTimeout(300);

    console.log('Start:');
    await page.click('.bottom-nav [data-group="plan"]');
    pruefe(await page.locator('#tab-plan').evaluate(e => e.classList.contains('active')), 'Plan-Seite öffnet sich');
    pruefe(await page.locator('#tpForm').isVisible(), 'Ohne Profil: Profil-Formular sichtbar');
    pruefe(await page.locator('#planCreateBtn').isDisabled(), 'Plan-Knopf gesperrt ohne Profil/Schlüssel');

    console.log('Profil & Schlüssel:');
    await page.fill('#tpAge', '48');
    await page.fill('#tpHeight', '182');
    await page.fill('#tpWeight', '93,4');
    await page.fill('#tpGoal', '85');
    await page.fill('#tpMinutes', '45');
    await page.click('#tpEquip .chip[data-value="Klimmzugstange"]');
    await page.click('#tpEquip .chip[data-value="Fitnessstudio"]');
    await page.click('#tpGoals .chip[data-value="Abnehmen"]');
    await page.fill('#tpLimits', 'Knie links empfindlich');
    await page.click('#tpForm button:has-text("Profil speichern")');
    const prof = await page.evaluate(() => getTrainingProfile());
    pruefe(prof && prof.age === 48 && prof.equipment.length === 2 && prof.goals[0] === 'Abnehmen', 'Profil gespeichert');
    pruefe(await page.evaluate(() => getWeightSummary().todayValue) === 93.4 && await page.evaluate(() => getGoalWeight()) === 85, 'Gewicht und Ziel aus dem Profil übernommen');
    pruefe(!(await page.locator('#tpForm').isVisible()) && (await page.locator('#tpSummary').innerText()).includes('48 Jahre'), 'Danach kurze Zusammenfassung');
    await page.fill('#aiKeyInput', 'falsch');
    await page.click('#aiKeyForm button');
    pruefe(await page.evaluate(() => getApiKey()) === '', 'Ungültiger Schlüssel wird nicht gespeichert');
    await page.fill('#aiKeyInput', FAKE_KEY);
    await page.click('#aiKeyForm button');
    pruefe((await page.locator('#aiKeyStatus').innerText()).includes('…xxxx'), 'Schlüssel gespeichert, nur Ende angezeigt');
    pruefe(await page.locator('#planCreateBtn').isEnabled(), 'Plan-Knopf jetzt frei');

    console.log('Fehlermeldungen:');
    mode = 'badkey';
    await page.click('#planCreateBtn');
    await page.waitForFunction(() => document.getElementById('planGenStatus').textContent.includes('⚠️'));
    pruefe((await page.locator('#planGenStatus').innerText()).includes('Schlüssel ist ungültig'), 'Falscher Schlüssel → verständliche Meldung');
    mode = 'nocredit';
    await page.click('#planCreateBtn');
    await page.waitForFunction(() => document.getElementById('planGenStatus').textContent.includes('Guthaben'));
    pruefe(true, 'Kein Guthaben → verständliche Meldung');
    pruefe(await page.evaluate(() => getTrainingPlans().length) === 0, 'Bei Fehler wird kein Plan gespeichert');

    console.log('Ersten Plan erstellen:');
    mode = 'ok';
    requests.length = 0;
    await page.click('#planFocusChips .chip[data-focus="gym"]');
    await page.click('#planFocusChips .chip[data-focus="strength"]');
    await page.fill('#planFocusText', 'diese Woche wenig Zeit');
    await page.click('#planWeeksChips .chip[data-weeks="1"]');
    await page.click('#planCreateBtn');
    await page.waitForFunction(() => getTrainingPlans().length === 1);
    const r1 = requests[0];
    pruefe(r1.headers['x-api-key'] === FAKE_KEY && r1.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'Kopfzeilen: Schlüssel + Browser-Zugriff');
    pruefe(r1.headers['anthropic-version'] === '2026-10-21', 'API-Version gesetzt');
    pruefe(r1.body.model === 'claude-opus-5-5' && r1.body.stream === true, 'Modell Opus 5.5, Antwort Stück für Stück');
    const c1 = r1.body.messages[0].content;
    pruefe(c1.includes('Mehr Kraft') && c1.includes('wenig Zeit') && c1.includes('"ersterPlan": true'), 'Schwerpunkte, Wünsche, „erster Plan“ übermittelt');
    pruefe(c1.includes('"durchschnitt7TageKg": 93.4') && c1.includes('Knie links'), 'Gewicht (Ø) und Einschränkungen übermittelt');
    pruefe(!c1.includes(FAKE_KEY), 'Schlüssel steht nicht im Text der Anfrage');
    const rec = await page.evaluate(() => getActivePlan());
    pruefe(rec.dates.length === 7 && rec.plan.days.length === 7 && rec.focus.options.includes('gym'), 'Plan gespeichert: 7 Tage, Schwerpunkte beim Plan');
    pruefe(Math.abs(rec.costUsd - 0.212) < 1e-6, 'Kosten berechnet (3.000 + 10.000 Tokens = 0,21 $)');
    pruefe((await page.locator('#aiUsageInfo').innerText()).includes('0,21 $'), 'Bisherige Kosten angezeigt');
    pruefe(await page.locator('#planCurrent .plan-day').count() === 7, 'Plan mit 7 Tagen angezeigt');
    pruefe(await page.locator('#planNewCard').isHidden(), 'Während ein Plan läuft: kein „Neuer Plan“');

    console.log('Abhaken:');
    const today = await page.evaluate(() => getLocalDateKey());
    pruefe(await page.locator(`#pdDone_${today}`).isVisible(), 'Heutige Einheit ist aufgeklappt');
    pruefe((await page.locator(`#pd_${today}`).innerText()).includes('Langsam ablassen.'), 'Übung mit Erklärung');
    await page.click(`#pdDone_${today} button:has-text("Als erledigt speichern")`);
    pruefe(!(await page.evaluate(t => (getActivePlan().progress || {})[t], today)), 'Ohne Schwierigkeit nicht speicherbar');
    await page.click(`#pdDone_${today} .chip[data-diff="3"]`);
    await page.fill(`#pdDone_${today} [data-reps="0"]`, '4, 3, 3');
    await page.fill(`#pdDone_${today} [data-note]`, 'Knie gut');
    await page.click(`#pdDone_${today} button:has-text("Als erledigt speichern")`);
    const pr = await page.evaluate(t => getActivePlan().progress[t], today);
    pruefe(pr && pr.done && pr.difficulty === 3 && pr.reps[0] === '4, 3, 3' && pr.note === 'Knie gut', 'Erledigt mit Schwierigkeit, Wiederholungen, Notiz');
    pruefe(await page.evaluate(t => getActiveDatesSet().has(t), today), 'Zählt als aktiver Tag (Serie)');
    await page.evaluate(() => switchTab('overview'));
    pruefe((await page.locator('#ovPlanText').innerText()).startsWith('✓ Ganzkörper'), 'Übersicht: „Heute laut Plan“ mit Haken');

    console.log('Check-in & nächster Plan:');
    await page.click('#ovPlanCard button');
    await page.click('#planCurrent button:has-text("Check-in vorzeitig machen")');
    pruefe(await page.locator('#planCheckinCard').isVisible(), 'Check-in-Formular');
    pruefe((await page.locator('#checkinWeightInfo').innerText()).includes('Ø 93,4 kg'), 'Check-in zeigt Gewichts-Ø');
    await page.click('#planCheckinCard button:has-text("Check-in speichern")');
    pruefe(await page.evaluate(() => getActivePlan().checkin) === null, 'Ohne „Wie lief es?“ kein Check-in');
    await page.fill('#checkinHow', 'Gut, aber wenig Schlaf');
    await page.fill('#checkinHard', 'Klimmzüge');
    await page.click('#planCheckinCard button:has-text("Check-in speichern")');
    pruefe(await page.locator('#planNewCard').isVisible() && (await page.locator('#planNewTitle').innerText()).includes('Nächster Plan'), 'Danach: neue Schwerpunkte wählen');
    pruefe(await page.locator('#planFocusChips .chip.active').count() === 0, 'Schwerpunkte neu wählbar (leer)');
    await page.click('#planFocusChips .chip[data-focus="home"]');
    await page.click('#planFocusChips .chip[data-focus="run"]');
    requests.length = 0;
    await page.click('#planCreateBtn');
    await page.waitForFunction(() => getTrainingPlans().length === 2);
    const c2 = requests[0].body.messages[0].content;
    pruefe(c2.includes('Gut, aber wenig Schlaf') && c2.includes('"zuSchwer": "Klimmzüge"'), 'Nächster Plan bekommt den Check-in');
    pruefe(c2.includes('"4, 3, 3"') && c2.includes('"empfunden": "schwer"') && c2.includes('"ersterPlan": false'), 'Nächster Plan bekommt Ergebnisse des letzten Plans');
    pruefe((await page.locator('#planCurrent').innerText()).includes('KI-Rückblick'), 'KI-Wochenrückblick wird angezeigt');
    pruefe(await page.locator('#planHistory .plan-day').count() >= 1, 'Alter Plan im Verlauf');
    await page.click('#planHistory .plan-day-head >> nth=0');
    const hist = await page.locator('#planHistory').innerText();
    pruefe(hist.includes('Gut, aber wenig Schlaf') && hist.includes('Training im Fitnessstudio'), 'Verlauf zeigt Check-in und Schwerpunkte');

    console.log('Backup:');
    await page.evaluate(() => { window.__saved = null; window.AndroidApp = { saveFile: (n, t) => { window.__saved = t; } }; exportBackup(); });
    const backupText = await page.evaluate(() => window.__saved);
    const backup = JSON.parse(backupText);
    pruefe(Array.isArray(backup.trainingPlansV2) && backup.trainingPlansV2.length === 2 && backup.trainingProfileV2.age === 48, 'Backup enthält Profil und Pläne');
    pruefe(!backupText.includes(FAKE_KEY) && !('aiApiKeyV2' in backup), 'Backup enthält KEINEN Schlüssel');
    await page.evaluate(() => { const k = localStorage.getItem('aiApiKeyV2'); localStorage.clear(); localStorage.setItem('aiApiKeyV2', k); });
    await page.setInputFiles('#importFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
    await page.waitForSelector('#appModal', { state: 'visible' });
    await page.click('#appModalYes');
    await page.waitForTimeout(300);
    pruefe(await page.evaluate(() => getTrainingPlans().length) === 2 && await page.evaluate(() => !!getTrainingProfile()), 'Backup laden stellt Pläne und Profil wieder her');

    console.log('Schlüssel löschen:');
    await page.evaluate(() => switchTab('plan'));
    await page.click('#aiKeyDeleteBtn');
    await page.click('#appModalYes');
    pruefe(await page.evaluate(() => getApiKey()) === '' && await page.evaluate(() => getTrainingPlans().length) === 2, 'Schlüssel weg, Pläne bleiben');

    await browser.close();
    if (errors.length) {
        console.log('FEHLER auf der Seite:\n- ' + errors.join('\n- '));
        fehler++;
    }
    console.log(fehler ? `plan_web_test: ${fehler} FEHLER` : 'plan_web_test: alles OK');
    process.exit(fehler ? 1 : 0);
})();
