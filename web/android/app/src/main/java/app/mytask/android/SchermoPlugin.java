package app.mytask.android;

import android.app.Activity;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiene lo schermo sempre acceso mentre una nota è «in corso» a tutto schermo. Due segnali insieme, per essere sicuri: il flag
 * FLAG_KEEP_SCREEN_ON della finestra e `keepScreenOn` della WebView (nessun permesso necessario). L'app lo richiede di nuovo ogni
 * pochi secondi finché la schermata è aperta e il plugin lo riapplica quando l'app torna in primo piano. In logcat (tag
 * «MyTaskSchermo») resta traccia di ogni cambio.
 */
@CapacitorPlugin(name = "Schermo")
public class SchermoPlugin extends Plugin {

    private static final String TAG = "MyTaskSchermo";
    /** Ultimo stato richiesto dall'app. */
    private boolean voluto = false;
    /** True se le barre di sistema devono restare nascoste (modalità immersiva). */
    private boolean immersivo = false;

    @PluginMethod
    public void acceso(PluginCall call) {
        voluto = Boolean.TRUE.equals(call.getBoolean("acceso", false));
        applica(voluto);
        call.resolve();
    }

    private void applica(final boolean acceso) {
        final Activity attivita = getActivity();
        if (attivita == null) {
            Log.w(TAG, "nessuna activity: schermo acceso=" + acceso + " non applicato");
            return;
        }
        attivita.runOnUiThread(() -> {
            Window finestra = attivita.getWindow();
            if (acceso) finestra.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else finestra.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            View web = getBridge() != null ? getBridge().getWebView() : null;
            if (web != null) web.setKeepScreenOn(acceso);
            Log.i(TAG, "schermo sempre acceso=" + acceso);
        });
    }

    /**
     * Nasconde (o rimostra) la barra di stato e i gesti di sistema: restano solo il foro della fotocamera e lo schermo. Scorrendo dal bordo le barre
     * ricompaiono per un attimo e poi si nascondono da sole. Serve alla schermata «in corso» quando restano solo timer e barra.
     */
    @PluginMethod
    public void immersivo(PluginCall call) {
        immersivo = Boolean.TRUE.equals(call.getBoolean("attivo", false));
        applicaImmersivo(immersivo);
        call.resolve();
    }

    private void applicaImmersivo(final boolean attivo) {
        final Activity attivita = getActivity();
        if (attivita == null) return;
        attivita.runOnUiThread(() -> {
            Window finestra = attivita.getWindow();
            WindowInsetsControllerCompat controllo = WindowCompat.getInsetsController(finestra, finestra.getDecorView());
            if (attivo) {
                controllo.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controllo.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                controllo.show(WindowInsetsCompat.Type.systemBars());
            }
            Log.i(TAG, "barre di sistema nascoste=" + attivo);
        });
    }

    /** Quando l'app torna in primo piano riapplica lo stato richiesto (Android può togliere i flag della finestra). */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (voluto) applica(true);
        if (immersivo) applicaImmersivo(true);
    }
}
