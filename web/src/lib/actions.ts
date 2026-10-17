import type { Item, Tipo } from '../../../shared/types.ts';
import { formatShort, today } from '../../../shared/dates.ts';
import { completa, riapri } from '../../../shared/recurrence.ts';
import { toggleOggi } from '../../../shared/routine.ts';
import { isOpen } from '../../../shared/priority.ts';
import { avanzamento, figli } from '../../../shared/views.ts';
import { getItem, getItems, saveItem } from './store.ts';
import { mostraToast } from './toast.ts';
import { newId } from './util.ts';
import { chiediRecensione } from './recensione.ts';
import { chiediDurata } from './durata.ts';
import { mostraAvanzamento, type PassoProgetto } from './avanzamento.ts';

export function nuovaVoce(p: Partial<Item> & { tipo: Tipo; titolo: string }): Item {
  const now = Date.now();
  return { id: newId(), stato: 'da_fare', creato: now, aggiornato: now, ...p };
}

/** Spunta una voce. Offre "Annulla" e, se era l'ultimo passo di un progetto, di chiudere il progetto. */
const TIPI_CON_VOTO = new Set<Tipo>(['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta']);

/** Il progetto com'è adesso: passi (checklist e voci figlie) e avanzamento; il passo `idTarget` risulta ancora da fare. */
function fotografaProgetto(progetto: Item, idTarget: string) {
  const passi: PassoProgetto[] = [
    ...(progetto.checklist ?? []).map((c) => ({ id: c.id, testo: c.testo, fatto: c.fatto })),
    ...figli(getItems(), progetto.id).filter((c) => c.stato !== 'parcheggiato').map((c) => ({ id: c.id, testo: c.titolo, fatto: c.stato === 'fatto' && c.id !== idTarget, target: c.id === idTarget || undefined })),
  ];
  return { padre: progetto, passi, prima: avanzamento(progetto, getItems()) };
}

export function completaVoce(item: Item) {
  // film, serie, libri, giochi…: prima si chiede il voto e un commento, poi si segna come fatto
  if (TIPI_CON_VOTO.has(item.tipo) && !item.ricorrenza) { chiediRecensione(item); return; }
  const oggi = today();
  const prima = item;
  const padre = item.padreId ? getItem(item.padreId) : undefined;
  // passo di un progetto: si fotografa il progetto prima del segno di fatto, per l'animazione dell'avanzamento
  const progetto = padre?.tipo === 'progetto' && !item.ricorrenza ? padre : undefined;
  const fotoPrima = progetto ? fotografaProgetto(progetto, item.id) : undefined;
  const dopo = completa(item, oggi, Date.now());
  saveItem(dopo);

  // attività: si chiede (facoltativo) quanto tempo c'è voluto, per affinare le stime; per i passi di un progetto
  // la richiesta arriva alla fine dell'animazione dell'avanzamento
  if (item.tipo === 'azione' && !item.ricorrenza) {
    if (progetto && fotoPrima) mostraAvanzamento({ ...fotoPrima, dopo: avanzamento(progetto, getItems()), alTermine: () => chiediDurata(dopo) });
    else chiediDurata(dopo);
  } else if (progetto && fotoPrima) {
    mostraAvanzamento({ ...fotoPrima, dopo: avanzamento(progetto, getItems()) });
  }

  if (padre && isOpen(padre) && !figli(getItems(), padre.id).some(isOpen)) {
    mostraToast(`Ultimo passo di «${padre.titolo}»`, {
      label: 'Chiudi progetto',
      fn: () => saveItem(completa(padre, oggi, Date.now())),
    }, 8000);
    return;
  }
  if (item.ricorrenza) {
    mostraToast(`Fatto · prossima ${formatShort(dopo.fine ?? dopo.inizio ?? oggi)}`, { label: 'Annulla', fn: () => saveItem(prima) });
  } else {
    mostraToast('Fatto', { label: 'Annulla', fn: () => saveItem(prima) });
  }
}

/**
 * Imposta l'ordine dei passi aperti di un progetto (`idsNuovi`, dal primo all'ultimo). L'ordine è anche la priorità:
 * il primo passo aperto è il prossimo da fare. I passi parcheggiati restano al loro posto; tutti ricevono una posizione.
 */
export function ordinaPassi(padreId: string, idsNuovi: string[]) {
  const lista = figli(getItems(), padreId);
  const visibili = new Set(lista.filter((c) => c.stato !== 'parcheggiato').map((c) => c.id));
  const per = new Map(lista.map((c) => [c.id, c]));
  const coda = idsNuovi.filter((i) => visibili.has(i));
  const nuovo = lista.map((c) => (visibili.has(c.id) ? per.get(coda.shift() ?? c.id)! : c));
  nuovo.forEach((c, n) => { if (c.ordine !== n) saveItem({ ...c, ordine: n }); });
}

export function riapriVoce(item: Item) {
  saveItem(riapri(item, Date.now()));
}

export function segnaRoutine(item: Item) {
  saveItem(toggleOggi(item, today(), Date.now()));
}

/** Segna o toglie la routine per un giorno qualsiasi (griglia settimanale). */
export function segnaRoutineGiorno(item: Item, giorno: string) {
  saveItem(toggleOggi(item, giorno, Date.now()));
}

export function ripianifica(item: Item, iso: string) {
  const conFine = item.fine !== undefined;
  saveItem({
    ...item,
    inizio: conFine ? item.inizio : iso,
    fine: conFine ? iso : item.fine,
    daRivedere: false,
    stato: item.stato === 'saltato' ? 'da_fare' : item.stato,
  });
  mostraToast(`Ripianificata al ${formatShort(iso)}`, { label: 'Annulla', fn: () => saveItem(item) });
}

export function saltaVoce(item: Item) {
  saveItem({ ...item, stato: 'saltato', daRivedere: false });
  mostraToast('Segnata come saltata', { label: 'Annulla', fn: () => saveItem(item) });
}
