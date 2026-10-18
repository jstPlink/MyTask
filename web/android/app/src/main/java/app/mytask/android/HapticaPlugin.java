package app.mytask.android;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Feedback aptico con durata e ampiezza scelte da noi (il plugin standard ha solo intensità fisse). */
@CapacitorPlugin(name = "Haptica")
public class HapticaPlugin extends Plugin {

    private Vibrator vibrator;

    /** Dalla versione S di Android il vibratore si ottiene dal VibratorManager, prima dal servizio diretto. */
    @Override
    public void load() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = manager.getDefaultVibrator();
        } else {
            vibrator = getVibratorPreS(context);
        }
    }

    @SuppressWarnings("deprecation")
    private Vibrator getVibratorPreS(Context context) {
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    /** Una vibrazione singola: `durata` in millisecondi, `ampiezza` da 1 a 255 (valori di default come un tocco leggero). */
    @PluginMethod
    public void tocco(PluginCall call) {
        int durata = call.getInt("durata", 40);
        int ampiezza = call.getInt("ampiezza", 77);
        if (vibrator != null && vibrator.hasVibrator()) {
            vibrator.vibrate(VibrationEffect.createOneShot(Math.max(1, durata), Math.max(1, Math.min(255, ampiezza))));
        }
        call.resolve();
    }
}
