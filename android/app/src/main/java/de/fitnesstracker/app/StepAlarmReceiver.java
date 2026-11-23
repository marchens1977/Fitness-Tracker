package de.fitnesstracker.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

/**
 * Weckt die App kurz vor Mitternacht, damit die Schritte dem richtigen Tag
 * zugeordnet werden. Startet außerdem nach einem Neustart des Handys.
 */
public class StepAlarmReceiver extends BroadcastReceiver {
    private static final String ACTION_READ = "de.fitnesstracker.app.READ_STEPS";

    static void scheduleNext(Context context) {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        if (am == null) return;
        LocalDateTime target = LocalDate.now().atTime(LocalTime.of(23, 52));
        if (!LocalDateTime.now().isBefore(target)) target = target.plusDays(1);
        long at = target.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        Intent intent = new Intent(context, StepAlarmReceiver.class).setAction(ACTION_READ);
        PendingIntent pi = PendingIntent.getBroadcast(context, 1, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        // Ungefährer Wecker, darf auch im Energiesparmodus kurz laufen
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!ACTION_READ.equals(action) && !Intent.ACTION_BOOT_COMPLETED.equals(action)) return;
        StepJobService.schedule(context);
        scheduleNext(context);
        ReminderReceiver.scheduleAll(context); // Erinnerungen nach Neustart wieder einplanen
        PendingResult result = goAsync();
        StepReader.readOnce(context, result::finish);
    }
}
