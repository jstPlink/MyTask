// Arricchimento delle voci di intrattenimento con dati presi da internet (generi, durata, pagine):
// da qui si ricavano tipologia, mood ed energia che usano i filtri di "Cosa guardo stasera".
// Questo file contiene solo le regole (pure, con test); le richieste di rete stanno in web/src/lib/arricchimento.ts.
import type { Item, Tipo } from './types.ts';
import { chiaveTitolo } from './testo.ts';
import { TIPOLOGIE } from './stasera.ts';

/** Tipi di voce che si arricchiscono. */
export const TIPI_ARRICCHIBILI: Tipo[] = ['film', 'serie', 'anime', 'gioco', 'libro'];
const VIDEO: Tipo[] = ['film', 'serie', 'anime'];

/** Ogni quanti giorni si riprova per una voce che non è stata trovata. */
export const GIORNI_RIPROVA = 30;

/** Per ogni tipologia dell'app, le parole (italiane e inglesi) che nei generi trovati online la indicano. */
const RE_TIPOLOGIE: [string, RegExp][] = [
  ['Comico', /comic|commedia|comedy|umoris|satir|parodi/],
  ['Drammatico', /dramm|drama/],
  ['Azione', /azione|action|avventur|adventure|guerra|\bwar\b|western|supereroi|superhero/],
  ['Thriller', /thriller|giallo|mister|mystery|poliziesc|crime|noir|spionagg/],
  ['Horror', /horror|orrore|splatter|slasher/],
  ['Fantascienza', /fantascien|science fiction|sci ?fi|cyberpunk|\bspace\b/],
  ['Fantasy', /fantasy|fantastic|sovrannatur|supernatural|magic/],
  ['Animazione', /animazion|animat|\banime\b|cartoon|manga/],
  ['Documentario', /documentar/],
];

// Mood ed energia si deducono dai generi: il primo mood che combacia vince, nell'ordine in cui sono provati in `moodDa`.
const RE_INTENSO = /horror|orrore|thriller|crime|noir|splatter|slasher|guerra|\bwar\b|giallo/;
const RE_SPENSIERATO = /comic|commedia|comedy|umoris|parodi|famil|bambin|\bkids\b/;
const RE_RIFLESSIVO = /documentar|biograf|storic|dramm|drama|psicolog/;
const RE_EMOZIONANTE = /azione|action|avventur|adventure|fantasy|fantascien|science fiction|supereroi|superhero|sportiv|sport/;
const RE_RILASSANTE = /roman|musical|slice of life|iyashikei|animazion|animat|cartoon/;
const RE_ALTA = /thriller|mister|mystery|giallo|crime|noir|fantascien|science fiction|documentar|dramm|drama|storic|psicolog|guerra|\bwar\b|biograf|cyberpunk/;
const RE_BASSA = /comic|commedia|comedy|animazion|animat|cartoon|roman|famil|musical|slice of life|iyashikei/;

const norm = (labels: string[]) => chiaveTitolo(labels.join(' | '));

/** Tipologie dell'app (Comico, Thriller…) che corrispondono ai generi trovati. */
export function tipologieDa(labels: string[]): string[] {
  const t = norm(labels);
  return TIPOLOGIE.filter((nome) => RE_TIPOLOGIE.some(([n, re]) => n === nome && re.test(t)));
}

/** Stato d'animo che richiede (Intenso, Spensierato, Riflessivo, Emozionante, Rilassante), se i generi lo suggeriscono. */
export function moodDa(labels: string[]): string | undefined {
  const t = norm(labels);
  if (RE_INTENSO.test(t)) return 'Intenso';
  if (RE_SPENSIERATO.test(t)) return 'Spensierato';
  if (RE_RIFLESSIVO.test(t)) return 'Riflessivo';
  if (RE_EMOZIONANTE.test(t)) return 'Emozionante';
  if (RE_RILASSANTE.test(t)) return 'Rilassante';
  return undefined;
}

/** Impegno mentale richiesto per seguire la storia: alta per thriller, fantascienza, drammi…, bassa per commedie e animazione, altrimenti media. */
export function energiaDa(labels: string[]): 'bassa' | 'media' | 'alta' | undefined {
  const t = norm(labels);
  if (!t) return undefined;
  if (RE_ALTA.test(t)) return 'alta';
  if (RE_BASSA.test(t)) return 'bassa';
  return 'media';
}

