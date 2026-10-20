import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { App } from './App.tsx';
import { initStore, subscribe } from './lib/store.ts';
import { avviaSync } from './lib/sync.ts';
import { avviaTema } from './lib/theme.ts';
import { avviaPromemoria } from './lib/reminders.ts';
import { avviaNotificheNative, isNative } from './lib/native.ts';
import { avviaWidget } from './lib/widget.ts';
import { avviaSessione } from './lib/sessione.ts';
import { avviaAggiornamento } from './lib/aggiornamento.ts';
import { avviaHaptic } from './lib/haptic.ts';
import { avviaPesi } from './lib/pesi.ts';
import { sistemaPersoneEChecklist } from './lib/migrazioni.ts';
import { avviaArricchimento } from './lib/arricchimento.ts';

// Punto d'ingresso. Tema, pesi della priorità e aptica non dipendono dai dati: partono subito, prima del disegno.
avviaTema();
avviaPesi();
avviaHaptic();

/** Carica l'archivio locale, mostra l'app e avvia i servizi in background (diversi per app Android e sito). */
async function avvia() {
  await initStore();
  sistemaPersoneEChecklist();
  // anche per le voci che arrivano dopo, con la sincronizzazione (idempotente: dopo la prima passata non fa nulla)
  subscribe(() => { sistemaPersoneEChecklist(); });
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
  avviaSync();
  avviaSessione();
  avviaArricchimento();
  if (isNative()) {
    // app Android: notifiche pianificate dal sistema e widget della Home; l'APK contiene già i file, niente service worker
    avviaNotificheNative();
    avviaWidget();
  } else {
    // sito: promemoria con l'API Notification (finché la pagina è aperta) e service worker per l'uso offline e l'installazione
    avviaPromemoria();
    registerSW({ immediate: true });
    avviaAggiornamento();
  }
}

void avvia();
