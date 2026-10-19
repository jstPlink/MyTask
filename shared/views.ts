// Selezioni e ordinamenti che alimentano le schermate (Oggi, Attività, Progetti, Esperienze, collezioni, Inbox, Archivio, ricerca)
// e il widget. Funzioni pure sul solo elenco di voci: stesso input, stesso output. Vale ovunque la regola dei progetti:
// un progetto non compare mai da solo nelle liste di azione, compare il suo prossimo passo.
import type { Item } from './types.ts';
import { chiaveTitolo } from './testo.ts';
import { addDays, diffDays } from './dates.ts';
import {
  dueDate, isClosed, isOpen, score, withInheritance,
} from './priority.ts';
import { routineDueToday } from './routine.ts';

/** Una riga delle liste di azione con il suo punteggio di priorità. */
export interface Entry {
  /** La voce da mostrare (per un progetto, il suo prossimo passo con le eredità applicate). */
  item: Item;
  /** Progetto di cui l'item è il prossimo passo. */
  padre?: Item;
  punteggio: number;
}

/** Le voci non eliminate (la cancellazione è logica: le eliminate restano nei dati per la sincronizzazione). */
export const live = (items: Item[]) => items.filter((i) => !i.eliminato);

/** Nella Inbox: catturata e non ancora smistata, oppure ancora senza tipo. */
export const inInbox = (i: Item) => !!i.inbox || i.tipo === 'nota';

/** I passi di un progetto, nell'ordine scelto dall'utente (`ordine`); senza ordine vengono dopo, per data d'inizio e poi per creazione. */
export function figli(items: Item[], padreId: string): Item[] {
  return live(items)
    .filter((i) => i.padreId === padreId)
    .sort((a, b) => (a.ordine ?? 1e9) - (b.ordine ?? 1e9) || (a.inizio ?? '9999').localeCompare(b.inizio ?? '9999') || a.creato - b.creato);
}

/** Avanzamento di un progetto (es. 3 su 8): passi fatti e voci della checklist spuntate, sul totale. Si calcola, non si inserisce a mano. */
export function avanzamento(padre: Item, items: Item[]): { fatti: number; totale: number } {
  const f = figli(items, padre.id);
  const checklist = padre.checklist ?? [];
  const totale = f.length + checklist.length;
  const fatti = f.filter((c) => c.stato === 'fatto').length + checklist.filter((c) => c.fatto).length;
  return { fatti, totale };
}

/** Stima di un progetto: la somma dei tempi stimati dei suoi passi ancora da fare (minuti), 0 se nessun passo ha una stima. Dipende dai passi, non si inserisce a mano. */
export function stimaProgetto(padre: Item, items: Item[]): number {
  return figli(items, padre.id)
    .filter((c) => c.stato !== 'fatto' && c.stato !== 'saltato' && c.stato !== 'parcheggiato')
    .reduce((somma, c) => somma + (c.sforzoMin ?? 0), 0);
}

/** Il primo passo ancora aperto del progetto (non archiviato), cioè quello che compare in Oggi al posto del progetto. */
export function prossimoPasso(padre: Item, items: Item[]): Item | undefined {
  return figli(items, padre.id).find((c) => isOpen(c) && c.stato !== 'parcheggiato');
}

const parcheggiata = (i: Item) => i.stato === 'parcheggiato';

/** Tipi che appartengono alle liste di azione (non collezioni, routine, persone). */
const TIPI_LISTA_AZIONE = new Set(['azione', 'progetto', 'esperienza']);

/**
 * Punteggio di una nota tenendo conto delle dipendenze: in un progetto ogni passo dipende dal precedente, quindi un passo
 * non può avere priorità più bassa di quelli che vengono dopo (se un passo successivo è urgente, anche i passi che lo precedono lo sono).
 * Per le note fuori da un progetto è il punteggio normale.
 */
