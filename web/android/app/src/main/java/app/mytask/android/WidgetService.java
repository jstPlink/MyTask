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
        private StileVetro vt; // stile Vetro scelto nell'app (null = classico)
        private boolean flat; // stile Flat scelto nell'app: righe a altezza fissa come nell'app (RigaFlat)
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
            vt = StileVetro.leggi(c, s);
            flat = "flat".equals(WidgetDati.stile(c));
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
        @Override public int getViewTypeCount() { return 3; }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }

        /** Intestazione di sezione: nome e tempo necessario (somma delle stime). */
        private RemoteViews sezione(JSONObject o) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.riga_sezione);
            v.setTextViewText(R.id.sez_nome, o.optString("h"));
            v.setTextColor(R.id.sez_nome, cSec());
            v.setTextViewText(R.id.sez_tempo, ""); // nessuna stima del tempo totale: la compili una nota alla volta
            v.setTextColor(R.id.sez_tempo, colore("#2F7D5B", "#6FCF9B"));
            v.setOnClickFillInIntent(R.id.sez_riga, new Intent().putExtra("azione", "apri")); // anche l'intestazione apre l'app
            return v;
        }

        /** Colore #RRGGBB per il tema del widget (stessi colori dell'app web). */
        private int colore(String chiaro, String scuro) {
            return Color.parseColor(s ? scuro : chiaro);
        }

        /** Testo secondario e testo principale: della palette con lo stile Vetro, altrimenti quelli classici. */
        private int cSec() { return vt != null ? vt.secondario : colore("#65656E", "#A5A5B0"); }
        private int cInk() { return vt != null ? vt.testo : colore("#404040", "#F3F3F6"); }

        /** Riga con lo stile Flat: targhetta, titolo, pallino delle note e scadenza, tempo/stima in testo e barra verticale; niente casella. */
        private RemoteViews rigaFlat(JSONObject o) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.riga_flat);
            boolean fatto = o.optInt("f", 0) == 1;
            String id = o.optString("id");
            JSONObject lavoro = WidgetDati.lavoro(c);
            boolean inLavoro = lavoro != null && id.equals(lavoro.optString("id"));
            boolean inCorso = !fatto && (o.optInt("c", 0) == 1 || inLavoro);
            boolean inPausa = !fatto && !inCorso && o.optInt("z", 0) == 1;
            int ink = cInk();
            int sec = cSec();
            int rosso = Color.parseColor(s ? "#FF6B6B" : "#D32F2F");

            // targhetta di posizione
            int rank = o.optInt("r", 0);
            boolean curiosita = "c".equals(o.optString("k"));
            if (rank > 0 || curiosita) {
                int col;
                String numero;
                if (curiosita) {
                    int interesse = Math.max(1, Math.min(5, o.optInt("i", 3)));
                    String[] tc = {"#8A93A0", "#8A93A0", "#4E9A78", "#1F7A52", "#1F7A52"};
                    String[] ts = {"#7B8493", "#7B8493", "#5FAE8D", "#6FCF9B", "#6FCF9B"};
                    col = Color.parseColor((s ? ts : tc)[interesse - 1]);
                    numero = String.valueOf(rank > 0 ? rank : interesse);
                } else {
                    String[] tc = {"#8A93A0", "#D9A400", "#D32F2F"};
                    String[] ts = {"#7B8493", "#F4C542", "#FF6B6B"};
                    col = Color.parseColor((s ? ts : tc)[Math.max(1, Math.min(3, o.optInt("l", 1))) - 1]);
                    numero = String.valueOf(rank);
                }
                v.setViewVisibility(R.id.rank_img, View.VISIBLE);
                v.setImageViewBitmap(R.id.rank_img, RigaFlat.targhetta(c, curiosita, col, numero));
            } else {
                v.setViewVisibility(R.id.rank_img, View.INVISIBLE);
            }

            SpannableString titolo = new SpannableString(o.optString("t", ""));
            if (fatto) titolo.setSpan(new StrikethroughSpan(), 0, titolo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.titolo, titolo);
            v.setTextColor(R.id.titolo, fatto ? sec : ink);

            // sotto il titolo: targhetta delle note, poi la targhetta della scadenza (rossa se in ritardo)
            boolean haNote = o.optInt("n", 0) == 1 && !fatto;
            String data = fatto ? "" : o.optString("d", "");
            boolean haData = !data.isEmpty();
            v.setViewVisibility(R.id.bd, haNote || haData ? View.VISIBLE : View.GONE);
            v.setViewVisibility(R.id.nota_img, haNote ? View.VISIBLE : View.GONE);
            if (haNote) v.setImageViewBitmap(R.id.nota_img, RigaFlat.targhettaNote(c, ink, Color.parseColor(s ? "#1D1F23" : "#FAFAFA")));
            v.setViewVisibility(R.id.data, haData ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.data, data);
            boolean inRitardo = o.optInt("dl", 0) == 1;
            v.setTextColor(R.id.data, inRitardo ? rosso : ink);
            v.setInt(R.id.data, "setBackgroundResource", inRitardo ? (s ? R.drawable.chip_flat_late_s : R.drawable.chip_flat_late_c) : (s ? R.drawable.chip_flat_s : R.drawable.chip_flat_c));

            // a destra: il tempo con la barra orizzontale sotto se la nota è cominciata, altrimenti solo la stima; sotto la riga un divisorio sottile
            long previsto = o.optLong("p", 0);
            boolean conTempo = inCorso || inPausa;
            if (conTempo) {
                long ms = o.optLong("w", 0);
                if (inLavoro && lavoro != null && "lavoro".equals(lavoro.optString("stato"))) ms = lavoro.optLong("base", ms) + Math.max(0, System.currentTimeMillis() - lavoro.optLong("ref", 0));
                v.setViewVisibility(R.id.tempo_box, View.VISIBLE);
                v.setTextViewText(R.id.tc, RigaFlat.tempoCompatto(ms / 60000));
                v.setTextColor(R.id.tc, ink);
                float quota = previsto > 0 ? ms / (previsto * 60000f) : 0f;
                v.setImageViewBitmap(R.id.barra_img, RigaFlat.targhettaTempo(c, ink, quota, previsto <= 0, inPausa));
                v.setViewVisibility(R.id.su, View.GONE);
            } else if (previsto > 0 && !fatto) {
                v.setViewVisibility(R.id.tempo_box, View.GONE);
                v.setViewVisibility(R.id.su, View.VISIBLE);
                v.setTextViewText(R.id.su, RigaFlat.tempoCompatto(previsto));
                v.setTextColor(R.id.su, Color.parseColor(s ? "#939396" : "#8A8A88")); // stesso colore e stile del titolo dei progetti: targhetta con solo il contorno
                v.setInt(R.id.su, "setBackgroundResource", s ? R.drawable.chip_stima_s : R.drawable.chip_stima_c);
            } else {
                v.setViewVisibility(R.id.tempo_box, View.GONE);
                v.setViewVisibility(R.id.su, View.GONE);
            }
            v.setInt(R.id.divisore, "setBackgroundColor", Color.argb(0x80, Color.red(ink), Color.green(ink), Color.blue(ink))); // divisorio più marcato (circa 50% del colore del testo)

            // il tocco apre l'app (lo stato si cambia nell'app)
            v.setOnClickFillInIntent(R.id.riga, new Intent().putExtra("azione", "apri"));
            return v;
        }

        @Override
        public RemoteViews getViewAt(int pos) {
            JSONObject o = pos < voci.size() ? voci.get(pos) : null;
            if (o != null && o.has("h")) return sezione(o);
            if (o != null && flat) return rigaFlat(o);
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
            v.setTextColor(R.id.sub, cSec());

            // tempo già lavorato accanto alla casella
            long lavorato = o.optLong("w", 0);
            boolean mostraTempo = lavorato >= 1000 && !fatto;
            v.setViewVisibility(R.id.tempo, mostraTempo ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.tempo, WidgetDati.cronometro(lavorato));
            v.setTextColor(R.id.tempo, cSec());

            // targhetta della posizione, come nell'app: due pezzi attaccati con una linea di 1 dp, a sinistra il simbolo («!» attività, «?» curiosità) con la tinta del livello, a destra il numero su fondo grigio neutro con il contorno nel colore del livello; ferma
            int rank = o.optInt("r", 0);
            boolean curiosita = "c".equals(o.optString("k"));
            if (vt != null && (curiosita || rank > 0)) {
                // stile Vetro: la targhetta è un'unica immagine disegnata con i colori della palette
                int col;
                String numero;
                if (curiosita) {
                    int interesse = Math.max(1, Math.min(5, o.optInt("i", 3)));
                    col = vt.interesse(interesse);
                    numero = String.valueOf(rank > 0 ? rank : interesse);
                } else {
                    col = vt.livello(Math.max(1, Math.min(3, o.optInt("l", 1))));
                    numero = String.valueOf(rank);
                }
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewVisibility(R.id.rank, View.GONE);
                v.setViewVisibility(R.id.rank_img, View.VISIBLE);
                v.setImageViewBitmap(R.id.rank_img, vt.targhetta(c, curiosita, col, numero));
            } else if (rank > 0 && !curiosita) {
                // attività: freccetta 32 x 30 con fondo appena colorato; il numero ha il colore della priorità
                int livello = Math.max(1, Math.min(3, o.optInt("l", 1)));
                int[] tagC = {R.drawable.tag_c_1, R.drawable.tag_c_2, R.drawable.tag_c_3};
                int[] tagS = {R.drawable.tag_s_1, R.drawable.tag_s_2, R.drawable.tag_s_3};
                String[] tintaC = {"#8A93A0", "#D9A400", "#D32F2F"};
                String[] tintaS = {"#7B8493", "#F4C542", "#FF6B6B"};
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewPadding(R.id.rank, Math.round(4 * c.getResources().getDisplayMetrics().density), 0, 0, 0); // il numero sta verso il corpo: la punta è a sinistra, verso il titolo
                v.setTextViewText(R.id.rank, String.valueOf(rank));
                v.setInt(R.id.rank, "setBackgroundResource", (s ? tagS : tagC)[livello - 1]);
                v.setTextColor(R.id.rank, Color.parseColor((s ? tintaS : tintaC)[livello - 1]));
            } else if (curiosita) {
                // curiosità: pallino 30 x 30 con l'interesse (1-5): grigio (1-2), verde medio (3), verde scuro (4-5); fermo, senza battito
                int interesse = Math.max(1, Math.min(5, o.optInt("i", 3)));
                int[] pieniC = {R.drawable.rank_int_c_1, R.drawable.rank_int_c_2, R.drawable.rank_int_c_3, R.drawable.rank_int_c_4, R.drawable.rank_int_c_5};
                int[] pieniS = {R.drawable.rank_int_s_1, R.drawable.rank_int_s_2, R.drawable.rank_int_s_3, R.drawable.rank_int_s_4, R.drawable.rank_int_s_5};
                String[] tintaC = {"#8A93A0", "#8A93A0", "#4E9A78", "#1F7A52", "#1F7A52"};
                String[] tintaS = {"#7B8493", "#7B8493", "#5FAE8D", "#6FCF9B", "#6FCF9B"};
                v.setViewVisibility(R.id.rankbox, View.VISIBLE);
                v.setViewPadding(R.id.rank, 0, 0, 0, 0);
                v.setTextViewText(R.id.rank, String.valueOf(rank > 0 ? rank : interesse)); // la posizione nella classifica delle curiosità
                v.setInt(R.id.rank, "setBackgroundResource", (s ? pieniS : pieniC)[interesse - 1]);
                v.setTextColor(R.id.rank, Color.parseColor((s ? tintaS : tintaC)[interesse - 1]));
            } else {
                v.setViewVisibility(R.id.rankbox, View.GONE);
            }

            SpannableString titolo = new SpannableString(o.optString("t", ""));
            if (fatto) titolo.setSpan(new StrikethroughSpan(), 0, titolo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.titolo, titolo);
            v.setTextColor(R.id.titolo, fatto ? cSec() : cInk());

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
