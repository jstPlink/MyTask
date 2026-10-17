package app.mytask.android;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONObject;

/** Finestrella per scrivere una nota dal widget: finisce nell'Inbox dell'app, senza aprirla. */
public class NotaRapidaActivity extends Activity {

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle b) {
        boolean scuro = getIntent().getBooleanExtra("scuro", false);
        setTheme(scuro ? android.R.style.Theme_DeviceDefault_Dialog : android.R.style.Theme_DeviceDefault_Light_Dialog);
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), dp(18), dp(20), dp(10));

        TextView titolo = new TextView(this);
        titolo.setText("Nuova nota nell\u2019Inbox");
        titolo.setTextSize(17);
        titolo.setTypeface(titolo.getTypeface(), android.graphics.Typeface.BOLD);
        col.addView(titolo);

        EditText campo = new EditText(this);
        campo.setHint("Scrivi una nota\u2026");
        campo.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        campo.setMinLines(3);
        campo.setGravity(Gravity.TOP | Gravity.START);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(10);
        col.addView(campo, lp);

        LinearLayout riga = new LinearLayout(this);
        riga.setGravity(Gravity.END);
        Button annulla = new Button(this, null, android.R.attr.borderlessButtonStyle);
        annulla.setText("Annulla");
        annulla.setOnClickListener(v -> finish());
        Button salva = new Button(this, null, android.R.attr.borderlessButtonStyle);
        salva.setText("Salva in Inbox");
        salva.setTypeface(salva.getTypeface(), android.graphics.Typeface.BOLD);
        salva.setOnClickListener(v -> {
            String testo = campo.getText().toString().trim();
            if (testo.isEmpty()) { finish(); return; }
            try {
                JSONObject a = new JSONObject();
                a.put("tipo", "nota");
                a.put("testo", testo);
                a.put("ts", System.currentTimeMillis());
                WidgetDati.accoda(this, a);
                Toast.makeText(this, "Salvata nell\u2019Inbox", Toast.LENGTH_SHORT).show();
            } catch (Exception ignored) {
            }
            finish();
        });
        riga.addView(annulla);
        riga.addView(salva);
        col.addView(riga);

        setContentView(col);
        getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        campo.requestFocus();
    }
}
