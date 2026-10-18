package app.mytask.android;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte tra l'app e i widget della schermata Home. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    /** Salva la lista di oggi (testo JSON) e aggiorna i widget. */
    @PluginMethod
    public void aggiorna(PluginCall call) {
        String righe = call.getString("righe", "[]");
        String archivio = call.getString("archivio");
        if (archivio != null) WidgetDati.salvaArchivio(getContext(), archivio);
        WidgetDati.salvaRighe(getContext(), righe);
        call.resolve();
    }

    /** Restituisce, svuotandole, le azioni fatte dal widget da quando l'app è stata aperta l'ultima volta. */
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
