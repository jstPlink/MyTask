// Azioni sulle voci (creare, completare, cambiare stato, ordinare i passi): unico punto in cui la logica di dominio
// condivisa (shared/) incontra l'archivio locale, i toast e i fogli di conferma. Le schermate chiamano queste funzioni.
import type { Item, Stato, Tipo } from '../../../shared/types.ts';
import { formatShort, today } from '../../../shared/dates.ts';
import { completa, riapri } from '../../../shared/recurrence.ts';
import { toggleOggi } from '../../../shared/routine.ts';
import { isOpen } from '../../../shared/priority.ts';
import { avanzamento, figli } from '../../../shared/views.ts';
import { getItem, getItems, saveItem } from './store.ts';
import { durataRealeInCorso, pianifica } from '../../../shared/piano.ts';
import { margineAtteso } from '../../../shared/stima.ts';
import { getDisponibilita } from './disponibilita.ts';
import { mostraCompletamento } from './completamento.ts';
import { mostraToast } from './toast.ts';
import { newId, nomeTempo } from './util.ts';
import { chiediRecensione } from './recensione.ts';
import { mostraAvanzamento, type PassoProgetto } from './avanzamento.ts';

/** Crea una voce nuova in memoria (da passare a `saveItem`): id casuale, da fare, date di creazione e modifica adesso. */
export function nuovaVoce(p: Partial<Item> & { tipo: Tipo; titolo: string }): Item {
  const now = Date.now();
  return { id: newId(), stato: 'da_fare', creato: now, aggiornato: now, ...p };
}

/** Tipi per cui, prima di segnarli fatti, si chiede voto e commento (foglio «Com'è andata?»). */
const TIPI_CON_VOTO = new Set<Tipo>(['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta']);

/** Il progetto com'è adesso: passi (checklist e voci figlie) e avanzamento; il passo `idTarget` risulta ancora da fare. */
function fotografaProgetto(progetto: Item, idTarget: string) {
  const passi: PassoProgetto[] = [
    ...(progetto.checklist ?? []).map((c) => ({ id: c.id, testo: c.testo, fatto: c.fatto })),
    ...figli(getItems(), progetto.id).filter((c) => c.stato !== 'parcheggiato').map((c) => ({ id: c.id, testo: c.titolo, fatto: c.stato === 'fatto' && c.id !== idTarget, target: c.id === idTarget || undefined })),
  ];
  return { padre: progetto, passi, prima: avanzamento(progetto, getItems()) };
}

/**
 * Spunta una voce. Offre «Annulla» e, se era l'ultimo passo di un progetto, di chiudere il progetto.
 * Per le note «in corso» registra il tempo impiegato misurato dall'app (vedi `durataRealeInCorso`).
 */
