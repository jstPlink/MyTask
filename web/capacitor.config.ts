// Configurazione di Capacitor: l'app Android è il contenuto di `dist` (build del sito) dentro un WebView.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mytask.android',
  appName: 'MyTask',
  webDir: 'dist',
  server: {
    // l'app web gira da https://localhost dentro l'app: serve l'origine esatta per il CORS del server
    androidScheme: 'https',
  },
  plugins: {
    // icona e colore delle notifiche locali (l'icona è una risorsa Android, ic_stat_mytask)
    LocalNotifications: {
      smallIcon: 'ic_stat_mytask',
      iconColor: '#2F7D5B',
    },
  },
};

export default config;