/** Come si presenta, nella descrizione breve di un risultato, un elemento di ciascun tipo. */
const RE_DESCRIZIONE: Partial<Record<Tipo, RegExp>> = {
  film: /\bfilm\b|lungometraggio|cortometraggio/,
  serie: /serie televisiva|serie tv|television series|web series|miniserie|sitcom|telenovela/,
  anime: /anime|serie animata|animated series|serie televisiva animata/,
  gioco: /videogioc|video ?game|gioco/,
  libro: /romanzo|libro|novel|saggio|raccolta|racconto|fumetto|manga|\bbook\b|poema|opera letteraria/,
};

/** Vero se la descrizione di un risultato (es. "film del 2010 diretto da…") è quella di un elemento del tipo giusto. */
export function descrizioneCompatibile(tipo: Tipo, descrizione: string | undefined): boolean {
  const re = RE_DESCRIZIONE[tipo];
  if (!re) return false;
  const d = chiaveTitolo(descrizione ?? '');
  if (tipo === 'film' && /serie|television/.test(d)) return false;
  return re.test(d);
}

/** Quello che si è trovato su internet per una voce (la ricerca di rete sta in web/src/lib/arricchimento.ts). */
export interface DatiTrovati {
  /** Generi presi da internet (etichette, nella lingua trovata). */
  generi: string[];
  /** Durata in minuti (film). */
  durataMin?: number;
  /** Pagine (libri). */
  pagine?: number;
  /** Breve descrizione presa da Wikipedia (le prime frasi). */
  descrizione?: string;
}

/** Prime frasi di un testo (al massimo due, entro `max` caratteri), per la descrizione di una nota. */
export function accorciaDescrizione(testo: string | undefined, max = 320): string | undefined {
  const t = (testo ?? '').replace(/\s+/g, ' ').replace(/\s*\([^)]*\)/g, '').trim();
  if (t.length < 20) return undefined;
  const frasi = t.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [t];
  let out = '';
  for (const f of frasi.slice(0, 2)) {
    if ((out + f).length > max && out) break;
    out += (out ? ' ' : '') + f.trim();
  }
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Campi da aggiungere alla voce. Non sovrascrive mai quello che l'utente ha già scritto.
 * Film, serie e anime: tipologia, mood, energia e (film) durata, se tra 20 e 400 minuti. Giochi e libri: i generi trovati (al massimo due) e le pagine dei libri.
 */
export function campiDaDati(item: Item, dati: DatiTrovati): Partial<Item> {
  const out: Partial<Item> = {};
  const video = VIDEO.includes(item.tipo);
  if (video) {
    const tip = tipologieDa(dati.generi);
    if (!item.genere && tip.length) out.genere = tip.join(', ');
    if (!item.mood) { const m = moodDa(dati.generi); if (m) out.mood = m; }
    if (!item.energia) { const e = energiaDa(dati.generi); if (e) out.energia = e; }
    if (item.tipo === 'film' && !item.durataMin && dati.durataMin && dati.durataMin >= 20 && dati.durataMin <= 400) out.durataMin = Math.round(dati.durataMin);
  } else {
    if (!item.genere && dati.generi.length) out.genere = [...new Set(dati.generi.map(maiuscola))].slice(0, 2).join(', ');
    if (item.tipo === 'libro' && !item.pagine && dati.pagine && dati.pagine > 0) out.pagine = Math.round(dati.pagine);
  }
  // la descrizione va nelle note, solo se sono ancora vuote
  if (!item.note && dati.descrizione) out.note = dati.descrizione;
  return out;
}

/** Vero se alla voce mancano ancora dati che si possono cercare (la descrizione nelle note, il genere e, per i video, mood, energia e durata del film; per i libri le pagine). */
export function mancaQualcosa(i: Item): boolean {
  if (!TIPI_ARRICCHIBILI.includes(i.tipo)) return false;
  if (!i.note && i.descrittoIl === undefined) return true;
  if (VIDEO.includes(i.tipo)) return !i.genere || !i.mood || !i.energia || (i.tipo === 'film' && !i.durataMin);
  return !i.genere || (i.tipo === 'libro' && !i.pagine);
}

/** Voci da arricchire adesso: dei tipi giusti, con dati mancanti, mai cercate (o non trovate da più di GIORNI_RIPROVA giorni). */
export function daArricchire(items: Item[], now: number = Date.now()): Item[] {
  const limite = now - GIORNI_RIPROVA * 86400000;
  return items
    .filter((i) => !i.eliminato && mancaQualcosa(i) && (i.arricchitoIl === undefined || i.arricchitoIl < limite))
    .sort((a, b) => b.aggiornato - a.aggiornato);
}
