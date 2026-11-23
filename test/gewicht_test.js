// Prüft die Gewichts-Berechnungen (Block WEIGHT-CALC in index.html) ohne Browser:
//  - ein Wert pro Tag (letzter gewinnt), Lücken, 7-Tage-Ø, Wochen-Ø (Mo–So), Veränderung zur Vorwoche
//  - Hinweise: Tagesschwankung, ideales Tempo, zu schnelle Abnahme
//  - "Kilo verloren" und Etappenziele nach dem Ø
//  - Zusammenfassung für den KI-Check-in
// Aufruf: node test/gewicht_test.js   (Exit-Code 1 bei Fehler)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* WEIGHT-CALC-START[\s\S]*?\/\* WEIGHT-CALC-END \*\//);
if (!m) { console.log('FEHLER: Block WEIGHT-CALC nicht gefunden'); process.exit(1); }
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + '\nthis.WeightCalc = WeightCalc;', ctx);
const W = ctx.WeightCalc;

let fehler = 0;
function pruefe(ok, was) {
    console.log((ok ? '  OK     ' : '  FEHLER ') + was);
    if (!ok) fehler++;
}
const nah = (a, b) => a !== null && Math.abs(a - b) < 1e-9;
const e = (date, weightKg) => ({ date, weightKg });

console.log('Tageswerte:');
const d = W.daily([e('2026-11-02', 90), e('2026-11-01', 91), e('2026-11-02', 89.5), e('kaputt', 80), e('2026-11-03', 'x')]);
pruefe(d.length === 2 && d[0].date === '2026-11-01', 'Sortiert, ungültige Einträge ignoriert');
pruefe(d[1].weightKg === 89.5, 'Zwei Werte am selben Tag → der letzte zählt');

console.log('7-Tage-Durchschnitt (mit Lücken):');
const days = W.daily([e('2026-11-09', 92), e('2026-11-10', 91.6), e('2026-11-12', 91), e('2026-11-16', 90)]);
const r = W.rollingAvg(days, '2026-11-16');
pruefe(r && r.count === 3 && nah(r.avg, (91.6 + 91 + 90) / 3), '16.11.: Fenster 10.–16.11., 9.11. zu alt, Lücken übersprungen → Ø aus 3 Werten');
pruefe(W.rollingAvg(days, '2026-11-08') === null, 'Keine Werte im Fenster → kein Ø');
pruefe(W.rollingAvg(W.daily([e('2026-11-09', 92)]), '2026-11-11').count === 1, 'Einzelner Wert reicht für einen Ø');

console.log('Kalenderwochen (Mo–So):');
pruefe(W.weekStart('2026-11-23') === '2026-11-23', '23.11.2026 ist ein Montag');
pruefe(W.weekStart('2026-11-29') === '2026-11-23', 'Sonntag 29.11. gehört zur Woche ab 23.11.');
pruefe(W.weekStart('2026-11-30') === '2026-11-30', 'Montag 30.11. beginnt neue Woche');
pruefe(W.isoWeek('2026-11-23').week === 48, '23.11.2026 = KW 48');
pruefe(W.isoWeek('2027-01-01').week === 53 && W.isoWeek('2027-01-01').year === 2026, '1.1.2027 gehört noch zu KW 53/2026');
const weeks = W.weeklyAverages(W.daily([
    e('2026-11-09', 94), e('2026-11-15', 93),          // KW 46: Ø 93,5
    e('2026-11-16', 93), e('2026-11-18', 92),          // KW 47: Ø 92,5
    e('2026-11-30', 91)                                // KW 49 (KW 48 fehlt)
]));
pruefe(weeks.length === 3, 'Drei Wochen mit Werten (eine Woche fehlt)');
pruefe(nah(weeks[0].avg, 93.5) && nah(weeks[1].avg, 92.5), 'Wochen-Ø richtig (93,5 / 92,5)');
pruefe(nah(weeks[1].change, -1), 'Veränderung KW 47 zur Vorwoche: −1,0 kg');
pruefe(weeks[2].change === null, 'Nach fehlender Woche keine Veränderung (kein falscher Vergleich)');

