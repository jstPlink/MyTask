// Pianificazione automatica: distribuisce le attività nei giorni in base a priorità,
// tempo libero e durata. Funzione pura: stesso input, stesso output.
import type { Item } from './types.ts';
import { addDays } from './dates.ts';
import { dueDate } from './priority.ts';
import { candidatiOggi, curiosita, type Entry } from './views.ts';

/** Fascia di tempo libero, orari HH:MM. */
export interface FasciaOraria { da: string; a: string }

export interface Disponibilita {
  /** Sette giorni, da lunedì (0) a domenica (6). */
  settimana: FasciaOraria[][];
  /** Fasce di un giorno preciso (YYYY-MM-DD) al posto di quelle della settimana. */
  eccezioni?: Record<string, FasciaOraria[]>;
}

export const DISPONIBILITA_SUGGERITA: Disponibilita = {
  settimana: [
    [{ da: '18:00', a: '21:00' }], [{ da: '18:00', a: '21:00' }], [{ da: '18:00', a: '21:00' }],
    [{ da: '18:00', a: '21:00' }], [{ da: '18:00', a: '21:00' }],
    [{ da: '09:00', a: '13:00' }], [{ da: '09:00', a: '13:00' }],
  ],
};

export interface Blocco {
  item: Item;
  /** Progetto di cui l'item è il prossimo passo. */
  padre?: Item;
  data: string;
  /** Minuti dalla mezzanotte. */
  da: number;
  a: number;
  /** Se l'attività è spezzata su più blocchi: numero del blocco e totale. */
  parte?: { n: number; di: number };
  /** Impegno con orario già deciso: non viene spostato. */
  fisso?: boolean;
  /** Finisce dopo la scadenza: il tempo prima non bastava. */
  inRitardo?: boolean;
  /** Pausa breve con una curiosità, tra un'attività grande e l'altra: `item` è la curiosità. */
  pausa?: boolean;
}

export interface GiornoPiano {
  data: string;
  blocchi: Blocco[];
  /** Minuti di tempo libero del giorno (al netto degli impegni fissi e, per oggi, dell'ora già passata). */
  liberi: number;
  /** Minuti occupati da attività pianificate (impegni fissi esclusi). */
  usati: number;
}

export interface Piano {
  giorni: GiornoPiano[];
  /** Attività che non entrano nell'orizzonte di pianificazione. */
  fuori: Entry[];
}

export const ORIZZONTE_GIORNI = 14;
const DURATA_PREDEFINITA = 30;
/** Oltre questa durata un'attività si può spezzare su più blocchi e giorni. */
const SOGLIA_SPEZZABILE = 60;
const BLOCCO_MINIMO = 30;
const PASSO = 5;
/** Un blocco di almeno questa durata è "grande": dopo ogni secondo blocco grande del giorno si prova a inserire una pausa curiosità. */
export const SOGLIA_GRANDE = 60;
export const DURATA_PAUSA = 15;
const MAX_PAUSE_GIORNO = 2;

interface Pezzo extends Omit<Blocco, 'parte' | 'inRitardo' | 'pausa'> {
  /** Pausa curiosità riservata subito dopo questo pezzo. */
  riserva?: { item: Item; da: number; a: number };
}

export const minuti = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const orario = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const arrotonda = (n: number) => Math.ceil(n / PASSO) * PASSO;

