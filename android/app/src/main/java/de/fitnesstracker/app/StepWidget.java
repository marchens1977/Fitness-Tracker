package de.fitnesstracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.Locale;

/** Widget für den Startbildschirm: zeigt die heutigen Schritte und das Tagesziel. */
public class StepWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        manager.updateAppWidget(widgetIds, build(context));
        StepJobService.schedule(context);
    }

    /** Alle Widgets auf den neuesten Stand bringen (nach jedem Ablesen aufgerufen). */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, StepWidget.class));
        if (ids == null || ids.length == 0) return;
        manager.updateAppWidget(ids, build(context));
    }

    private static RemoteViews build(Context context) {
        long steps = StepStore.todaySteps(context);
        int goal = StepStore.goal(context);
        int pct = goal > 0 ? (int) Math.min(100, steps * 100 / goal) : 0;
        NumberFormat fmt = NumberFormat.getIntegerInstance(Locale.GERMANY);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_steps);
        views.setTextViewText(R.id.widget_steps, fmt.format(steps));
        views.setTextViewText(R.id.widget_goal, steps >= goal
                ? "Ziel erreicht! 🎉"
                : "von " + fmt.format(goal));
        views.setProgressBar(R.id.widget_progress, 100, pct, false);

        Intent open = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pi);
        return views;
    }
}
