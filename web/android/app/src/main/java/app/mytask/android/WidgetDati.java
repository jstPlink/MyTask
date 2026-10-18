package app.mytask.android;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Archivio locale (SharedPreferences «mytask_widget») condiviso tra app e widget. Il widget non legge i dati dell'app
 * e non usa la rete: conserva solo quattro valori testuali in JSON.
 *  - «righe»: la lista di oggi, scritta dall'app (WidgetPlugin.aggiorna); per riga: id, titolo «t», posizione «r»,
 *    livello di priorità «l», battiti al minuto «b», orario «o», stato fatto «f».
 *  - «archivio»: note compatte per la ricerca delle note simili nella nota veloce.
 *  - «coda»: le azioni fatte dall'utente sul widget, in attesa dell'app: {tipo:"nota", testo, ts} e {tipo:"fatto", id, ts}.
 *    L'app la svuota (WidgetPlugin.coda) quando si apre o torna in primo piano e applica le azioni ai suoi dati.
 */
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

    /** Sostituisce la lista di oggi e fa ridisegnare i widget. */
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

    /** Restituisce la coda e la azzera, in un solo passaggio protetto (nessuna azione va persa o letta due volte). */
    static synchronized JSONArray svuotaCoda(Context c) {
        try {
            JSONArray coda = new JSONArray(prefs(c).getString("coda", "[]"));
            prefs(c).edit().putString("coda", "[]").apply();
            return coda;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /**
     * Spunta una riga del widget: la inverte subito (fatta/da fare, così il widget la mostra sbarrata) e mette
     * l'azione in coda per l'app. La coda è sempre aggiornata sulla riga: se c'è già una richiesta «fatto» per
     * lo stesso id, la nuova spunta la annulla invece di aggiungerne un'altra.
     */
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

    /** Dice ai due widget (chiaro e scuro) che la lista è cambiata: WidgetService rilegge le righe. */
    static void aggiornaWidget(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : new Class<?>[] {MyTaskWidgetChiaro.class, MyTaskWidgetScuro.class}) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length > 0) m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
        }
    }
}
