package app.mytask.android;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Servizio che fornisce al ListView del widget le righe della lista di oggi (lette da WidgetDati): l'intestazione
 * «Attività» con le attività, poi «Curiosità» con le curiosità, tutte, e la lista scorre. Ogni riga ha: pallino con la
 * posizione in classifica colorato per priorità (non per le curiosità), titolo con la stima sotto, tempo già lavorato e
 * checkbox quadrato. Le righe fatte (spuntate dal widget, non ancora applicate dall'app) sono sbarrate e senza battito.
 */
public class WidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Fabbrica(getApplicationContext(), intent.getBooleanExtra("scuro", false));
    }

    /** Costruisce le righe una alla volta; `s` = aspetto scuro (layout riga_scuro, drawable «_s», colori del tema scuro). */
    static class Fabbrica implements RemoteViewsFactory {
        private final Context c;
        private final boolean s;
        private JSONArray righe = new JSONArray();
        /** Le voci della lista: intestazioni di sezione (con «h») e righe, nell'ordine in cui compaiono. */
        private final List<JSONObject> voci = new ArrayList<>();

        Fabbrica(Context c, boolean scuro) {
            this.c = c;
            this.s = scuro;
        }

        @Override public void onCreate() { }
        @Override public void onDataSetChanged() {
            righe = WidgetDati.righe(c);
            voci.clear();
            aggiungi("Attività", false);
            aggiungi("Curiosità", true);
        }

        /** Intestazione (con il tempo necessario a finire le voci) e righe di una sezione; se non ha voci non compare. */
        private void aggiungi(String nome, boolean curiosita) {
            List<JSONObject> sezione = new ArrayList<>();
            long minuti = 0;
            for (int i = 0; i < righe.length(); i++) {
                JSONObject o = righe.optJSONObject(i);
                if (o == null || "c".equals(o.optString("k")) != curiosita) continue;
                sezione.add(o);
                minuti += o.optLong("p", 0);
            }
            if (sezione.isEmpty()) return;
            try {
                voci.add(new JSONObject().put("h", nome).put("m", minuti));
            } catch (Exception ignored) {
            }
            voci.addAll(sezione);
        }

        @Override public void onDestroy() { }
        @Override public int getCount() { return voci.size(); }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 2; }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }

        /** Intestazione di sezione: nome e tempo necessario (somma delle stime). */
        private RemoteViews sezione(JSONObject o) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.riga_sezione);
            v.setTextViewText(R.id.sez_nome, o.optString("h"));
            v.setTextColor(R.id.sez_nome, colore("#65656E", "#A5A5B0"));
            v.setTextViewText(R.id.sez_tempo, ""); // nessuna stima del tempo totale: la compili una nota alla volta
            v.setTextColor(R.id.sez_tempo, colore("#2F7D5B", "#6FCF9B"));
            v.setOnClickFillInIntent(R.id.sez_riga, new Intent().putExtra("azione", "apri")); // anche l'intestazione apre l'app
            return v;
        }

        /** Colore #RRGGBB per il tema del widget (stessi colori dell'app web). */
        private int colore(String chiaro, String scuro) {
            return Color.parseColor(s ? scuro : chiaro);
        }

        @Override
        public RemoteViews getViewAt(int pos) {
            JSONObject o = pos < voci.size() ? voci.get(pos) : null;
            if (o != null && o.has("h")) return sezione(o);
            RemoteViews v = new RemoteViews(c.getPackageName(), s ? R.layout.riga_scuro : R.layout.riga_chiaro);
            if (o == null) return v;
            boolean fatto = o.optInt("f", 0) == 1;
            String id = o.optString("id");

            // «in corso»: lo dice lo stato della nota oppure il cronometro «Inizia» (anche se l'app non ha ancora aggiornato la nota).
            // La riga non cambia stile: cambia solo la casella (mezza gialla, come nell'app).
            JSONObject lavoro = WidgetDati.lavoro(c);
            boolean inLavoro = lavoro != null && id.equals(lavoro.optString("id"));
            boolean inCorso = !fatto && (o.optInt("c", 0) == 1 || inLavoro);
            v.setInt(R.id.riga, "setBackgroundColor", Color.TRANSPARENT);

            // stima sotto il titolo
            long previsto = o.optLong("p", 0);
            v.setViewVisibility(R.id.sub, previsto > 0 ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.sub, WidgetDati.durata(previsto));
            v.setTextColor(R.id.sub, colore("#65656E", "#A5A5B0"));

            // tempo già lavorato accanto alla casella
            long lavorato = o.optLong("w", 0);
            boolean mostraTempo = lavorato >= 1000 && !fatto;
            v.setViewVisibility(R.id.tempo, mostraTempo ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.tempo, WidgetDati.cronometro(lavorato));
            v.setTextColor(R.id.tempo, colore("#65656E", "#A5A5B0"));

            // targhetta della posizione, come nell'app: due pezzi attaccati con una linea di 1 dp, a sinistra il simbolo («!» attività, «?» curiosità) con la tinta del livello, a destra il numero su fondo grigio neutro con il contorno nel colore del livello; ferma
            int rank = o.optInt("r", 0);
            if (rank > 0 && !"c".equals(o.optString("k"))) {
                int livello = Math.max(1, Math.min(3, o.optInt("l", 1)));
                int[] simC = {R.drawable.sim_a_c_1, R.drawable.sim_a_c_2, R.drawable.sim_a_c_3};
                int[] simS = {R.drawable.sim_a_s_1, R.drawable.sim_a_s_2, R.drawable.sim_a_s_3};
                int[] numC = {R.drawable.num_a_c_1, R.drawable.num_a_c_2, R.drawable.num_a_c_3};
                int[] numS = {R.drawable.num_a_s_1, R.drawable.num_a_s_2, R.drawable.num_a_s_3};
                String[] tintaC = {"#8A93A0", "#D9A400", "#D32F2F"};
                String[] tintaS = {"#7B8493", "#F4C542", "#FF6B6B"};
                String tinta = (s ? tintaS : tintaC)[livello - 1];
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewPadding(R.id.rank, 0, 0, Math.round(6 * c.getResources().getDisplayMetrics().density), 0); // il numero sta verso il corpo: la punta è a destra
                v.setTextViewText(R.id.rank_s, "!");
                v.setInt(R.id.rank_s, "setBackgroundResource", (s ? simS : simC)[livello - 1]);
                v.setTextColor(R.id.rank_s, Color.parseColor(tinta));
                v.setTextViewText(R.id.rank, String.valueOf(rank));
                v.setInt(R.id.rank, "setBackgroundResource", (s ? numS : numC)[livello - 1]);
                v.setTextColor(R.id.rank, Color.parseColor(s ? "#F3F3F6" : "#404040")); // il numero resta neutro: il colore sta solo nel simbolo e nel contorno
            } else if ("c".equals(o.optString("k"))) {
                // curiosità: due pezzi con l'interesse (1-5): grigio (1-2), verde medio (3), verde scuro (4-5); fermo, senza battito
                int interesse = Math.max(1, Math.min(5, o.optInt("i", 3)));
                int[] simC = {R.drawable.sim_q_c_1, R.drawable.sim_q_c_2, R.drawable.sim_q_c_3, R.drawable.sim_q_c_4, R.drawable.sim_q_c_5};
                int[] simS = {R.drawable.sim_q_s_1, R.drawable.sim_q_s_2, R.drawable.sim_q_s_3, R.drawable.sim_q_s_4, R.drawable.sim_q_s_5};
                int[] numC = {R.drawable.num_q_c_1, R.drawable.num_q_c_2, R.drawable.num_q_c_3, R.drawable.num_q_c_4, R.drawable.num_q_c_5};
                int[] numS = {R.drawable.num_q_s_1, R.drawable.num_q_s_2, R.drawable.num_q_s_3, R.drawable.num_q_s_4, R.drawable.num_q_s_5};
                String[] tintaC = {"#8A93A0", "#8A93A0", "#4E9A78", "#1F7A52", "#1F7A52"};
                String[] tintaS = {"#7B8493", "#7B8493", "#5FAE8D", "#6FCF9B", "#6FCF9B"};
                String tinta = (s ? tintaS : tintaC)[interesse - 1];
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewPadding(R.id.rank, 0, 0, Math.round(2 * c.getResources().getDisplayMetrics().density), 0);
                v.setTextViewText(R.id.rank_s, "?");
                v.setInt(R.id.rank_s, "setBackgroundResource", (s ? simS : simC)[interesse - 1]);
                v.setTextColor(R.id.rank_s, Color.parseColor(tinta));
                v.setTextViewText(R.id.rank, String.valueOf(rank > 0 ? rank : interesse)); // la posizione nella classifica delle curiosità
                v.setInt(R.id.rank, "setBackgroundResource", (s ? numS : numC)[interesse - 1]);
                v.setTextColor(R.id.rank, Color.parseColor(s ? "#F3F3F6" : "#404040")); // il numero resta neutro: il colore sta solo nel simbolo e nel contorno
            } else {
                v.setViewVisibility(R.id.rankbox, View.GONE);
            }

            SpannableString titolo = new SpannableString(o.optString("t", ""));
            if (fatto) titolo.setSpan(new StrikethroughSpan(), 0, titolo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.titolo, titolo);
            v.setTextColor(R.id.titolo, fatto ? colore("#65656E", "#A5A5B0") : colore("#404040", "#F3F3F6"));

            // «in pausa»: nota avviata e messa da parte (campo «z»), a meno che il cronometro sia proprio su di lei
            boolean inPausa = !fatto && !inCorso && o.optInt("z", 0) == 1;
            v.setImageViewResource(R.id.cb, fatto ? (s ? R.drawable.cb_fatto_s : R.drawable.cb_fatto_c)
                    : inCorso ? (s ? R.drawable.cb_corso_s : R.drawable.cb_corso_c)
                    : inPausa ? (s ? R.drawable.cb_pausa_s : R.drawable.cb_pausa_c)
                    : (s ? R.drawable.cb_vuoto_s : R.drawable.cb_vuoto_c));

            // il tocco sulla casella non cambia stato: apre l'app come il resto della riga (lo stato si cambia nell'app)
            Intent apri = new Intent().putExtra("azione", "apri");
            v.setOnClickFillInIntent(R.id.cb, apri);
            v.setOnClickFillInIntent(R.id.riga, apri);
            return v;
        }
    }
}
