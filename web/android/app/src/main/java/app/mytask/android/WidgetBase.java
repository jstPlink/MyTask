package app.mytask.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * Widget «Oggi» della schermata Home, 4x3 e ridimensionabile: la lista scorrevole delle attività di oggi in ordine di priorità e delle
 * curiosità e, in basso a destra, il pulsante + che apre la nota veloce (NotaRapidaActivity). Niente barra in alto. Un tocco su qualsiasi
 * altra parte (righe, caselle, intestazioni di sezione, messaggio a lista vuota, sfondo) apre l'app sulla pagina Priorità (AzioneActivity).
 * Le sottoclassi MyTaskWidgetChiaro e MyTaskWidgetScuro scelgono solo l'aspetto (layout widget_chiaro o widget_scuro).
 * Le righe arrivano da WidgetService.
 */
public abstract class WidgetBase extends AppWidgetProvider {

    /** true per l'aspetto scuro. */
    abstract boolean scuro();

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, costruisci(c, id));
        m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
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

        // tocco su una riga: il modello (mutabile) viene completato da ogni riga con "fatto" + id (checkbox) oppure "apri"
        // (resto della riga); tocco sul messaggio «Tutto fatto per oggi»: apre l'app
        Intent azione = new Intent(c, AzioneActivity.class);
        v.setPendingIntentTemplate(R.id.lista, PendingIntent.getActivity(c, 10 + k, azione, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        Intent apri = new Intent(c, AzioneActivity.class).putExtra("azione", "apri");
        PendingIntent apriApp = PendingIntent.getActivity(c, 20 + k, apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.vuoto, apriApp);
        v.setOnClickPendingIntent(R.id.radice, apriApp); // sfondo e margini del widget
        return v;
    }
}
