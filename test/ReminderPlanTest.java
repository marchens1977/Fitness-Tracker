package de.fitnesstracker.app;

import java.time.LocalDateTime;
import java.util.Arrays;

/**
 * Prüft die Erinnerungs-Regeln (ReminderPlan.java) ohne Handy.
 * Start: über  python3 test/update_pruefung.py  (übersetzt und startet diese Datei).
 */
public class ReminderPlanTest {
    static int fehler = 0;

    static void pruefe(boolean ok, String was) {
        System.out.println((ok ? "  OK     " : "  FEHLER ") + was);
        if (!ok) fehler++;
    }

    public static void main(String[] args) {
        int[] t = ReminderPlan.parseTime("07:30", 7, 0);
        pruefe(t[0] == 7 && t[1] == 30, "\"07:30\" -> 7:30");
        t = ReminderPlan.parseTime("7:05", 7, 0);
        pruefe(t[0] == 7 && t[1] == 5, "\"7:05\" -> 7:05");
        t = ReminderPlan.parseTime("25:00", 17, 0);
        pruefe(t[0] == 17 && t[1] == 0, "\"25:00\" ungültig -> Ersatz 17:00");
        t = ReminderPlan.parseTime(null, 7, 0);
        pruefe(t[0] == 7, "leer -> Ersatz");

        LocalDateTime morning = LocalDateTime.of(2026, 11, 23, 6, 0);
        pruefe(ReminderPlan.nextTrigger(morning, 7, 0).equals(LocalDateTime.of(2026, 11, 23, 7, 0)),
                "6:00 Uhr, Erinnerung 7:00 -> heute 7:00");
        LocalDateTime later = LocalDateTime.of(2026, 11, 23, 7, 0);
        pruefe(ReminderPlan.nextTrigger(later, 7, 0).equals(LocalDateTime.of(2026, 11, 24, 7, 0)),
                "genau 7:00 -> morgen 7:00 (keine doppelte Erinnerung)");
        LocalDateTime silvester = LocalDateTime.of(2026, 12, 31, 20, 0);
        pruefe(ReminderPlan.nextTrigger(silvester, 7, 0).equals(LocalDateTime.of(2027, 1, 1, 7, 0)),
                "über den Jahreswechsel");

        pruefe(!ReminderPlan.shouldRemindWeigh("2026-11-23", "2026-11-23"), "heute schon gewogen -> keine Wiege-Erinnerung");
        pruefe(ReminderPlan.shouldRemindWeigh("2026-11-23", "2026-11-22"), "gestern gewogen -> erinnern");
        pruefe(ReminderPlan.shouldRemindWeigh("2026-11-23", null), "nie gewogen -> erinnern");

        pruefe("Ganzkörper".equals(ReminderPlan.trainingTitleFor("2026-11-24",
                Arrays.asList("2026-11-24", "2026-11-26"), Arrays.asList("Ganzkörper", "Laufen"))),
                "offener Trainingstag -> Erinnerung mit Titel");
        pruefe(ReminderPlan.trainingTitleFor("2026-11-25",
                Arrays.asList("2026-11-24", "2026-11-26"), Arrays.asList("Ganzkörper", "Laufen")) == null,
                "Ruhetag/erledigt (nicht in der Liste) -> keine Erinnerung");
        pruefe("Training".equals(ReminderPlan.trainingTitleFor("2026-11-24",
                Arrays.asList("2026-11-24"), Arrays.asList(""))), "ohne Titel -> „Training“");

        System.out.println(fehler == 0 ? "ReminderPlanTest: alles OK" : "ReminderPlanTest: " + fehler + " FEHLER");
        if (fehler > 0) System.exit(1);
    }
}
