package app.mytask.android;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Archivio locale (SharedPreferences «mytask_widget») condiviso tra app e widget. Il widget non legge i dati dell'app
 * e non usa la rete: conserva solo cinque valori testuali in JSON.
 *  - «righe»: la lista di oggi, scritta dall'app (WidgetPlugin.aggiorna); per riga: id, titolo «t», posizione «r»,
 *    livello di priorità «l», battiti al minuto «b», millisecondi già lavorati «w», stato fatto «f».
 *  - «lavoro»: la sessione «Sto lavorando» ({stato:"lavoro"|"pausa", id, t, base, ref}); il tempo del task è «base»
 *    (millisecondi già accumulati) più, se corre, il tempo trascorso da «ref» (momento di inizio del tratto). L'app lo scrive
 *    (WidgetPlugin.aggiorna) e il widget lo cambia da solo quando si tocca Sto lavorando, pausa, Fine o la casella del task.
 *  - «archivio»: note compatte per la ricerca delle note simili nella nota veloce.
 *  - «coda»: le azioni fatte dall'utente sul widget, in attesa dell'app: {tipo:"nota", testo, ts}, {tipo:"fatto", id, ts} e,
 *    per la sessione, {tipo:"avvia", id, ts}, {tipo:"pausa", ts}, {tipo:"riprendi", ts}, {tipo:"fine", ts}.
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

    /** La sessione «Sto lavorando» come la vede il widget, o null se non si sta lavorando. */
    static JSONObject lavoro(Context c) {
        try {
            String s = prefs(c).getString("lavoro", "");
            return s.isEmpty() ? null : new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    /** Sostituisce la sessione scritta dall'app (testo vuoto = nessuna sessione) e ridisegna i widget. */
    static void salvaLavoro(Context c, String json) {
        prefs(c).edit().putString("lavoro", json == null ? "" : json).apply();
        aggiornaWidget(c);
    }

    /** Millisecondi trascorsi sul task della sessione: «base» più, se corre, il tempo da «ref». */
    static long trascorso(JSONObject l, long adesso) {
        long base = l.optLong("base", 0);
        return "lavoro".equals(l.optString("stato")) ? base + Math.max(0, adesso - l.optLong("ref", adesso)) : base;
    }

    private static JSONObject azioneSessione(String tipo, String id, long ts) throws Exception {
        JSONObject a = new JSONObject();
        a.put("tipo", tipo);
        if (id != null) a.put("id", id);
        a.put("ts", ts);
        return a;
    }

    /** Cambia la sessione e mette l'azione in coda per l'app (che la applica con lo stesso orario). */
    private static void cambiaSessione(Context c, JSONObject nuova, JSONObject azione) {
        prefs(c).edit().putString("lavoro", nuova == null ? "" : nuova.toString()).apply();
        accoda(c, azione);
        aggiornaWidget(c);
    }

    /** «Sto lavorando»: il cronometro parte sul primo task della lista non ancora spuntato. */
    static void avvia(Context c) {
        try {
            if (lavoro(c) != null) return;
            JSONArray r = righe(c);
            for (int i = 0; i < r.length(); i++) {
                JSONObject o = r.getJSONObject(i);
                if (o.optInt("f", 0) == 1) continue;
                long ora = System.currentTimeMillis();
                JSONObject l = new JSONObject().put("stato", "lavoro").put("id", o.optString("id")).put("t", o.optString("t")).put("base", o.optLong("w", 0)).put("ref", ora);
                cambiaSessione(c, l, azioneSessione("avvia", o.optString("id"), ora));
                return;
            }
        } catch (Exception ignored) {
        }
    }

    /** Ferma il cronometro tenendo aperta la sessione. */
    static void pausa(Context c) {
        try {
            JSONObject l = lavoro(c);
            if (l == null || !"lavoro".equals(l.optString("stato"))) return;
            long ora = System.currentTimeMillis();
            l.put("base", trascorso(l, ora)).put("stato", "pausa");
            cambiaSessione(c, l, azioneSessione("pausa", null, ora));
        } catch (Exception ignored) {
        }
    }

    /** Riprende dal task in pausa. */
    static void riprendi(Context c) {
        try {
            JSONObject l = lavoro(c);
            if (l == null || !"pausa".equals(l.optString("stato"))) return;
            long ora = System.currentTimeMillis();
            l.put("stato", "lavoro").put("ref", ora);
            cambiaSessione(c, l, azioneSessione("riprendi", null, ora));
        } catch (Exception ignored) {
        }
    }

    /** «Fine»: chiude la sessione (nessun task viene completato). */
    static void fine(Context c) {
        if (lavoro(c) == null) return;
        try {
            cambiaSessione(c, null, azioneSessione("fine", null, System.currentTimeMillis()));
        } catch (Exception ignored) {
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
            boolean spuntata = false;
            for (int i = 0; i < r.length(); i++) {
                JSONObject o = r.getJSONObject(i);
                if (id.equals(o.optString("id"))) {
                    o.put("f", o.optInt("f", 0) == 1 ? 0 : 1);
                    spuntata = o.optInt("f", 0) == 1;
                }
            }
            // se era il task su cui corre il cronometro, la sessione passa al successivo non spuntato (o si chiude)
            JSONObject l = lavoro(c);
            if (spuntata && l != null && id.equals(l.optString("id"))) {
                JSONObject prossimo = null;
                int pos = -1;
                for (int i = 0; i < r.length(); i++) if (id.equals(r.getJSONObject(i).optString("id"))) pos = i;
                for (int k = 1; k <= r.length() && prossimo == null; k++) {
                    JSONObject o = r.getJSONObject((pos + k) % r.length());
                    if (!id.equals(o.optString("id")) && o.optInt("f", 0) != 1) prossimo = o;
                }
                if (prossimo != null) {
                    l.put("id", prossimo.optString("id")).put("t", prossimo.optString("t")).put("base", prossimo.optLong("w", 0)).put("ref", System.currentTimeMillis());
                    prefs(c).edit().putString("lavoro", l.toString()).apply();
                } else {
                    prefs(c).edit().putString("lavoro", "").apply();
                }
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

    /**
     * Dice ai due widget (chiaro e scuro) che qualcosa è cambiato: WidgetService rilegge le righe e il provider ridisegna
     * l'intestazione (pulsante «Sto lavorando» o cronometro).
     */
    static void aggiornaWidget(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : new Class<?>[] {MyTaskWidgetChiaro.class, MyTaskWidgetScuro.class}) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length == 0) continue;
            m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
            c.sendBroadcast(new Intent(c, k).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids));
        }
    }
}
