package de.fitnesstracker.app;

/**
 * Reine Rechen-Regeln der Update-Suche (ohne Android), damit sie auf dem Computer
 * getestet werden können: test/UpdateVersionTest.java.
 *
 * Release-Namen bei GitHub: "app-v1.0.N" (N = fortlaufende Bau-Nummer von GitHub,
 * siehe .github/workflows/android-app.yml). Die App selbst hat versionCode = N und
 * versionName = "1.0.N" (android/app/build.gradle). Verglichen wird nur N.
 */
final class UpdateVersion {
    static final String TAG_PREFIX = "app-v1.0.";

    private UpdateVersion() {}

    /** "app-v1.0.7" -> 7. Unbekanntes Format -> 0 (dann wird kein Update angeboten). */
    static long fromTag(String tag) {
        if (tag == null) return 0;
        String t = tag.trim();
        if (!t.startsWith(TAG_PREFIX)) return 0;
        String n = t.substring(TAG_PREFIX.length());
        if (n.isEmpty() || n.length() > 12) return 0;
        for (int i = 0; i < n.length(); i++) {
            if (!Character.isDigit(n.charAt(i))) return 0;
        }
        return Long.parseLong(n);
    }

    /** Nur anbieten, wenn das Release wirklich neuer ist als die installierte App. */
    static boolean isNewer(long latest, long installed) {
        return latest > 0 && latest > installed;
    }

    /** Anzeige-Name zur Bau-Nummer: 9 -> "1.0.9" (passt zu versionName in build.gradle). */
    static String displayName(long buildNumber) {
        return "1.0." + buildNumber;
    }
}
