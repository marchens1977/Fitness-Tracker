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
    });
    for (const tab of ['overview', 'steps', 'nutrition', 'running', 'weight', 'stats', 'motivation', 'gym-strength', 'plan', 'profile']) {
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
