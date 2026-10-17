// Lettura e scrittura di durate scritte a mano: "45m", "6h", "4d" o "4g", "5g 6h", "1h30", "1:30", "1,5h", "90".

export type EsitoDurata = { ok: true; minuti: number | undefined } | { ok: false };

const MINUTI_PER_UNITA: Record<string, number> = {
  m: 1, min: 1, minuto: 1, minuti: 1,
  h: 60, o: 60, ora: 60, ore: 60,
  d: 1440, g: 1440, gg: 1440, giorno: 1440, giorni: 1440,
};
const MAX_MINUTI = 60 * 24 * 365;

/** Vuoto = nessuna stima. Un numero da solo vale minuti; in "1h30" il 30 finale vale minuti. */
export function leggiDurata(testo: string): EsitoDurata {
  const t = testo.trim().toLowerCase().replace(/,/g, '.');
  if (!t) return { ok: true, minuti: undefined };

  const hm = /^(\d+):(\d{1,2})$/.exec(t);
  if (hm) return controlla(Number(hm[1]) * 60 + Number(hm[2]));

  const re = /(\d+(?:\.\d+)?)\s*([a-z]+)?\s*/gy;
  let totale = 0;
  let fine = 0;
  let ultimaUnita = 0; // minuti dell'ultima unità letta (0 = nessuna)
  let n = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    n++;
    fine = re.lastIndex;
    const valore = Number(m[1]);
    if (m[2]) {
      const u = MINUTI_PER_UNITA[m[2]];
      if (!u) return { ok: false };
      totale += valore * u;
      ultimaUnita = u;
    } else if (n === 1 && re.lastIndex >= t.length) {
      totale += valore; // numero da solo: minuti
    } else if (ultimaUnita === 60) {
      totale += valore; // "1h30": dopo le ore, il numero senza unità sono minuti
    } else {
      return { ok: false };
    }
    if (fine >= t.length) break;
  }
  if (n === 0 || fine < t.length) return { ok: false };
  return controlla(totale);
}

function controlla(minuti: number): EsitoDurata {
  const m = Math.round(minuti);
  return m > 0 && m <= MAX_MINUTI ? { ok: true, minuti: m } : { ok: false };
}

/** 45 → "45m", 390 → "6h 30m", 7500 → "5g 5h". */
export function scriviDurata(minuti: number | undefined): string {
  if (!minuti || minuti <= 0) return '';
  const g = Math.floor(minuti / 1440);
  const h = Math.floor((minuti % 1440) / 60);
  const m = Math.round(minuti % 60);
  return [g && `${g}g`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

/** Separa i minuti in giorni, ore e minuti. */
export function scomponi(minuti: number | undefined): { g: number; h: number; m: number } {
  const t = Math.max(0, Math.round(minuti ?? 0));
  return { g: Math.floor(t / 1440), h: Math.floor((t % 1440) / 60), m: t % 60 };
}
