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

            // pallino della posizione: fermo (TextView «rank») oppure pulsante (ViewFlipper «rank_flip»)
            int rank = o.optInt("r", 0);
            if (rank > 0 && !"c".equals(o.optString("k"))) {
                int livello = Math.max(1, Math.min(3, o.optInt("l", 1)));
                int[] sfondiC = {R.drawable.rank_c_1, R.drawable.rank_c_2, R.drawable.rank_c_3};
                int[] sfondiS = {R.drawable.rank_s_1, R.drawable.rank_s_2, R.drawable.rank_s_3};
                int[][] colpoC = {{R.drawable.rank_c_1_a, R.drawable.rank_c_1_b}, {R.drawable.rank_c_2_a, R.drawable.rank_c_2_b}, {R.drawable.rank_c_3_a, R.drawable.rank_c_3_b}};
                int[][] colpoS = {{R.drawable.rank_s_1_a, R.drawable.rank_s_1_b}, {R.drawable.rank_s_2_a, R.drawable.rank_s_2_b}, {R.drawable.rank_s_3_a, R.drawable.rank_s_3_b}};
                String[] tintaC = {"#919199", "#B7791F", "#C8501E"};
                String[] tintaS = {"#72737D", "#E8B04B", "#FF9466"};
                int tinta = Color.parseColor((s ? tintaS : tintaC)[livello - 1]);
                int pieno = (s ? sfondiS : sfondiC)[livello - 1];
                int[] colpo = (s ? colpoS : colpoC)[livello - 1];
                int bpm = fatto ? 0 : o.optInt("b", 0);
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                if (bpm > 0) {
                    // Battito come nell'app, con un ViewFlipper che cambia quadro ogni 150 ms (flipInterval nel layout).
                    // Quadri: 0 = primo colpo (lub), 1 = pieno, 2 = secondo colpo (dub), poi altri quadri pieni per la pausa
                    // fino al battito successivo. Il ciclo dura il periodo (60000 / bpm ms, tra 450 e 2550) arrotondato a 150 ms.
                    // Un widget non può animare con codice proprio: la sequenza è fatta di viste statiche alternate dal sistema.
                    v.setViewVisibility(R.id.rank, View.GONE);
                    v.setViewVisibility(R.id.rank_flip, View.VISIBLE);
                    v.removeAllViews(R.id.rank_flip);
                    int periodo = Math.max(450, Math.min(2550, 60000 / bpm));
                    int quadri = 3 + Math.max(0, Math.round((periodo - 450) / 150f));
                    for (int k = 0; k < quadri; k++) {
                        int sfondo = k == 0 ? colpo[0] : k == 2 ? colpo[1] : pieno;
                        RemoteViews f = new RemoteViews(c.getPackageName(), R.layout.rank_frame);
                        f.setTextViewText(R.id.rf, String.valueOf(rank));
                        f.setTextColor(R.id.rf, tinta);
                        f.setInt(R.id.rf, "setBackgroundResource", sfondo);
                        v.addView(R.id.rank_flip, f);
                    }
                } else {
                    v.setViewVisibility(R.id.rank_flip, View.GONE);
                    v.setViewVisibility(R.id.rank, View.VISIBLE);
                    v.setTextViewText(R.id.rank, String.valueOf(rank));
                    v.setInt(R.id.rank, "setBackgroundResource", pieno);
                    v.setTextColor(R.id.rank, tinta);
                }
            } else if ("c".equals(o.optString("k"))) {
                // curiosità: pallino verde con l'interesse (1-5), che si riempie con l'interesse; fermo, senza battito
                int interesse = Math.max(1, Math.min(5, o.optInt("i", 3)));
                int[] pieniC = {R.drawable.rank_int_c_1, R.drawable.rank_int_c_2, R.drawable.rank_int_c_3, R.drawable.rank_int_c_4, R.drawable.rank_int_c_5};
                int[] pieniS = {R.drawable.rank_int_s_1, R.drawable.rank_int_s_2, R.drawable.rank_int_s_3, R.drawable.rank_int_s_4, R.drawable.rank_int_s_5};
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewVisibility(R.id.rank_flip, View.GONE);
                v.setViewVisibility(R.id.rank, View.VISIBLE);
                v.setTextViewText(R.id.rank, String.valueOf(rank > 0 ? rank : interesse)); // la posizione nella classifica delle curiosità
                v.setInt(R.id.rank, "setBackgroundResource", (s ? pieniS : pieniC)[interesse - 1]);
                v.setTextColor(R.id.rank, interesse >= 3 ? Color.parseColor(s ? "#0E0F12" : "#F1F0EC") : Color.parseColor(s ? "#6FCF9B" : "#2F7D5B"));
            } else {
                v.setViewVisibility(R.id.rankbox, View.GONE);
            }

            SpannableString titolo = new SpannableString(o.optString("t", ""));
            if (fatto) titolo.setSpan(new StrikethroughSpan(), 0, titolo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.titolo, titolo);
            v.setTextColor(R.id.titolo, fatto ? colore("#65656E", "#A5A5B0") : colore("#111115", "#F3F3F6"));

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
