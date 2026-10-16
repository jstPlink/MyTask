// Selezioni e ordinamenti usati dalle schermate. Funzioni pure: stesso input, stesso output.
import type { Item } from './types.ts';
import { chiaveTitolo } from './capture.ts';
import { addDays, diffDays } from './dates.ts';
import {
  SOGLIA_REVISIONE_GIORNI, daysOverdue, dueDate, isClosed, isOpen, score, withInheritance,
} from './priority.ts';
import { routineDueToday } from './routine.ts';

export interface Entry {
  /** La voce da mostrare (per un progetto, il suo prossimo passo con le eredità applicate). */
  item: Item;
  /** Progetto di cui l'item è il prossimo passo. */
  padre?: Item;
  punteggio: number;
}

export type MotivoRevisione = 'scaduta' | 'manuale' | 'fermo' | 'vecchia';
export interface VoceRevisione { item: Item; motivo: MotivoRevisione; giorni: number }

const GIORNI_PROGETTO_FERMO = 30;
/** Un'attività senza scadenza che non viene toccata da tanto va rivista: forse la priorità o gli altri parametri non sono più giusti. */
export const GIORNI_ATTIVITA_VECCHIA = 45;

export const live = (items: Item[]) => items.filter((i) => !i.eliminato);

export function figli(items: Item[], padreId: string): Item[] {
  return live(items)
    .filter((i) => i.padreId === padreId)
    .sort((a, b) => (a.inizio ?? '9999').localeCompare(b.inizio ?? '9999') || a.creato - b.creato);
}

export function avanzamento(padre: Item, items: Item[]): { fatti: number; totale: number } {
  const f = figli(items, padre.id);
  const checklist = padre.checklist ?? [];
  const totale = f.length + checklist.length;
  const fatti = f.filter((c) => c.stato === 'fatto').length + checklist.filter((c) => c.fatto).length;
  return { fatti, totale };
}

export function prossimoPasso(padre: Item, items: Item[]): Item | undefined {
  return figli(items, padre.id).find((c) => isOpen(c) && c.stato !== 'parcheggiato');
}

const parcheggiata = (i: Item) => i.stato === 'parcheggiato';

/** Voce che appartiene alle liste di azione (non a collezioni, routine, persone). */
const TIPI_LISTA_AZIONE = new Set(['azione', 'progetto', 'esperienza']);

/** Voci in Revisione: scadute da più di SOGLIA giorni, segnate a mano, progetti fermi. */
export function revisione(items: Item[], today: string, now: number = Date.now()): VoceRevisione[] {
  const out: VoceRevisione[] = [];
  const tutte = live(items);
  for (const i of tutte) {
    if (!isOpen(i) || parcheggiata(i) || i.inbox || i.tipo === 'persona' || i.tipo === 'routine') continue;
    const giorni = daysOverdue(i, today);
    if (giorni > SOGLIA_REVISIONE_GIORNI) out.push({ item: i, motivo: 'scaduta', giorni });
    else if (i.daRivedere) out.push({ item: i, motivo: 'manuale', giorni });
    else if (i.tipo === 'azione' && !i.padreId && !dueDate(i)) {
      const eta = Math.floor((now - i.aggiornato) / 86400000);
      if (eta > GIORNI_ATTIVITA_VECCHIA) out.push({ item: i, motivo: 'vecchia', giorni: eta });
    } else if (i.tipo === 'progetto') {
      const ultimo = Math.max(i.aggiornato, ...figli(tutte, i.id).map((c) => c.aggiornato));
      if (now - ultimo > GIORNI_PROGETTO_FERMO * 86400000 && prossimoPasso(i, tutte)) {
        out.push({ item: i, motivo: 'fermo', giorni: Math.floor((now - ultimo) / 86400000) });
      }
    }
  }
  return out.sort((a, b) => (dueDate(a.item) ?? '9999').localeCompare(dueDate(b.item) ?? '9999'));
}

export function candidatiOggi(items: Item[], today: string, now: number): Entry[] {
  const tutte = live(items);
  const inRevisione = new Set(revisione(tutte, today, now).map((v) => v.item.id));
  const out: Entry[] = [];
  for (const i of tutte) {
    if (!isOpen(i) || parcheggiata(i) || i.inbox || inRevisione.has(i.id)) continue;
    if (!TIPI_LISTA_AZIONE.has(i.tipo)) continue;
    if (i.padreId) continue; // i figli compaiono solo come prossimo passo del padre
    if (i.tipo === 'progetto') {
      const next = prossimoPasso(i, tutte);
      if (next && !inRevisione.has(next.id)) {
        const eff = withInheritance(next, i);
        out.push({ item: eff, padre: i, punteggio: score(eff, today, now) });
      } else if (!next && figli(tutte, i.id).length === 0) {
        out.push({ item: i, punteggio: score(i, today, now) });
      }
      continue;
    }
    out.push({ item: i, punteggio: score(i, today, now) });
  }
  return out;
}

export interface VistaOggi {
  routine: Item[];
  fare: Entry[];
  prossimi: Entry[];
  inbox: number;
  revisione: number;
}

const MAX_OGGI = 5;

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
    inbox: live(items).filter((i) => i.inbox).length,
    revisione: revisione(items, today, now).length,
  };
}

