package app.mytask.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

/** Widget "Oggi": campo per una nota veloce in Inbox e lista delle cose da fare. Due aspetti: chiaro e scuro. */
public abstract class WidgetBase extends AppWidgetProvider {

    abstract boolean scuro();

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, costruisci(c, id));
        m.notifyAppWidgetViewDataChanged(ids, R.id.lista);
    }

    private RemoteViews costruisci(Context c, int id) {
        boolean s = scuro();
        int k = s ? 1 : 0;
        RemoteViews v = new RemoteViews(c.getPackageName(), s ? R.layout.widget_scuro : R.layout.widget_chiaro);

        Intent servizio = new Intent(c, WidgetService.class);
        servizio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        servizio.putExtra("scuro", s);
        servizio.setData(Uri.parse(servizio.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.lista, servizio);
        v.setEmptyView(R.id.lista, R.id.vuoto);

        Intent nota = new Intent(c, NotaRapidaActivity.class).putExtra("scuro", s);
        v.setOnClickPendingIntent(R.id.nota, PendingIntent.getActivity(c, k, nota, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        // tocco su una riga: la spunta o apre l'app (decide l'intento della singola riga)
        Intent azione = new Intent(c, AzioneActivity.class);
        v.setPendingIntentTemplate(R.id.lista, PendingIntent.getActivity(c, 10 + k, azione, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE));
        Intent apri = new Intent(c, AzioneActivity.class).putExtra("azione", "apri");
        v.setOnClickPendingIntent(R.id.vuoto, PendingIntent.getActivity(c, 20 + k, apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }
}
