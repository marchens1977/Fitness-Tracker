package de.fitnesstracker.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Zeigt die Fitness-Tracker-Webseite an und liefert ihr die Schritte
 * vom eingebauten Schrittzähler-Chip des Handys.
 */
public class MainActivity extends Activity implements SensorEventListener {
    static final String APP_URL = "https://marchens1977.github.io/Fitness-Tracker/";
    private static final String APP_HOST = "marchens1977.github.io";

    private static final int REQ_PERMISSION = 1;
    private static final int REQ_OPEN_FILE = 2;
    private static final int REQ_SAVE_FILE = 3;
    private static final long PUSH_DELAY_MS = 1500;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingSaveContent;

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private boolean listening = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean pageReady = false;
    private boolean pushScheduled = false;
    private boolean triedOfflineCopy = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#0e1324"));
        getWindow().setNavigationBarColor(Color.parseColor("#0e1324"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0e1324"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // localStorage = Speicher der App-Daten
        settings.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);

        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppChromeClient());

        sensorManager = getSystemService(SensorManager.class);
        stepSensor = StepReader.stepSensor(this);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL);
        }

        StepJobService.schedule(this);
        StepAlarmReceiver.scheduleNext(this);
        if (stepSensor != null && !StepReader.hasPermission(this)) {
            requestStepPermission();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        startListening();
        schedulePush();
    }

    @Override
    protected void onPause() {
        stopListening();
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ---------------------------------------------------------------- Schritte

    private void startListening() {
        if (listening || stepSensor == null || sensorManager == null || !StepReader.hasPermission(this)) return;
        listening = sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
    }

    private void stopListening() {
        if (!listening) return;
        sensorManager.unregisterListener(this);
        listening = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (StepStore.update(this, (long) event.values[0])) {
            schedulePush();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private String sensorState() {
        if (stepSensor == null) return "nosensor";
        if (!StepReader.hasPermission(this)) return "permission";
        return "ok";
    }

    private void schedulePush() {
        if (pushScheduled) return;
        pushScheduled = true;
        handler.postDelayed(() -> {
            pushScheduled = false;
            pushSteps();
        }, PUSH_DELAY_MS);
    }

    /** Schickt die Schritte an die Webseite (window.FitnessNativeApp.onSteps). */
    private void pushSteps() {
        if (!pageReady) return;
        String js = "window.FitnessNativeApp && window.FitnessNativeApp.onSteps("
                + StepStore.historyJson(this) + "," + JSONObject.quote(sensorState()) + ");";
        webView.evaluateJavascript(js, null);
    }

    private void requestStepPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        SharedPreferences prefs = getSharedPreferences("app", MODE_PRIVATE);
        boolean askedBefore = prefs.getBoolean("askedPermission", false);
        if (!askedBefore || shouldShowRequestPermissionRationale(Manifest.permission.ACTIVITY_RECOGNITION)) {
            prefs.edit().putBoolean("askedPermission", true).apply();
            requestPermissions(new String[]{Manifest.permission.ACTIVITY_RECOGNITION}, REQ_PERMISSION);
        } else {
            // Android fragt nicht mehr nach: App-Einstellungen öffnen
            Toast.makeText(this, "Bitte unter „Berechtigungen“ → „Körperliche Aktivität“ erlauben.",
                    Toast.LENGTH_LONG).show();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", getPackageName(), null));
            startActivity(intent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_PERMISSION) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startListening();
            Toast.makeText(this, "Schrittzähler aktiv.", Toast.LENGTH_SHORT).show();
        }
        schedulePush();
    }

    // ---------------------------------------------------------------- Dateien

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OPEN_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            String content = pendingSaveContent;
            pendingSaveContent = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || content == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException("kein Ziel");
                out.write(content.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "Backup gespeichert.", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Backup konnte nicht gespeichert werden.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private boolean isOnline() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm == null || cm.getActiveNetwork() == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    // ---------------------------------------------------------------- Webseite

    private class AppWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (APP_HOST.equals(uri.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri)); // fremde Links im Browser öffnen
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            pageReady = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageReady = true;
            pushSteps();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            // Kein Internet: gespeicherte Kopie der Seite verwenden
            if (request.isForMainFrame() && !triedOfflineCopy) {
                triedOfflineCopy = true;
                view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                view.loadUrl(APP_URL);
            }
        }
    }

    private class AppChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            try {
                startActivityForResult(Intent.createChooser(intent, "Backup-Datei wählen"), REQ_OPEN_FILE);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
        }
    }

    /** Wird von der Webseite als window.AndroidApp aufgerufen. */
    private class AppBridge {
        @JavascriptInterface
        public void saveFile(String fileName, String content) {
            handler.post(() -> {
                pendingSaveContent = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                try {
                    startActivityForResult(intent, REQ_SAVE_FILE);
                } catch (ActivityNotFoundException e) {
                    pendingSaveContent = null;
                    Toast.makeText(MainActivity.this, "Kein Speicherort verfügbar.", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void requestPermission() {
            handler.post(MainActivity.this::requestStepPermission);
        }

        @JavascriptInterface
        public void reportSteps(String date, double steps, double goal) {
            StepStore.saveReported(MainActivity.this, date, Math.round(steps), (int) Math.round(goal));
            StepWidget.updateAll(MainActivity.this);
        }

        @JavascriptInterface
        public String getSteps() {
            return StepStore.historyJson(MainActivity.this);
        }

        @JavascriptInterface
        public String getSensorState() {
            return sensorState();
        }
    }
}
