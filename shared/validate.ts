// Controllo delle voci lette da un file (importazione, ripristino di una copia): protegge il database da dati malformati.
import type { Item, Stato, Tipo } from './types.ts';
import { NOMI_TIPO } from './types.ts';

const STATI: Stato[] = ['da_fare', 'in_corso', 'fatto', 'saltato', 'parcheggiato'];

export interface EsitoValidazione { voci: Item[]; scartate: number }

/**
 * Accetta un elenco di voci oppure l'esportazione dell'app ({ voci: [...] }).
 * Le voci non valide vengono scartate e contate; i campi mancanti di data vengono completati.
 */
export function validaVoci(dati: unknown, now: number = Date.now()): EsitoValidazione {
  const lista: unknown = Array.isArray(dati)
    ? dati
    : dati && typeof dati === 'object' && Array.isArray((dati as { voci?: unknown }).voci) ? (dati as { voci: unknown[] }).voci : undefined;
  if (!Array.isArray(lista)) throw new Error('Il file non contiene un elenco di voci.');

  const voci: Item[] = [];
  let scartate = 0;
  const visti = new Set<string>();
  for (const x of lista) {
    const i = x as Partial<Item> | null;
    const valida = !!i && typeof i === 'object'
      && typeof i.id === 'string' && i.id.length > 0 && i.id.length <= 64 && !visti.has(i.id)
      && typeof i.titolo === 'string' && i.titolo.trim().length > 0
      && typeof i.tipo === 'string' && i.tipo in NOMI_TIPO
      && typeof i.stato === 'string' && (STATI as string[]).includes(i.stato);
    if (!valida) { scartate++; continue; }
    const v = i as Item;
    visti.add(v.id);
    voci.push({
      ...v,
      tipo: v.tipo as Tipo,
      creato: typeof v.creato === 'number' && Number.isFinite(v.creato) ? v.creato : now,
      aggiornato: typeof v.aggiornato === 'number' && Number.isFinite(v.aggiornato) ? v.aggiornato : now,
    });
  }
  return { voci, scartate };
}
