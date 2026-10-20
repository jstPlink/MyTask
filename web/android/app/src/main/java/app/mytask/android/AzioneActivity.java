package app.mytask.android;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Senza schermata (tema NoDisplay): riceve il tocco su una riga del widget e si chiude subito.
 * Extra `azione` = "fatto" (con `id` della voce): spunta la riga nella coda locale (WidgetDati.fatto), senza aprire l'app.
 * Extra `azione` = "avvia", "pausa", "riprendi" o "fine": comandi della sessione «Inizia» (WidgetDati), sempre senza aprire l'app.
 * Qualsiasi altro valore, e il tocco sul messaggio «Tutto fatto per oggi»: apre l'app.
 */
public class AzioneActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = getIntent();
        String azione = i.getStringExtra("azione");
        String id = i.getStringExtra("id");
        if ("fatto".equals(azione) && id != null) {
            WidgetDati.fatto(this, id);
        } else if ("avvia".equals(azione)) {
            WidgetDati.avvia(this);
        } else if ("pausa".equals(azione)) {
            WidgetDati.pausa(this);
        } else if ("riprendi".equals(azione)) {
            WidgetDati.riprendi(this);
        } else if ("fine".equals(azione)) {
            WidgetDati.fine(this);
        } else {
            Intent apri = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (apri != null) startActivity(apri);
        }
        finish();
    }
}