/** Giorno della settimana con lunedì = 0. */
function giornoSettimana(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

type Gap = [number, number];

function sottrai(gaps: Gap[], da: number, a: number): Gap[] {
  const out: Gap[] = [];
  for (const [s, e] of gaps) {
    if (a <= s || da >= e) { out.push([s, e]); continue; }
    if (da > s) out.push([s, da]);
    if (a < e) out.push([a, e]);
  }
  return out;
}

const durataDi = (i: Item) => Math.max(PASSO, arrotonda(i.sforzoMin ?? DURATA_PREDEFINITA));

export function pianifica(items: Item[], disp: Disponibilita, oggi: string, now: number = Date.now(), giorniOrizzonte = ORIZZONTE_GIORNI): Piano {
  const nowD = new Date(now);
  const minutiOra = arrotonda(nowD.getHours() * 60 + nowD.getMinutes());

  const giorni: GiornoPiano[] = Array.from({ length: giorniOrizzonte }, (_, n) => addDays(oggi, n)).map((data) => ({ data, blocchi: [], liberi: 0, usati: 0 }));
  const gaps = new Map<string, Gap[]>();
  for (const g of giorni) {
    const fasce = disp.eccezioni?.[g.data] ?? disp.settimana[giornoSettimana(g.data)] ?? [];
    let l: Gap[] = fasce.map((f) => [minuti(f.da), minuti(f.a)] as Gap).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
    if (g.data === oggi) l = l.map(([s, e]) => [Math.max(s, minutiOra), e] as Gap).filter(([s, e]) => e > s);
    gaps.set(g.data, l);
  }

  const candidati = candidatiOggi(items, oggi, now).filter((e) => e.item.tipo === 'azione' || e.item.tipo === 'progetto');

  // impegni con orario già deciso: restano dove sono e tolgono tempo libero
  const flessibili: Entry[] = [];
  for (const e of candidati) {
    const i = e.item;
    const giorno = giorni.find((g) => g.data === (i.inizio ?? i.fine));
    if (i.oraInizio && giorno) {
      const da = minuti(i.oraInizio);
      const a = i.oraFine ? minuti(i.oraFine) : da + durataDi(i);
      giorno.blocchi.push({ item: i, padre: e.padre, data: giorno.data, da, a, fisso: true });
      gaps.set(giorno.data, sottrai(gaps.get(giorno.data)!, da, a));
    } else {
      flessibili.push(e);
    }
  }

  // curiosità per le pause: prima le più interessanti, a parità le più vecchie; ognuna una volta sola
  const pool = curiosita(items)
    .filter((c) => c.stato !== 'parcheggiato')
    .sort((a, b) => (b.interesse ?? 3) - (a.interesse ?? 3) || a.aggiornato - b.aggiornato);
  const grandiGiorno = new Map<string, number>();
  const pauseGiorno = new Map<string, number>();
  /** Dopo un pezzo grande (e ogni due), riserva una pausa curiosità se nella fascia resta spazio per altro lavoro. */
  const riservaPausa = (p: Pezzo, l: Gap[], k: number) => {
    const grandi = grandiGiorno.get(p.data) ?? 0;
    grandiGiorno.set(p.data, grandi + 1);
    const rimasto = l[k];
    if (grandi % 2 !== 0 || !rimasto || (pauseGiorno.get(p.data) ?? 0) >= MAX_PAUSE_GIORNO) return;
    if (rimasto[1] - rimasto[0] < DURATA_PAUSA + BLOCCO_MINIMO) return;
    const c = pool.shift();
    if (!c) return;
    p.riserva = { item: c, da: rimasto[0], a: rimasto[0] + DURATA_PAUSA };
    l[k] = [rimasto[0] + DURATA_PAUSA, rimasto[1]];
    pauseGiorno.set(p.data, (pauseGiorno.get(p.data) ?? 0) + 1);
  };

  const fuori: Entry[] = [];
  const ordinati = [...flessibili].sort((a, b) => b.punteggio - a.punteggio);
  for (const e of ordinati) {
    const i = e.item;
    const totale = durataDi(i);
    const scadenza = dueDate(i);
    const spezzabile = totale > SOGLIA_SPEZZABILE;
    const pezzi: Pezzo[] = [];
    let resto = totale;

    for (const g of giorni) {
      if (resto <= 0) break;
      const l = gaps.get(g.data)!;
      for (let k = 0; k < l.length && resto > 0; k++) {
        const [s, f] = l[k];
        const spazio = f - s;
        if (spezzabile) {
          const presa = Math.min(resto, spazio);
          if (presa < BLOCCO_MINIMO && presa < resto) continue;
          const pezzo: Pezzo = { item: i, padre: e.padre, data: g.data, da: s, a: s + presa };
          pezzi.push(pezzo);
          l.splice(k, 1, ...(presa < spazio ? [[s + presa, f] as Gap] : []));
          if (presa >= SOGLIA_GRANDE && presa < spazio) riservaPausa(pezzo, l, k);
          if (presa >= spazio) k--;
          resto -= presa;
        } else if (spazio >= totale) {
          const pezzo: Pezzo = { item: i, padre: e.padre, data: g.data, da: s, a: s + totale };
          pezzi.push(pezzo);
          l.splice(k, 1, ...(totale < spazio ? [[s + totale, f] as Gap] : []));
          if (totale >= SOGLIA_GRANDE && totale < spazio) riservaPausa(pezzo, l, k);
          resto = 0;
        }
      }
    }

    if (resto > 0) {
      // non entra nell'orizzonte: i pezzi già assegnati vengono annullati
      for (const p of pezzi) {
        const l = gaps.get(p.data)!;
        if (p.riserva) { pool.unshift(p.riserva.item); pauseGiorno.set(p.data, (pauseGiorno.get(p.data) ?? 1) - 1); }
        l.push([p.da, p.riserva ? p.riserva.a : p.a]);
        l.sort((a, b) => a[0] - b[0]);
        const unite: Gap[] = [];
        for (const x of l) {
          const ultimo = unite[unite.length - 1];
          if (ultimo && ultimo[1] >= x[0]) ultimo[1] = Math.max(ultimo[1], x[1]); else unite.push([x[0], x[1]]);
        }
        gaps.set(p.data, unite);
      }
      fuori.push(e);
      continue;
    }

    const ultimaData = pezzi[pezzi.length - 1].data;
    const inRitardo = !!scadenza && ultimaData > scadenza;
    pezzi.forEach((p, n) => {
      const { riserva, ...blocco } = p;
      const giorno = giorni.find((g) => g.data === p.data)!;
      giorno.blocchi.push({ ...blocco, parte: pezzi.length > 1 ? { n: n + 1, di: pezzi.length } : undefined, inRitardo });
      if (riserva) giorno.blocchi.push({ item: riserva.item, data: p.data, da: riserva.da, a: riserva.a, pausa: true });
    });
  }

  for (const g of giorni) {
    g.blocchi.sort((a, b) => a.da - b.da);
    g.liberi = (gaps.get(g.data) ?? []).reduce((n, [s, e]) => n + (e - s), 0);
    g.usati = g.blocchi.filter((b) => !b.fisso).reduce((n, b) => n + (b.a - b.da), 0);
  }
  return { giorni, fuori };
}

/** Minuti totali di tempo libero di un giorno, prima della pianificazione (per mostrare "usato su totale"). */
export function minutiDisponibili(disp: Disponibilita, data: string, oggi: string, now: number = Date.now()): number {
  const nowD = new Date(now);
  const minutiOra = arrotonda(nowD.getHours() * 60 + nowD.getMinutes());
  const fasce = disp.eccezioni?.[data] ?? disp.settimana[giornoSettimana(data)] ?? [];
  return fasce.reduce((n, f) => {
    const s = data === oggi ? Math.max(minuti(f.da), minutiOra) : minuti(f.da);
    return n + Math.max(0, minuti(f.a) - s);
  }, 0);
}
