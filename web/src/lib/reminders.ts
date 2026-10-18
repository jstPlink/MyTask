// Promemoria locali del sito (API Notification): funzionano finché la pagina è aperta, con un controllo ogni 30 secondi.
// Nell'app Android non si usano: lì le notifiche le pianifica il sistema operativo (native.ts).
import type { Item } from '../../../shared/types.ts';
import { addDays, diffDays, today } from '../../../shared/dates.ts';
import { dueDate, isOpen } from '../../../shared/priority.ts';
import { fattaOggi } from '../../../shared/routine.ts';
import { getItems } from './store.ts';

/** Promemoria già mostrati (chiave -> momento), per non ripeterli; le voci più vecchie di 3 giorni si scartano. */
const KEY = 'mytask.notificati';

function letti(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function scrivi(m: Record<string, number>) {
  try {
    const limite = Date.now() - 3 * 86400000;
    for (const k of Object.keys(m)) if (m[k] < limite) delete m[k];
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch { /* ignora */ }
}

const oggiMinuti = (d: Date) => d.getHours() * 60 + d.getMinutes();
const aMinuti = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Un promemoria da mostrare; `chiave` lo identifica per non ripeterlo. */
interface Promemoria { chiave: string; titolo: string; corpo: string }

/**
 * Calcola i promemoria da mostrare adesso: routine con ora (se non fatta oggi), promemoria «N giorni prima» delle voci
 * con scadenza e, per le voci con «insisti», un richiamo ripetuto finché non sono spuntate. Funzione pura.
 */
function promemoriaDovuti(items: Item[], now: Date, notificati: Record<string, number>): Promemoria[] {
  const giorno = today(now);
  const min = oggiMinuti(now);
  const out: Promemoria[] = [];
  for (const i of items) {
    if (i.eliminato || !isOpen(i)) continue;
    const due = dueDate(i);
    if (i.tipo === 'routine') {
      if (i.oraPromemoria && i.stato !== 'parcheggiato' && min >= aMinuti(i.oraPromemoria) && !fattaOggi(i, giorno)) {
        const chiave = `${i.id}|routine|${giorno}`;
        if (!notificati[chiave]) out.push({ chiave, titolo: i.titolo, corpo: i.obiettivo ?? 'Routine di oggi' });
      }
      continue;
    }
    if (!due) continue;
    for (const p of i.promemoria ?? []) {
      const giornoPromemoria = addDays(due, -p.giorniPrima);
      const scattato = giorno > giornoPromemoria || (giorno === giornoPromemoria && min >= aMinuti(p.ora));
      if (!scattato || diffDays(due, giorno) < 0) continue;
      const chiave = `${i.id}|${p.giorniPrima}|${due}`;
      if (!notificati[chiave]) out.push({ chiave, titolo: i.titolo, corpo: p.giorniPrima === 0 ? 'Scade oggi' : `Scade tra ${p.giorniPrima} giorni` });
    }
    // insistenza: ripete finché la voce non viene spuntata
    if (i.insisti && diffDays(due, giorno) <= 0) {
      const chiave = `${i.id}|insisti`;
      const ultimo = notificati[chiave] ?? 0;
      if (now.getTime() - ultimo >= i.insisti.ogniMinuti * 60000) out.push({ chiave, titolo: i.titolo, corpo: 'Ancora da fare' });
    }
  }
  return out;
}

/** Permesso di notifica del browser. */
function permessoNotifiche(): NotificationPermission | 'non_supportate' {
  return typeof Notification === 'undefined' ? 'non_supportate' : Notification.permission;
}

/** Mostra la notifica tramite il service worker (funziona anche su telefono), altrimenti direttamente. */
async function mostra(p: Promemoria) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(p.titolo, { body: p.corpo, tag: p.chiave, icon: '/icon.svg' });
    else new Notification(p.titolo, { body: p.corpo, tag: p.chiave, icon: '/icon.svg' });
  } catch { /* ignora */ }
}

/** Avvia il controllo periodico dei promemoria (solo se il permesso è già stato concesso). */
export function avviaPromemoria() {
  const controlla = () => {
    if (permessoNotifiche() !== 'granted') return;
    const m = letti();
    const dovuti = promemoriaDovuti(getItems(), new Date(), m);
    for (const p of dovuti) { void mostra(p); m[p.chiave] = Date.now(); }
    if (dovuti.length) scrivi(m);
  };
  setInterval(controlla, 30_000);
  controlla();
}
