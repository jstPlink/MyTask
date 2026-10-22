package app.mytask.android;

import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Tiene lo schermo sempre acceso mentre una nota è «in corso» a tutto schermo (flag della finestra, nessun permesso necessario). */
@CapacitorPlugin(name = "Schermo")
public class SchermoPlugin extends Plugin {

    @PluginMethod
    public void acceso(PluginCall call) {
        final boolean acceso = Boolean.TRUE.equals(call.getBoolean("acceso", false));
        getActivity().runOnUiThread(() -> {
            Window finestra = getActivity().getWindow();
            if (acceso) finestra.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else finestra.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }
}
