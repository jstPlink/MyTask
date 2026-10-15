import type { Item, Tipo } from '../../../shared/types.ts';
import { formatShort, today } from '../../../shared/dates.ts';
import { completa, riapri } from '../../../shared/recurrence.ts';
import { toggleOggi } from '../../../shared/routine.ts';
import { isOpen } from '../../../shared/priority.ts';
import { figli, nomiPersone } from '../../../shared/views.ts';
import { getItem, getItems, saveItem } from './store.ts';
import { mostraToast } from './toast.ts';
import { newId } from './util.ts';
import { chiediRecensione } from './recensione.ts';

export function nuovaVoce(p: Partial<Item> & { tipo: Tipo; titolo: string }): Item {
  const now = Date.now();
  return { id: newId(), stato: 'da_fare', creato: now, aggiornato: now, ...p };
}

/** Crea la persona se non esiste ancora (confronto senza maiuscole). */
export function assicuraPersona(nome?: string) {
  const n = nome?.trim();
  if (!n) return;
  if (nomiPersone(getItems()).some((x) => x.toLowerCase() === n.toLowerCase())) return;
  saveItem(nuovaVoce({ tipo: 'persona', titolo: n }));
}

export function assicuraPersone(item: Pick<Item, 'consigliatoDa' | 'conChi' | 'persone'>) {
  assicuraPersona(item.consigliatoDa);
  assicuraPersona(item.conChi);
  item.persone?.forEach(assicuraPersona);
}

/** Spunta una voce. Offre "Annulla" e, se era l'ultimo passo di un progetto, di chiudere il progetto. */
const TIPI_CON_VOTO = new Set<Tipo>(['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta']);

export function completaVoce(item: Item) {
  // film, serie, libri, giochi…: prima si chiede il voto e un commento, poi si segna come fatto
  if (TIPI_CON_VOTO.has(item.tipo) && !item.ricorrenza) { chiediRecensione(item); return; }
  const oggi = today();
  const prima = item;
  const dopo = completa(item, oggi, Date.now());
  saveItem(dopo);

  const padre = item.padreId ? getItem(item.padreId) : undefined;
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
