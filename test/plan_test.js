// Prüft den KI-Trainingsplan-Teil (Block PLAN-CALC in index.html) ohne Browser und ohne Internet:
//  - Zeitraum (1/2 Wochen), nächster Montag, Kosten
//  - Anfrage an die Claude-API: Modell, festes JSON-Format, KEIN Schlüssel im Inhalt,
//    Gewicht als Wochen-Ø/Trend (kein Tageswert), Schwerpunkte, Check-in, letzter Plan
//  - Antwort lesen (Server-Sent Events, auch in kleinen Stücken, Fehler, Modellwechsel)
//  - Plan prüfen/vervollständigen, Fortschritt
// Aufruf: node test/plan_test.js   (Exit-Code 1 bei Fehler)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* PLAN-CALC-START[\s\S]*?\/\* PLAN-CALC-END \*\//);
if (!m) { console.log('FEHLER: Block PLAN-CALC nicht gefunden'); process.exit(1); }
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + '\nthis.PlanCalc = PlanCalc;', ctx);
const P = ctx.PlanCalc;

let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

console.log('Zeitraum & Kosten:');
const d1 = P.periodDates('2026-11-23', 1);
const d2 = P.periodDates('2026-11-30', 2);
pruefe(d1.length === 7 && d1[6] === '2026-11-29', '1 Woche ab Mo 23.11. = 7 Tage bis So 29.11.');
pruefe(d2.length === 14 && d2[13] === '2026-12-13', '2 Wochen über den Monatswechsel');
pruefe(P.weekday('2026-11-23') === 'Mo' && P.weekday('2026-11-29') === 'So', 'Wochentage richtig');
pruefe(P.nextMonday('2026-11-23') === '2026-11-30' && P.nextMonday('2026-11-26') === '2026-11-30', 'Nächster Montag');
pruefe(Math.abs(P.costUsd({ input: 4000, output: 12000 }) - 0.256) < 1e-9, '4.000 rein + 12.000 raus = 0,256 $ (Opus 5.5: 4 $/20 $)');

