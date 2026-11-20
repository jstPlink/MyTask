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

    /** Pallino 20 dp con le tre righe delle note: contorno e righe nel colore del testo, fondo nel colore della superficie. */
    static Bitmap pallinoNote(Context c, int ink, int fondo) {
        float d = dp(c, 1);
        int n = Math.round(20 * d);
        Bitmap b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        cv.drawCircle(n / 2f, n / 2f, n / 2f - 0.5f * d, p(fondo, Paint.Style.FILL, 0));
        cv.drawCircle(n / 2f, n / 2f, n / 2f - 0.5f * d, p(ink, Paint.Style.STROKE, 1f * d));
        Paint l = p(ink, Paint.Style.STROKE, 1.3f * d);
        float x0 = n / 2f - 4 * d;
        cv.drawLine(x0, n / 2f - 3.2f * d, x0 + 8 * d, n / 2f - 3.2f * d, l);
        cv.drawLine(x0, n / 2f, x0 + 8 * d, n / 2f, l);
        cv.drawLine(x0, n / 2f + 3.2f * d, x0 + 5.5f * d, n / 2f + 3.2f * d, l);
        return b;
    }

    /**
     * Barra verticale 8 x 40 dp: contorno e riempimento dello stesso colore (quello del testo: nero nel tema chiaro, bianco nello scuro), sfondo vuoto. `quota` 0-1 (riempimento dal basso); `piena` = avviata
     * senza stima (barra intera e tenue); `pausa` = barra tenue.
     */
    static Bitmap barra(Context c, int primario, float quota, boolean piena, boolean pausa) {
        float d = dp(c, 1);
        int w = Math.round(8 * d);
        int h = Math.round(40 * d);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        int alfa = piena ? 0x73 : pausa ? 0x8C : 0xFF;
        int col = Color.argb(alfa, Color.red(primario), Color.green(primario), Color.blue(primario));
        RectF r = new RectF(0.75f * d, 0.75f * d, w - 0.75f * d, h - 0.75f * d);
        float raggio = 4 * d;
        Path forma = new Path();
        forma.addRoundRect(r, raggio, raggio, Path.Direction.CW);
        cv.save();
        cv.clipPath(forma);
        float q = piena ? 1f : Math.max(0f, Math.min(1f, quota));
        cv.drawRect(r.left, r.bottom - (r.height() * q), r.right, r.bottom, p(col, Paint.Style.FILL, 0));
        cv.restore();
        cv.drawRoundRect(r, raggio, raggio, p(col, Paint.Style.STROKE, 1.5f * d));
        return b;
    }
}
