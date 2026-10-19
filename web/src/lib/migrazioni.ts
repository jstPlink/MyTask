// Migrazioni dei dati locali, eseguite all'avvio e a ogni sincronizzazione (idempotenti: dopo la prima non fanno nulla).
import type { Item } from '../../../shared/types.ts';
import { eliminaPersone, ripristinaChecklistProgetto, inboxNonAssegnata, spostaInNote } from '../../../shared/migrazioni.ts';
import { getItems, saveMany } from './store.ts';
import { newId } from './util.ts';

/** Evita rientri: il salvataggio notifica gli ascoltatori, che richiamerebbero la migrazione. */
let inCorso = false;

/**
 * Sistema i dati già presenti sul dispositivo (anche quelli in arrivo dal server). Le regole sono in shared/migrazioni.ts:
 * persone e checklist (esclusa quella dei progetti) passano nelle note; la checklist di un progetto finita nelle note
 * torna nel suo campo; le note «Persona» della vecchia importazione vengono eliminate; le note in Inbox mai toccate create come «attività» diventano «non assegnate».
 * Restituisce quante voci ha cambiato.
 */
export function sistemaPersoneEChecklist(items: Item[] = getItems()): number {
  if (inCorso) return 0;
  const aggiornate: Item[] = [];
  for (const i of items) {
    const x = eliminaPersone(i) ?? spostaInNote(i) ?? ripristinaChecklistProgetto(i, newId) ?? inboxNonAssegnata(i);
    if (x) aggiornate.push(x);
  }
  if (!aggiornate.length) return 0;
  inCorso = true;
  try { saveMany(aggiornate); } finally { inCorso = false; }
  return aggiornate.length;
}
