package de.fitnesstracker.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Sucht bei GitHub nach einer neueren Version der App und bietet sie zum Herunterladen an.
 *
 * Ablauf: GitHub-„Release“ abfragen → Versionsnummer aus dem Namen (app-v1.0.N) mit der eigenen
 * vergleichen → Fenster „Update verfügbar“ → neue APK im Browser herunterladen.
 *
 * Bewusst OHNE die Erlaubnis „andere Apps installieren“ (REQUEST_INSTALL_PACKAGES):
 * Damit stuft Google Play Protect eine selbst gebaute App als „schädlich“ ein und blockiert sie.
 * Übernommen aus dem Fisch-Fang-Tracker; hier nur REPO und APK_NAME angepasst.
 * Die Regeln für Versionsnummern stehen in UpdateVersion.java (getestet).
 */
public class UpdateChecker {
    static final String REPO = "marchens1977/Fitness-Tracker";
    static final String APK_NAME = "FitnessTracker.apk";
    private static final String API_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
    private static final long AUTO_CHECK_INTERVAL_MS = 60L * 60L * 1000L; // höchstens 1x pro Stunde von selbst

    private final Activity activity;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean busy = false;

    UpdateChecker(Activity activity) {
        this.activity = activity;
    }

    /** Eigene Versionsnummer (fortlaufende Bau-Nummer von GitHub). */
    long currentVersion() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.getLongVersionCode();
        } catch (Exception e) {
            return 0;
        }
    }

    String currentVersionName() {
        try {
            return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    /** Beim Start: von selbst nachsehen (nicht öfter als einmal pro Stunde). */
    void autoCheck() {
        SharedPreferences prefs = activity.getSharedPreferences("update", Context.MODE_PRIVATE);
        long last = prefs.getLong("lastCheck", 0);
        if (System.currentTimeMillis() - last < AUTO_CHECK_INTERVAL_MS) return;
        check(false);
    }

    /** manual = true: auch „Du hast die neueste Version“ bzw. Fehler anzeigen. */
    void check(boolean manual) {
        if (busy) return;
        busy = true;
        if (manual) toast("Suche nach Update …");
        new Thread(() -> {
            try {
                JSONObject release = new JSONObject(readText(API_URL));
                long latest = UpdateVersion.fromTag(release.optString("tag_name", ""));
                String url = findApkUrl(release);
                activity.getSharedPreferences("update", Context.MODE_PRIVATE)
                        .edit().putLong("lastCheck", System.currentTimeMillis()).apply();
                ui.post(() -> {
                    busy = false;
                    if (UpdateVersion.isNewer(latest, currentVersion()) && url != null) {
                        showUpdateDialog(UpdateVersion.displayName(latest), url);
                    } else if (manual) {
                        toast("Du hast schon die neueste Version (" + currentVersionName() + ").");
                    }
                });
            } catch (Exception e) {
                ui.post(() -> {
                    busy = false;
                    if (manual) toast("Update-Suche nicht möglich. Bitte Internet prüfen.");
                });
            }
        }).start();
    }

    private static String findApkUrl(JSONObject release) {
        JSONArray assets = release.optJSONArray("assets");
        if (assets == null) return null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject a = assets.optJSONObject(i);
            if (a != null && APK_NAME.equals(a.optString("name"))) return a.optString("browser_download_url", null);
        }
        return null;
    }

    private void showUpdateDialog(String newVersion, String url) {
        if (activity.isFinishing()) return;
        new AlertDialog.Builder(activity)
                .setTitle("Update verfügbar")
                .setMessage("Eine neue Version der App ist da (" + newVersion + ", du hast "
                        + currentVersionName() + ").\n\nDeine Trainings- und Schrittdaten bleiben beim Update erhalten.")
                .setPositiveButton("Jetzt herunterladen", (d, w) -> openDownload(url))
                .setNegativeButton("Später", null)
                .show();
    }

    /** Lädt die neue Version im Browser herunter; danach tippt man auf die Datei → „Aktualisieren“. */
    private void openDownload(String url) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            new AlertDialog.Builder(activity)
                    .setTitle("So geht es weiter")
                    .setMessage("1. Warten, bis der Download fertig ist.\n"
                            + "2. Auf die heruntergeladene Datei tippen (oben in der Benachrichtigung).\n"
                            + "3. „Aktualisieren“ wählen.\n\nDeine Daten bleiben erhalten.")
                    .setPositiveButton("Verstanden", null)
                    .show();
        } catch (Exception e) {
            toast("Download konnte nicht gestartet werden.");
        }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Accept", "application/vnd.github+json, application/octet-stream");
        conn.setRequestProperty("User-Agent", "FitnessTrackerApp");
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code);
        return conn;
    }

    private static String readText(String url) throws Exception {
        HttpURLConnection conn = open(url);
        try (InputStream in = conn.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }
    }

    private void toast(String text) {
        Toast.makeText(activity, text, Toast.LENGTH_LONG).show();
    }
}