export function punteggioEffettivo(i: Item, items: Item[], today: string, now: number = Date.now(), cache?: Map<string, Item[]>): number {
  const padre = i.padreId ? items.find((p) => p.id === i.padreId && p.tipo === 'progetto' && !p.eliminato) : undefined;
  if (!padre) return score(i, today, now);
  let passi = cache?.get(padre.id);
  if (!passi) {
    passi = figli(items, padre.id).filter((c) => isOpen(c) && !parcheggiata(c));
    cache?.set(padre.id, passi);
  }
  const k = passi.findIndex((c) => c.id === i.id);
  if (k < 0) return score(withInheritance(i, padre), today, now);
  return Math.max(...passi.slice(k).map((c) => score(withInheritance(c, padre), today, now)));
}

/**
 * Le voci tra cui scegliere cosa fare, ognuna col suo punteggio. Esclude chiuse, archiviate, Inbox e passi di progetto;
 * un progetto con passi aperti entra con il solo prossimo passo (con le eredità del progetto), uno senza passi entra come voce a sé.
 */
export function candidatiOggi(items: Item[], today: string, now: number): Entry[] {
  const tutte = live(items);
  const cache = new Map<string, Item[]>();
  const out: Entry[] = [];
  for (const i of tutte) {
    if (!isOpen(i) || parcheggiata(i) || i.inbox) continue;
    if (!TIPI_LISTA_AZIONE.has(i.tipo)) continue;
    if (i.padreId) continue; // i figli compaiono solo come prossimo passo del padre
    if (i.tipo === 'progetto') {
      const next = prossimoPasso(i, tutte);
      if (next) {
        const eff = withInheritance(next, i);
        out.push({ item: eff, padre: i, punteggio: punteggioEffettivo(next, tutte, today, now, cache) });
      } else if (figli(tutte, i.id).length === 0) {
        out.push({ item: i, punteggio: score(i, today, now) });
      }
      continue;
    }
    out.push({ item: i, punteggio: score(i, today, now) });
  }
  return out;
}

/** Ordine di priorità, uguale ovunque: prima il punteggio, a parità la nota più vecchia (poi l'id, per essere stabili). */
export const perPriorita = (a: Entry, b: Entry) => b.punteggio - a.punteggio || a.item.creato - b.item.creato || a.item.id.localeCompare(b.item.id);

/** Posizione di ogni nota nella classifica di priorità (1 = la prima): quella che si legge in Oggi e nella scheda della nota. */
export function classificaPriorita(items: Item[], today: string, now: number = Date.now()): Map<string, number> {
  return new Map(candidatiOggi(items, today, now).sort(perPriorita).map((e, n) => [e.item.id, n + 1] as [string, number]));
}

/** Posizione di una nota (anche non ancora salvata o con modifiche in corso) tra quelle da fare, con lo stesso ordine di Oggi. */
export function posizionePriorita(items: Item[], nota: Item, today: string, now: number = Date.now()): { pos: number; tot: number } {
  const altre = candidatiOggi(items.filter((i) => i.id !== nota.id), today, now);
  const padre = nota.padreId ? items.find((p) => p.id === nota.padreId && p.tipo === 'progetto') : undefined;
  const mia: Entry = { item: nota, padre, punteggio: punteggioEffettivo(nota, [...items.filter((i) => i.id !== nota.id), nota], today, now) };
  const tutte = [...altre, mia].sort(perPriorita);
  return { pos: tutte.findIndex((e) => e.item.id === nota.id) + 1, tot: tutte.length };
}

export interface VistaOggi {
  routine: Item[];
  fare: Entry[];
  prossimi: Entry[];
  inbox: number;
}

/** Quante note mostra Oggi al massimo: le scadute o in scadenza oggi compaiono tutte (anche se più di 5), le senza data riempiono fino a 5. */
const MAX_OGGI = 5;

/**
 * Cosa compare in Oggi: le routine del giorno, le note "da fare" (scadute o in scadenza oggi, poi le senza data più prioritarie, in corso
 * prima a parità, fino a `MAX_OGGI`; le esperienze senza data non compaiono mai), le scadenze dei prossimi 7 giorni e il numero di note in Inbox.
 */
