package de.fitnesstracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

/**
 * Merkt sich die Schritte pro Tag.
 *
 * Der Schrittzähler-Chip liefert nur eine fortlaufende Summe seit dem letzten
 * Neustart des Handys. Bei jedem Ablesen wird die Differenz zum letzten
 * Ablesen dem heutigen Tag gutgeschrieben.
 */
final class StepStore {
    private static final String PREFS = "native_steps";
    private static final String KEY_LAST_COUNTER = "lastCounter";
    private static final String KEY_LAST_BOOT = "lastBoot";
    private static final String KEY_HISTORY = "history";
    private static final String KEY_LAST_UPDATE = "lastUpdate";
    private static final String KEY_REPORTED_DATE = "reportedDate";
    private static final String KEY_REPORTED_STEPS = "reportedSteps";
    private static final String KEY_GOAL = "goal";
    private static final int KEEP_DAYS = 90;
    private static final long MAX_PLAUSIBLE_DELTA = 150000;

    private StepStore() {}

    /** Neuen Zählerstand verarbeiten. Gibt true zurück, wenn neue Schritte dazukamen. */
    static synchronized boolean update(Context context, long counter) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long last = prefs.getLong(KEY_LAST_COUNTER, -1);
        int boot = bootCount(context);
        int lastBoot = prefs.getInt(KEY_LAST_BOOT, -1);

        long delta;
        if (last < 0) {
            delta = 0; // allererstes Ablesen: Startpunkt merken
        } else if ((boot != -1 && lastBoot != -1 && boot != lastBoot) || counter < last) {
            delta = counter; // Handy wurde neu gestartet: Chip hat bei 0 neu angefangen
        } else {
            delta = counter - last;
        }
        if (delta < 0 || delta > MAX_PLAUSIBLE_DELTA) delta = 0;

        JSONObject history = loadHistory(prefs);
        String today = LocalDate.now().toString();
        try {
            if (delta > 0) {
                history.put(today, history.optLong(today, 0) + delta);
            }
            prune(history);
        } catch (JSONException ignored) {
        }

        prefs.edit()
                .putLong(KEY_LAST_COUNTER, counter)
                .putInt(KEY_LAST_BOOT, boot)
                .putString(KEY_HISTORY, history.toString())
                .putLong(KEY_LAST_UPDATE, System.currentTimeMillis())
                .apply();
        StepWidget.updateAll(context);
        return delta > 0;
    }

    /** Die Webseite meldet ihren angezeigten Stand (inkl. manueller Einträge) und das Ziel. */
    static synchronized void saveReported(Context context, String date, long steps, int goal) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor edit = prefs.edit()
                .putString(KEY_REPORTED_DATE, date)
                .putLong(KEY_REPORTED_STEPS, Math.max(0, steps));
        if (goal > 0) edit.putInt(KEY_GOAL, goal);
        edit.apply();
    }

    /** Schritte heute fürs Widget: größerer Wert aus Chip und Webseite. */
    static synchronized long todaySteps(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String today = LocalDate.now().toString();
        long fromChip = loadHistory(prefs).optLong(today, 0);
        long fromPage = today.equals(prefs.getString(KEY_REPORTED_DATE, ""))
                ? prefs.getLong(KEY_REPORTED_STEPS, 0) : 0;
        return Math.max(fromChip, fromPage);
    }

    static int goal(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_GOAL, 10000);
    }

    /** Alle Tage als JSON-Liste: [{"date":"2026-11-17","steps":1234}, ...] */
    static synchronized String historyJson(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject history = loadHistory(prefs);
        List<String> days = new ArrayList<>();
        Iterator<String> keys = history.keys();
        while (keys.hasNext()) days.add(keys.next());
        Collections.sort(days);
        JSONArray out = new JSONArray();
        for (String day : days) {
            try {
                JSONObject item = new JSONObject();
                item.put("date", day);
                item.put("steps", history.optLong(day, 0));
                out.put(item);
            } catch (JSONException ignored) {
            }
        }
        return out.toString();
    }

    private static JSONObject loadHistory(SharedPreferences prefs) {
        try {
            return new JSONObject(prefs.getString(KEY_HISTORY, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void prune(JSONObject history) {
        String oldest = LocalDate.now().minusDays(KEEP_DAYS).toString();
        List<String> remove = new ArrayList<>();
        Iterator<String> keys = history.keys();
        while (keys.hasNext()) {
            String day = keys.next();
            if (day.compareTo(oldest) < 0) remove.add(day);
        }
        for (String day : remove) history.remove(day);
    }

    private static int bootCount(Context context) {
        try {
            return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Exception e) {
            return -1;
        }
    }
}
