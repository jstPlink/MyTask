package app.mytask.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * Widget «Oggi» della schermata Home, 4x3 e ridimensionabile: in cima il pulsante «Sto lavorando» (o, a sessione aperta, il
 * cronometro con «Fine» e pausa), sotto la lista delle cose da fare di oggi in ordine di priorità e, in basso a destra, il
 * pulsante + che apre la nota veloce (NotaRapidaActivity). Le sottoclassi
 * MyTaskWidgetChiaro e MyTaskWidgetScuro scelgono solo l'aspetto (layout widget_chiaro o widget_scuro).
 * Le righe arrivano da WidgetService; i tocchi sulle righe passano da AzioneActivity.
 */
public abstract class WidgetBase extends AppWidgetProvider {

    /** true per l'aspetto scuro. */
    abstract boolean scuro();

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, costruisci(c, id));
        m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
    }

    /** PendingIntent di un comando della sessione (AzioneActivity); `n` rende unico il codice di richiesta. */
    private static PendingIntent comando(Context c, int n, String azione) {
        Intent i = new Intent(c, AzioneActivity.class).putExtra("azione", azione);
        return PendingIntent.getActivity(c, n, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Intestazione: senza sessione il pulsante «Sto lavorando»; con la sessione la barra con il cronometro nativo
     * (Chronometer, avanza da solo), il titolo del task, «Fine» e il pulsante pausa/riprendi (giallo se in pausa).
     */
    private void intestazione(Context c, RemoteViews v, boolean s, int k) {
        JSONObject l = WidgetDati.lavoro(c);
        boolean attiva = l != null;
        v.setViewVisibility(R.id.avvia, attiva ? android.view.View.GONE : android.view.View.VISIBLE);
        v.setViewVisibility(R.id.crono_barra, attiva ? android.view.View.VISIBLE : android.view.View.GONE);
        v.setOnClickPendingIntent(R.id.avvia, comando(c, 40 + k, "avvia"));
        if (!attiva) return;
        boolean pausa = "pausa".equals(l.optString("stato"));
        long trascorso = WidgetDati.trascorso(l, System.currentTimeMillis());
        v.setChronometer(R.id.crono, SystemClock.elapsedRealtime() - trascorso, null, !pausa);
        v.setTextViewText(R.id.crono_titolo, (pausa ? "In pausa · " : "") + l.optString("t"));
        v.setTextViewText(R.id.crono_pausa, pausa ? "▶" : "⏸");
        v.setInt(R.id.crono_barra, "setBackgroundResource", pausa ? (s ? R.drawable.crono_pausa_bg_s : R.drawable.crono_pausa_bg_c) : (s ? R.drawable.crono_bg_s : R.drawable.crono_bg_c));
        v.setInt(R.id.crono_pausa, "setBackgroundResource", pausa ? R.drawable.pl_bg_ambra : (s ? R.drawable.piu_bg_s : R.drawable.pl_bg_bianco));
        v.setTextColor(R.id.crono_pausa, pausa ? 0xFFFFFFFF : (s ? 0xFF0E0F12 : 0xFF111115));
        int testo = pausa ? (s ? 0xFFF3F3F6 : 0xFF111115) : (s ? 0xFFF3F3F6 : 0xFFF1F0EC);
        v.setTextColor(R.id.crono, pausa ? (s ? 0xFFF0B866 : 0xFFB7791F) : testo);
        v.setTextColor(R.id.crono_titolo, pausa ? (s ? 0xFFD8C9A8 : 0xFF65656E) : 0xFFBDBDC4);
        v.setOnClickPendingIntent(R.id.crono_pausa, comando(c, 42 + k, pausa ? "riprendi" : "pausa"));
        v.setOnClickPendingIntent(R.id.crono_fine, comando(c, 44 + k, "fine"));
    }

    private RemoteViews costruisci(Context c, int id) {
        boolean s = scuro();
        int k = s ? 1 : 0; // codice di richiesta distinto per chiaro e scuro: i PendingIntent dei due widget non si sovrascrivono
        RemoteViews v = new RemoteViews(c.getPackageName(), s ? R.layout.widget_scuro : R.layout.widget_chiaro);

        // lista: l'indirizzo dell'intento è reso unico per widget, altrimenti Android riuserebbe la stessa fabbrica di righe
        Intent servizio = new Intent(c, WidgetService.class);
        servizio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        servizio.putExtra("scuro", s);
        servizio.setData(Uri.parse(servizio.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.lista, servizio);
        v.setEmptyView(R.id.lista, R.id.vuoto);

        // pulsante +: nota veloce, con i colori del widget
        Intent nota = new Intent(c, NotaRapidaActivity.class).putExtra("scuro", s);
        v.setOnClickPendingIntent(R.id.nota, PendingIntent.getActivity(c, k, nota, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        intestazione(c, v, s, k);

        // tocco su una riga: il modello (mutabile) viene completato da ogni riga con "fatto" + id (checkbox) oppure "apri"
        // (resto della riga); tocco sul messaggio «Tutto fatto per oggi»: apre l'app
        Intent azione = new Intent(c, AzioneActivity.class);
        v.setPendingIntentTemplate(R.id.lista, PendingIntent.getActivity(c, 10 + k, azione, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        Intent apri = new Intent(c, AzioneActivity.class).putExtra("azione", "apri");
        v.setOnClickPendingIntent(R.id.vuoto, PendingIntent.getActivity(c, 20 + k, apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }
}