export function listaAzioni(items: Item[], today: string, now: number = Date.now()): Entry[] {
  const tutte = live(items);
  // tutte le attività aperte, comprese quelle in Revisione (scadute o ferme da tempo)
  return tutte
    .filter((i) => i.tipo === 'azione' && !i.inbox && isOpen(i) && !parcheggiata(i))
    .map((i) => {
      const padre = i.padreId ? tutte.find((p) => p.id === i.padreId && p.tipo === 'progetto') : undefined;
      const eff = withInheritance(i, padre);
      return { item: i, padre, punteggio: score(eff, today, now) };
    })
    .sort((a, b) => b.punteggio - a.punteggio);
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

export interface VoceProgetto { progetto: Item; fatti: number; totale: number; prossimo?: Item; fermo: boolean }

export function listaProgetti(items: Item[], today: string, now: number = Date.now()): VoceProgetto[] {
  const tutte = live(items);
  const fermi = new Set(revisione(tutte, today, now).filter((v) => v.motivo === 'fermo').map((v) => v.item.id));
  return tutte
    .filter((i) => i.tipo === 'progetto' && isOpen(i) && !parcheggiata(i))
    .map((p) => ({ progetto: p, ...avanzamento(p, tutte), prossimo: prossimoPasso(p, tutte), fermo: fermi.has(p.id) }))
    .sort((a, b) => Number(a.fermo) - Number(b.fermo) || score(b.progetto, today, now) - score(a.progetto, today, now));
}

export interface VistaEsperienze { conData: Item[]; perZona: [string, Item[]][] }

export function listaEsperienze(items: Item[], today: string, now: number = Date.now()): VistaEsperienze {
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

export function collezione(items: Item[], tipi: Item['tipo'][], piattaforma?: string): Item[] {
  return live(items)
    .filter((i) => tipi.includes(i.tipo) && (i.stato === 'da_fare' || i.stato === 'in_corso') && !i.inbox)
    .filter((i) => !piattaforma || i.piattaforma === piattaforma)
    .sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo, 'it'));
}

export function piattformeUsate(items: Item[], tipi: Item['tipo'][]): string[] {
  const set = new Set<string>();
  for (const i of live(items)) if (tipi.includes(i.tipo) && i.piattaforma && i.stato !== 'fatto') set.add(i.piattaforma);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function curiosita(items: Item[]): Item[] {
  return live(items)
    .filter((i) => i.tipo === 'curiosita' && i.stato !== 'fatto' && i.stato !== 'saltato' && !i.inbox)
    .sort((a, b) => b.aggiornato - a.aggiornato);
}

export function inbox(items: Item[]): Item[] {
  return live(items).filter((i) => i.inbox).sort((a, b) => b.creato - a.creato);
}

/** Data usata per ordinare l'archivio. */
export function dataChiusura(i: Item): string {
  return i.completatoIl ?? i.fine ?? i.inizio ?? new Date(i.aggiornato).toISOString().slice(0, 10);
}

export function archivio(items: Item[]): Item[] {
  return live(items)
    .filter((i) => isClosed(i) && i.tipo !== 'persona' && i.tipo !== 'routine' && !i.padreId)
    .sort((a, b) => dataChiusura(b).localeCompare(dataChiusura(a)));
}

export interface VocePersona { persona: Item; collegamenti: number; consigliati: number }

export function persone(items: Item[]): VocePersona[] {
  const tutte = live(items);
  return tutte
    .filter((i) => i.tipo === 'persona')
    .map((p) => {
      const n = p.titolo.toLowerCase();
      const collegate = tutte.filter((i) => i.tipo !== 'persona' && (
        (i.persone ?? []).some((x) => x.toLowerCase() === n) ||
        i.consigliatoDa?.toLowerCase() === n ||
        i.conChi?.toLowerCase() === n));
      return { persona: p, collegamenti: collegate.length, consigliati: collegate.filter((i) => i.consigliatoDa?.toLowerCase() === n).length };
    })
    .sort((a, b) => Number(!!b.persona.daContattare) - Number(!!a.persona.daContattare) || b.collegamenti - a.collegamenti || a.persona.titolo.localeCompare(b.persona.titolo, 'it'));
}

export function nomiPersone(items: Item[]): string[] {
  return live(items).filter((i) => i.tipo === 'persona').map((i) => i.titolo).sort((a, b) => a.localeCompare(b, 'it'));
}

export function zoneUsate(items: Item[]): string[] {
  const set = new Set<string>();
  for (const i of live(items)) if (i.zona) set.add(i.zona);
  return [...set].sort((a, b) => a.localeCompare(b, 'it'));
}

export function luoghi(items: Item[], zona?: string): Item[] {
  return live(items)
    .filter((i) => i.tipo === 'esperienza' && isOpen(i) && (i.zona || i.luogo) && (!zona || i.zona === zona))
    .sort((a, b) => (a.zona ?? '').localeCompare(b.zona ?? '', 'it') || (b.interesse ?? 3) - (a.interesse ?? 3) || a.titolo.localeCompare(b.titolo, 'it'));
}

/** Ricerca per parole nel titolo, nelle note e nei campi di testo. Tutte le parole devono comparire. */
export function cercaVoci(items: Item[], q: string, max = 60): Item[] {
  const parole = chiaveTitolo(q).split(' ').filter(Boolean);
  if (parole.length === 0) return [];
  const chiave = (i: Item) => chiaveTitolo([i.titolo, i.note, i.consigliatoDa, i.conChi, i.area, i.zona, i.piattaforma, i.genere, ...(i.persone ?? []), ...(i.checklist ?? []).map((c) => c.testo)].filter(Boolean).join(' '));
  const primo = chiaveTitolo(parole[0]);
  return live(items)
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
