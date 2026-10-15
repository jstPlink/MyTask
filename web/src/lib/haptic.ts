// Feedback aptico leggero sui tocchi ai pulsanti. Nell'app Android usa il motore aptico (Capacitor),
// nel browser del telefono la vibrazione breve; sul computer non fa nulla.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const nativo = Capacitor.isNativePlatform();

type Forza = 'leggero' | 'medio';

export function tocco(forza: Forza = 'leggero') {
  try {
    if (nativo) {
      void Haptics.impact({ style: forza === 'medio' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => undefined);
    } else if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(forza === 'medio' ? 14 : 8);
    }
  } catch { /* non supportato: nessun feedback */ }
}

const CONTROLLI = 'button, a[href], [role=tab], [role=switch], [role=checkbox], [role=option], summary, select';

/** Un solo ascoltatore (in cattura, così lo vedono anche i controlli che fermano la propagazione) per tutta l'app: ogni pulsante attivo dà un tocco leggero, il segno di fatto uno più marcato. */
export function avviaHaptic() {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.(CONTROLLI);
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    tocco(el.closest('.cb') || el.classList.contains('cb') ? 'medio' : 'leggero');
  }, { passive: true, capture: true });
}