console.log('Anfrage an die KI:');
const weight = { hasData: true, avg7Kg: 92.3, changeVsPrevWeekKg: -0.4, trend: 'fällt', lastWeeks: [{ kw: 47, avgKg: 92.7 }], startAvgKg: 94, lostKg: 1.7, goalKg: 85 };
const profile = { age: 48, heightCm: 182, level: 'Wiedereinsteiger', experience: 'Früher Fußball', equipment: ['Klimmzugstange', 'Fitnessstudio'], equipmentOther: 'Kettlebell 12 kg', daysPerWeek: 3, minutesPerSession: 45, goals: ['Abnehmen', 'Kraft'], limitations: 'Knie links empfindlich' };
const prev = {
    dates: d1, focus: { options: ['gym'] },
    plan: { days: d1.map((d, i) => i % 2 === 0
        ? { date: d, type: 'training', title: 'Ganzkörper', exercises: [{ name: 'Klimmzüge', sets: 3, reps: '3–5', tracksReps: true }] }
        : { date: d, type: 'ruhe', title: 'Ruhetag', exercises: [] }) },
    progress: { [d1[0]]: { done: true, difficulty: 3, reps: { 0: '5, 4, 3' }, note: 'Knie ok' } }
};
const body = P.buildRequestBody({
    profile, weight, weeks: 2, dates: d2, previousPlan: prev,
    focus: { options: ['home', 'run'], text: 'diese Woche wenig Zeit' },
    checkin: { howItWent: 'Gut, aber müde', tooEasy: 'Dehnen', tooHard: 'Klimmzüge' },
    nutritionGoals: { kcal: 'höchstens 2000' }, activity: { schritteSchnitt7Tage: 8000 }
});
const content = body.messages[0].content;
pruefe(body.model === 'claude-opus-5-5', 'Modell claude-opus-5-5');
pruefe(body.stream === true && body.max_tokens >= 16000, 'Antwort Stück für Stück, genug Platz');
pruefe(body.output_config.format.type === 'json_schema' && body.output_config.format.schema === P.PLAN_SCHEMA, 'Festes JSON-Format');
pruefe(body.output_config.effort === 'medium', 'Effort ausdrücklich gesetzt (medium)');
pruefe(body.fallbacks === 'default', 'Ersatzmodell bei Ablehnung aktiviert');
pruefe(!('temperature' in body) && !('thinking' in body), 'Keine Parameter, die Opus 5.5 ablehnt');
pruefe(!/sk-ant|api[_-]?key|x-api-key/i.test(JSON.stringify(body)), 'Kein API-Schlüssel im Inhalt der Anfrage');
pruefe(content.includes('"durchschnitt7TageKg": 92.3') && content.includes('"trend": "fällt"'), 'Gewicht als 7-Tage-Ø und Trend');
pruefe(!/heute|tageswert/i.test(JSON.stringify(JSON.parse(content.slice(content.indexOf('{'))).gewicht)), 'Kein einzelner Tageswert beim Gewicht');
pruefe(content.includes('Training zu Hause') && content.includes('Mehr Laufen') && content.includes('wenig Zeit'), 'Schwerpunkte und Wünsche enthalten');
pruefe(content.includes('Gut, aber müde') && content.includes('"zuSchwer": "Klimmzüge"'), 'Check-in enthalten');
pruefe(content.includes('"5, 4, 3"') && content.includes('"empfunden": "schwer"'), 'Letzter Plan: geschaffte Wdh. und Schwierigkeit');
pruefe(content.includes('Knie links empfindlich') && content.includes('Kettlebell 12 kg'), 'Einschränkungen und eigene Geräte enthalten');
pruefe(content.includes('2026-11-30 (Mo)') && content.includes('2026-12-13 (So)'), 'Alle Tage mit Wochentag');
pruefe(/langsam/.test(P.SYSTEM_PROMPT) && /Körperfett/.test(P.SYSTEM_PROMPT), 'Systemanweisung: langsamer Wiedereinstieg, keine Maße/Körperfett');
const first = JSON.parse(P.buildUserContent({ profile, weight: { hasData: false }, weeks: 1, dates: d1, focus: { options: [] } }).replace(/^[^{]*/, ''));
pruefe(first.ersterPlan === true && first.checkIn === null && first.vorherigerPlan === null, 'Erster Plan: ohne Check-in, ohne Vorgänger');

console.log('Schema:');
function checkSchema(s, where) {
    if (s.type === 'object') {
        if (s.additionalProperties !== false) return where + ': additionalProperties fehlt';
        const keys = Object.keys(s.properties).sort().join();
        if (keys !== s.required.slice().sort().join()) return where + ': nicht alle Felder required';
        for (const k of Object.keys(s.properties)) { const r = checkSchema(s.properties[k], where + '.' + k); if (r) return r; }
    }
    if (s.type === 'array') return checkSchema(s.items, where + '[]');
    if ('minimum' in s || 'maxLength' in s || 'minLength' in s) return where + ': nicht erlaubte Grenze';
    return null;
}
const schemaErr = checkSchema(P.PLAN_SCHEMA, 'plan');
pruefe(!schemaErr, 'JSON-Schema erfüllt die API-Regeln' + (schemaErr ? ' (' + schemaErr + ')' : ''));

console.log('Antwort lesen:');
const planJson = JSON.stringify({ title: 'Plan', summary: 'S', review: '', days: [], nutritionTips: [], safetyNotes: [] });
const events = [
    { type: 'message_start', message: { model: 'claude-opus-5-5', usage: { input_tokens: 3500, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'geheim' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: planJson.slice(0, 20) } },
    { type: 'ping' },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: planJson.slice(20) } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 9000 } },
    { type: 'message_stop' }
];
const sse = events.map(e => `event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join('');
const parser = P.createStreamParser();
for (let i = 0; i < sse.length; i += 37) parser.feed(sse.slice(i, i + 37)); // in kleinen Stücken
const r = parser.result();
pruefe(r.text === planJson, 'Text korrekt zusammengesetzt (auch bei Stücken mitten im Wort)');
pruefe(!r.text.includes('geheim'), 'Denk-Teil wird nicht in den Plan übernommen');
pruefe(r.input === 3500 && r.output === 9000 && r.stopReason === 'end_turn', 'Verbrauch und Ende erkannt');
const p2 = P.createStreamParser();
p2.feed('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'abgebrochen' } }) + '\n\n');
p2.feed('data: ' + JSON.stringify({ type: 'content_block_start', content_block: { type: 'fallback' } }) + '\n\n');
p2.feed('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'neu' } }) + '\n\n');
pruefe(p2.result().text === 'neu' && p2.result().fallback, 'Modellwechsel: alter Text verworfen');
const p3 = P.createStreamParser();
p3.feed('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n');
pruefe(p3.result().error === 'Overloaded', 'Fehler im Datenstrom erkannt');

console.log('Plan prüfen:');
const raw = {
    title: ' Wiedereinstieg ', summary: 'Langsam starten', review: '',
    days: [
        { date: d1[0], type: 'training', title: 'Ganzkörper', durationMin: 40, warmup: '5 Min. Rad', exercises: [{ name: 'Klimmzüge', sets: 3, reps: '3–5', restSec: 90, explanation: 'Langsam ablassen', tracksReps: true }, { name: '', sets: 1, reps: '1', restSec: 0, explanation: '', tracksReps: false }], cooldown: 'Dehnen', notes: '' },
        { date: d1[0], type: 'ruhe', title: 'doppelt', durationMin: 0, warmup: '', exercises: [], cooldown: '', notes: '' },
        { date: d1[2], type: 'training', title: 'Leer', durationMin: 30, warmup: '', exercises: [], cooldown: '', notes: '' },
        { date: '2030-01-01', type: 'training', title: 'falsches Datum', durationMin: 30, warmup: '', exercises: [{ name: 'X', sets: 1, reps: '1', restSec: 1, explanation: '', tracksReps: false }], cooldown: '', notes: '' }
    ],
    nutritionTips: ['Viel Eiweiß', ''], safetyNotes: []
};
const plan = P.normalizePlan(raw, d1);
pruefe(plan.days.length === 7 && plan.days.every((d, i) => d.date === d1[i]), 'Genau ein Eintrag je Tag, richtige Reihenfolge');
pruefe(plan.days[0].title === 'Ganzkörper' && plan.days[0].exercises.length === 1, 'Doppelter Tag ignoriert, Übung ohne Namen entfernt');
pruefe(plan.days[1].type === 'ruhe', 'Fehlender Tag wird Ruhetag');
pruefe(plan.days[2].type === 'ruhe', 'Training ohne Übungen wird Ruhetag');
pruefe(plan.title === 'Wiedereinstieg' && plan.nutritionTips.length === 1, 'Texte bereinigt, leere Tipps entfernt');
let threw = false;
try { P.normalizePlan({ days: [] }, d1); } catch (e) { threw = true; }
pruefe(threw, 'Plan ganz ohne Training wird abgelehnt');

console.log('Fortschritt:');
const rec = { dates: d1, plan: { days: [plan.days[0], { ...plan.days[0], date: d1[3] }, { ...plan.days[0], date: d1[5] }, plan.days[1]] }, progress: { [d1[0]]: { done: true, difficulty: 2 }, [d1[3]]: { done: true, difficulty: 4 }, [d1[1]]: { done: true } } };
const st = P.progressStats(rec);
pruefe(st.total === 3 && st.done === 2 && st.pct === 67, '2 von 3 Trainingstagen erledigt (Ruhetag zählt nicht)');
pruefe(st.avgDifficulty === 3, 'Durchschnittliche Schwierigkeit');
pruefe(!P.isEnded(rec, d1[6]) && P.isEnded(rec, P.shift(d1[6], 1)), 'Zeitraum endet nach dem letzten Tag');

console.log('Logbuch für die KI (letzte 14 Tage):');
const T = '2026-11-24';
const log = P.activityDigest({
    strength: {
        '2026-11-20': { date: '2026-11-20', exercises: [{ name: 'Bankdrücken', sets: [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }] }] },
        '2026-11-01': { date: '2026-11-01', exercises: [{ name: 'Kniebeugen', sets: [{ weight: 80, reps: 5 }] }] }
    },
    bw: { '2026-11-22': { exercises: [{ name: 'Klimmzüge', unit: 'Wdh.', sets: [{ reps: 6 }, { reps: 5 }] }, { name: 'Leer', sets: [] }] } },
    stretch: { '2026-11-23': { exercises: [{ name: 'Hüftbeuger', unit: 'Sek.', sets: [{ reps: 30 }] }] } },
    cardio: { '2026-11-21': { entries: [{ deviceName: 'Laufband', duration: 20, distance: 2.5 }, { deviceName: 'Rudergerät', duration: 10, distance: 0 }] } },
    runs: [{ date: '2026-11-19', distanceKm: 5, durationMin: 30 }, { date: '2026-10-01', distanceKm: 10, durationMin: 60 }],
    mini: ['2026-11-18', '2026-11-02'],
    steps: { '2026-11-24': 4000, '2026-11-23': 8000 }
}, T);
pruefe(log.zeitraum === '2026-11-11 bis 2026-11-24', 'Zeitraum 14 Tage bis heute');
pruefe(log.krafttraining.length === 1 && log.krafttraining[0].uebungen[0].saetze.join('|') === '60 kg × 8|62,5 kg × 6', 'Kraft: Übung mit Gewicht × Wiederholungen je Satz (alter Eintrag fällt weg)');
pruefe(log.krafttraining[0].datum === '2026-11-20 (Fr)', 'Kraft: Datum mit Wochentag');
pruefe(log.bodyweight[0].uebungen.length === 1 && log.bodyweight[0].uebungen[0].saetze.join('|') === '6 Wdh.|5 Wdh.', 'Bodyweight: Sätze, leere Übung weggelassen');
pruefe(log.dehnen[0].uebungen[0].saetze[0] === '30 Sek.', 'Dehnen: Haltezeit in Sekunden');
pruefe(log.cardio[0].einheiten.join('|') === 'Laufband: 20 Min., 2,5 km|Rudergerät: 10 Min.', 'Cardio: Gerät, Minuten, km');
pruefe(log.laeufe.length === 1 && log.laeufe[0].pace === '6:00 min/km' && log.laeufe[0].minuten === 30, 'Läufe: nur 14 Tage, mit Pace');
pruefe(log.miniEinheiten10Min.join() === '2026-11-18', 'Mini-Einheiten im Zeitraum');
pruefe(log.schritteSchnitt7Tage === 6000, 'Schritte-Ø 7 Tage');
pruefe(log.tageMitKraft === 1 && log.tageMitBodyweight === 1 && log.tageMitCardio === 1 && log.tageMitLauf === 1 && log.tageMitDehnen === 1, 'Anzahl Tage je Art');
const leer = P.activityDigest({}, T);
pruefe(leer.krafttraining.length === 0 && leer.schritteSchnitt7Tage === null, 'Leeres Logbuch stürzt nicht ab');
const withLog = JSON.parse(P.buildUserContent({ profile, weight, weeks: 1, dates: d1, focus: { options: [] }, activity: log, records: { 'Klimmzüge (am Stück)': '6 Wdh. (am 2026-11-22)' } }).split('\n\n').slice(1).join('\n\n'));
pruefe(withLog.aktivitaetLetzte14Tage.krafttraining[0].uebungen[0].name === 'Bankdrücken', 'Logbuch steckt in der Anfrage');
pruefe(withLog.bestwerte['Klimmzüge (am Stück)'] === '6 Wdh. (am 2026-11-22)', 'Bestwerte stecken in der Anfrage');
pruefe(/Logbuch/.test(P.SYSTEM_PROMPT) && /tatsächlich geschafften Gewichten/.test(P.SYSTEM_PROMPT), 'Systemanweisung: Logbuch auswerten');

// --- Trainingstag verschieben ---
console.log('Verschieben:');
const mvDates = ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
const tr = d => ({ date: d, type: 'training', title: 'T ' + d, durationMin: 30, warmup: '', exercises: [{ name: 'Kniebeugen', sets: 3, reps: '10', restSec: 60, explanation: '', tracksReps: true }], cooldown: '', notes: '' });
const rs = d => ({ date: d, type: 'ruhe', title: 'Ruhetag', durationMin: 0, warmup: '', exercises: [], cooldown: '', notes: 'Spaziergang' });
const mvRec = { dates: mvDates.slice(), plan: { days: [tr(mvDates[0]), rs(mvDates[1]), tr(mvDates[2]), rs(mvDates[3])] }, progress: {}, checkin: null };
pruefe(P.canMove(mvRec, '2026-11-24') && !P.canMove(mvRec, '2026-11-25'), 'Nur Trainingstage sind verschiebbar');
pruefe(P.moveTargets(mvRec, '2026-11-24', '2026-11-24').join() === '2026-11-25,2026-11-27', 'Ziele = freie Ruhetage ab heute');
pruefe(P.moveTargets(mvRec, '2026-11-24', '2026-11-26').join() === '2026-11-27', 'Vergangene Ruhetage sind kein Ziel');
const sw = P.moveDay(mvRec, '2026-11-24', '2026-11-25', '2026-11-24');
pruefe(sw.plan.days[0].type === 'ruhe' && sw.plan.days[0].movedTo === '2026-11-25' && sw.plan.days[0].date === '2026-11-24', 'Tausch: alter Tag wird Ruhetag (mit Hinweis)');
pruefe(sw.plan.days[1].type === 'training' && sw.plan.days[1].title === 'T 2026-11-24' && sw.plan.days[1].movedFrom === '2026-11-24', 'Tausch: Einheit liegt am neuen Tag');
pruefe(sw.dates.join() === mvDates.join() && sw.plan.days.length === 4, 'Tausch: Plan endet am selben Tag');
pruefe(mvRec.plan.days[0].type === 'training', 'Original bleibt unverändert');
const back = P.moveDay(sw, '2026-11-25', '2026-11-24', '2026-11-24');
pruefe(back.plan.days[0].type === 'training' && !back.plan.days[0].movedFrom, 'Zurückschieben: Hinweis „verschoben“ verschwindet');
let err = false; try { P.moveDay(mvRec, '2026-11-24', '2026-11-26', '2026-11-24'); } catch (e) { err = true; }
pruefe(err, 'Auf einen anderen Trainingstag geht nicht');
const doneRec = JSON.parse(JSON.stringify(mvRec)); doneRec.progress['2026-11-24'] = { done: true, difficulty: 2 };
pruefe(!P.canMove(doneRec, '2026-11-24') && P.moveTargets(doneRec, '2026-11-24', '2026-11-24').length === 0, 'Erledigte Einheit nicht verschiebbar');
const ciRec = Object.assign({}, mvRec, { checkin: { date: '2026-11-27' } });
pruefe(!P.canMove(ciRec, '2026-11-24'), 'Nach dem Check-in nicht mehr verschiebbar');
const sh = P.shiftLater(Object.assign({}, mvRec, { progress: { '2026-11-26': { done: true, difficulty: 2, doneOn: '2026-11-24' } } }), '2026-11-24');
pruefe(sh.dates.join() === '2026-11-24,2026-11-25,2026-11-26,2026-11-27,2026-11-28', 'Nach hinten: Plan 1 Tag länger');
pruefe(sh.plan.days.map(d => d.type[0]).join('') === 'rtrtr', 'Nach hinten: neuer Ruhetag, Rest rutscht 1 Tag');
pruefe(sh.plan.days[0].movedTo === '2026-11-25' && sh.plan.days[1].title === 'T 2026-11-24' && sh.plan.days[1].movedFrom === '2026-11-24', 'Nach hinten: Hinweise stimmen');
pruefe(sh.plan.days[4].date === '2026-11-28' && sh.plan.days[4].type === 'ruhe', 'Nach hinten: letzter Tag am neuen Ende');
pruefe(sh.progress['2026-11-27'] && sh.progress['2026-11-27'].done && !sh.progress['2026-11-26'], 'Nach hinten: Erledigt-Haken wandert mit');
pruefe(P.isEnded(sh, '2026-11-28') === false && P.isEnded(sh, '2026-11-29') === true, 'Check-in kommt 1 Tag später');
const sh2 = P.shiftLater(sh, '2026-11-25');
pruefe(sh2.plan.days[2].date === '2026-11-26' && sh2.plan.days[2].movedFrom === '2026-11-24', 'Zweimal verschoben: ursprünglicher Tag bleibt gemerkt');
const dig = P.previousPlanDigest(Object.assign({ focus: { options: [] } }, sw));
pruefe(dig.einheiten[0].verschobenVom === '2026-11-24', 'KI erfährt, dass eine Einheit verschoben wurde');

console.log(fehler ? `plan_test: ${fehler} FEHLER` : 'plan_test: alles OK');
process.exit(fehler ? 1 : 0);
