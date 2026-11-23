// Prüft die Motivations-Berechnungen (Block MOTIV-CALC in index.html) ohne Browser:
//  - Serie mit Ruhetagen (aus dem Plan und feste Wochentage), heute darf noch offen sein
//  - Serie „ohne Süßes“
//  - Bestwerte aus Bodyweight, Plan-Wiederholungen, Läufen, Schritten (nur abgeschlossene Tage)
//  - „Neuer Rekord!“ nur bei echter Verbesserung
// Aufruf: node test/motivation_test.js   (Exit-Code 1 bei Fehler)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* MOTIV-CALC-START[\s\S]*?\/\* MOTIV-CALC-END \*\//);
if (!m) { console.log('FEHLER: Block MOTIV-CALC nicht gefunden'); process.exit(1); }
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + '\nthis.M = MotivCalc;', ctx);
const M = ctx.M;

let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}

// Woche: Mo 16.11. bis So 22.11.2026, heute = Mo 23.11.
console.log('Ruhetage:');
const plan = { plan: { days: [
    { date: '2026-11-16', type: 'training' }, { date: '2026-11-17', type: 'ruhe' },
    { date: '2026-11-18', type: 'training' }, { date: '2026-11-19', type: 'ruhe' }
] } };
const rest = M.restDaySet([plan], [6], '2026-11-16', '2026-11-23'); // fester Ruhetag: Sonntag (6)
pruefe(rest.has('2026-11-17') && rest.has('2026-11-19'), 'Ruhetage aus dem Plan');
pruefe(rest.has('2026-11-22') && !rest.has('2026-11-21'), 'Fester Ruhetag Sonntag (Tag ohne Plan)');
pruefe(!rest.has('2026-11-16'), 'Trainingstag aus dem Plan ist kein Ruhetag');
const restPlanSunday = M.restDaySet([{ plan: { days: [{ date: '2026-11-22', type: 'training' }] } }], [6], '2026-11-22', '2026-11-22');
pruefe(!restPlanSunday.has('2026-11-22'), 'Plan geht vor festem Ruhetag');
pruefe(M.weekdayIndex('2026-11-23') === 0 && M.weekdayIndex('2026-11-22') === 6, 'Wochentage (Mo = 0, So = 6)');

