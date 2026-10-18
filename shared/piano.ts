// Pianificazione automatica: distribuisce le attività nei giorni in base a priorità,
// tempo libero e durata. Funzione pura: stesso input, stesso output.
import type { Item } from './types.ts';
import { addDays, today as giornoDi } from './dates.ts';
import { dueDate } from './priority.ts';
import { candidatiOggi, curiosita, perPriorita, type Entry } from './views.ts';

/** Fascia di tempo libero, orari HH:MM. */
export interface FasciaOraria { da: string; a: string }

export interface Disponibilita {
  /** Sette giorni, da lunedì (0) a domenica (6). */
  settimana: FasciaOraria[][];
  /** Fasce di un giorno preciso (YYYY-MM-DD) al posto di quelle della settimana. */
  eccezioni?: Record<string, FasciaOraria[]>;
  /** Minuti di pausa lasciati tra un'attività e la successiva (PAUSA_PREDEFINITA se non impostato). */
  pausaMin?: number;
  /**
   * Modalità flessibile: le fasce della settimana non si usano. Il tempo libero di ogni giorno è quello inserito
   * la sera prima (in `eccezioni`); un giorno senza orari inseriti non ha tempo libero.
   */
  flessibile?: boolean;
  /** Modalità flessibile: ora della sera (HH:MM) a cui l'app chiede gli orari liberi del giorno dopo. */
  oraChiedi?: string;
}

/** Ora di base a cui, in modalità flessibile, arriva la richiesta degli orari di domani. */
export const ORA_CHIEDI_PREDEFINITA = '21:00';

/** Pausa di base tra due attività, in minuti. */
export const PAUSA_PREDEFINITA = 5;

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
  /** Ultimi minuti del blocco che sono margine d'errore sulla stima (il blocco dura già stima + margine). */
  margineMin?: number;
  /** Punteggio di priorità usato dal piano (tiene conto delle dipendenze tra i passi di un progetto). */
  punteggio?: number;
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
  /** Fine del tempo tolto dalla fascia libera: il blocco più la pausa che lo segue. */
  fino: number;
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

/** Fasce di tempo libero di un giorno: quelle inserite per quel giorno, altrimenti (solo in modalità fissa) quelle della settimana. */
export function fasceDelGiorno(disp: Disponibilita, data: string): FasciaOraria[] {
  if (disp.flessibile) return disp.eccezioni?.[data] ?? [];
  return disp.eccezioni?.[data] ?? disp.settimana[giornoSettimana(data)] ?? [];
}

/** Giorni passati per cui si ricordano gli orari inseriti (servono a calcolare il tempo davvero lavorato su una nota iniziata giorni fa). */
export const GIORNI_ORARI_RICORDATI = 45;

