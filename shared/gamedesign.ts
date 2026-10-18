// Priorità delle idee di videogiochi (tipo «Game design»): un punteggio da 0 a 100 che mescola interesse, tempo stimato e
// difficoltà. Pesa di più l'interesse, poi il tempo, infine la difficoltà: si fa prima ciò che interessa di più, è più breve
// da realizzare ed è meno difficile. Funzioni pure.
import type { Item } from './types.ts';
import { isOpen } from './priority.ts';

/** Pesi (somma 100): interesse 50, tempo stimato 30, difficoltà 20. */
export const PESI_GAMEDESIGN = { interesse: 50, tempo: 30, difficolta: 20 } as const;

/** Valore di un parametro non compilato: l'idea non viene né premiata né penalizzata. */
const NEUTRO = 50;

/** Tempo stimato (minuti) che vale 100 (un'ora) e quello che vale 0 (30 giorni): in mezzo la scala è logaritmica, perché le stime variano di ordini di grandezza. */
const MIN_TEMPO = 60;
const MAX_TEMPO = 30 * 24 * 60;

/** Componenti del punteggio, ognuna da 0 a 100 (più alto = più prioritario). */
export function componentiGameDesign(i: Item): { interesse: number; tempo: number; difficolta: number } {
  const interesse = ((Math.min(5, Math.max(1, i.interesse ?? 3)) - 1) / 4) * 100;
  const tempo = i.sforzoMin && i.sforzoMin > 0
    ? 100 * (1 - (Math.log(Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, i.sforzoMin))) - Math.log(MIN_TEMPO)) / (Math.log(MAX_TEMPO) - Math.log(MIN_TEMPO)))
    : NEUTRO;
  const difficolta = i.difficolta ? ((5 - Math.min(5, Math.max(1, i.difficolta))) / 4) * 100 : NEUTRO;
  return { interesse, tempo, difficolta };
}

/** Punteggio di priorità da 0 a 100: più alto = da realizzare prima. */
export function punteggioGameDesign(i: Item): number {
  const c = componentiGameDesign(i);
  const p = PESI_GAMEDESIGN;
  return (c.interesse * p.interesse + c.tempo * p.tempo + c.difficolta * p.difficolta) / (p.interesse + p.tempo + p.difficolta);
}

/** Idee aperte (da fare o in corso, non archiviate, fuori dall'Inbox), dalla più alla meno prioritaria; a parità la più vecchia. */
export function listaGameDesign(items: Item[]): { item: Item; punteggio: number }[] {
  return items
    .filter((i) => i.tipo === 'gamedesign' && !i.eliminato && isOpen(i) && i.stato !== 'parcheggiato' && !i.inbox)
    .map((item) => ({ item, punteggio: punteggioGameDesign(item) }))
    .sort((a, b) => b.punteggio - a.punteggio || a.item.creato - b.item.creato || a.item.id.localeCompare(b.item.id));
}
