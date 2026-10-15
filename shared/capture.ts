// Interpretazione locale (senza IA) di una riga di cattura rapida. Serve offline
// e come ripiego quando il servizio IA non risponde.
import type { Item, Tipo } from './types.ts';
import { addDays, toISO } from './dates.ts';

export interface Proposta {
  tipo: Tipo;
  titolo: string;
  piattaforma?: string;
  consigliatoDa?: string;
  conChi?: string;
  inizio?: string;
  /** false = tipo incerto: la voce va in Inbox */
  sicura: boolean;
}

const PIATTAFORME: [RegExp, string][] = [
  [/\bnetflix\b/i, 'Netflix'],
  [/\b(prime video|amazon prime|prime)\b/i, 'Prime Video'],
  [/\bdisney\s*\+|\bdisney plus\b|\bdisney\b/i, 'Disney+'],
  [/\binfinity\b/i, 'Infinity'],
  [/\bapple tv\b/i, 'Apple TV'],
  [/\bsky\b/i, 'Sky'],
  [/\brai ?play\b/i, 'RaiPlay'],
  [/\byoutube\b/i, 'YouTube'],
  [/\bcrunchyroll\b/i, 'Crunchyroll'],
  [/\bsteam\b/i, 'Steam'],
  [/\bswitch\b/i, 'Switch'],
  [/\bplaystation|\bps5\b|\bps4\b/i, 'PlayStation'],
];

/** Chiave per riconoscere lo stesso titolo scritto in modo diverso (maiuscole, accenti, apostrofi). */
export function chiaveTitolo(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const MAIUSC = (s: string) => s.trim().replace(/\s+/g, ' ').split(' ').map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p)).join(' ');

const RE_CONSIGLIATO = /(?:me l['’]ha (?:consigliat[oa]|suggerit[oa])|consigliat[oa] da|suggerit[oa] da|citat[oa] da|me ne ha parlato|mi ha parlato)\s+([A-ZÀ-Ý][\p{L}']+(?:\s+[A-ZÀ-Ý][\p{L}']+)?)/iu;
const RE_CON = /\bcon\s+([A-ZÀ-Ý][\p{L}']+)/u;

const PAROLE_AZIONE = /\b(chiamare|telefonare|pagare|comprare|ordinare|prenotare|rinnovare|scrivere a|mandare|inviare|ritirare|prendere|vendere|cambiare|disdire|verificare|controllare|fare|sistemare|portare|restituire|gettare|buttare)\b/i;
const PAROLE_ESPERIENZA = /\b(visitare|andare a|andare al|museo|parco|terme|concerto|festival|mostra|escape room|gita|viaggio|cammino|spiaggia|cascate|rifugio|castello|weekend)\b/i;

export function parseCapture(testo: string, oggi: Date = new Date()): Proposta {
  const orig = testo.trim();
  let resto = orig;

  const m = resto.match(RE_CONSIGLIATO);
  const consigliatoDa = m ? MAIUSC(m[1]) : undefined;
  if (m) resto = resto.replace(m[0], ' ');

  let piattaforma: string | undefined;
  for (const [re, nome] of PIATTAFORME) {
    if (re.test(resto)) { piattaforma = nome; resto = resto.replace(re, ' '); break; }
  }
  // "su", "in" rimasti appesi dopo aver tolto la piattaforma
  resto = resto.replace(/\b(su|sulla|sul|in)\s*(?=[,.;]|$)/gi, ' ');

  const c = resto.match(RE_CON);
  const conChi = c ? MAIUSC(c[1]) : undefined;

  let inizio: string | undefined;
  const low = orig.toLowerCase();
  if (/\bdopodomani\b/.test(low)) inizio = toISO(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 2));
  else if (/\bdomani\b/.test(low)) inizio = toISO(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1));
  else if (/\boggi\b/.test(low)) inizio = toISO(oggi);
  else {
    const tra = low.match(/\btra\s+(\d{1,3})\s+giorn/);
    if (tra) inizio = addDays(toISO(oggi), Number(tra[1]));
  }
  resto = resto.replace(/\b(dopodomani|domani|oggi)\b/gi, ' ');

  let tipo: Tipo | undefined;
  if (/\banime\b|\bmanga\b/i.test(orig)) tipo = 'anime';
  else if (/\bserie( tv)?\b|\bstagione\b/i.test(orig)) tipo = 'serie';
  else if (/\bfilm\b|\bpellicola\b/i.test(orig)) tipo = 'film';
  else if (/\bgioco\b|\bvideogioco\b|\bvideogame\b/i.test(orig)) tipo = 'gioco';
  else if (/\blibro\b|\bromanzo\b|\bfumetto\b/i.test(orig)) tipo = 'libro';
  else if (/\bricetta\b/i.test(orig)) tipo = 'ricetta';
  else if (PAROLE_ESPERIENZA.test(orig)) tipo = 'esperienza';
  else if (PAROLE_AZIONE.test(orig) || inizio) tipo = 'azione';
  else if (piattaforma && ['Netflix', 'Prime Video', 'Disney+', 'Infinity', 'Apple TV', 'Sky', 'RaiPlay', 'Crunchyroll'].includes(piattaforma)) tipo = 'film';
  else if (piattaforma && ['Steam', 'Switch', 'PlayStation'].includes(piattaforma)) tipo = 'gioco';

  // Titolo: la parte prima della prima virgola, ripulita; se non ci sono virgole, ciò che resta.
  let titolo = resto.split(/[,;]/)[0];
  titolo = titolo
    .replace(/\b(film|serie( tv)?|anime|gioco|videogioco|libro|romanzo|fumetto|ricetta)\b\s*(da vedere|da giocare|da leggere)?/gi, ' ')
    .replace(/\s+/g, ' ').replace(/^[\s:\-–"“]+|[\s:\-–"”]+$/g, '');
  if (!titolo) titolo = orig;
  titolo = titolo[0].toUpperCase() + titolo.slice(1);

  return {
    tipo: tipo ?? 'curiosita',
    titolo,
    piattaforma,
    consigliatoDa,
    conChi,
    inizio,
    sicura: tipo !== undefined,
  };
}

/** Converte una proposta in una voce completa da salvare. */
export function proposalToItem(p: Proposta, id: string, now: number): Item {
  return {
    id,
    tipo: p.tipo,
    titolo: p.titolo,
    stato: 'da_fare',
    creato: now,
    aggiornato: now,
    inbox: !p.sicura || undefined,
    piattaforma: p.piattaforma,
    consigliatoDa: p.consigliatoDa,
    conChi: p.conChi,
    inizio: p.inizio,
    interesse: ['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta', 'curiosita', 'esperienza'].includes(p.tipo) ? 3 : undefined,
    importanza: ['azione', 'progetto'].includes(p.tipo) ? 3 : undefined,
  };
}