export function vistaOggi(items: Item[], today: string, now: number = Date.now()): VistaOggi {
  const cand = candidatiOggi(items, today, now);
  const due = (e: Entry) => dueDate(e.item);
  const perPunteggio = (a: Entry, b: Entry) => b.punteggio - a.punteggio;

  const dovute = cand.filter((e) => { const d = due(e); return d !== undefined && diffDays(d, today) <= 0; }).sort(perPunteggio);
  const inCorsoPrima = (a: Entry, b: Entry) => Number(b.item.stato === 'in_corso') - Number(a.item.stato === 'in_corso') || b.punteggio - a.punteggio;
  const senzaData = cand
    .filter((e) => due(e) === undefined && e.item.tipo !== 'esperienza')
    .sort(inCorsoPrima);
  const fare = [...dovute];
  for (const e of senzaData) {
    if (fare.length >= Math.max(MAX_OGGI, dovute.length)) break;
    fare.push(e);
  }

  const limite = addDays(today, 7);
  const prossimi = live(items)
    .filter((i) => isOpen(i) && !parcheggiata(i) && !i.inbox && i.tipo !== 'persona' && i.tipo !== 'routine')
    .filter((i) => { const d = dueDate(i); return d !== undefined && d > today && d <= limite; })
    .map((i) => ({ item: i, punteggio: score(i, today, now) }))
    .sort((a, b) => (dueDate(a.item) ?? '').localeCompare(dueDate(b.item) ?? ''));

  return {
    routine: routineDueToday(items, today),
    fare,
    prossimi,
    inbox: live(items).filter(inInbox).length,
  };
}

/** Tutte le attività aperte (comprese le scadute), per priorità; a parità, i passi di uno stesso progetto restano nell'ordine del progetto. */
export function listaAzioni(items: Item[], today: string, now: number = Date.now()): Entry[] {
  const tutte = live(items);
  const cache = new Map<string, Item[]>();
  const ordinePasso = new Map<string, number>();
  for (const p of tutte.filter((x) => x.tipo === 'progetto')) figli(tutte, p.id).forEach((c, n) => ordinePasso.set(c.id, n));
  return tutte
    .filter((i) => i.tipo === 'azione' && !i.inbox && isOpen(i) && !parcheggiata(i))
    .map((i) => {
      const padre = i.padreId ? tutte.find((p) => p.id === i.padreId && p.tipo === 'progetto') : undefined;
      return { item: i, padre, punteggio: punteggioEffettivo(i, tutte, today, now, cache) };
    })
    .sort((a, b) => b.punteggio - a.punteggio || (ordinePasso.get(a.item.id) ?? 0) - (ordinePasso.get(b.item.id) ?? 0));
}

/** Raggruppa le voci per progetto: il gruppo sta dove sta la sua voce più prioritaria; le attività senza progetto restano singole. */
export function raggruppaPerProgetto<T extends { padre?: Item }>(voci: T[], items: Item[]): { progetto?: Item; fatti: number; totale: number; voci: T[] }[] {
  const out: { progetto?: Item; fatti: number; totale: number; voci: T[] }[] = [];
  const perId = new Map<string, (typeof out)[number]>();
  for (const v of voci) {
    if (!v.padre) { out.push({ fatti: 0, totale: 0, voci: [v] }); continue; }
    let g = perId.get(v.padre.id);
    if (!g) { g = { progetto: v.padre, ...avanzamento(v.padre, items), voci: [] }; perId.set(v.padre.id, g); out.push(g); }
    g.voci.push(v);
  }
  return out;
}

/** Voci messe da parte ("Da parte"), le più recenti prima. */
export function daParte(items: Item[]): Item[] {
  return live(items)
    .filter((i) => parcheggiata(i) && i.tipo !== 'persona')
    .sort((a, b) => b.aggiornato - a.aggiornato);
}

/** Un progetto con avanzamento e prossimo passo. */
export interface VoceProgetto { progetto: Item; fatti: number; totale: number; prossimo?: Item }

