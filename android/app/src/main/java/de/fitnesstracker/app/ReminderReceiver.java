package de.fitnesstracker.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Erinnerungen: morgens ans Wiegen, an Trainingstagen aus dem Plan ans Training.
 * Die Webseite schickt die Einstellungen per AndroidApp.setReminders(json):
 * {"weigh":{"on":true,"time":"07:00"},"training":{"on":true,"time":"17:00"},
 *  "trainingDays":[{"date":"2026-11-24","title":"Ganzkörper"}],"weighedOn":"2026-11-23"}
 * Uhrzeit ist ungefähr (Android darf im Energiesparmodus ein paar Minuten verschieben).
 */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_WEIGH = "de.fitnesstracker.app.REMIND_WEIGH";
    static final String ACTION_TRAIN = "de.fitnesstracker.app.REMIND_TRAIN";
    static final String EXTRA_TAB = "openTab";
    private static final String PREFS = "reminders";
    private static final String KEY_CONFIG = "config";
    private static final String CHANNEL = "erinnerungen";
    private static final int CODE_WEIGH = 31;
    private static final int CODE_TRAIN = 32;

    static void saveConfig(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_CONFIG, json).apply();
        scheduleAll(context);
    }

    static JSONObject config(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            return new JSONObject(prefs.getString(KEY_CONFIG, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static boolean anyOn(Context context) {
        JSONObject cfg = config(context);
        JSONObject w = cfg.optJSONObject("weigh");
        JSONObject t = cfg.optJSONObject("training");
        return (w != null && w.optBoolean("on")) || (t != null && t.optBoolean("on"));
    }

    static void scheduleAll(Context context) {
        JSONObject cfg = config(context);
        schedule(context, ACTION_WEIGH, CODE_WEIGH, cfg.optJSONObject("weigh"), 7, 0);
        schedule(context, ACTION_TRAIN, CODE_TRAIN, cfg.optJSONObject("training"), 17, 0);
    }

    private static void schedule(Context context, String action, int code, JSONObject o, int defH, int defM) {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        if (am == null) return;
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(action);
        PendingIntent pi = PendingIntent.getBroadcast(context, code, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (o == null || !o.optBoolean("on")) {
            am.cancel(pi);
            return;
        }
        int[] hm = ReminderPlan.parseTime(o.optString("time"), defH, defM);
        LocalDateTime next = ReminderPlan.nextTrigger(LocalDateTime.now(), hm[0], hm[1]);
        long at = next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        // Ungefährer Wecker (keine Sonder-Erlaubnis nötig), darf auch im Energiesparmodus laufen
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        JSONObject cfg = config(context);
        String today = LocalDate.now().toString();
        if (ACTION_WEIGH.equals(action)) {
            JSONObject w = cfg.optJSONObject("weigh");
            if (w != null && w.optBoolean("on") && ReminderPlan.shouldRemindWeigh(today, cfg.optString("weighedOn", null))) {
                notify(context, CODE_WEIGH, "⚖️ Zeit zum Wiegen",
                        "Morgens nüchtern wiegen und den Wert in der App eintragen.", "overview");
            }
        } else if (ACTION_TRAIN.equals(action)) {
            JSONObject t = cfg.optJSONObject("training");
            if (t != null && t.optBoolean("on")) {
                List<String> dates = new ArrayList<>();
                List<String> titles = new ArrayList<>();
                JSONArray arr = cfg.optJSONArray("trainingDays");
                if (arr != null) {
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject d = arr.optJSONObject(i);
                        if (d == null) continue;
                        dates.add(d.optString("date"));
                        titles.add(d.optString("title"));
                    }
                }
                String title = ReminderPlan.trainingTitleFor(today, dates, titles);
                if (title != null) {
                    notify(context, CODE_TRAIN, "🏋️ Heute ist Trainingstag",
                            title + " – du schaffst das! Danach in der App abhaken.", "plan");
                }
            }
        }
        scheduleAll(context); // nächsten Tag planen
    }

    static boolean canNotify(Context context) {
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        return nm != null && nm.areNotificationsEnabled();
    }

    private static void notify(Context context, int code, String title, String text, String tab) {
        if (!canNotify(context)) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Erinnerungen", NotificationManager.IMPORTANCE_DEFAULT));
        Intent open = new Intent(context, MainActivity.class)
                .putExtra(EXTRA_TAB, tab)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, code, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify(code, n);
    }
}
