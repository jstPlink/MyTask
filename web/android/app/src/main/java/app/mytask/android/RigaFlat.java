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
 * Disegni della riga del widget con lo stile Flat (come le righe dell'app): freccetta o pallino della posizione, pallino delle note e barra
 * verticale del tempo. Sono immagini disegnate a runtime perché i colori dipendono dal tema del widget e dalla quota di avanzamento.
 */
final class RigaFlat {
    private RigaFlat() {}

    private static float dp(Context c, float v) { return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()); }

    private static Paint p(int colore, Paint.Style stile, float spessore) {
        Paint x = new Paint(Paint.ANTI_ALIAS_FLAG);
        x.setColor(colore);
        x.setStyle(stile);
        x.setStrokeWidth(spessore);
        x.setStrokeJoin(Paint.Join.ROUND);
        x.setStrokeCap(Paint.Cap.ROUND);
        return x;
    }

    /** Tempo lavorato in minuti pieni: «24 min», «1 h 05 min». */
    static String tempoBreve(long minuti) {
        long m = Math.max(0, minuti);
        long h = m / 60;
        long r = m % 60;
        return h > 0 ? h + " h" + (r > 0 ? String.format(" %02d min", r) : "") : m + " min";
    }

    /** Tempo nella targhetta di dimensione fissa, sempre con l'unità più grande e senza tetto: «59 min», «9 h 59», «24 h», «47 h 30»; da due giorni «2 g 4», «10 g». */
    static String tempoCompatto(long minuti) {
        long m = Math.max(0, minuti);
        if (m < 60) return m + " min";
        long h = m / 60;
        if (h < 48) return m % 60 != 0 ? h + " h " + String.format("%02d", m % 60) : h + " h";
        long g = h / 24;
        return h % 24 != 0 ? g + " g " + (h % 24) : g + " g";
    }

    /** Stima in minuti: «30 min», «2 h», «1 h 30 min». */
    static String stimaBreve(long minuti) {
        long h = minuti / 60;
        long r = minuti % 60;
        return h > 0 ? h + " h" + (r > 0 ? " " + r + " min" : "") : minuti + " min";
    }

    /** Targhetta di posizione: attività = freccetta 32 x 30 dp, curiosità = pallino; fondo appena colorato (16%), contorno 1 dp, numero nel colore. */
    static Bitmap targhetta(Context c, boolean curiosita, int colore, String numero) {
        float d = dp(c, 1);
        Bitmap b = Bitmap.createBitmap(Math.round(32 * d), Math.round(30 * d), Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        Path f = new Path();
        if (curiosita) {
            f.addOval(new RectF(1.5f * d, 1 * d, 30.5f * d, 29 * d), Path.Direction.CW);
        } else {
            f.moveTo(4.5f * d, 1.5f * d);
            f.lineTo(23.3f * d, 1.5f * d);
            f.lineTo(29.6f * d, 12.19f * d);
            f.quadTo(30.8f * d, 15 * d, 29.6f * d, 17.81f * d);
            f.lineTo(23.3f * d, 28.5f * d);
            f.lineTo(4.5f * d, 28.5f * d);
            f.quadTo(1.2f * d, 28.5f * d, 1.2f * d, 24.4f * d);
            f.lineTo(1.2f * d, 5.6f * d);
            f.quadTo(1.2f * d, 1.5f * d, 4.5f * d, 1.5f * d);
            f.close();
        }
        cv.drawPath(f, p(Color.argb(0x29, Color.red(colore), Color.green(colore), Color.blue(colore)), Paint.Style.FILL, 0));
        cv.drawPath(f, p(colore, Paint.Style.STROKE, d));
        Paint t = p(colore, Paint.Style.FILL, 0);
        t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        t.setTextAlign(Paint.Align.CENTER);
        t.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 15.5f, c.getResources().getDisplayMetrics()));
        float y = 15 * d - (t.ascent() + t.descent()) / 2;
        cv.drawText(numero, (curiosita ? 16 : 14) * d, y, t);
        return b;
    }

    /** Targhetta delle note 22 x 18 dp (angoli 6 dp, contorno 1 dp) con le tre righe: contorno e righe nel colore del testo, fondo nel colore della superficie. */
    static Bitmap targhettaNote(Context c, int ink, int fondo) {
        float d = dp(c, 1);
        int w = Math.round(22 * d);
        int h = Math.round(18 * d);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        RectF r = new RectF(0.5f * d, 0.5f * d, w - 0.5f * d, h - 0.5f * d);
        cv.drawRoundRect(r, 6 * d, 6 * d, p(fondo, Paint.Style.FILL, 0));
        cv.drawRoundRect(r, 6 * d, 6 * d, p(ink, Paint.Style.STROKE, 1f * d));
        Paint l = p(ink, Paint.Style.STROKE, 1.2f * d);
        float x0 = w / 2f - 4 * d;
        cv.drawLine(x0, h / 2f - 3 * d, x0 + 8 * d, h / 2f - 3 * d, l);
        cv.drawLine(x0, h / 2f, x0 + 8 * d, h / 2f, l);
        cv.drawLine(x0, h / 2f + 3 * d, x0 + 5.5f * d, h / 2f + 3 * d, l);
        return b;
    }

    /**
     * Targhetta del tempo trascorso 72 x 24 dp: contorno nel colore del testo e riempimento da sinistra (32% del colore del testo) pari alla quota della stima già usata;
     * senza stima (`piena`) è tutta a riempimento tenue (20%); in pausa più spenta. Il numero lo scrive un TextView sopra l'immagine.
     */
    static Bitmap targhettaTempo(Context c, int colore, float quota, boolean piena, boolean pausa) {
        float d = dp(c, 1);
        int w = Math.round(72 * d);
        int h = Math.round(24 * d);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        float vivo = pausa ? 0.6f : 1f;
        RectF r = new RectF(0.5f * d, 0.5f * d, w - 0.5f * d, h - 0.5f * d);
        float raggio = 8 * d;
        Path forma = new Path();
        forma.addRoundRect(r, raggio, raggio, Path.Direction.CW);
        cv.save();
        cv.clipPath(forma);
        float q = piena ? 1f : Math.max(0f, Math.min(1f, quota));
        int alfa = Math.round(255 * (piena ? 0.20f : 0.32f) * vivo);
        cv.drawRect(r.left, r.top, r.left + r.width() * q, r.bottom, p(Color.argb(alfa, Color.red(colore), Color.green(colore), Color.blue(colore)), Paint.Style.FILL, 0));
        cv.restore();
        cv.drawRoundRect(r, raggio, raggio, p(Color.argb(Math.round(255 * vivo), Color.red(colore), Color.green(colore), Color.blue(colore)), Paint.Style.STROKE, d));
        return b;
    }
}
