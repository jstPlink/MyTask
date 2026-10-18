// Regole di smistamento usate dall'importazione da Notion.
//
// Le regole dipendono dai dati di chi importa (titoli, nomi di persone, luoghi), quindi:
//  - `regole.esempio.ts` è pubblico e contiene solo regole generiche;
//  - `regole.locale.ts` (non finisce su git) contiene quelle personali e, se esiste, ha la precedenza.
// Le chiavi delle tabelle sono titoli o note in minuscolo e senza accenti (vedi `norm` in notion.ts).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Fascia, Item, Tipo } from '../../shared/types.ts';

/** Impostazioni di una routine importata. */
export interface ImpostazioniRoutine { fascia: Fascia; volteSettimana?: number; obiettivo: string; stato: Item['stato'] }
/** Dati strutturati che certe note di Notion nascondevano nel testo (es. "netflix" → piattaforma). */
export interface NotaSpeciale { consigliatoDa?: string; conChi?: string; piattaforma?: string; genere?: string; note?: string }

/** Le tabelle di smistamento usate da `converti`. */
export interface Regole {
  /** Titoli che sono serie TV (i "Video" non elencati diventano film). */
  serie: string[];
  /** Titoli che sono anime. */
  anime: string[];
  /** Titolo → tipo, quando non coincide con quello che darebbe il tipo Notion. */
  tipoForzato: Record<string, Tipo>;
  /** Titolo di una routine → impostazioni. */
  routine: Record<string, ImpostazioniRoutine>;
  /** Titolo → zona (regione, città). */
  zone: Record<string, string>;
  /** Titolo → persone nominate nel titolo o nelle note. */
  personeVoce: Record<string, string[]>;
  /** Persone da marcare "da contattare". */
  daContattare: string[];
  /** Nota (intera) → dati strutturati nascosti nella nota. */
  noteSpeciali: Record<string, NotaSpeciale>;
  /** Area → espressione regolare (senza maiuscole) applicata al titolo delle azioni. L'ordine conta. */
  aree: [string, string][];
  /** Titoli con scadenza rigida. */
  rigide: string[];
  /** Titolo → motivo per cui va controllato a mano (finisce nel report). */
  daVerificare: Record<string, string>;
}

/** Carica le regole personali se il file esiste, altrimenti quelle di esempio. */
export async function caricaRegole(): Promise<{ regole: Regole; origine: 'locale' | 'esempio' }> {
  const locale = path.join(import.meta.dirname, 'regole.locale.ts');
  if (fs.existsSync(locale)) {
    // percorso in una variabile: il file è ignorato da git e può non esistere (per esempio nel controllo su GitHub)
    const m = (await import(pathToFileURL(locale).href)) as { REGOLE: Regole };
    return { regole: m.REGOLE, origine: 'locale' };
  }
  const m = (await import('./regole.esempio.ts')) as { REGOLE: Regole };
  return { regole: m.REGOLE, origine: 'esempio' };
}
