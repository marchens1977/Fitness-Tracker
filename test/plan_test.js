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

console.log(fehler ? `plan_test: ${fehler} FEHLER` : 'plan_test: alles OK');
process.exit(fehler ? 1 : 0);
