package app.mytask.android;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.util.TypedValue;

/**
 * Stile «Vetro» dell'app (web/src/stile-vetro.css) applicato al widget: l'app scrive il nome della palette (WidgetDati.stile) e qui
 * si trovano i colori della palette per il tema scuro e per quello chiaro, più la targhetta di posizione e il pulsante + disegnati
 * a runtime (le forme e i colori cambiano con la palette: non bastano i drawable fissi dello stile classico).
 * Ordine dei colori nelle tabelle: sfondo, sfondo 2, sfondo 3 (numero), accento, testo su accento, valore positivo, valore negativo, testo secondario.
 */
final class StileVetro {
    static final String[] NOMI = {"grafite", "ghiaccio", "turchese", "smeraldo", "salvia", "lime", "ambra", "arancio"};
    private static final String[][] SCURO = {
        {"#0E1012", "#171A1E", "#1C2025", "#E9EBEF", "#0E1012", "#8FE0B0", "#FF8F8F", "#8D94A0"}, // grafite
        {"#0E1114", "#151A20", "#1A212A", "#A9C8E8", "#0A2036", "#8FE0C8", "#FF9AA8", "#8A97A8"}, // ghiaccio
        {"#0B0E0F", "#111718", "#162022", "#5EE6D0", "#05241F", "#5EE6D0", "#FF9A8A", "#86978F"}, // turchese
        {"#08100D", "#0E1A15", "#13261D", "#3DDC97", "#04281A", "#3DDC97", "#FF9A8A", "#84A094"}, // smeraldo
        {"#0F1211", "#161B19", "#1B221F", "#9FD8B8", "#06241A", "#9FD8B8", "#F29A8A", "#8A9892"}, // salvia
        {"#0B0C0B", "#131512", "#181B16", "#C9F36B", "#14200A", "#C9F36B", "#FF9A72", "#8C9488"}, // lime
        {"#101010", "#1A1713", "#201B15", "#F0B45A", "#2A1A05", "#A8D98A", "#FF8A6B", "#9A9385"}, // ambra
        {"#0D0B0A", "#161210", "#1F1814", "#FF8A3D", "#2E1100", "#B5E08A", "#FF6B6B", "#9C9088"}, // arancio
    };
    private static final String[][] CHIARO = {
        {"#F4F5F7", "#ECEEF1", "#E3E6EA", "#2B3038", "#FFFFFF", "#1F8A56", "#C93A3A", "#6B7380"}, // grafite
        {"#F3F7FB", "#E9F0F8", "#DFE9F5", "#2F6FB0", "#FFFFFF", "#1F8A6A", "#C4455A", "#66758A"}, // ghiaccio
        {"#F2F8F8", "#E6F1F1", "#DAEAEA", "#12968A", "#FFFFFF", "#12968A", "#C8473F", "#62807D"}, // turchese
        {"#F2F8F4", "#E5F1E9", "#D8EADF", "#17894F", "#FFFFFF", "#17894F", "#C4493F", "#61806F"}, // smeraldo
        {"#F4F7F4", "#EAF0EB", "#DFE8E1", "#3F8F68", "#FFFFFF", "#3F8F68", "#C4503F", "#6A7A70"}, // salvia
        {"#F7F8F0", "#EFF1E2", "#E6EACE", "#5F8F0E", "#FFFFFF", "#5F8F0E", "#C8512F", "#767C64"}, // lime
        {"#FAF6EE", "#F4ECDC", "#ECDFC6", "#B9771A", "#FFFFFF", "#4F8A2C", "#C8442F", "#85796A"}, // ambra
        {"#FAF4F0", "#F5E9E1", "#EFDCCF", "#D1561A", "#FFFFFF", "#4F8A2C", "#B8322E", "#8A786C"}, // arancio
    };

    final int sfondo, sfondo2, sfondo3, accento, suAccento, positivo, negativo, secondario, testo, avvertenza;
    final String nome;
    final boolean scuro;

    private StileVetro(String nome, boolean scuro) {
        int i = 0;
        for (int k = 0; k < NOMI.length; k++) if (NOMI[k].equals(nome)) i = k;
        String[] t = (scuro ? SCURO : CHIARO)[i];
        this.nome = NOMI[i];
        this.scuro = scuro;
        sfondo = Color.parseColor(t[0]);
        sfondo2 = Color.parseColor(t[1]);
        sfondo3 = Color.parseColor(t[2]);
        accento = Color.parseColor(t[3]);
        suAccento = Color.parseColor(t[4]);
        positivo = Color.parseColor(t[5]);
        negativo = Color.parseColor(t[6]);
        secondario = Color.parseColor(t[7]);
        testo = Color.parseColor(scuro ? "#F2F4F7" : "#1B1F24");
        avvertenza = Color.parseColor(scuro ? "#F4C542" : "#B9811A");
    }

