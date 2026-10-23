package app.mytask.android;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Nota veloce dal widget: barra sopra la tastiera con un campo tondo e il pulsante di invio, coi colori dell'app
 * (chiaro o scuro come il widget). Mentre si scrive compaiono le note che contengono le stesse parole, per non
 * ripetersi. L'interfaccia è costruita in codice (nessun layout XML), col tema traslucido che lascia vedere la Home.
 * Al tocco sul pulsante di invio la nota non viene salvata qui: va nella coda locale (WidgetDati.accoda, tipo «nota»)
 * e l'app la mette nell'Inbox alla prima apertura, senza aprirsi adesso.
 * Le note simili si cercano nell'archivio compatto scritto dall'app; ogni voce ha: k = chiave di ricerca (titolo, note e
 * altri campi, normalizzati), t = titolo, m = riga di dettaglio, c = 1 se chiusa, a = ultimo aggiornamento.
 */
public class NotaRapidaActivity extends Activity {

    private static final int MAX_SIMILI = 30;

    private int sfondo, campoBg, inchiostro, suggerimento, linea, accento, sopra, tenue;
    private JSONArray archivio = new JSONArray();
    private LinearLayout elenco;
    private ScrollView scorrevole;
    private TextView intestazione;

    /** Da dp a pixel. */
    private int dp(float v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /** Sfondo arrotondato (o ovale) con bordo facoltativo, per il campo di testo e il pulsante di invio. */
    private GradientDrawable forma(int riempimento, float raggioDp, int bordo, float spessoreDp, boolean ovale) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(ovale ? GradientDrawable.OVAL : GradientDrawable.RECTANGLE);
        g.setColor(riempimento);
        if (!ovale) g.setCornerRadius(dp(raggioDp));
        if (spessoreDp > 0) g.setStroke(dp(spessoreDp), bordo);
        return g;
    }

