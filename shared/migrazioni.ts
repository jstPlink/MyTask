// Migrazioni dei dati: funzioni pure (stesso input, stesso output), usate all'avvio dell'app.
import type { Item, VoceChecklist } from './types.ts';
import { isOpen } from './priority.ts';

const BLOCCO_CHECKLIST = /(?:^|\n\n)Checklist:\n((?:- \[[ xX]\] .*(?:\n|$))+)/;

/**
 * Persone e checklist non si modificano più dall'app, tranne la checklist dei progetti:
 * negli altri tipi, se la voce li ha, passano nelle note e i campi si svuotano.
 */
export function spostaInNote(i: Item): Item | undefined {
  const persone = (i.persone?.length ?? 0) > 0;
  const checklist = i.tipo !== 'progetto' && (i.checklist?.length ?? 0) > 0;
  if (i.eliminato || (!persone && !checklist)) return undefined;
  const pezzi: string[] = [];
  if (persone) pezzi.push(`Persone: ${i.persone!.join(', ')}`);
  if (checklist) pezzi.push(`Checklist:\n${i.checklist!.map((c) => `- [${c.fatto ? 'x' : ' '}] ${c.testo}`).join('\n')}`);
  const note = [i.note?.trim(), pezzi.join('\n\n')].filter(Boolean).join('\n\n');
  return { ...i, note, persone: undefined, checklist: checklist ? undefined : i.checklist };
}

/**
 * I progetti tornano ad avere la checklist: se una checklist era già finita nelle note
 * (blocco "Checklist:" con righe "- [ ] testo"), la rimette nel campo e toglie il blocco dalle note.
 */
export function ripristinaChecklistProgetto(i: Item, nuovoId: () => string): Item | undefined {
  if (i.tipo !== 'progetto' || i.eliminato || (i.checklist?.length ?? 0) > 0 || !i.note) return undefined;
  const m = BLOCCO_CHECKLIST.exec(i.note);
  if (!m) return undefined;
  const voci: VoceChecklist[] = m[1].split('\n').filter(Boolean).map((r) => {
    const x = /^- \[([ xX])\] (.*)$/.exec(r)!;
    return { id: nuovoId(), testo: x[2].trim(), fatto: x[1].toLowerCase() === 'x' };
  });
  const note = i.note.replace(BLOCCO_CHECKLIST, '').trim();
  return { ...i, checklist: voci, note: note || undefined };
}

/** Le voci create dall'importazione di Notion hanno un identificativo di 13 caratteri ("n" + 12 cifre esadecimali). */
export const èImportata = (i: Item) => /^n[0-9a-f]{12}$/.test(i.id);

/**
 * Attività e progetti importati da Notion e mai toccati dall'importazione in poi (data di modifica uguale a quella di creazione)
 * vanno in Revisione. Il salvataggio cambia la data di modifica, quindi la regola scatta una sola volta per voce.
 */
export function segnaImportataDaRivedere(i: Item): Item | undefined {
  if (!èImportata(i) || (i.tipo !== 'azione' && i.tipo !== 'progetto')) return undefined;
  if (!isOpen(i) || i.stato === 'parcheggiato' || i.inbox || i.daRivedere || i.aggiornato !== i.creato) return undefined;
  return { ...i, daRivedere: true };
}
