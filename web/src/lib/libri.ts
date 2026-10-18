// Ricerca del numero di pagine di un libro su Open Library (gratuita, senza chiave, ammette le richieste dal browser).
// Al servizio esterno va solo il titolo scritto dall'utente.

/** Campi richiesti a Open Library per ogni risultato. */
interface Documento { title?: string; author_name?: string[]; number_of_pages_median?: number }

/** Titolo normalizzato per il confronto: minuscole, senza accenti né punteggiatura. */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Pagine del libro con quel titolo, o undefined se non si trovano (o se si è offline). */
export async function cercaPagine(titolo: string, segnale?: AbortSignal): Promise<number | undefined> {
  const t = titolo.trim();
  if (t.length < 3) return undefined;
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(t)}&limit=10&fields=title,author_name,number_of_pages_median`;
    const res = await fetch(url, { signal: segnale });
    if (!res.ok) return undefined;
    const docs = ((await res.json()) as { docs?: Documento[] }).docs ?? [];
    const conPagine = docs.filter((d) => (d.number_of_pages_median ?? 0) > 0);
    const q = norm(t);
    const scelta = conPagine.find((d) => norm(d.title ?? '') === q) ?? conPagine.find((d) => norm(d.title ?? '').startsWith(q));
    return scelta?.number_of_pages_median;
  } catch {
    return undefined;
  }
}
