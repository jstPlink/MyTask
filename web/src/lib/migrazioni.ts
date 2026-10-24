// Migrazioni dei dati locali, eseguite all'avvio e a ogni sincronizzazione (idempotenti: dopo la prima non fanno nulla).
import type { Item } from '../../../shared/types.ts';
import { checklistInPassi, eliminaPersone, ripristinaChecklistProgetto, inboxNonAssegnata, spostaInNote } from '../../../shared/migrazioni.ts';
import { today } from '../../../shared/dates.ts';
import { getItems, saveMany } from './store.ts';
import { newId } from './util.ts';

/** Evita rientri: il salvataggio notifica gli ascoltatori, che richiamerebbero la migrazione. */
let inCorso = false;

/**
 * Sistema i dati già presenti sul dispositivo (anche quelli in arrivo dal server). Le regole sono in shared/migrazioni.ts:
 * persone e checklist (esclusa quella dei progetti) passano nelle note; la checklist di un progetto finita nelle note
 * torna nel suo campo e poi, con le altre righe di checklist di un progetto, diventa un passo vero (`checklistInPassi`); le note «Persona» della vecchia importazione vengono eliminate; le note in Inbox mai toccate create come «attività» diventano «non assegnate».
 * Restituisce quante voci ha cambiato.
 */
export function sistemaPersoneEChecklist(items: Item[] = getItems()): number {
  if (inCorso) return 0;
  const cambiate = new Map<string, Item>();
  for (const i of items) {
    const x = eliminaPersone(i) ?? spostaInNote(i) ?? ripristinaChecklistProgetto(i, newId) ?? inboxNonAssegnata(i);
    if (x) cambiate.set(i.id, x);
  }
  // le righe della checklist di un progetto diventano passi veri (note con il progetto come padre)
  const correnti = items.map((i) => cambiate.get(i.id) ?? i);
  const adesso = Date.now();
  for (const p of correnti) {
    const passi = p.tipo === 'progetto' && (p.checklist?.length ?? 0) > 0 ? checklistInPassi(p, correnti, newId, today(), adesso) : undefined;
    for (const v of passi ?? []) cambiate.set(v.id, v);
  }
  const aggiornate = [...cambiate.values()];
  if (!aggiornate.length) return 0;
  inCorso = true;
  try { saveMany(aggiornate); } finally { inCorso = false; }
  return aggiornate.length;
}
