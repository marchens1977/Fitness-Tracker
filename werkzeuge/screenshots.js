// Öffnet index.html im Browser (Playwright/Chromium), klickt durch einige Bereiche,
// speichert Bildschirmfotos und meldet Programmfehler der Seite.
// Aufruf:  node werkzeuge/screenshots.js [Ausgabe-Ordner]
// Ergebnis: Bilder s-*.png im Ausgabe-Ordner; Exit-Code 1, wenn die Seite Fehler wirft.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
    const outDir = path.resolve(process.argv[2] || '.');
    const page_ = 'file://' + path.resolve(__dirname, '..', 'index.html');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(page_);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 's-start.png') });

    // Beispiel-Schritte, damit Balken und Diagramme etwas zeigen
    await page.evaluate(() => {
        const t = getLocalDateKey();
        localStorage.setItem('stepsHistoryV2', JSON.stringify({ [t]: 6400, [shiftDateKey(t, -1)]: 11200 }));
        // Beispiel-Gewicht: 5 Wochen, manche Tage fehlen, Trend ca. −0,5 kg/Woche, Tageswerte schwanken
        const log = [];
        for (let i = 34; i >= 0; i--) {
            if (i % 4 === 2) continue;
            const w = 95 - ((34 - i) / 7) * 0.5 + (i % 3 === 0 ? 0.7 : (i % 3 === 1 ? -0.4 : 0.1));
            log.push({ id: 'b' + i, date: shiftDateKey(t, -i), weightKg: Math.round(w * 10) / 10, bodyFatPct: null });
        }
        localStorage.setItem('bodyMetricsLogV2', JSON.stringify(log));
        localStorage.setItem('userGoalWeightV2', '85.0');
        // Beispiel-Bestwerte und Motivation
        localStorage.setItem('bwWorkoutsV2', JSON.stringify({ [shiftDateKey(t, -9)]: { date: shiftDateKey(t, -9), exercises: [{ exerciseId: 'bw_pullup', sets: [{ reps: 4 }] }, { exerciseId: 'bw_pushup', sets: [{ reps: 15 }] }] }, [shiftDateKey(t, -2)]: { date: shiftDateKey(t, -2), exercises: [{ exerciseId: 'bw_pullup', sets: [{ reps: 6 }] }] } }));
        localStorage.setItem('runningLogsV2', JSON.stringify([{ id: 'r1', date: shiftDateKey(t, -8), distanceKm: 5, durationMin: 31 }, { id: 'r2', date: shiftDateKey(t, -3), distanceKm: 6.2, durationMin: 36.5 }]));
        localStorage.setItem('sweetsFreeV2', JSON.stringify([shiftDateKey(t, -3), shiftDateKey(t, -2), shiftDateKey(t, -1)]));
        localStorage.setItem('activeDatesV2', JSON.stringify([shiftDateKey(t, -4), shiftDateKey(t, -3), shiftDateKey(t, -2), shiftDateKey(t, -1)]));
        // Beispiel-Trainingsplan (ohne KI erzeugt), damit die Plan-Seite etwas zeigt
        localStorage.setItem('trainingProfileV2', JSON.stringify({ age: 48, heightCm: 182, level: 'Wiedereinsteiger (länger kein Sport)', experience: '', equipment: ['Klimmzugstange', 'Fitnessstudio'], equipmentOther: '', daysPerWeek: 3, minutesPerSession: 45, goals: ['Abnehmen', 'Kraft'], limitations: '' }));
        const dates = PlanCalc.periodDates(shiftDateKey(t, -2), 1);
        const plan = PlanCalc.normalizePlan({ title: 'Sanfter Wiedereinstieg', summary: 'Drei kurze Ganzkörper-Einheiten, Technik vor Gewicht.', review: '', nutritionTips: ['Zu jeder Mahlzeit eine Eiweißquelle'], safetyNotes: [],
            days: dates.map((d, i) => i % 2 === 0 ? { date: d, type: 'training', title: 'Ganzkörper Studio', durationMin: 45, warmup: '5 Min. Rudergerät locker', cooldown: '5 Min. Dehnen', notes: 'Ruhig angehen, Technik zählt.', exercises: [
                { name: 'Klimmzüge (negativ)', sets: 3, reps: '3–5', restSec: 90, explanation: 'Oben starten und 3–4 Sekunden langsam ablassen.', tracksReps: true },
                { name: 'Beinpresse', sets: 3, reps: '12', restSec: 60, explanation: 'Knie nicht ganz durchstrecken, Rücken an der Lehne.', tracksReps: false }] }
                : { date: d, type: 'ruhe', title: 'Ruhetag', durationMin: 0, warmup: '', exercises: [], cooldown: '', notes: 'Lockerer Spaziergang' }) }, dates);
        localStorage.setItem('trainingPlansV2', JSON.stringify([{ id: 'p1', createdAt: '', startDate: dates[0], weeks: 1, dates, focus: { options: ['gym', 'strength'], text: '' }, plan, progress: { [dates[0]]: { done: true, difficulty: 2, reps: { 0: '4, 4, 3' }, note: '', doneOn: dates[0] } }, checkin: null, costUsd: 0.21 }]));
    });
    for (const tab of ['overview', 'steps', 'nutrition', 'running', 'weight', 'records', 'stats', 'motivation', 'gym-strength', 'plan', 'profile']) {
        await page.evaluate(t => { initApp(); switchTab(t); }, tab);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, 's-' + tab + '.png') });
    }
    await browser.close();

    if (errors.length) {
        console.log('FEHLER auf der Seite:\n- ' + errors.join('\n- '));
        process.exit(1);
    }
    console.log('OK: keine Fehler, Bilder in ' + outDir);
})();