    /** Stesso testo di ricerca dell'app (chiaveTitolo): senza accenti, minuscolo, solo lettere, cifre e apostrofo. */
    private static String chiave(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT).replace('’', '\'').replace('‘', '\'').replace('`', '\'');
        return n.replaceAll("[^a-z0-9' ]", " ").replaceAll("\\s+", " ").trim();
    }

    /** Una nota dell'archivio che contiene le parole scritte. */
    private static class Simile {
        int punti;
        int chiusa;
        long agg;
        String titolo;
        String meta;
    }

    /** Come cercaSimili dell'app: parole con la stessa radice; prima più parole in comune, poi le aperte, poi le più recenti. */
    private void aggiornaSimili(String testo) {
        elenco.removeAllViews();
        String q = chiave(testo);
        if (q.isEmpty()) {
            intestazione.setVisibility(View.GONE);
            scorrevole.setVisibility(View.GONE);
            return;
        }
        List<String> radici = new ArrayList<>();
        for (String p : q.split(" ")) {
            if (p.length() >= 2) radici.add(p.length() > 5 ? p.substring(0, p.length() - 2) : p);
        }
        List<Simile> trovate = new ArrayList<>();
        if (!radici.isEmpty()) {
            int minimo = radici.size() <= 2 ? 1 : (int) Math.ceil(radici.size() / 2.0);
            for (int i = 0; i < archivio.length(); i++) {
                JSONObject o = archivio.optJSONObject(i);
                if (o == null) continue;
                String k = o.optString("k", "");
                int punti = 0;
                for (String r : radici) if (k.contains(r)) punti++;
                if (punti < minimo) continue;
                Simile s = new Simile();
                s.punti = punti;
                s.chiusa = o.optInt("c", 0);
                s.agg = o.optLong("a", 0);
                s.titolo = o.optString("t", "");
                s.meta = o.optString("m", "");
                trovate.add(s);
            }
        }
        Collections.sort(trovate, (a, b) -> {
            if (a.punti != b.punti) return b.punti - a.punti;
            if (a.chiusa != b.chiusa) return a.chiusa - b.chiusa;
            return Long.compare(b.agg, a.agg);
        });
        intestazione.setVisibility(View.VISIBLE);
        int n = Math.min(trovate.size(), MAX_SIMILI);
        intestazione.setText(trovate.isEmpty() ? "Nessuna nota con queste parole: è nuova."
                : trovate.size() + (trovate.size() == 1 ? " nota contiene" : " note contengono") + " queste parole");
        scorrevole.setVisibility(n == 0 ? View.GONE : View.VISIBLE);
        for (int i = 0; i < n; i++) {
            Simile s = trovate.get(i);
            LinearLayout riga = new LinearLayout(this);
            riga.setOrientation(LinearLayout.VERTICAL);
            riga.setPadding(0, dp(9), 0, dp(9));
            TextView t = new TextView(this);
            t.setText(s.titolo);
            t.setTextSize(14);
            t.setMaxLines(2);
            t.setTypeface(t.getTypeface(), Typeface.BOLD);
            t.setTextColor(s.chiusa == 1 ? tenue : inchiostro);
            riga.addView(t);
            if (!s.meta.isEmpty()) {
                TextView m = new TextView(this);
                m.setText(s.meta);
                m.setTextSize(11.5f);
                m.setMaxLines(1);
                m.setTextColor(tenue);
                riga.addView(m);
            }
            elenco.addView(riga);
            if (i < n - 1) {
                View f = new View(this);
                f.setBackgroundColor(linea);
                elenco.addView(f, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
            }
        }
    }

    /** Mette la nota in coda per l'app (come «non assegnata» in Inbox); con `apriSubito` apre anche l'app sulla scheda della nota. */
    private void salva(String testo, boolean apriSubito) {
        if (testo.isEmpty()) { finish(); return; }
        try {
            JSONObject a = new JSONObject();
            a.put("tipo", "nota");
            a.put("testo", testo);
            a.put("ts", System.currentTimeMillis());
            if (apriSubito) a.put("apri", true);
            WidgetDati.accoda(this, a);
            if (apriSubito) {
                Intent lancia = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (lancia != null) startActivity(lancia);
            } else {
                Toast.makeText(this, "Salvata nell’Inbox", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception ignored) {
        }
        finish();
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // colori: stessa palette dell'app, nel tema (chiaro o scuro) del widget che ha aperto la barra
        boolean scuro = getIntent().getBooleanExtra("scuro", false);
        sfondo = Color.parseColor(scuro ? "#0E0F12" : "#F1F0EC");
        campoBg = Color.parseColor(scuro ? "#1D1F23" : "#FFFFFF");
        inchiostro = Color.parseColor(scuro ? "#F3F3F6" : "#111115");
        suggerimento = Color.parseColor(scuro ? "#72737D" : "#919199");
        linea = Color.parseColor(scuro ? "#2F3138" : "#DDDAD4");
        accento = Color.parseColor(scuro ? "#6FCF9B" : "#2F7D5B");
        sopra = Color.parseColor(scuro ? "#0E0F12" : "#FFFFFF");
        tenue = Color.parseColor(scuro ? "#A5A5B0" : "#65656E");
        archivio = WidgetDati.archivio(this);

        // tocco fuori dalla barra: chiude
        FrameLayout radice = new FrameLayout(this);
        radice.setOnClickListener(v -> finish());

        LinearLayout pannello = new LinearLayout(this);
        pannello.setOrientation(LinearLayout.VERTICAL);
        pannello.setBackgroundColor(sfondo);
        pannello.setClickable(true);
        radice.addView(pannello, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        // note con parole simili (si vedono solo mentre si scrive)
        intestazione = new TextView(this);
        intestazione.setTextSize(12);
        intestazione.setTextColor(tenue);
        intestazione.setPadding(dp(18), dp(12), dp(18), dp(4));
        intestazione.setVisibility(View.GONE);
        pannello.addView(intestazione);

        final int massimo = Math.round(getResources().getDisplayMetrics().heightPixels * 0.34f);
        scorrevole = new ScrollView(this) {
            @Override
            protected void onMeasure(int larghezza, int altezza) {
                super.onMeasure(larghezza, MeasureSpec.makeMeasureSpec(massimo, MeasureSpec.AT_MOST));
            }
        };
        scorrevole.setVisibility(View.GONE);
        elenco = new LinearLayout(this);
        elenco.setOrientation(LinearLayout.VERTICAL);
        elenco.setPadding(dp(18), 0, dp(18), dp(4));
        scorrevole.addView(elenco, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        pannello.addView(scorrevole, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        LinearLayout barra = new LinearLayout(this);
        barra.setOrientation(LinearLayout.HORIZONTAL);
        barra.setGravity(Gravity.BOTTOM);
        barra.setPadding(dp(12), dp(10), dp(12), dp(10));
        pannello.addView(barra, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText campo = new EditText(this);
        campo.setHint("Scrivi una nota…");
        campo.setHintTextColor(suggerimento);
        campo.setTextColor(inchiostro);
        campo.setTextSize(15);
        campo.setBackground(forma(campoBg, 24, accento, 1.5f, false));
        campo.setPadding(dp(16), dp(11), dp(16), dp(11));
        campo.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        campo.setMaxLines(5);
        campo.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        barra.addView(campo, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        campo.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void onTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void afterTextChanged(Editable e) { aggiornaSimili(e.toString()); }
        });

        TextView apri = new TextView(this);
        apri.setText("↗");
        apri.setTextSize(20);
        apri.setTextColor(accento);
        apri.setTypeface(apri.getTypeface(), Typeface.BOLD);
        apri.setGravity(Gravity.CENTER);
        apri.setBackground(forma(campoBg, 0, accento, 1.5f, true));
        apri.setContentDescription("Salva e apri la nota per configurarla");
        LinearLayout.LayoutParams lpApri = new LinearLayout.LayoutParams(dp(46), dp(46));
        lpApri.leftMargin = dp(8);
        barra.addView(apri, lpApri);

        TextView invia = new TextView(this);
        invia.setText("↑");
        invia.setTextSize(22);
        invia.setTextColor(sopra);
        invia.setTypeface(invia.getTypeface(), Typeface.BOLD);
        invia.setGravity(Gravity.CENTER);
        invia.setBackground(forma(accento, 0, 0, 0, true));
        invia.setContentDescription("Salva in Inbox");
        LinearLayout.LayoutParams lpInvia = new LinearLayout.LayoutParams(dp(46), dp(46));
        lpInvia.leftMargin = dp(8);
        barra.addView(invia, lpInvia);
        invia.setOnClickListener(v -> salva(campo.getText().toString().trim(), false));
        // «Salva e apri»: salva la nota nell'Inbox e apre subito l'app sulla sua scheda, per configurarla
        apri.setOnClickListener(v -> salva(campo.getText().toString().trim(), true));

        setContentView(radice);
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        getWindow().setDimAmount(0.4f);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        // la barra resta sopra la tastiera e sopra i tasti di sistema
        radice.setOnApplyWindowInsetsListener((v, insets) -> {
            int sotto;
            if (Build.VERSION.SDK_INT >= 30) {
                sotto = insets.getInsets(WindowInsets.Type.ime() | WindowInsets.Type.systemBars()).bottom;
            } else {
                sotto = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(0, 0, 0, sotto);
            return insets;
        });
        campo.requestFocus();
    }
}
