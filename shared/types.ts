// Modello dati condiviso tra server e web: una sola tabella di «voci» (`Item`) con un campo `tipo`.
// Sul server ogni voce è un documento JSON con un numero di sequenza (sincronizzazione); sul dispositivo sta in IndexedDB.
// Solo sintassi cancellabile (niente enum), così Node può eseguire questi file direttamente.

export type Tipo =
  | 'azione' | 'progetto' | 'esperienza' | 'routine'
  | 'film' | 'serie' | 'anime' | 'gioco' | 'libro' | 'ricetta'
  | 'curiosita' | 'gamedesign' | 'persona'
  /** Nota non ancora smistata: il tipo lo sceglie l'utente quando la smista dall'Inbox. */
  | 'nota';

/** Tipi raggruppati sotto "Intrattenimento" nella scelta del tipo. */
export const TIPI_INTRATTENIMENTO: Tipo[] = ['film', 'serie', 'anime', 'gioco', 'libro'];
/** Tipi che si guardano: sono quelli proposti da «Cosa guardo stasera». */
export const TIPI_VIDEO: Tipo[] = ['film', 'serie', 'anime'];

export const NOMI_TIPO: Record<Tipo, string> = {
  azione: 'Attività', progetto: 'Progetto', esperienza: 'Esperienza', routine: 'Routine',
  film: 'Film', serie: 'Serie', anime: 'Anime', gioco: 'Gioco', libro: 'Libro', ricetta: 'Ricetta',
  curiosita: 'Curiosità', gamedesign: 'Game design', persona: 'Persona', nota: 'Non assegnata',
};

/**
 * Stato salvato di una voce. «Scaduto» non è uno stato: si calcola da data e stato (vedi `isOverdue`).
 * `saltato` è trattato come `fatto`; `parcheggiato` è la «Archiviata» mostrata all'utente.
 */
export type Stato = 'da_fare' | 'in_corso' | 'fatto' | 'saltato' | 'parcheggiato';

/** Momento della giornata di una routine. */
export type Fascia = 'mattina' | 'pomeriggio' | 'sera' | 'prima_di_dormire';
export const NOMI_FASCIA: Record<Fascia, string> = {
  mattina: 'Mattina', pomeriggio: 'Pomeriggio', sera: 'Sera', prima_di_dormire: 'Prima di dormire',
};