    /** Lo stile Vetro scelto nell'app, o null se è attivo quello classico. */
    static StileVetro leggi(Context c, boolean scuro) {
        String nome = WidgetDati.stile(c);
        return nome == null || "flat".equals(nome) ? null : new StileVetro(nome, scuro); // «flat» = stile Flat (RigaFlat), non è una palette
    }

    /** Risorsa dello sfondo del widget per questa palette (widget_bg_v_<palette>_<c|s>), 0 se manca. */
    int sfondoWidget(Context c) {
        return c.getResources().getIdentifier("widget_bg_v_" + nome + "_" + (scuro ? "s" : "c"), "drawable", c.getPackageName());
    }

    /** Colore della targhetta di un livello di priorità (1 basso, 2 medio, 3 alto). */
    int livello(int l) { return l >= 3 ? negativo : l == 2 ? avvertenza : secondario; }

    /** Colore della targhetta di una curiosità per l'interesse (1-5): grigio, accento, positivo. */
    int interesse(int i) { return i >= 4 ? positivo : i == 3 ? accento : secondario; }

    private static float dp(Context c, float v) { return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()); }

    private Paint pennello(int colore, Paint.Style stile, float spessore) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(colore);
        p.setStyle(stile);
        p.setStrokeWidth(spessore);
        p.setStrokeJoin(Paint.Join.ROUND);
        return p;
    }

    /**
     * Targhetta di posizione: attività = freccetta 32 x 30 dp con la punta a destra, curiosità = pallino 30 x 30 dp; fondo appena colorato
     * (16%), contorno di 1 dp e numero nel colore del livello.
     */
    Bitmap targhetta(Context c, boolean curiosita, int colore, String numero) {
        float d = dp(c, 1);
        Bitmap b = Bitmap.createBitmap(Math.round(32 * d), Math.round(30 * d), Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        float u = d;
        Path forma = new Path();
        if (curiosita) {
            forma.addOval(new RectF(1.5f * u, 1 * u, 30.5f * u, 29 * u), Path.Direction.CW);
        } else {
            forma.moveTo(4.5f * u, 1.5f * u);
            forma.lineTo(23.3f * u, 1.5f * u);
            forma.lineTo(29.6f * u, 12.19f * u);
            forma.quadTo(30.8f * u, 15 * u, 29.6f * u, 17.81f * u);
            forma.lineTo(23.3f * u, 28.5f * u);
            forma.lineTo(4.5f * u, 28.5f * u);
            forma.quadTo(1.2f * u, 28.5f * u, 1.2f * u, 24.4f * u);
            forma.lineTo(1.2f * u, 5.6f * u);
            forma.quadTo(1.2f * u, 1.5f * u, 4.5f * u, 1.5f * u);
            forma.close();
        }
        android.graphics.Matrix specchio = new android.graphics.Matrix();
        specchio.setScale(-1, 1, 16 * u, 15 * u); // la punta guarda il titolo (a sinistra)
        forma.transform(specchio);
        cv.drawPath(forma, pennello(Color.argb(0x29, Color.red(colore), Color.green(colore), Color.blue(colore)), Paint.Style.FILL, 0));
        cv.drawPath(forma, pennello(colore, Paint.Style.STROKE, d));
        Paint t = pennello(colore, Paint.Style.FILL, 0);
        t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        t.setTextAlign(Paint.Align.CENTER);
        t.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 15.5f, c.getResources().getDisplayMetrics()));
        float y = 15 * u - (t.ascent() + t.descent()) / 2;
        cv.drawText(numero, (curiosita ? 16 : 18) * u, y, t);
        return b;
    }

    /** Pulsante «+» della nota veloce: cerchio d'accento di 56 dp con il segno nel colore «testo su accento». */
    Bitmap piu(Context c) {
        float d = dp(c, 1);
        int n = Math.round(56 * d);
        Bitmap b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        cv.drawCircle(n / 2f, n / 2f, n / 2f, pennello(accento, Paint.Style.FILL, 0));
        Paint p = pennello(suAccento, Paint.Style.STROKE, 3 * d);
        p.setStrokeCap(Paint.Cap.ROUND);
        cv.drawLine(n / 2f - 11 * d, n / 2f, n / 2f + 11 * d, n / 2f, p);
        cv.drawLine(n / 2f, n / 2f - 11 * d, n / 2f, n / 2f + 11 * d, p);
        return b;
    }
}
