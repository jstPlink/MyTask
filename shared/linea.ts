// Posizione dei numeri d'ordine sotto la barra a segmenti del piano di Oggi (solo schermate web): funzione pura, con test.

export interface NumeriSistemati {
  /** Centri (px) dei numeri, dentro [0, larghezza]. */
  px: number[];
  /** Diametro (px) con cui disegnarli: si riduce quando sono tanti. */
  diametro: number;
}

/** Sotto questo diametro (px) i cerchi non si rimpiccioliscono più: se non bastano si sovrappongono. */
const DIAMETRO_MINIMO = 12;

/**
 * Ogni numero vorrebbe stare sotto il centro del suo segmento (`centri`). Se si toccano vengono spostati di lato; se sono
 * troppi per la larghezza il cerchio si rimpicciolisce e, in ultimo, i cerchi si sovrappongono un poco: restano comunque
 * tutti dentro la barra, nello stesso ordine dei segmenti.
 */
export function sistemaNumeri(centri: number[], larghezza: number, diametroMassimo = 24): NumeriSistemati {
  const n = centri.length;
  if (!n || larghezza <= 0) return { px: centri.map(() => 0), diametro: diametroMassimo };
  const d = Math.max(DIAMETRO_MINIMO, Math.min(diametroMassimo, Math.floor(larghezza / n) - 2));
  const r = d / 2;
  const passo = n > 1 ? Math.min(d + 2, (larghezza - d) / (n - 1)) : 0;
  const px = centri.map((c) => Math.min(larghezza - r, Math.max(r, c)));
  for (let i = 1; i < n; i++) px[i] = Math.max(px[i], px[i - 1] + passo);
  const eccesso = px[n - 1] + r - larghezza;
  if (eccesso > 0) {
    px[n - 1] -= eccesso;
    for (let i = n - 2; i >= 0; i--) px[i] = Math.min(px[i], px[i + 1] - passo);
  }
  return { px, diametro: d };
}