/** Progetti aperti, dal più prioritario. */
export function listaProgetti(items: Item[], today: string, now: number = Date.now()): VoceProgetto[] {
  const tutte = live(items);
  return tutte
    .filter((i) => i.tipo === 'progetto' && isOpen(i) && !parcheggiata(i))
    .map((p) => ({ progetto: p, ...avanzamento(p, tutte), prossimo: prossimoPasso(p, tutte) }))
    .sort((a, b) => score(b.progetto, today, now) - score(a.progetto, today, now));
}

/** Esperienze aperte: con una data (in ordine di data) e senza data (raggruppate per luogo, `zona`, con «Altro» in fondo). */
export interface VistaEsperienze { conData: Item[]; perZona: [string, Item[]][] }

/** Esperienze aperte divise in «con data» e «senza data»; le senza data sono una lista di desideri ordinata per interesse. */
export function listaEsperienze(items: Item[]): VistaEsperienze {
  const e = live(items).filter((i) => i.tipo === 'esperienza' && isOpen(i) && !i.inbox && !parcheggiata(i));
  const conData = e.filter((i) => dueDate(i)).sort((a, b) => (dueDate(a) ?? '').localeCompare(dueDate(b) ?? ''));
  const senza = e.filter((i) => !dueDate(i)).sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo));
  const mappa = new Map<string, Item[]>();
  for (const i of senza) {
    const z = i.zona ?? 'Altro';
    mappa.set(z, [...(mappa.get(z) ?? []), i]);
  }
  const perZona = [...mappa.entries()].sort((a, b) => (a[0] === 'Altro' ? 1 : b[0] === 'Altro' ? -1 : b[1].length - a[1].length));
  return { conData, perZona };
}

/** Voci di collezione (film, serie, libri…) ancora da fare o in corso, per interesse, opzionalmente di una piattaforma. */
/** Voce speciale dei filtri per piattaforma: le opere che non hanno nessuna piattaforma. */
export const SENZA_PIATTAFORMA = 'Senza piattaforma';

/** Vero se l'opera passa il filtro: nessun filtro, oppure la sua piattaforma è tra quelle scelte (o non ne ha e «Senza piattaforma» è scelta). */
export const passaPiattaforme = (i: Item, scelte: string[]): boolean =>
  scelte.length === 0 || (i.piattaforma ? scelte.includes(i.piattaforma) : scelte.includes(SENZA_PIATTAFORMA));

/** Opere in lista (da fare o in corso) senza piattaforma, per sapere se proporre il filtro «Senza piattaforma». */
export const opereSenzaPiattaforma = (items: Item[], tipi: Item['tipo'][]): number =>
  live(items).filter((i) => tipi.includes(i.tipo) && (i.stato === 'da_fare' || i.stato === 'in_corso') && !i.inbox && !i.piattaforma?.trim()).length;

/** Opere da fare di questi tipi, filtrate (se serve) per una o più piattaforme scelte insieme. */
export function collezione(items: Item[], tipi: Item['tipo'][], piattaforme: string[] = []): Item[] {
  return live(items)
    .filter((i) => tipi.includes(i.tipo) && (i.stato === 'da_fare' || i.stato === 'in_corso') && !i.inbox)
    .filter((i) => passaPiattaforme(i, piattaforme))
    .sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo, 'it'));
}