export function completaVoce(item: Item) {
  // film, serie, libri, giochi…: prima si chiede il voto e un commento, poi si segna come fatto
  if (TIPI_CON_VOTO.has(item.tipo) && !item.ricorrenza) { chiediRecensione(item); return; }
  const oggi = today();
  const prima = item;
  const padre = item.padreId ? getItem(item.padreId) : undefined;
  // passo di un progetto: si fotografa il progetto prima del segno di fatto, per l'animazione dell'avanzamento
  const progetto = padre?.tipo === 'progetto' && !item.ricorrenza ? padre : undefined;
  const fotoPrima = progetto ? fotografaProgetto(progetto, item.id) : undefined;
  const ora = Date.now();
  // il tempo impiegato non si chiede: si misura da quando la nota è passata «in corso», contando solo il tempo libero segnato
  const durata = item.tipo === 'azione' && !item.ricorrenza ? durataRealeInCorso(item, ora, getDisponibilita()) : undefined;
  const dopo = { ...completa(item, oggi, ora), ...(durata ? { durataRealeMin: durata } : {}) };
  const margineDa = margineAtteso(getItems());
  saveItem(dopo);
  // con il tempo misurato e una stima si apre il foglio con il confronto e il margine d'errore aggiornato
  const confronto = durata && item.sforzoMin
    ? () => mostraCompletamento({ titolo: item.titolo, stimaMin: item.sforzoMin!, realeMin: durata, margineDa: Math.round(margineDa * 100), margineA: Math.round(margineAtteso(getItems()) * 100) })
    : undefined;

  if (progetto && fotoPrima) mostraAvanzamento({ ...fotoPrima, dopo: avanzamento(progetto, getItems()), alTermine: confronto });
  else confronto?.();

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
    mostraToast(confronto ? 'Fatto' : durata ? `Fatto in ${nomeTempo(durata)}${item.sforzoMin ? ` (stimati ${nomeTempo(item.sforzoMin)})` : ''}` : 'Fatto', { label: 'Annulla', fn: () => saveItem(prima) });
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

/** Gli stati che l'utente può scegliere (menu «Stato»): da fare, in corso, fatta, archiviata. */
export const STATI_NOTA: { id: Stato; nome: string; descr: string }[] = [
  { id: 'da_fare', nome: 'Da fare', descr: 'Non ancora iniziata' },
  { id: 'in_corso', nome: 'In corso', descr: 'Ci sto lavorando' },
  { id: 'fatto', nome: 'Fatta', descr: 'Completata' },
  { id: 'parcheggiato', nome: 'Archiviata', descr: 'Messa da parte' },
];

/** Lo stato che l'utente vede: «saltato» conta come fatta. */
export const statoVisto = (s: Stato): Stato => (s === 'saltato' ? 'fatto' : s);

/** Dove è nel piano di oggi (o dei prossimi giorni) una nota: serve a fissarla quando passa «in corso». */
function postoNelPiano(item: Item): { pianoData?: string; pianoDa?: number } {
  const disp = getDisponibilita();
  if (!disp) return {};
  const tutte = getItems();
  const giorni = pianifica(tutte, disp, today(), Date.now(), undefined, margineAtteso(tutte)).giorni;
  for (const g of giorni) {
    const b = g.blocchi.find((x) => x.item.id === item.id && !x.pausa && !x.fisso);
    if (b) return { pianoData: b.data, pianoDa: b.da };
  }
  return {};
}

/**
 * Porta una nota in uno stato. «Fatta» passa da `completaVoce` (voto, durata, ricorrenze, progetti).
 * Archiviare un progetto archivia anche i suoi passi; ripristinarlo li ripristina (da fare). Tutto si può annullare.
 * Una nota che passa «in corso» resta dove era nel piano e non viene più spostata.
 */
export function cambiaStato(item: Item, nuovo: Stato) {
  if (statoVisto(item.stato) === nuovo) return;
  if (nuovo === 'fatto') { completaVoce(item); return; }
  const base = statoVisto(item.stato) === 'fatto' ? riapri(item, Date.now()) : item;
  const ora = Date.now();
  const posto = nuovo === 'in_corso' ? postoNelPiano(item) : {};
  const prima: Item[] = [item];
  saveItem({
    ...base,
    stato: nuovo,
    inCorsoTs: nuovo === 'in_corso' ? ora : nuovo === 'da_fare' ? undefined : base.inCorsoTs,
    pianoData: posto.pianoData,
    pianoDa: posto.pianoDa,
    aggiornato: ora,
  });
  if (item.tipo === 'progetto') {
    const era = statoVisto(item.stato);
    for (const c of figli(getItems(), item.id)) {
      if (nuovo === 'parcheggiato' && statoVisto(c.stato) !== 'fatto' && c.stato !== 'parcheggiato') {
        prima.push(c);
        saveItem({ ...c, stato: 'parcheggiato', pianoData: undefined, pianoDa: undefined, aggiornato: ora });
      } else if (era === 'parcheggiato' && nuovo !== 'parcheggiato' && c.stato === 'parcheggiato') {
        prima.push(c);
        saveItem({ ...c, stato: 'da_fare', aggiornato: ora });
      }
    }
  }
  const passi = prima.length - 1;
  if (nuovo === 'parcheggiato') {
    mostraToast(passi ? `Archiviato con ${passi} ${passi === 1 ? 'passo' : 'passi'}` : 'Archiviata', { label: 'Annulla', fn: () => prima.forEach((x) => saveItem(x)) });
  } else if (passi) {
    mostraToast(`Ripristinato con ${passi} ${passi === 1 ? 'passo' : 'passi'}`, { label: 'Annulla', fn: () => prima.forEach((x) => saveItem(x)) });
  }
}

/** Un tocco sulla casella: da fare → in corso → fatta; una nota fatta o archiviata torna da fare. */
export function avanzaStato(item: Item) {
  const s = statoVisto(item.stato);
  cambiaStato(item, s === 'da_fare' ? 'in_corso' : s === 'in_corso' ? 'fatto' : 'da_fare');
}

/** Segna (o toglie) la routine per oggi. */
export function segnaRoutine(item: Item) {
  saveItem(toggleOggi(item, today(), Date.now()));
}

/** Segna o toglie la routine per un giorno qualsiasi (griglia settimanale). */
export function segnaRoutineGiorno(item: Item, giorno: string) {
  saveItem(toggleOggi(item, giorno, Date.now()));
}
