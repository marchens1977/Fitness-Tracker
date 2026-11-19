// Prüft die Update-Karte im Profil der Webseite (index.html) mit Playwright/Chromium:
//  - in Chrome (ohne Android-App) ist sie versteckt,
//  - mit nachgespielter Android-App (window.AndroidApp) zeigt sie die Version,
//  - der Knopf „Nach Updates suchen“ ruft AndroidApp.checkUpdate() auf,
//  - ältere App-Versionen ohne checkUpdate(): Karte bleibt versteckt.
// Aufruf: node test/update_web.js   (Exit-Code 1 bei Fehler)
const path = require('path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

async function seite(browser, fakeApp) {
    const page = await browser.newPage({ viewport: { width: 412, height: 860 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (fakeApp) await page.addInitScript(fakeApp);
    await page.goto(url);
    await page.evaluate(() => { startApp(); initApp(); switchTab('profile'); });
    await page.waitForTimeout(300);
    return { page, errors };
}

(async () => {
    const browser = await chromium.launch();

    // 1) Chrome ohne App
    let { page, errors } = await seite(browser, null);
    pruefe(!(await page.isVisible('#appUpdateCard')), 'Chrome: Update-Karte ist versteckt');
    pruefe(errors.length === 0, 'Chrome: keine Programmfehler ' + errors.join('; '));
    await page.close();

    // 2) Neue Android-App (mit Update-Funktion)
    ({ page, errors } = await seite(browser, () => {
        window.__updateCalls = 0;
        window.AndroidApp = {
            getVersion: () => '1.0.9',
            checkUpdate: () => { window.__updateCalls++; },
            reportSteps: () => {}, saveFile: () => {},
        };
    }));
    pruefe(await page.isVisible('#appUpdateCard'), 'App: Update-Karte im Profil sichtbar');
    pruefe((await page.textContent('#appVersionLabel')).trim() === 'App-Version 1.0.9', 'App: zeigt „App-Version 1.0.9“');
    await page.click('#appUpdateCard button');
    pruefe(await page.evaluate(() => window.__updateCalls) === 1, 'App: Knopf „Nach Updates suchen“ fragt die App');
    const reihenfolge = await page.evaluate(() => {
        const karten = [...document.querySelectorAll('#tab-profile .card')];
        const sich = karten.findIndex(k => k.textContent.includes('Datensicherung'));
        return karten.indexOf(document.getElementById('appUpdateCard')) === sich + 1;
    });
    pruefe(reihenfolge, 'App: Karte steht direkt unter „Datensicherung“');
    await page.screenshot({ path: path.join(process.argv[2] || require('os').tmpdir(), 's-profil-update.png'), fullPage: true });
    pruefe(errors.length === 0, 'App: keine Programmfehler ' + errors.join('; '));
    await page.close();

    // 3) Alte App (1.0.8) ohne Update-Funktion
    ({ page, errors } = await seite(browser, () => {
        window.AndroidApp = { reportSteps: () => {}, saveFile: () => {} };
    }));
    pruefe(!(await page.isVisible('#appUpdateCard')), 'Alte App ohne Update-Funktion: Karte versteckt');
    pruefe(errors.length === 0, 'Alte App: keine Programmfehler ' + errors.join('; '));
    await page.close();

    await browser.close();
    console.log(fehler === 0 ? 'update_web: alles OK' : 'update_web: ' + fehler + ' Fehler');
    process.exit(fehler === 0 ? 0 : 1);
})();
