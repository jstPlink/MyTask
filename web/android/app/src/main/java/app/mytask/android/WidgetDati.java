package app.mytask.android;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Dati condivisi tra app e widget: la lista di oggi (scritta dall'app) e le azioni fatte dal widget (lette dall'app). */
final class WidgetDati {
    private static final String PREFS = "mytask_widget";

    private WidgetDati() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray righe(Context c) {
        try {
            return new JSONArray(prefs(c).getString("righe", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static JSONArray archivio(Context c) {
        try {
            return new JSONArray(prefs(c).getString("archivio", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static void salvaArchivio(Context c, String json) {
        prefs(c).edit().putString("archivio", json).apply();
    }

    static void salvaRighe(Context c, String json) {
        prefs(c).edit().putString("righe", json).apply();
        aggiornaWidget(c);
    }

    /** Aggiunge un'azione da consegnare all'app: {tipo:"nota", testo, ts} oppure {tipo:"fatto", id, ts}. */
    static synchronized void accoda(Context c, JSONObject azione) {
        try {
            JSONArray coda = new JSONArray(prefs(c).getString("coda", "[]"));
            coda.put(azione);
            prefs(c).edit().putString("coda", coda.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static synchronized JSONArray svuotaCoda(Context c) {
        try {
            JSONArray coda = new JSONArray(prefs(c).getString("coda", "[]"));
            prefs(c).edit().putString("coda", "[]").apply();
            return coda;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Spunta una riga del widget: la segna subito come fatta e la mette in coda per l'app. */
    static void fatto(Context c, String id) {
        try {
            JSONArray r = righe(c);
            for (int i = 0; i < r.length(); i++) {
                JSONObject o = r.getJSONObject(i);
                if (id.equals(o.optString("id"))) o.put("f", o.optInt("f", 0) == 1 ? 0 : 1);
            }
            JSONObject a = new JSONObject();
            a.put("tipo", "fatto");
            a.put("id", id);
            a.put("ts", System.currentTimeMillis());
            // spuntare di nuovo una riga già fatta annulla la richiesta ancora in coda
            JSONArray coda = new JSONArray(prefs(c).getString("coda", "[]"));
            boolean annullata = false;
            JSONArray nuova = new JSONArray();
            for (int i = 0; i < coda.length(); i++) {
                JSONObject x = coda.getJSONObject(i);
                if ("fatto".equals(x.optString("tipo")) && id.equals(x.optString("id"))) { annullata = true; continue; }
                nuova.put(x);
            }
            if (!annullata) nuova.put(a);
            prefs(c).edit().putString("righe", r.toString()).putString("coda", nuova.toString()).apply();
        } catch (Exception ignored) {
        }
        aggiornaWidget(c);
    }

    static void aggiornaWidget(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : new Class<?>[] {MyTaskWidgetChiaro.class, MyTaskWidgetScuro.class}) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
        }
    }
}
