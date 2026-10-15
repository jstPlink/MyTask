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
import { avviaHaptic } from './lib/haptic.ts';
import { spostaPersoneEChecklistInNote } from './lib/migrazioni.ts';

avviaTema();
avviaHaptic();

async function avvia() {
  await initStore();
  spostaPersoneEChecklistInNote();
  // anche per le voci che arrivano dopo, con la sincronizzazione (idempotente: dopo la prima passata non fa nulla)
  subscribe(() => { spostaPersoneEChecklistInNote(); });
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
  avviaSync();
  if (isNative()) {
    avviaNotificheNative();
  } else {
    avviaPromemoria();
    registerSW({ immediate: true });
  }
}

void avvia();
