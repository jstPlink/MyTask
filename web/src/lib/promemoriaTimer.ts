// Impostazione «Notifica del timer» (solo telefono): mentre una nota è in corso e il cronometro scorre, ogni N minuti il telefono
// manda una notifica sonora per ricordare che il tempo sta passando. Salvata sul dispositivo (localStorage), come l'aspetto.
import { INTERVALLI_PROMEMORIA_MIN, INTERVALLO_PROMEMORIA_PREDEFINITO_MIN } from '../../../shared/sessione.ts';

export interface PromemoriaTimer { attivo: boolean; ogniMinuti: number }

const KEY = 'mytask.promemoriaTimer';
const PREDEFINITO: PromemoriaTimer = { attivo: true, ogniMinuti: INTERVALLO_PROMEMORIA_PREDEFINITO_MIN };
const listeners = new Set<() => void>();

function leggi(): PromemoriaTimer {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PromemoriaTimer>;
      return { attivo: p.attivo !== false, ogniMinuti: INTERVALLI_PROMEMORIA_MIN.includes(Number(p.ogniMinuti)) ? Number(p.ogniMinuti) : PREDEFINITO.ogniMinuti };
    }
  } catch { /* spazio di archiviazione non disponibile */ }
  return PREDEFINITO;
}

let corrente = leggi();

export const getPromemoriaTimer = (): PromemoriaTimer => corrente;
export const subscribePromemoriaTimer = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Cambia l'impostazione e la salva; le notifiche del telefono si riprogrammano da sole (native.ts). */
export function impostaPromemoriaTimer(p: Partial<PromemoriaTimer>) {
  corrente = { ...corrente, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(corrente)); } catch { /* ignora */ }
  listeners.forEach((l) => l());
}
