package app.mytask.android;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin Capacitor «Widget»: ponte tra la web app e i widget della schermata Home (lato JavaScript: web/src/lib/widget.ts).
 * L'app scrive la lista di oggi con `aggiorna` e legge-svuotando le azioni fatte dal widget con `coda`.
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    /**
     * Salva la lista di oggi (`righe`, testo JSON) e, se presente, l'archivio compatto delle note per la ricerca delle
     * note simili (`archivio`) e, se presente, la sessione «Inizia» (`lavoro`, testo JSON; vuoto = nessuna sessione),
     * poi chiede ai widget di ridisegnarsi.
     */
    @PluginMethod
    public void aggiorna(PluginCall call) {
        String righe = call.getString("righe", "[]");
        String archivio = call.getString("archivio");
        if (archivio != null) WidgetDati.salvaArchivio(getContext(), archivio);
        if (call.hasOption("lavoro")) WidgetDati.salvaLavoro(getContext(), call.getString("lavoro", ""));
        WidgetDati.salvaRighe(getContext(), righe);
        call.resolve();
    }

    /** Restituisce, svuotandole, le azioni fatte dal widget da quando l'app le ha lette l'ultima volta: nuove note, spunte e comandi della sessione. */
    @PluginMethod
    public void coda(PluginCall call) {
        JSObject out = new JSObject();
        try {
            out.put("azioni", new JSArray(WidgetDati.svuotaCoda(getContext()).toString()));
        } catch (Exception e) {
            out.put("azioni", new JSArray());
        }
        call.resolve(out);
    }
}
