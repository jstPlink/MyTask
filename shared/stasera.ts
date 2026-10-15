// "Cosa guardo stasera?": ragionamento locale su interesse, durata, piattaforma e compagnia.
import type { Item } from './types.ts';
import { TIPI_VIDEO } from './types.ts';

export type Durata = 'breve' | 'media' | 'lunga' | 'serie';

export interface FiltriStasera {
  durata: Durata;
  conChi?: string; // vuoto = da solo
  piattaforma?: string; // vuoto = qualsiasi
}

export interface Suggerimento { item: Item; motivo: string; punti: number }

function fitDurata(i: Item, d: Durata): number {
  if (d === 'serie') return i.tipo === 'serie' || i.tipo === 'anime' ? 30 : -100;
  if (i.tipo !== 'film') return -100; // film (anche d'animazione): le serie solo con "Serie"
  const m = i.durataMin;
  if (m === undefined) return 0;
  if (d === 'breve') return m <= 90 ? 25 : m <= 110 ? 0 : -40;
  if (d === 'media') return m > 80 && m <= 130 ? 25 : -10;
  return m > 120 ? 25 : -30;
}

export function suggerisciStasera(items: Item[], f: FiltriStasera, max = 3): Suggerimento[] {
  const candidati = items.filter((i) => !i.eliminato && !i.inbox && TIPI_VIDEO.includes(i.tipo) && (i.stato === 'da_fare' || i.stato === 'in_corso'));
  const out: Suggerimento[] = [];
  for (const i of candidati) {
    if (f.piattaforma && i.piattaforma && i.piattaforma !== f.piattaforma) continue;
    const fit = fitDurata(i, f.durata);
    if (fit <= -100) continue;
    let punti = (i.interesse ?? 3) * 20 + fit;
    const motivi: string[] = [];
    if (f.piattaforma && i.piattaforma === f.piattaforma) { punti += 15; motivi.push(`su ${f.piattaforma}`); }
    if (f.conChi && i.conChi?.toLowerCase() === f.conChi.toLowerCase()) { punti += 25; motivi.push(`da vedere con ${f.conChi}`); }
    if (!f.conChi && i.conChi) punti -= 15;
    if (i.stato === 'in_corso') { punti += 10; motivi.push('già iniziato'); }
    if (i.consigliatoDa) motivi.push(`consigliato da ${i.consigliatoDa}`);
    if ((i.interesse ?? 3) >= 4) motivi.unshift('interesse alto');
    if (fit > 0 && f.durata !== 'serie') motivi.push(f.durata === 'breve' ? 'breve' : f.durata === 'lunga' ? 'lungo' : 'durata giusta');
    out.push({ item: i, motivo: motivi.length ? motivi.join(', ') : 'mai visto', punti });
  }
  return out.sort((a, b) => b.punti - a.punti || a.item.titolo.localeCompare(b.item.titolo, 'it')).slice(0, max);
}