console.log('Serie mit Ruhetagen:');
const active = ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-21'];
const s1 = M.activityStreak(active, rest, '2026-11-23');
pruefe(s1.current === 4, 'Ruhetage (17., 19., 22.) unterbrechen nicht: 4 aktive Tage');
pruefe(s1.best === 4, 'Rekord 4');
pruefe(!s1.todayActive, 'Heute noch nicht aktiv, Serie trotzdem nicht gebrochen');
const s2 = M.activityStreak(active, new Set(), '2026-11-23');
pruefe(s2.current === 0 && s2.best === 2, 'Ohne Ruhetage: 22.11. fehlt → Serie 0, Rekord 2');
const s3 = M.activityStreak([...active, '2026-11-23'], rest, '2026-11-23');
pruefe(s3.current === 5 && s3.todayActive, 'Heute aktiv → 5');
const s4 = M.activityStreak(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-20'], rest, '2026-11-23');
pruefe(s4.best === 3, 'Rekord bleibt aus früherer Serie');
pruefe(M.activityStreak([], rest, '2026-11-23').current === 0, 'Keine Aktivität → 0');
const restRest = M.activityStreak(['2026-11-21'], new Set(['2026-11-22', '2026-11-23']), '2026-11-23');
pruefe(restRest.current === 1 && restRest.todayIsRest, 'Ruhetag heute: Serie bleibt, wird erkannt');

console.log('Aktive Tage (Fehler „7 von 7“ vom 23.11.):');
const act = M.activeDays({
    steps: { '2026-11-17': 300, '2026-11-18': 4200, '2026-11-19': 10500, '2026-11-20': 800 }, stepGoal: 10000,
    bw: { '2026-11-21': { date: '2026-11-21', exercises: [{ sets: [{ reps: 5 }] }] }, '2026-11-22': { date: '2026-11-22', exercises: [] } },
    cardio: { '2026-11-16': { entries: [{ duration: 20 }] } },
    runs: [{ date: '2026-11-15', distanceKm: 3 }],
    mini: ['2026-11-14'],
    plans: [{ progress: { '2026-11-13': { done: true, doneOn: '2026-11-13' }, '2026-11-12': { done: false } } }]
});
pruefe(!act.has('2026-11-17') && !act.has('2026-11-18') && !act.has('2026-11-20'), 'Nur ein paar Schritte → KEIN aktiver Tag');
pruefe(act.has('2026-11-19'), 'Schrittziel erreicht → aktiver Tag');
pruefe(act.has('2026-11-21') && !act.has('2026-11-22'), 'Bodyweight mit Satz zählt, leerer Tag nicht');
pruefe(act.has('2026-11-16') && act.has('2026-11-15') && act.has('2026-11-14') && act.has('2026-11-13'), 'Cardio, Lauf, Mini-Einheit, erledigte Plan-Einheit zählen');
pruefe(!act.has('2026-11-12'), 'Nicht erledigte Plan-Einheit zählt nicht');
pruefe(M.activeDays({ steps: { '2026-11-19': 15000 }, stepGoal: 0 }).size === 0, 'Ohne Schrittziel zählen Schritte nicht');

console.log('Erinnerungen (Regeln):');
const rem = M.buildReminders({
    today: '2026-11-23',
    settings: { weigh: { on: true, time: '06:30' }, evening: { on: true, time: 'Quatsch' }, streak: { on: true } },
    lastWeighDate: '2026-11-23',
    openTrainingDays: [{ date: '2026-11-24', title: 'Ganzkörper' }],
    nutritionDates: ['2026-11-22', '2026-11-23'],
    activeDates: ['2026-11-22'], restDates: ['2026-11-25'], streak: 4,
    plan: { endDate: '2026-11-29', checkinDone: false },
    lastBackup: '2026-11-20'
});
const R = id => rem.reminders.find(r => r.id === id);
pruefe(rem.version === 2 && rem.reminders.length === 6, '6 Erinnerungen im neuen Format');
pruefe(R('weigh').on && R('weigh').time === '06:30' && R('weigh').skipOn.includes('2026-11-23'), 'Wiegen: heute schon gewogen → heute nicht');
pruefe(R('evening').time === '20:30' && R('evening').skipOn.includes('2026-11-23'), 'Abends: ungültige Uhrzeit → 20:30; heute schon Ernährung → nicht');
pruefe(!R('training').on && R('training').onlyOn.join() === '2026-11-24' && R('training').textOn['2026-11-24'].startsWith('Ganzkörper'), 'Training: nur offene Plan-Tage, mit Titel');
pruefe(!R('streak').skipOn.includes('2026-11-23') && R('streak').skipOn.includes('2026-11-25') && R('streak').textOn['2026-11-23'].includes('4 Tage'), 'Serie: heute noch nicht aktiv → ja (mit „4 Tage“), Ruhetag → nein');
pruefe(R('checkin').onlyOn[0] === '2026-11-30' && !R('checkin').onlyOn.includes('2026-11-29'), 'Check-in: erst nach Planende');
pruefe(M.buildReminders({ today: '2026-11-23', plan: { endDate: '2026-11-20', checkinDone: true } }).reminders.find(r => r.id === 'checkin').onlyOn.length === 0, 'Check-in erledigt → keine Erinnerung');
pruefe(R('backup').weekday === 7 && R('backup').skipOn.includes('2026-11-26') && !R('backup').skipOn.includes('2026-11-29'), 'Backup: sonntags, nur wenn letztes Backup ≥ 7 Tage alt');
pruefe(rem.reminders.every(r => !r.on || /^\d{2}:\d{2}$/.test(r.time)), 'Alle Uhrzeiten gültig');

console.log('Ohne Süßes:');
const sw = M.simpleStreak(['2026-11-20', '2026-11-21', '2026-11-22'], '2026-11-23');
pruefe(sw.current === 3 && !sw.today, 'Gestern zählt noch (heute abends abhaken)');
const sw2 = M.simpleStreak(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'], '2026-11-23');
pruefe(sw2.current === 4 && sw2.today, 'Mit heute: 4');
const sw3 = M.simpleStreak(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-21'], '2026-11-23');
pruefe(sw3.current === 0 && sw3.best === 4, 'Lücke gestern → 0, Rekord 4');
pruefe(M.simpleStreak(['2026-11-30', '2026-11-22'], '2026-11-23').current === 1, 'Zukunft ignoriert');
pruefe(M.simpleStreak(['2026-12-31', '2027-01-01'], '2027-01-01').current === 2, 'Über den Jahreswechsel');

console.log('Bestwerte:');
pruefe(M.planExerciseMetric('Klimmzüge (Obergriff)') === 'pullups', 'Plan-Übung „Klimmzüge“ → Klimmzug-Rekord');
pruefe(M.planExerciseMetric('Negative Klimmzüge') === null && M.planExerciseMetric('Australische Klimmzüge') === null, 'Erleichterte Klimmzüge zählen nicht');
pruefe(M.planExerciseMetric('Liegestütze') === 'pushups' && M.planExerciseMetric('Liegestütze auf Knien') === null, 'Liegestütze ja, auf Knien nein');
pruefe(M.maxNumber('5, 4, 3') === 5 && M.maxNumber('3x6') === 6 && M.maxNumber('keine') === null, 'Wiederholungen aus Text lesen');
const src = {
    bw: {
        '2026-11-10': { date: '2026-11-10', exercises: [{ exerciseId: 'bw_pullup', sets: [{ reps: 3 }, { reps: 4 }] }, { exerciseId: 'bw_neg_pullup', sets: [{ reps: 10 }] }] },
        '2026-11-15': { date: '2026-11-15', exercises: [{ exerciseId: 'bw_pushup', sets: [{ reps: 12 }] }, { exerciseId: 'bw_pushup_incline', sets: [{ reps: 30 }] }] }
    },
    plans: [{ plan: { days: [{ date: '2026-11-18', exercises: [{ name: 'Klimmzüge' }, { name: 'Liegestütze' }] }] },
        progress: { '2026-11-18': { done: true, doneOn: '2026-11-18', reps: { 0: '6, 5, 4', 1: '10, 9' } } } }],
    runs: [
        { date: '2026-11-12', distanceKm: 5, durationMin: 30 },
        { date: '2026-11-19', distanceKm: 8, durationMin: 52 },
        { date: '2026-11-21', distanceKm: 3, durationMin: 16.5 },
        { date: '2026-11-22', distanceKm: 0.5, durationMin: 2 }
    ],
    steps: { '2026-11-20': 9000, '2026-11-22': 14000, '2026-11-23': 25000 }
};
const recs = M.records(src, '2026-11-23');
pruefe(recs.pullups.best.value === 6 && recs.pullups.best.date === '2026-11-18', 'Klimmzüge: 6 (aus dem Plan), negative zählen nicht');
pruefe(recs.pullups.history.map(h => h.value).join() === '4,6', 'Klimmzug-Verlauf: 4 → 6');
pruefe(recs.pushups.best.value === 12, 'Liegestütze: 12 (erleichterte 30 zählen nicht, Plan 10 kleiner)');
pruefe(recs.runKm.best.value === 8 && recs.runKm.history.length === 2, 'Längster Lauf 8 km, Verlauf 5 → 8');
pruefe(recs.runPace.best.value === 330 && recs.runPace.best.date === '2026-11-21', 'Schnellste Pace 5:30 min/km (0,5-km-Lauf zählt nicht)');
pruefe(recs.steps.best.value === 14000, 'Schritte: heute (noch offen) zählt nicht, Rekord 14.000');

console.log('Neuer Rekord:');
const seen0 = M.seenFrom(recs, null);
pruefe(seen0.pullups === 6 && seen0.runPace === 330, 'Erster Stand wird still gemerkt');
pruefe(M.newRecords(recs, null).length === 0, 'Ohne gemerkten Stand keine Feier');
src.bw['2026-11-23'] = { date: '2026-11-23', exercises: [{ exerciseId: 'bw_chinup', sets: [{ reps: 7 }] }] };
src.runs.push({ date: '2026-11-23', distanceKm: 5, durationMin: 29 });
const recs2 = M.records(src, '2026-11-23');
const nr = M.newRecords(recs2, seen0);
pruefe(nr.length === 1 && nr[0].def.key === 'pullups' && nr[0].value === 7 && nr[0].before === 6, 'Klimmzüge 7 statt 6 → „Neuer Rekord!“');
pruefe(!nr.some(r => r.def.key === 'runPace'), 'Langsamere Pace → kein Rekord');
const seen1 = M.seenFrom(recs2, seen0);
pruefe(M.newRecords(recs2, seen1).length === 0, 'Derselbe Rekord wird nicht zweimal gefeiert');
const recs3 = M.records({ runs: [{ date: '2026-11-23', distanceKm: 5, durationMin: 25 }] }, '2026-11-23');
pruefe(M.newRecords(recs3, seen1).some(r => r.def.key === 'runPace'), 'Schnellere Pace (5:00) → Rekord');

console.log('Mini-Einheit:');
pruefe(M.MINI_SESSION.length >= 5 && M.MINI_SESSION.every(x => x.name && x.time), 'Mini-Einheit hat Übungen mit Zeitangabe');

console.log(fehler ? `motivation_test: ${fehler} FEHLER` : 'motivation_test: alles OK');
process.exit(fehler ? 1 : 0);
