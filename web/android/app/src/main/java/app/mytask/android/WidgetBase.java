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
 * Widget «Oggi» della schermata Home, 4x3 e ridimensionabile: in cima il blocco del cronometro (come in Priorità: stato, timer grande, ▶/⏸ e ■, barra), sotto la
 * lista scorrevole delle attività di oggi in ordine di priorità e delle curiosità e, in basso a destra, il pulsante + che apre
 * la nota veloce (NotaRapidaActivity). Le sottoclassi
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
     * Blocco del cronometro, sempre della stessa altezza: senza nota in corso solo «Nessuna nota in corso» (timer, tasti e barra invisibili al loro posto); con una nota «In corso», il timer
     * grande (Chronometer nativo, avanza da solo; grigio se fermo, verde se corre), il tasto ▶/⏸ e ■ (▶/⏸ solo con una nota in
     * corso; ■ solo a sessione aperta) e la barra del tempo sul previsto, senza scritte. Il bordo è verde mentre corre.
     * La barra si ridisegna a ogni aggiornamento del widget.
     */
    private void intestazione(Context c, RemoteViews v, boolean s, int k) {
        JSONObject l = WidgetDati.lavoro(c);
        JSONObject nota = WidgetDati.notaBlocco(c);
        boolean ce = nota != null;
        boolean corre = ce && l != null && "lavoro".equals(l.optString("stato"));
        boolean pausa = ce && l != null && "pausa".equals(l.optString("stato"));
        int sfondo = !ce ? (s ? R.drawable.blocco_vuoto_s : R.drawable.blocco_vuoto_c) : corre ? (s ? R.drawable.blocco_corre_s : R.drawable.blocco_corre_c) : (s ? R.drawable.blocco_fermo_s : R.drawable.blocco_fermo_c);
        v.setInt(R.id.blocco, "setBackgroundResource", sfondo);
        v.setTextViewText(R.id.blk_e, c.getString(ce ? R.string.widget_in_corso : R.string.widget_nessuna));
        int verde = s ? 0xFF6FCF9B : 0xFF2F7D5B;
        int grigio = s ? 0xFF72737D : 0xFF919199;
        v.setTextColor(R.id.blk_e, corre ? verde : grigio);
        v.setTextColor(R.id.blk_tm, corre ? verde : grigio);
        // senza nota in corso si vede solo lo stato, ma timer, tasto e barra restano invisibili al loro posto: il blocco ha sempre la stessa altezza
        int mostra = ce ? android.view.View.VISIBLE : android.view.View.INVISIBLE;
        v.setViewVisibility(R.id.blk_pl, mostra);
        v.setViewVisibility(R.id.blk_tm, mostra);
        v.setViewVisibility(R.id.blk_barra, mostra);
        v.setViewVisibility(R.id.blk_st, l != null ? android.view.View.VISIBLE : android.view.View.GONE);

        long trascorso = !ce ? 0 : l != null ? WidgetDati.trascorso(l, System.currentTimeMillis()) : nota.optLong("w", 0);
        long previsto = ce ? nota.optLong("p", 0) : 0; // minuti (0 = nessuna stima)
        v.setChronometer(R.id.blk_tm, SystemClock.elapsedRealtime() - trascorso, null, corre);
        v.setProgressBar(R.id.blk_barra, 1000, previsto > 0 ? (int) Math.min(1000, trascorso * 1000 / (previsto * 60_000)) : 0, false);
        v.setOnClickPendingIntent(R.id.blk_sx, comando(c, 44 + k, "apri"));
        if (!ce) return;
        v.setTextViewText(R.id.blk_pl, corre ? "❚❚" : "▶︎"); // glifi di testo (non emoji): prendono il colore del testo
        v.setOnClickPendingIntent(R.id.blk_pl, comando(c, 42 + k, corre ? "pausa" : pausa ? "riprendi" : "avvia"));
        v.setOnClickPendingIntent(R.id.blk_st, comando(c, 46 + k, "fine"));
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
