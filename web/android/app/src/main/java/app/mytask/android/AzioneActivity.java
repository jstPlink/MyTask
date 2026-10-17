package app.mytask.android;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Senza schermata: gestisce il tocco su una riga del widget (spunta, oppure apre l'app) e si chiude subito. */
public class AzioneActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent i = getIntent();
        String azione = i.getStringExtra("azione");
        String id = i.getStringExtra("id");
        if ("fatto".equals(azione) && id != null) {
            WidgetDati.fatto(this, id);
        } else {
            Intent apri = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (apri != null) startActivity(apri);
        }
        finish();
    }
}
