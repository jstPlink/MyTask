// Durate e date in forma leggibile. Il tempo stimato non si scrive a mano: si sceglie con le rotelle (web/src/ui/CampoTempo.tsx).

/** Separa i minuti in giorni, ore e minuti. */
export function scomponi(minuti: number | undefined): { g: number; h: number; m: number } {
  const t = Math.max(0, Math.round(minuti ?? 0));
  return { g: Math.floor(t / 1440), h: Math.floor((t % 1440) / 60), m: t % 60 };
}

const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const due = (n: number) => String(n).padStart(2, '0');

/** "ven 16 ott · 14:32" (ora locale del dispositivo). Con `senzaOra` solo il giorno. */
export function scriviQuando(ms: number, senzaOra = false): string {
  const d = new Date(ms);
  const giorno = `${GIORNI_BREVI[d.getDay()]} ${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
  return senzaOra ? giorno : `${giorno} · ${due(d.getHours())}:${due(d.getMinutes())}`;
}

/** Tempo trascorso in forma breve: "12 min", "18 h 38 min", "2 g 3 h". */
export function scriviTrascorso(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'meno di un minuto';
  const g = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (g) return h ? `${g} g ${h} h` : `${g} g`;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}
