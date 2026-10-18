// Normalizzazione del testo per confrontare e cercare: titoli, note e parole chiave (ricerca, note simili, stime, arricchimento).

/** Chiave per riconoscere lo stesso testo scritto in modo diverso (maiuscole, accenti, apostrofi, punteggiatura). */
export function chiaveTitolo(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
}
