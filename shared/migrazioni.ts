// Migrazioni dei dati già salvati: funzioni pure (stesso input, stesso output) che l'app applica a ogni voce all'avvio
// (web/src/lib/migrazioni.ts). Ognuna restituisce la voce corretta, oppure undefined se non c'è nulla da cambiare.
import type { Item, VoceChecklist } from './types.ts';
import { figli } from './views.ts';

const BLOCCO_CHECKLIST = /(?:^|\n\n)Checklist:\n((?:- \[[ xX]\] .*(?:\n|$))+)/;

/**
 * L'app non gestisce più il campo `persone` né le checklist, tranne quella dei progetti: se una voce li ha ancora,
 * passano nelle note ("Persone: …", blocco "Checklist:") e i campi si svuotano, così non si perde nulla.
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
 * La checklist dei progetti è un campo vero: se per errore era finita nelle note (blocco "Checklist:" con righe
 * "- [ ] testo", per effetto di `spostaInNote`), la rimette nel campo e toglie il blocco dalle note.
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

/**
 * Le note in Inbox mai modificate (`aggiornato` uguale a `creato`) e create come «attività» senza che l'utente
 * l'abbia scelto diventano «non assegnate»: il tipo lo sceglie l'utente quando le smista.
 */
export function inboxNonAssegnata(i: Item): Item | undefined {
  if (!i.inbox || i.tipo !== 'azione' || i.aggiornato !== i.creato || i.eliminato) return undefined;
  return { ...i, tipo: 'nota' };
}

/**
 * Le persone non esistono più nell'app: le note di tipo `persona` rimaste dalla vecchia importazione (contatti) vengono
 * eliminate con una cancellazione logica, che arriva anche agli altri dispositivi e al server.
 */
export function eliminaPersone(i: Item): Item | undefined {
  return i.tipo === 'persona' && !i.eliminato ? { ...i, eliminato: true } : undefined;
}

/**
 * Le righe della checklist di un progetto non erano vere note (non si aprivano né avevano priorità): diventano **passi veri**, cioè note di
 * tipo attività che hanno il progetto come padre, nello stesso ordine in cui si vedevano (prima le righe della checklist, poi i passi già
 * presenti). Una riga spuntata diventa un passo fatto. Il progetto resta senza checklist, quindi la conversione non si ripete.
 * Restituisce le voci da salvare (il progetto, i passi nuovi e i passi esistenti con la nuova posizione), oppure undefined se non c'è nulla da fare.
 */
export function checklistInPassi(progetto: Item, tutti: Item[], nuovoId: () => string, oggi: string, now: number): Item[] | undefined {
  const righe = progetto.checklist ?? [];
  if (progetto.tipo !== 'progetto' || progetto.eliminato || righe.length === 0) return undefined;
  const nuovi: Item[] = righe.map((c, k) => ({
    id: nuovoId(), tipo: 'azione', titolo: c.testo, stato: c.fatto ? 'fatto' : 'da_fare', creato: now + k, aggiornato: now + k,
    padreId: progetto.id, ordine: k,
    ...(c.fatto ? { completatoIl: oggi, completatoTs: now } : {}),
  }));
  const esistenti = figli(tutti, progetto.id).map((p, n) => ({ ...p, ordine: righe.length + n, aggiornato: Math.max(p.aggiornato, now) }));
  return [{ ...progetto, checklist: undefined, aggiornato: Math.max(progetto.aggiornato, now) }, ...nuovi, ...esistenti];
}
