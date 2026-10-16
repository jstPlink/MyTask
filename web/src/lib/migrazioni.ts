// Migrazioni dei dati locali, eseguite all'avvio e a ogni sincronizzazione (idempotenti: dopo la prima non fanno nulla).
import type { Item } from '../../../shared/types.ts';
import { ripristinaChecklistProgetto, segnaImportataDaRivedere, spostaInNote } from '../../../shared/migrazioni.ts';
import { getItems, saveMany } from './store.ts';
import { newId } from './util.ts';

let inCorso = false;

/**
 * Persone e checklist non si modificano più dall'app (tranne la checklist dei progetti): le voci che li hanno
 * li vedono spostati nelle note; i progetti con una checklist già finita nelle note ritrovano la checklist nel campo.
 */
export function sistemaPersoneEChecklist(items: Item[] = getItems()): number {
  if (inCorso) return 0; // il salvataggio notifica gli ascoltatori: niente rientri
  const aggiornate: Item[] = [];
  for (const i of items) {
    const x = spostaInNote(i) ?? ripristinaChecklistProgetto(i, newId) ?? segnaImportataDaRivedere(i);
    if (x) aggiornate.push(x);
  }
  if (!aggiornate.length) return 0;
  inCorso = true;
  try { saveMany(aggiornate); } finally { inCorso = false; }
  return aggiornate.length;
}