/** Toglie gli orari inseriti per giorni passati da molto tempo, così l'impostazione non cresce all'infinito. */
export function senzaGiorniPassati(eccezioni: Record<string, FasciaOraria[]> | undefined, oggi: string): Record<string, FasciaOraria[]> | undefined {
  if (!eccezioni) return undefined;
  const limite = addDays(oggi, -GIORNI_ORARI_RICORDATI);
  const out = Object.fromEntries(Object.entries(eccezioni).filter(([g]) => g >= limite));
  return Object.keys(out).length ? out : undefined;
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

/**
 * Dove sta una nota «in corso»: il posto salvato quando è passata in corso; se non c'è (note segnate prima),
 * il giorno e l'ora (a passi di 5 minuti) in cui è passata in corso. Vale solo se il giorno è tra quelli pianificati.
 */
function postoInCorso(i: Item, giorni: string[]): { data: string; da: number } | undefined {
  if (i.stato !== 'in_corso') return undefined;
  let posto: { data: string; da: number } | undefined;
  if (i.pianoData && i.pianoDa !== undefined) posto = { data: i.pianoData, da: i.pianoDa };
  else if (i.inCorsoTs) {
    const d = new Date(i.inCorsoTs);
    posto = { data: giornoDi(d), da: Math.floor((d.getHours() * 60 + d.getMinutes()) / PASSO) * PASSO };
  }
  return posto && giorni.includes(posto.data) ? posto : undefined;
}

const durataDi = (i: Item) => Math.max(PASSO, arrotonda(i.sforzoMin ?? DURATA_PREDEFINITA));

export function pianifica(items: Item[], disp: Disponibilita, oggi: string, now: number = Date.now(), giorniOrizzonte = ORIZZONTE_GIORNI, margine = 0): Piano {
  const nowD = new Date(now);
  const minutiOra = arrotonda(nowD.getHours() * 60 + nowD.getMinutes());
  const pausa = Math.max(0, Math.round(disp.pausaMin ?? PAUSA_PREDEFINITA));

  const giorni: GiornoPiano[] = Array.from({ length: giorniOrizzonte }, (_, n) => addDays(oggi, n)).map((data) => ({ data, blocchi: [], liberi: 0, usati: 0 }));
  const gaps = new Map<string, Gap[]>();
  for (const g of giorni) {
    const fasce = fasceDelGiorno(disp, g.data);
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
      giorno.blocchi.push({ item: i, padre: e.padre, data: giorno.data, da, a, fisso: true, punteggio: e.punteggio });
      gaps.set(giorno.data, sottrai(gaps.get(giorno.data)!, da, a));
    } else if (postoInCorso(i, giorni.map((g) => g.data))) {
      // nota già iniziata: resta dove era quando è passata «in corso» (stima più margine), non si sposta più
      const posto = postoInCorso(i, giorni.map((g) => g.data))!;
      const g = giorni.find((x) => x.data === posto.data)!;
      const base = durataDi(i);
      const totale = arrotonda(base * (1 + Math.max(0, margine)));
      g.blocchi.push({ item: i, padre: e.padre, data: g.data, da: posto.da, a: posto.da + totale, margineMin: totale - base, punteggio: e.punteggio });
      gaps.set(g.data, sottrai(gaps.get(g.data)!, posto.da, posto.da + totale));
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
    const c = pool[0];
    if (!c) return;
    const durataPausa = Math.max(PASSO, arrotonda(c.sforzoMin ?? DURATA_PAUSA));
    if (rimasto[1] - rimasto[0] < durataPausa + BLOCCO_MINIMO) return;
    pool.shift();
    p.riserva = { item: c, da: rimasto[0], a: rimasto[0] + durataPausa };
    l[k] = [rimasto[0] + durataPausa, rimasto[1]];
    pauseGiorno.set(p.data, (pauseGiorno.get(p.data) ?? 0) + 1);
  };

  const fuori: Entry[] = [];
  const ordinati = [...flessibili].sort(perPriorita);
  for (const e of ordinati) {
    const i = e.item;
    // il tempo reale è sempre la stima più il margine d'errore atteso
    const base = durataDi(i);
    const totale = arrotonda(base * (1 + Math.max(0, margine)));
    const quotaMargine = (totale - base) / totale;
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
          const fino = s + Math.min(spazio, presa + pausa);
          const pezzo: Pezzo = { item: i, padre: e.padre, data: g.data, da: s, a: s + presa, fino, margineMin: Math.round(presa * quotaMargine), punteggio: e.punteggio };
          pezzi.push(pezzo);
          l.splice(k, 1, ...(fino < f ? [[fino, f] as Gap] : []));
          if (presa >= SOGLIA_GRANDE && fino < f) riservaPausa(pezzo, l, k);
          if (fino >= f) k--;
          resto -= presa;
        } else if (spazio >= totale) {
          const fino = s + Math.min(spazio, totale + pausa);
          const pezzo: Pezzo = { item: i, padre: e.padre, data: g.data, da: s, a: s + totale, fino, margineMin: totale - base, punteggio: e.punteggio };
          pezzi.push(pezzo);
          l.splice(k, 1, ...(fino < f ? [[fino, f] as Gap] : []));
          if (totale >= SOGLIA_GRANDE && fino < f) riservaPausa(pezzo, l, k);
          resto = 0;
        }
      }
    }

    if (resto > 0) {
      // non entra nell'orizzonte: i pezzi già assegnati vengono annullati
      for (const p of pezzi) {
        const l = gaps.get(p.data)!;
        if (p.riserva) { pool.unshift(p.riserva.item); pauseGiorno.set(p.data, (pauseGiorno.get(p.data) ?? 1) - 1); }
        l.push([p.da, p.riserva ? p.riserva.a : p.fino]);
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
      const { riserva, fino: _fino, ...blocco } = p;
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
  const fasce = fasceDelGiorno(disp, data);
  return fasce.reduce((n, f) => {
    const s = data === oggi ? Math.max(minuti(f.da), minutiOra) : minuti(f.da);
    return n + Math.max(0, minuti(f.a) - s);
  }, 0);
}

/** Fasce di tempo libero di un giorno, in minuti dalla mezzanotte (senza togliere l'ora già passata). */
export function fasceLibere(disp: Disponibilita, data: string): [number, number][] {
  const fasce = fasceDelGiorno(disp, data);
  return fasce.map((f): [number, number] => [minuti(f.da), minuti(f.a)]).filter(([a, b]) => b > a);
}

const isoDi = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const minutoDel = (ts: number) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };

/** Minuti tra due istanti che cadono nei lassi di tempo segnati come liberi (le pause fuori dal tempo libero non contano). */
export function minutiLiberiTra(disp: Disponibilita, daTs: number, aTs: number): number {
  if (aTs <= daTs) return 0;
  const ultimo = isoDi(aTs);
  let totale = 0;
  let giorno = isoDi(daTs);
  for (let n = 0; n < 120 && giorno <= ultimo; n++, giorno = addDays(giorno, 1)) {
    const inizio = giorno === isoDi(daTs) ? minutoDel(daTs) : 0;
    const fine = giorno === ultimo ? minutoDel(aTs) : 1440;
    for (const [s, e] of fasceLibere(disp, giorno)) totale += Math.max(0, Math.min(e, fine) - Math.max(s, inizio));
  }
  return totale;
}

/**
 * Tempo reale di una nota completata: dall'istante in cui è passata «in corso» a quello in cui è stata completata, contando solo
 * il tempo libero segnato (se hai staccato e ripreso la sera, la pausa non pesa). Senza «in corso» non c'è una misura (undefined).
 * Senza tempo libero impostato conta il tempo trascorso, al massimo 8 ore.
 */
export function durataRealeInCorso(item: Item, now: number, disp: Disponibilita | null): number | undefined {
  if (!item.inCorsoTs || now <= item.inCorsoTs) return undefined;
  const minuti = disp ? minutiLiberiTra(disp, item.inCorsoTs, now) : Math.min(480, (now - item.inCorsoTs) / 60000);
  return minuti >= 0.5 ? Math.max(1, Math.round(minuti)) : undefined;
}
