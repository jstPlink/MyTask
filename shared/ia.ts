// Funzioni pure per le funzioni IA scelte dall'utente (Gemini e Groq): autocompilazione della tipologia delle opere
// di intrattenimento e riepilogo delle note da dare alla chat. Le richieste di rete stanno in web/src/lib/ia.ts.
import type { Item } from './types.ts';
import { NOMI_TIPO } from './types.ts';
import { MOOD, TIPOLOGIE } from './stasera.ts';
import { dueDate, isOpen, score, barLevel } from './priority.ts';
import { live } from './views.ts';

export type Provider = 'gemini' | 'groq';
export const NOMI_PROVIDER: Record<Provider, string> = { gemini: 'Gemini', groq: 'Groq' };
export const MODELLI_PREDEFINITI: Record<Provider, string> = { gemini: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' };

/** Tipi di opere di cui si compila la tipologia. */
export const TIPI_OPERE: Item['tipo'][] = ['film', 'serie', 'anime', 'gioco', 'libro'];
const VIDEO: Item['tipo'][] = ['film', 'serie', 'anime'];

/** Opere a cui manca la tipologia (il campo «genere»): sono quelle da passare in rassegna. */
export const opereSenzaTipologia = (items: Item[]): Item[] =>
  live(items).filter((i) => TIPI_OPERE.includes(i.tipo) && !i.genere?.trim() && !i.inbox);

/** Richiesta per un gruppo di opere: tipologie, mood ed energia, scelti solo tra i valori che l'app conosce. */
export function promptTipologie(opere: Item[]): string {
  const elenco = opere.map((o, n) => `${n}. [${NOMI_TIPO[o.tipo]}] ${o.titolo.slice(0, 120)}${o.piattaforma ? ` (${o.piattaforma})` : ''}`).join('\n');
  return `Sei l'assistente di un'app personale in italiano. Per ogni opera (film, serie, anime, videogioco o libro) indica:
- tipologie: da 1 a 3 scelte SOLO tra: ${TIPOLOGIE.join(', ')}
- mood: uno SOLO tra: ${MOOD.join(', ')}
- energia (impegno mentale per seguirla): bassa, media oppure alta
Se non conosci l'opera, lascia l'elenco delle tipologie vuoto. Non inventare.
Rispondi SOLO con un oggetto JSON fatto così: {"risultati":[{"n":0,"tipologie":["Thriller"],"mood":"Intenso","energia":"alta"}]}

Opere:
${elenco}`;
}

export interface RispostaOpera { n: number; tipologie?: string[]; mood?: string; energia?: string }

/** Estrae i risultati dalla risposta dell'IA (anche se è dentro un blocco di codice o ha testo attorno). */
export function leggiRisposta(testo: string): RispostaOpera[] {
  const t = testo.replace(/```(?:json)?/gi, '');
  const inizio = t.indexOf('{');
  const fine = t.lastIndexOf('}');
  if (inizio < 0 || fine <= inizio) return [];
  try {
    const o = JSON.parse(t.slice(inizio, fine + 1)) as { risultati?: unknown };
    return Array.isArray(o.risultati) ? (o.risultati as RispostaOpera[]).filter((r) => r && Number.isInteger(r.n)) : [];
  } catch { return []; }
}

/** Campi da aggiungere a un'opera. Non sovrascrive mai quello che c'è già e accetta solo i valori noti all'app. */
export function campiDaRisposta(item: Item, r: RispostaOpera): Partial<Item> {
  const out: Partial<Item> = {};
  const tip = [...new Set((r.tipologie ?? []).map((x) => TIPOLOGIE.find((t) => t.toLowerCase() === String(x).trim().toLowerCase())).filter((x): x is string => !!x))].slice(0, 3);
  if (!item.genere?.trim() && tip.length) out.genere = tip.join(', ');
  if (VIDEO.includes(item.tipo)) {
    if (!item.mood) { const m = MOOD.find((x) => x.toLowerCase() === String(r.mood ?? '').trim().toLowerCase()); if (m) out.mood = m; }
    if (!item.energia) { const e = String(r.energia ?? '').trim().toLowerCase(); if (e === 'bassa' || e === 'media' || e === 'alta') out.energia = e; }
  }
  return out;
}

/** Istruzioni per la chat: cos'è l'app e come rispondere. */
export const ISTRUZIONI_CHAT = `Sei l'assistente di MyTask, un'app personale in italiano per organizzare attività, progetti, esperienze, routine, curiosità e cose da guardare, giocare o leggere.
Come funziona: ogni nota ha una priorità da 0 a 100 (urgenza, importanza, poco sforzo, età, scadenza fissa); in Oggi il piano dispone le attività nel tempo libero; l'Inbox raccoglie le note non ancora smistate; gli stati sono da fare, in corso, fatta e archiviata.
Rispondi in italiano, in modo breve e concreto. Se ti viene dato un riepilogo delle note usalo, altrimenti dì che non hai accesso ai dati dell'utente. Non inventare note che non vedi.`;

/**
 * Riepilogo compatto delle note da dare alla chat (solo se l'utente lo sceglie): conteggi e un elenco ristretto, senza testi lunghi.
 */
export function riepilogoPerChat(items: Item[], oggi: string, now: number = Date.now()): string {
  const viv = live(items).filter((i) => i.tipo !== 'persona');
  const conta = new Map<string, number>();
  for (const i of viv.filter(isOpen)) conta.set(NOMI_TIPO[i.tipo], (conta.get(NOMI_TIPO[i.tipo]) ?? 0) + 1);
  const attivita = viv.filter((i) => (i.tipo === 'azione' || i.tipo === 'progetto') && isOpen(i) && !i.inbox)
    .map((i) => ({ i, s: score(i, oggi, now) })).sort((a, b) => b.s - a.s).slice(0, 25)
    .map(({ i, s }) => `- ${i.titolo.slice(0, 80)} (priorità ${['', 'bassa', 'media', 'alta'][barLevel(s)]}${dueDate(i) ? `, scade ${dueDate(i)}` : ''}${i.stato === 'in_corso' ? ', in corso' : ''})`);
  const altre = (tipo: Item['tipo'], n: number) => viv.filter((i) => i.tipo === tipo && isOpen(i)).slice(0, n).map((i) => `- ${i.titolo.slice(0, 60)}${i.zona ? ` (${i.zona})` : ''}`);
  const parti = [
    `Data di oggi: ${oggi}.`,
    `Note aperte: ${[...conta.entries()].map(([k, n]) => `${k} ${n}`).join(', ') || 'nessuna'}.`,
    attivita.length ? `Attività e progetti più prioritari:\n${attivita.join('\n')}` : '',
    altre('esperienza', 12).length ? `Esperienze:\n${altre('esperienza', 12).join('\n')}` : '',
    altre('film', 10).length ? `Film da vedere:\n${altre('film', 10).join('\n')}` : '',
    altre('serie', 10).length ? `Serie da vedere:\n${altre('serie', 10).join('\n')}` : '',
  ];
  return parti.filter(Boolean).join('\n');
}
