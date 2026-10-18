// Feedback aptico leggero sui tocchi ai pulsanti. Nell'app Android usa un plugin nostro (HapticaPlugin) con
// ampiezza ridotta del 30% rispetto ai valori standard di Capacitor (110 -> 77 e 180 -> 126); nel browser
// del telefono la vibrazione breve; sul computer non fa nulla.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const nativo = Capacitor.isNativePlatform();

type Forza = 'leggero' | 'medio';

/** Plugin Android scritto per l'app (HapticaPlugin): permette di scegliere durata e ampiezza della vibrazione. */
const Haptica = registerPlugin<{ tocco(o: { durata: number; ampiezza: number }): Promise<void> }>('Haptica');

/** Durata in ms e ampiezza (1-255). Lo standard di Capacitor è 50 ms a 110 (leggero) e 43 ms a 180 (medio). */
const PROFILI: Record<Forza, { durata: number; ampiezza: number }> = {
  leggero: { durata: 50, ampiezza: 77 },
  medio: { durata: 43, ampiezza: 126 },
};

/** Un tocco aptico. App: plugin nostro (se manca, impatto standard di Capacitor); browser del telefono: vibrazione breve; computer: nulla. */
export function tocco(forza: Forza = 'leggero') {
  try {
    if (nativo) {
      Haptica.tocco(PROFILI[forza]).catch(() => {
        void Haptics.impact({ style: forza === 'medio' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => undefined);
      });
    } else if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(forza === 'medio' ? 10 : 6);
    }
  } catch { /* non supportato: nessun feedback */ }
}

/** Elementi che danno feedback al tocco. */
const CONTROLLI = 'button, a[href], [role=tab], [role=switch], [role=checkbox], [role=option], summary, select';

/** Un solo ascoltatore (in cattura, così lo vedono anche i controlli che fermano la propagazione) per tutta l'app: ogni pulsante attivo dà un tocco leggero, il segno di fatto uno più marcato. */
export function avviaHaptic() {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.(CONTROLLI);
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    // `.cb` = casella di spunta (segno di fatto): tocco più marcato
    tocco(el.closest('.cb') || el.classList.contains('cb') ? 'medio' : 'leggero');
  }, { passive: true, capture: true });
}