/** Le piattaforme già scritte nelle voci di questi tipi (escluse quelle completate), in ordine alfabetico. */
export function piattformeUsate(items: Item[], tipi: Item['tipo'][]): string[] {
  const set = new Set<string>();
  for (const i of live(items)) if (tipi.includes(i.tipo) && i.piattaforma && i.stato !== 'fatto') set.add(i.piattaforma);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Curiosità non ancora chiuse, le più recenti prima. */
export function curiosita(items: Item[]): Item[] {
  return live(items)
    .filter((i) => i.tipo === 'curiosita' && i.stato !== 'fatto' && i.stato !== 'saltato' && !i.inbox)
    .sort((a, b) => b.aggiornato - a.aggiornato);
}

/** Note in Inbox (da smistare o senza tipo), le più recenti prima. */
export function inbox(items: Item[]): Item[] {
  return live(items).filter(inInbox).sort((a, b) => b.creato - a.creato);
}

/** Data usata per ordinare l'archivio. */
export function dataChiusura(i: Item): string {
  return i.completatoIl ?? i.fine ?? i.inizio ?? new Date(i.aggiornato).toISOString().slice(0, 10);
}

/** Voci chiuse (fatte o saltate), esclusi i passi di progetto (si leggono dentro il progetto), per data di chiusura. */
export function archivio(items: Item[]): Item[] {
  return live(items)
    .filter((i) => isClosed(i) && i.tipo !== 'persona' && i.tipo !== 'routine' && !i.padreId)
    .sort((a, b) => dataChiusura(b).localeCompare(dataChiusura(a)));
}

/** Nomi già scritti in "Consigliato da" e "Con chi", per il completamento automatico. */
export function nomiUsati(items: Item[]): string[] {
  const set = new Set<string>();
  for (const i of live(items)) for (const n of [i.consigliatoDa, i.conChi]) if (n?.trim()) set.add(n.trim());
  return [...set].sort((a, b) => a.localeCompare(b, 'it'));
}

/** Luoghi già inseriti nelle esperienze, dal più usato al meno usato (a parità in ordine alfabetico), per sceglierli senza riscriverli. */
export function luoghiUsati(items: Item[]): string[] {
  const conta = new Map<string, number>();
  for (const i of live(items)) {
    const z = i.zona?.trim();
    if (z) conta.set(z, (conta.get(z) ?? 0) + 1);
  }
  return [...conta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it')).map(([z]) => z);
}

/** Ricerca per parole nel titolo, nelle note e nei campi di testo. Tutte le parole devono comparire. */
export function cercaVoci(items: Item[], q: string, max = 60): Item[] {
  const parole = chiaveTitolo(q).split(' ').filter(Boolean);
  if (parole.length === 0) return [];
  const chiave = (i: Item) => chiaveTitolo([i.titolo, i.note, i.consigliatoDa, i.conChi, i.area, i.zona, i.piattaforma, i.genere, ...(i.persone ?? []), ...(i.checklist ?? []).map((c) => c.testo)].filter(Boolean).join(' '));
  const primo = chiaveTitolo(parole[0]);
  return live(items)
    .filter((i) => i.tipo !== 'persona')
    .map((i) => ({ i, k: chiave(i) }))
    .filter(({ k }) => parole.every((p) => k.includes(p)))
    .sort((a, b) => {
      const aperta = Number(isClosed(a.i)) - Number(isClosed(b.i));
      const inizio = Number(!chiaveTitolo(a.i.titolo).startsWith(primo)) - Number(!chiaveTitolo(b.i.titolo).startsWith(primo));
      return aperta || inizio || b.i.aggiornato - a.i.aggiornato;
    })
    .slice(0, max)
    .map(({ i }) => i);
}

/**
 * Note che contengono le parole scritte, anche in forme diverse (stessa radice): serve a non inserire due volte la stessa nota.
 * Prima quelle con più parole in comune, poi le aperte, poi le più recenti.
 */
export function cercaSimili(items: Item[], q: string, max = 30): Item[] {
  const parole = chiaveTitolo(q).split(' ').filter((p) => p.length >= 2);
  if (parole.length === 0) return [];
  const radici = parole.map((p) => (p.length > 5 ? p.slice(0, p.length - 2) : p));
  const minimo = parole.length <= 2 ? 1 : Math.ceil(parole.length / 2);
  const chiave = (i: Item) => chiaveTitolo([i.titolo, i.note, i.consigliatoDa, i.conChi, i.piattaforma, i.genere, ...(i.checklist ?? []).map((c) => c.testo)].filter(Boolean).join(' '));
  return live(items)
    .filter((i) => i.tipo !== 'persona')
    .map((i) => { const k = chiave(i); return { i, punti: radici.filter((r) => k.includes(r)).length }; })
    .filter((x) => x.punti >= minimo)
    .sort((a, b) => b.punti - a.punti || Number(isClosed(a.i)) - Number(isClosed(b.i)) || b.i.aggiornato - a.i.aggiornato)
    .slice(0, max)
    .map((x) => x.i);
}
