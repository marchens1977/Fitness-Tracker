package de.fitnesstracker.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

/** Liest den Schrittzähler-Chip einmal kurz aus (für den Hintergrund). */
final class StepReader {
    private static final long TIMEOUT_MS = 10_000;

    private StepReader() {}

    static boolean hasPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)
                == PackageManager.PERMISSION_GRANTED;
    }

    static Sensor stepSensor(Context context) {
        SensorManager sm = context.getSystemService(SensorManager.class);
        return sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    /** Liest einmal ab und ruft danach done auf (immer, auch bei Fehler/Zeitüberschreitung). */
    static void readOnce(Context context, Runnable done) {
        Context app = context.getApplicationContext();
        SensorManager sm = app.getSystemService(SensorManager.class);
        Sensor sensor = stepSensor(app);
        if (sm == null || sensor == null || !hasPermission(app)) {
            done.run();
            return;
        }
        Handler handler = new Handler(Looper.getMainLooper());
        OneShotListener listener = new OneShotListener(app, sm, handler, done);
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, 0, handler);
        handler.postDelayed(listener::finish, TIMEOUT_MS);
    }

    private static final class OneShotListener implements SensorEventListener {
        private final Context app;
        private final SensorManager sm;
        private final Handler handler;
        private final Runnable done;
        private boolean finished = false;

        OneShotListener(Context app, SensorManager sm, Handler handler, Runnable done) {
            this.app = app;
            this.sm = sm;
            this.handler = handler;
            this.done = done;
        }

        @Override
        public void onSensorChanged(SensorEvent event) {
            if (finished) return;
            StepStore.update(app, (long) event.values[0]);
            finish();
        }

        @Override
        public void onAccuracyChanged(Sensor s, int accuracy) {}

        void finish() {
            if (finished) return;
            finished = true;
            sm.unregisterListener(this);
            handler.removeCallbacksAndMessages(null);
            done.run();
        }
    }
}
