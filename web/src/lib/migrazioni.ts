// Migrazioni dei dati locali, eseguite all'avvio (sono idempotenti: dopo la prima non fanno nulla).
import type { Item } from '../../../shared/types.ts';
import { getItems, saveMany } from './store.ts';

let inCorso = false;

/** Persone e checklist non si modificano più dall'app: se una voce li ha, passano nelle note. */
export function spostaPersoneEChecklistInNote(items: Item[] = getItems()): number {
  if (inCorso) return 0; // il salvataggio notifica gli ascoltatori: niente rientri
  const daSpostare = items.filter((i) => !i.eliminato && ((i.persone?.length ?? 0) > 0 || (i.checklist?.length ?? 0) > 0));
  const aggiornate = daSpostare.map((i) => {
    const pezzi: string[] = [];
    if (i.persone?.length) pezzi.push(`Persone: ${i.persone.join(', ')}`);
    if (i.checklist?.length) pezzi.push(`Checklist:\n${i.checklist.map((c) => `- [${c.fatto ? 'x' : ' '}] ${c.testo}`).join('\n')}`);
    const note = [i.note?.trim(), pezzi.join('\n\n')].filter(Boolean).join('\n\n');
    return { ...i, note, persone: undefined, checklist: undefined };
  });
  if (!aggiornate.length) return 0;
  inCorso = true;
  try { saveMany(aggiornate); } finally { inCorso = false; }
  return aggiornate.length;
}
