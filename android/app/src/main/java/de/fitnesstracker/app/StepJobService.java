package de.fitnesstracker.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/** Hintergrund-Aufgabe: liest etwa alle 15 Minuten den Schrittzähler ab. */
public class StepJobService extends JobService {
    private static final int JOB_ID = 4711;
    private static final long INTERVAL_MS = 15 * 60 * 1000L;

    static void schedule(Context context) {
        JobScheduler js = context.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(context, StepJobService.class))
                .setPeriodic(INTERVAL_MS)
                .setPersisted(true)
                .build();
        js.schedule(info);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        StepAlarmReceiver.scheduleNext(this);
        StepReader.readOnce(this, () -> jobFinished(params, false));
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
