// "Cosa guardo stasera?" (schermata Scoprire): ragionamento locale, senza IA, che dà punti a film, serie e anime ancora da vedere
// secondo interesse, durata, piattaforma, compagnia, mood, energia e tipologia. I punteggi sono pesi empirici, non una formula esatta.
import type { Item } from './types.ts';
import { TIPI_VIDEO } from './types.ts';

export type Durata = 'breve' | 'media' | 'lunga' | 'serie';
export type Compagnia = 'solo' | 'partner' | 'amici';
export type Energia = 'bassa' | 'media' | 'alta';

export const COMPAGNIE: { id: Compagnia; nome: string }[] = [{ id: 'solo', nome: 'Da solo' }, { id: 'partner', nome: 'Con il partner' }, { id: 'amici', nome: 'Con amici' }];
export const MOOD = ['Spensierato', 'Rilassante', 'Emozionante', 'Intenso', 'Riflessivo'];
export const ENERGIE: { id: Energia; nome: string }[] = [{ id: 'bassa', nome: 'Bassa' }, { id: 'media', nome: 'Media' }, { id: 'alta', nome: 'Alta' }];
/** Tipologie (generi) tra cui scegliere; si confrontano con il campo "genere" delle voci. */
export const TIPOLOGIE = ['Comico', 'Drammatico', 'Azione', 'Thriller', 'Horror', 'Fantascienza', 'Fantasy', 'Animazione', 'Documentario'];
/** Piattaforme sempre proposte, oltre a quelle già usate nelle voci. */
export const PIATTAFORME_BASE = ['Prime Video', 'Disney+'];

/** Filtri scelti dall'utente per la serata; ogni campo vuoto significa «indifferente». */
export interface FiltriStasera {
  durata?: Durata; // vuoto = nessun filtro sul tempo
  compagnia?: Compagnia; // vuoto = indifferente
  piattaforma?: string; // vuoto = qualsiasi
  mood?: string; // vuoto = qualsiasi
  energia?: Energia; // l'energia che hai stasera: vuoto = qualsiasi
  tipologia?: string; // vuoto = qualsiasi
}

/** Un titolo proposto, con le ragioni leggibili e il punteggio usato per ordinare. */
export interface Suggerimento { item: Item; motivo: string; punti: number }

/** Punti per quanto la durata combacia: film breve ≤ 90 min, medio 80-130, lungo > 120; «serie» propone serie e anime. -100 esclude la voce. */
function fitDurata(i: Item, d: Durata | undefined): number {
  if (!d) return 0;
  if (d === 'serie') return i.tipo === 'serie' || i.tipo === 'anime' ? 30 : -100;
  if (i.tipo !== 'film') return -100; // film (anche d'animazione): le serie solo con "Serie"
  const m = i.durataMin;
  if (m === undefined) return 0;
  if (d === 'breve') return m <= 90 ? 25 : m <= 110 ? 0 : -40;
  if (d === 'media') return m > 80 && m <= 130 ? 25 : -10;
  return m > 120 ? 25 : -30;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const RADICI_TIPOLOGIE: Record<string, RegExp> = {
  Comico: /comic|commedia|comed|ridere/, Drammatico: /dramm|dramma/, Azione: /azione|action/, Thriller: /thriller|giallo|poliziesc/,
  Horror: /horror|paura/, Fantascienza: /fantascienza|sci-?fi|science/, Fantasy: /fantasy|fantastic/, Animazione: /animazion|animat|cartoon/, Documentario: /documentar/,
};

/** Vero/falso se il genere della voce corrisponde alla tipologia; undefined se la voce non ha un genere. */
function corrispondeTipologia(i: Item, t: string): boolean | undefined {
  if (!i.genere?.trim()) return undefined;
  const g = norm(i.genere);
  const re = RADICI_TIPOLOGIE[t];
  return re ? re.test(g) : g.includes(norm(t));
}

/** Livello numerico dell'energia, per confrontare quella richiesta con quella disponibile. */
const LIVELLO: Record<Energia, number> = { bassa: 0, media: 1, alta: 2 };

/**
 * I `max` titoli più adatti. Base: interesse × 20 (3 = 60 punti, valore di base se manca). Poi si sommano: durata (±), piattaforma uguale +15,
 * compagnia (+25 se la voce dice «con chi» e combacia, -15 per «da solo» se la voce è per più persone), mood uguale +20 e diverso -20,
 * energia (uguale +15, richiesta maggiore -30 per livello, minore +5), tipologia uguale +25 e diversa -25, già iniziato +10.
 * A parità di punti, ordine alfabetico.
 */
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

    // compagnia: la voce può dire con chi guardarla ("partner", "amici"…); senza indicazione resta neutra
    const con = i.conChi ? norm(i.conChi) : '';
    if (f.compagnia === 'partner') { if (/partner|moglie|marito|fidanzat|ragazz|compagn/.test(con)) { punti += 25; motivi.push('da vedere in coppia'); } }
    else if (f.compagnia === 'amici') { if (/amic|gruppo|compagni/.test(con)) { punti += 25; motivi.push('da vedere con amici'); } }
    else if (f.compagnia === 'solo' && con) punti -= 15;

    // mood
    if (f.mood && i.mood) {
      if (norm(i.mood) === norm(f.mood)) { punti += 20; motivi.push(`mood ${i.mood.toLowerCase()}`); } else punti -= 20;
    }
    // energia: quanta ne hai stasera contro quanta ne chiede la voce
    if (f.energia && i.energia) {
      const richiesta = LIVELLO[i.energia];
      const disponibile = LIVELLO[f.energia];
      if (richiesta === disponibile) { punti += 15; motivi.push(`energia ${i.energia}`); }
      else if (richiesta > disponibile) punti -= 30 * (richiesta - disponibile);
      else punti += 5;
    }
    // tipologia
    if (f.tipologia) {
      const c = corrispondeTipologia(i, f.tipologia);
      if (c === true) { punti += 25; motivi.push(f.tipologia.toLowerCase()); } else if (c === false) punti -= 25;
    }

    if (i.stato === 'in_corso') { punti += 10; motivi.push('già iniziato'); }
    if (i.consigliatoDa) motivi.push(`consigliato da ${i.consigliatoDa}`);
    if ((i.interesse ?? 3) >= 4) motivi.unshift('interesse alto');
    if (fit > 0 && f.durata && f.durata !== 'serie') motivi.push(f.durata === 'breve' ? 'breve' : f.durata === 'lunga' ? 'lungo' : 'durata giusta');
    out.push({ item: i, motivo: motivi.length ? motivi.join(', ') : 'mai visto', punti });
  }
  return out.sort((a, b) => b.punti - a.punti || a.item.titolo.localeCompare(b.item.titolo, 'it')).slice(0, max);
}
