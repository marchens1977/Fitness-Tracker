package de.fitnesstracker.app;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Reine Rechen-Regeln für die Erinnerungen (ohne Android, daher mit test/ReminderPlanTest.java prüfbar):
 * Uhrzeit lesen, nächsten Termin berechnen, entscheiden ob heute erinnert wird.
 */
final class ReminderPlan {
    private ReminderPlan() {}

    /** "07:30" -> {7, 30}; ungültig -> Ersatzwert. */
    static int[] parseTime(String text, int defHour, int defMinute) {
        if (text != null) {
            String t = text.trim();
            if (t.matches("\\d{1,2}:\\d{2}")) {
                String[] p = t.split(":");
                int h = Integer.parseInt(p[0]);
                int m = Integer.parseInt(p[1]);
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return new int[]{h, m};
            }
        }
        return new int[]{defHour, defMinute};
    }

    /** Nächster Termin zur Uhrzeit: heute, wenn noch nicht vorbei, sonst morgen. */
    static LocalDateTime nextTrigger(LocalDateTime now, int hour, int minute) {
        LocalDateTime target = now.toLocalDate().atTime(LocalTime.of(hour, minute));
        if (!now.isBefore(target)) target = target.plusDays(1);
        return target;
    }

    /** Wie lange nach der eingestellten Uhrzeit eine verpasste Erinnerung noch nachgeholt wird. */
    static final int CATCH_UP_MINUTES = 30;

    /**
     * Nächster Termin mit Nachholen: Ist die Uhrzeit heute erst vor kurzem (bis 30 Min.) vorbei und
     * wurde die Erinnerung heute für diese Uhrzeit noch nicht ausgelöst (z. B. weil Android den Wecker
     * verschoben hat), kommt sie in einer Minute – statt erst morgen.
     */
    static LocalDateTime nextTrigger(LocalDateTime now, int hour, int minute, boolean handledToday) {
        LocalDateTime today = now.toLocalDate().atTime(LocalTime.of(hour, minute));
        if (now.isBefore(today)) return today;
        if (!handledToday && now.isBefore(today.plusMinutes(CATCH_UP_MINUTES))) return now.plusMinutes(1);
        return today.plusDays(1);
    }

    /** Merk-Wert „heute für diese Uhrzeit erledigt“, z. B. "2026-11-24@11:39". */
    static String handledKey(String todayIso, int hour, int minute) {
        return todayIso + "@" + String.format("%02d:%02d", hour, minute);
    }

    /** Wiege-Erinnerung nur, wenn heute noch kein Gewicht eingetragen wurde. */
    static boolean shouldRemindWeigh(String todayIso, String weighedOnIso) {
        return weighedOnIso == null || !weighedOnIso.equals(todayIso);
    }

    /**
     * Erinnerungen v2: Soll heute erinnert werden?
     * onlyOn = null: jeden Tag erlaubt; leere Liste: nie. skipOn: an diesen Tagen nicht.
     * weekday 1–7 (1 = Montag): nur an diesem Wochentag; 0 = jeden Tag.
     */
    static boolean shouldFire(String todayIso, int todayWeekday, int weekday, List<String> onlyOn, List<String> skipOn) {
        if (weekday >= 1 && weekday <= 7 && weekday != todayWeekday) return false;
        if (onlyOn != null && !onlyOn.contains(todayIso)) return false;
        return skipOn == null || !skipOn.contains(todayIso);
    }

    /** Feste Nummer je Erinnerung (für Wecker und Benachrichtigung). */
    static int codeFor(String id) {
        switch (id == null ? "" : id) {
            case "weigh": return 41;
            case "training": return 42;
            case "streak": return 43;
            case "evening": return 44;
            case "checkin": return 45;
            case "backup": return 46;
            default: return 0; // unbekannt: nicht einplanen
        }
    }

    /** Trainings-Erinnerung nur an offenen Trainingstagen aus dem Plan. dates/titles gleich lang. */
    static String trainingTitleFor(String todayIso, List<String> dates, List<String> titles) {
        if (dates == null) return null;
        for (int i = 0; i < dates.size(); i++) {
            if (todayIso.equals(dates.get(i))) {
                String t = titles != null && i < titles.size() ? titles.get(i) : null;
                return t == null || t.trim().isEmpty() ? "Training" : t.trim();
            }
        }
        return null;
    }
}