/** Ricorrenza: la voce si ripete ogni `ogni` giorni, settimane, mesi o anni. */
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
  /** Ultima modifica: nella sincronizzazione vince, voce per voce, la versione con `aggiornato` più alto. */
  aggiornato: number;
  /** Cancellazione logica: la voce resta, così la cancellazione arriva agli altri dispositivi. */
  eliminato?: boolean;

  /** Catturata ma non ancora smistata. */
  inbox?: boolean;

  note?: string;
  link?: string[];
  /** Immagini allegate alle note (JPEG ridotti, come testo `data:`). */
  immagini?: string[];

  // date (YYYY-MM-DD) e orari (HH:MM)
  inizio?: string;
  fine?: string;
  oraInizio?: string;
  oraFine?: string;
  /** La scadenza non è spostabile: nel punteggio di priorità conta come parametro a parte (`fissa`). */
  rigida?: boolean;
  ricorrenza?: Ricorrenza;
  promemoria?: Promemoria[];
  insisti?: Insistenza;

  // priorità e collezioni
  importanza?: number; // 1-5, azioni e progetti
  /** Tempo stimato in minuti (con il margine d'errore atteso: shared/stima.ts). */
  sforzoMin?: number;
  /** Minuti che l'attività ha richiesto davvero, misurati dall'app dal passaggio a «in corso» al completamento; affina stime e margine d'errore. */
  durataRealeMin?: number;
  interesse?: number; // 1-5, collezioni, esperienze, curiosità e game design
  /** Difficoltà di un'idea di videogioco (1 = facile, 5 = molto difficile): entra nella sua priorità (`shared/gamedesign.ts`). */
  difficolta?: number;
  /**
   * Area dell'attività (Casa, Burocrazia, Digitale, Salute, Lavoro...): campo non più usato dalle schermate,
   * resta nei dati già salvati (assegnato dall'importazione da Notion) e nella ricerca.
   */
  area?: string;

  // gerarchia
  /** Progetto di cui la voce è un passo (un solo livello). */
  padreId?: string;
  checklist?: VoceChecklist[];

  // persone e luoghi
  /** Campo non più usato dalle schermate, resta nei dati già salvati (la migrazione `spostaInNote` lo porta nelle note). */
  persone?: string[];
  /** Luogo di un'esperienza («Luogo» nell'editor): raggruppa le esperienze e, se non c'è il link, si cerca per ottenere le coordinate. */
  zona?: string;
  /** Campo non più usato dalle schermate, resta nei dati già salvati: se contiene un link di Google Maps ne vengono lette le coordinate. */
  linkMaps?: string;

  // collezioni
  piattaforma?: string;
  consigliatoDa?: string;
  conChi?: string;
  durataMin?: number;
  /** Film, serie e anime: stato d'animo che richiedono (Spensierato, Rilassante…). */
  mood?: string;
  /** Quando i dati di genere, mood, energia, durata e pagine sono stati cercati su internet (millisecondi). */
  arricchitoIl?: number;
  /** Film, serie e anime: energia che richiedono per essere seguiti. */
  energia?: 'bassa' | 'media' | 'alta';
  /** Pagine di un libro (cercate online al momento della creazione). */
  pagine?: number;
  /** Tipologia: una o più tra quelle di `TIPOLOGIE` separate da virgola (per i giochi e i libri, i generi trovati online). */
  genere?: string;
  voto?: number;
  /** Commento lasciato quando si segna come fatto un film, un libro, un gioco… */
  commento?: string;
  completatoIl?: string;
  /** Quando è stata completata (millisecondi), oltre al giorno: serve per mostrare l'ora. */
  completatoTs?: number;
  /** Quando la nota è passata allo stato «in corso» (millisecondi). */
  inCorsoTs?: number;
  /** Millisecondi realmente lavorati sul task con il cronometro «Sto lavorando» (shared/sessione.ts): diventano il tempo reale al completamento. */
  lavoratoMs?: number;
  /** Quando si è cercata una descrizione su internet (millisecondi). */
  descrittoIl?: number;
  /** Posizione di un passo dentro il suo progetto (0 = il primo, il più prioritario). */
  ordine?: number;

  // routine
  fascia?: Fascia;
  /** Quota settimanale: la routine compare in Oggi finché non è stata fatta questo numero di volte nella settimana. */
  volteSettimana?: number;
  obiettivo?: string;
  /** ora (HH:MM) del promemoria giornaliero della routine */
  oraPromemoria?: string;
  /** date (YYYY-MM-DD) in cui la routine è stata fatta */
  log?: string[];

  // persona
  /** Solo per il tipo `persona` (non più usato dalle schermate): resta nei dati già salvati dall'importazione. */
  daContattare?: boolean;
}

/** Impostazione dell'utente sincronizzata tra i dispositivi (per ora la sessione di lavoro): vince la più recente. */
export interface ImpostazioneSync { valore: unknown; aggiornato: number }
export type ImpostazioniSync = Record<string, ImpostazioneSync>;

/** Richiesta di `POST /api/sync`: le modifiche locali dopo l'ultimo giro e, se cambiate, le impostazioni. */
export interface SyncRequest { since: number; changes: Item[]; impostazioni?: ImpostazioniSync }
/** Risposta: le voci cambiate sul server dopo `since`, il nuovo numero di sequenza da usare la volta dopo e le impostazioni. */
export interface SyncResponse { items: Item[]; seq: number; impostazioni?: ImpostazioniSync }
