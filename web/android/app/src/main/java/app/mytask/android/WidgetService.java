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
import org.json.JSONArray;
import org.json.JSONObject;

/** Fornisce le righe della lista di oggi al widget. */
public class WidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Fabbrica(getApplicationContext(), intent.getBooleanExtra("scuro", false));
    }

    static class Fabbrica implements RemoteViewsFactory {
        private final Context c;
        private final boolean s;
        private JSONArray righe = new JSONArray();

        Fabbrica(Context c, boolean scuro) {
            this.c = c;
            this.s = scuro;
        }

        @Override public void onCreate() { }
        @Override public void onDataSetChanged() { righe = WidgetDati.righe(c); }
        @Override public void onDestroy() { }
        @Override public int getCount() { return righe.length(); }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }

        private int colore(String chiaro, String scuro) {
            return Color.parseColor(s ? scuro : chiaro);
        }

        @Override
        public RemoteViews getViewAt(int pos) {
            RemoteViews v = new RemoteViews(c.getPackageName(), s ? R.layout.riga_scuro : R.layout.riga_chiaro);
            JSONObject o = righe.optJSONObject(pos);
            if (o == null) return v;
            boolean fatto = o.optInt("f", 0) == 1;
            String id = o.optString("id");

            // orario del piano sotto il titolo
            String ora = o.optString("o", "");
            v.setViewVisibility(R.id.sub, ora.isEmpty() ? View.GONE : View.VISIBLE);
            v.setTextViewText(R.id.sub, ora);
            v.setTextColor(R.id.sub, fatto ? colore("#919199", "#72737D") : colore("#2F7D5B", "#6FCF9B"));

            int rank = o.optInt("r", 0);
            if (rank > 0) {
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
                    // pulsazione come nell'app: due colpi (lub-dub) di 450 ms, poi pausa fino al battito successivo
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
            } else {
                v.setViewVisibility(R.id.rankbox, View.GONE);
            }

            SpannableString titolo = new SpannableString(o.optString("t", ""));
            if (fatto) titolo.setSpan(new StrikethroughSpan(), 0, titolo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(R.id.titolo, titolo);
            v.setTextColor(R.id.titolo, fatto ? colore("#65656E", "#A5A5B0") : colore("#111115", "#F3F3F6"));

            v.setImageViewResource(R.id.cb, fatto ? (s ? R.drawable.cb_fatto_s : R.drawable.cb_fatto_c) : (s ? R.drawable.cb_vuoto_s : R.drawable.cb_vuoto_c));

            Intent spunta = new Intent().putExtra("azione", "fatto").putExtra("id", id);
            Intent apri = new Intent().putExtra("azione", "apri");
            v.setOnClickFillInIntent(R.id.cb, spunta);
            v.setOnClickFillInIntent(R.id.riga, apri);
            return v;
        }
    }
}
