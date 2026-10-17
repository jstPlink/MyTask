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
import { avviaHaptic } from './lib/haptic.ts';
import { sistemaPersoneEChecklist } from './lib/migrazioni.ts';
import { avviaArricchimento } from './lib/arricchimento.ts';

avviaTema();
avviaHaptic();

async function avvia() {
  await initStore();
  sistemaPersoneEChecklist();
  // anche per le voci che arrivano dopo, con la sincronizzazione (idempotente: dopo la prima passata non fa nulla)
  subscribe(() => { sistemaPersoneEChecklist(); });
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
  avviaSync();
  avviaArricchimento();
  if (isNative()) {
    avviaNotificheNative();
    avviaWidget();
  } else {
    avviaPromemoria();
    registerSW({ immediate: true });
  }
}

void avvia();
