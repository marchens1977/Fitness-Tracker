package de.fitnesstracker.app;

/**
 * Prüft die Versions-Regeln der Update-Suche (UpdateVersion.java) ohne Handy.
 * Start: über  python3 test/update_pruefung.py  (übersetzt und startet diese Datei).
 */
public class UpdateVersionTest {
    static int fehler = 0;

    static void pruefe(boolean ok, String was) {
        System.out.println((ok ? "  OK     " : "  FEHLER ") + was);
        if (!ok) fehler++;
    }

    public static void main(String[] args) {
        // Release-Namen, wie GitHub sie anlegt
        pruefe(UpdateVersion.fromTag("app-v1.0.8") == 8, "app-v1.0.8 -> 8");
        pruefe(UpdateVersion.fromTag("app-v1.0.10") == 10, "app-v1.0.10 -> 10 (zweistellig)");
        pruefe(UpdateVersion.fromTag(" app-v1.0.123 ") == 123, "Leerzeichen werden ignoriert");
        // Falsche oder fremde Namen -> 0 = kein Update anbieten
        pruefe(UpdateVersion.fromTag("v1.0.7") == 0, "v1.0.7 (anderes Schema) -> 0");
        pruefe(UpdateVersion.fromTag("app-v1.0.") == 0, "app-v1.0. (ohne Nummer) -> 0");
        pruefe(UpdateVersion.fromTag("app-v1.0.9-beta") == 0, "app-v1.0.9-beta -> 0");
        pruefe(UpdateVersion.fromTag("") == 0, "leer -> 0");
        pruefe(UpdateVersion.fromTag(null) == 0, "nichts -> 0");
        pruefe(UpdateVersion.fromTag("app-v1.0.99999999999999999") == 0, "riesige Zahl -> 0 (kein Absturz)");
        // Vergleich
        pruefe(UpdateVersion.isNewer(9, 8), "9 ist neuer als 8 -> Update anbieten");
        pruefe(!UpdateVersion.isNewer(8, 8), "gleiche Version -> kein Update");
        pruefe(!UpdateVersion.isNewer(6, 8), "älteres Release -> kein Update");
        pruefe(!UpdateVersion.isNewer(0, 0), "unbekanntes Release -> kein Update");
        pruefe(UpdateVersion.isNewer(10, 9), "10 ist neuer als 9 (Zahl, nicht Text)");
        // Anzeige passt zu versionName in build.gradle
        pruefe("1.0.9".equals(UpdateVersion.displayName(9)), "Anzeige 9 -> 1.0.9");
        pruefe(UpdateVersion.displayName(UpdateVersion.fromTag("app-v1.0.42")).equals("1.0.42"),
                "Release app-v1.0.42 wird als 1.0.42 angezeigt");

        System.out.println(fehler == 0 ? "UpdateVersionTest: alles OK" : "UpdateVersionTest: " + fehler + " Fehler");
        System.exit(fehler == 0 ? 0 : 1);
    }
}
