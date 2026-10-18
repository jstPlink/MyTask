package app.mytask.android;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Activity principale: ospita la web app dentro la WebView di Capacitor. Registra i due plugin nativi dell'app
 * (vanno registrati prima di super.onCreate, che avvia il ponte): Haptica per la vibrazione e Widget per lo scambio
 * dati con i widget della schermata Home.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HapticaPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