console.log('Zusammenfassung & Veränderung zur Vorwoche:');
const log = [];
// 3 Wochen, jeder dritte Tag fehlt; Trend −0,5 kg pro Woche, Tageswerte schwanken ±0,3 kg
const start = '2026-11-02';
for (let i = 0; i <= 21; i++) {
    if (i % 3 === 1) continue;
    const base = 95 - (i / 7) * 0.5;
    log.push(e(W.shift(start, i), Math.round((base + (i % 2 === 0 ? 0.3 : -0.3)) * 10) / 10));
}
const s = W.summary(log, '2026-11-23', 85);
pruefe(s.hasData && s.isCurrent, 'Daten aktuell (heute = Ankertag)');
pruefe(s.avg7Count >= 4 && s.avg7Count <= 5, '7-Tage-Fenster enthält nur vorhandene Werte (' + s.avg7Count + ')');
pruefe(s.changeVsPrevWeek < -0.3 && s.changeVsPrevWeek > -0.7, 'Veränderung zur Vorwoche ca. −0,5 kg (' + W.round1(s.changeVsPrevWeek) + ')');
pruefe(s.hints.some(h => h.type === 'ideal'), 'Hinweis „ideales Tempo“ bei ca. 0,5 kg/Woche');
pruefe(!s.hints.some(h => h.type === 'fast'), 'Kein „zu schnell“-Hinweis');
pruefe(s.lostKg > 0.5, '„Kilo verloren“ nach Ø positiv (' + W.round1(s.lostKg) + ')');

console.log('Tagesschwankung:');
const fl = W.summary([e('2026-11-09', 94), e('2026-11-12', 93.8), e('2026-11-16', 93), e('2026-11-21', 92.2), e('2026-11-22', 92.0), e('2026-11-23', 93.1)], '2026-11-23', 85);
pruefe(fl.todayValue === 93.1, 'Tageswert heute erkannt');
pruefe(fl.hints.some(h => h.type === 'fluctuation'), 'Tageswert steigt, Trend fällt → Hinweis „Normale Tagesschwankung“');
const up = W.summary([e('2026-11-10', 90), e('2026-11-17', 91), e('2026-11-23', 92)], '2026-11-23', 85);
pruefe(!up.hints.some(h => h.type === 'fluctuation'), 'Trend steigt → kein Schwankungs-Hinweis');

console.log('Zu schnelle Abnahme:');
const fast = W.summary([e('2026-11-02', 100), e('2026-11-09', 98.5), e('2026-11-16', 97), e('2026-11-23', 95.5)], '2026-11-23', 85);
pruefe(fast.hints.some(h => h.type === 'fast'), 'Zwei Wochen hintereinander > 1 kg/Woche → sachlicher Hinweis');
const once = W.summary([e('2026-11-09', 98.5), e('2026-11-16', 98.3), e('2026-11-23', 96.5)], '2026-11-23', 85);
pruefe(!once.hints.some(h => h.type === 'fast'), 'Nur eine schnelle Woche → noch kein Hinweis');

console.log('Alte Daten / keine Daten:');
const old = W.summary([e('2026-10-01', 90), e('2026-10-03', 89)], '2026-11-23', 85);
pruefe(!old.isCurrent && old.anchor === '2026-10-03' && nah(old.avg7, 89.5), 'Letzter Wert älter als 7 Tage → Ø vom letzten Stand');
pruefe(W.summary([], '2026-11-23', 85).hasData === false, 'Ohne Werte: hasData = false');
pruefe(W.summary([e('2026-11-30', 90)], '2026-11-23', 85).hasData === false, 'Werte in der Zukunft werden ignoriert');

console.log('Etappenziele:');
const ms = W.milestones(95, 85, 92.4);
pruefe(ms.length === 4 && ms.map(x => x.targetKg).join('|') === '92.5|90|87.5|85', '95 → 85 kg: Etappen 92,5 / 90 / 87,5 / 85');
pruefe(ms[0].reached && !ms[1].reached, 'Ø 92,4 kg: erste Etappe erreicht, zweite noch nicht');
const ms2 = W.milestones(93, 86, null);
pruefe(ms2.length === 3 && ms2.every(x => x.targetKg <= 93) && ms2[2].targetKg === 86, '93 → 86 kg: 3 Etappen à ca. 2,3 kg, letzte = Ziel');
pruefe(W.milestones(85, 90, 85).length === 0, 'Ziel über Startgewicht → keine Etappen');
pruefe(W.milestones(85.5, 85, 85).length === 0, 'Weniger als 1 kg bis zum Ziel → keine Etappen');

console.log('KI-Check-in-Zusammenfassung:');
const ci = W.checkinSummary(log, '2026-11-23', 85);
pruefe(ci.hasData && typeof ci.avg7Kg === 'number' && ci.trend === 'fällt', 'Enthält 7-Tage-Ø und Trend „fällt“');
pruefe(Array.isArray(ci.lastWeeks) && ci.lastWeeks.length >= 3 && ci.lastWeeks[0].kw, 'Enthält Wochen-Ø der letzten Wochen');
pruefe(!('todayValue' in ci), 'Kein einzelner Tageswert als Grundlage');

console.log(fehler ? `gewicht_test: ${fehler} FEHLER` : 'gewicht_test: alles OK');
process.exit(fehler ? 1 : 0);
