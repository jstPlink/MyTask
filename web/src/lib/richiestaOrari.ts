// Richiesta di aprire la schermata «Quando sei libero?» (toccando la notifica serale). La notifica può arrivare
// prima che l'interfaccia sia pronta: la richiesta resta in attesa finché qualcuno la prende.

let pendente: string | undefined;
const ascoltatori = new Set<() => void>();

export function richiediOrari(giorno: string) {
  pendente = giorno;
  ascoltatori.forEach((l) => l());
}

/** Restituisce (una sola volta) il giorno di cui l'app deve chiedere gli orari. */
export function prendiRichiestaOrari(): string | undefined {
  const g = pendente;
  pendente = undefined;
  return g;
}

export const ascoltaRichiestaOrari = (fn: () => void) => { ascoltatori.add(fn); return () => { ascoltatori.delete(fn); }; };
