// Modello dati condiviso tra server e web. Solo sintassi cancellabile (niente enum),
// così Node può eseguire questi file direttamente.

export type Tipo =
  | 'azione' | 'progetto' | 'esperienza' | 'routine'
  | 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta'
  | 'curiosita' | 'persona';

export const TIPI_AZIONE: Tipo[] = ['azione', 'progetto', 'esperienza'];
export const TIPI_COLLEZIONE: Tipo[] = ['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta'];
/** Tipi raggruppati sotto "Intrattenimento" nella scelta del tipo. */
export const TIPI_INTRATTENIMENTO: Tipo[] = ['film', 'serie', 'anime', 'gioco', 'libro'];
export const TIPI_VIDEO: Tipo[] = ['film', 'serie', 'anime'];

export const NOMI_TIPO: Record<Tipo, string> = {
  azione: 'Attività', progetto: 'Progetto', esperienza: 'Esperienza', routine: 'Routine',
  film: 'Film', serie: 'Serie', anime: 'Anime', gioco: 'Gioco', libro: 'Libro', ricetta: 'Ricetta',
  curiosita: 'Curiosità', persona: 'Persona',
};

export type Stato = 'da_fare' | 'in_corso' | 'fatto' | 'saltato' | 'parcheggiato';

export type Fascia = 'mattina' | 'pomeriggio' | 'sera' | 'prima_di_dormire';
export const NOMI_FASCIA: Record<Fascia, string> = {
  mattina: 'Mattina', pomeriggio: 'Pomeriggio', sera: 'Sera', prima_di_dormire: 'Prima di dormire',
};

export interface Ricorrenza { ogni: number; unita: 'giorni' | 'settimane' | 'mesi' | 'anni' }
/** Promemoria a "giorniPrima" giorni dalla scadenza, all'ora indicata (HH:MM). */
export interface Promemoria { giorniPrima: number; ora: string }
/** Insistenza: il promemoria si ripete ogni N minuti finché la voce non viene spuntata. */
export interface Insistenza { ogniMinuti: number }
export interface VoceChecklist { id: string; testo: string; fatto: boolean }

export interface Item {
  id: string;
  tipo: Tipo;
  titolo: string;
  stato: Stato;
  /** millisecondi dall'epoca */
  creato: number;
  aggiornato: number;
  eliminato?: boolean;

  /** Catturata ma non ancora smistata. */
  inbox?: boolean;
  /** Messa in Revisione a mano o dall'import. */
  daRivedere?: boolean;

  note?: string;
  link?: string[];

  // date (YYYY-MM-DD) e orari (HH:MM)
  inizio?: string;
  fine?: string;
  oraInizio?: string;
  oraFine?: string;
  rigida?: boolean;
  ricorrenza?: Ricorrenza;
  promemoria?: Promemoria[];
  insisti?: Insistenza;

  // priorità e collezioni
  importanza?: number; // 1-5, azioni e progetti
  sforzoMin?: number;
  interesse?: number; // 1-5, collezioni, esperienze e curiosità
  area?: string; // Casa, Burocrazia, Digitale, Salute, Lavoro...

  // gerarchia
  padreId?: string;
  checklist?: VoceChecklist[];

  // persone e luoghi
  persone?: string[];
  zona?: string;
  luogo?: string;
  linkMaps?: string;

  // collezioni
  piattaforma?: string;
  consigliatoDa?: string;
  conChi?: string;
  durataMin?: number;
  /** Film, serie e anime: stato d'animo che richiedono (Spensierato, Rilassante…). */
  mood?: string;
  /** Film, serie e anime: energia che richiedono per essere seguiti. */
  energia?: 'bassa' | 'media' | 'alta';
  /** Pagine di un libro (cercate online al momento della creazione). */
  pagine?: number;
  genere?: string;
  voto?: number;
  /** Commento lasciato quando si segna come fatto un film, un libro, un gioco… */
  commento?: string;
  completatoIl?: string;

  // routine
  fascia?: Fascia;
  volteSettimana?: number;
  obiettivo?: string;
  /** ora (HH:MM) del promemoria giornaliero della routine */
  oraPromemoria?: string;
  /** date (YYYY-MM-DD) in cui la routine è stata fatta */
  log?: string[];

  // persona
  daContattare?: boolean;
}

export interface SyncRequest { since: number; changes: Item[] }
export interface SyncResponse { items: Item[]; seq: number }
