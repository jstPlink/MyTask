import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

// Riordino di righe per trascinamento. Si afferra una riga: dal bordo sinistro (maniglia, subito), con la pressione lunga
// (telefono, ovunque sulla riga) o con clic e trascinamento (mouse, ovunque). Durante il gesto la riga segue il dito,
// le altre scorrono; al rilascio `onFine` riceve i nuovi id in ordine.

const PRESSIONE_MS = 380;
const SOGLIA_PX = 6;
const IGNORA = '.cb, .chip, input, textarea, select, a';

type Gesto = { id: string; pid: number; x: number; y: number; grab: number; attivo: boolean; timer?: number; tocco: boolean; ultimaY: number };

/** Il primo antenato che scorre davvero: serve per lo scorrimento automatico ai bordi durante il trascinamento. */
function scrollGenitore(el: HTMLElement | null): HTMLElement | null {
  for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e;
  }
  return null;
}

/**
 * Riordino per trascinamento di una lista di righe con `id`.
 * - `cont`: ref da mettere sul contenitore delle righe.
 * - `presa(id)`: attributi da spargere su ogni riga (`data-rid` e il gestore del tocco).
 * - `preso`: id della riga in movimento (per darle uno stile), `null` se nessuna.
 * - `ordinati(lista)`: la lista nell'ordine provvisorio durante il gesto, altrimenti com'è.
 * `onFine` riceve i nuovi id solo se l'ordine è davvero cambiato.
 */
export function useRiordino(ids: string[], onFine: (nuovi: string[]) => void) {
  const [ordine, setOrdine] = useState<string[] | null>(null);
  const [preso, setPreso] = useState<string | null>(null);
  const cont = useRef<HTMLDivElement>(null);
  const g = useRef<Gesto | null>(null);
  const corrente = useRef<string[] | null>(null);
  const fine = useRef(onFine);
  fine.current = onFine;
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const riga = (id: string) => cont.current?.querySelector<HTMLElement>(`[data-rid="${CSS.escape(id)}"]`) ?? null;

  /** Porta la riga trascinata sotto il dito, qualunque sia la sua posizione nella lista. */
  const posiziona = () => {
    const s = g.current;
    if (!s?.attivo) return;
    const el = riga(s.id);
    if (!el) return;
    el.style.transform = '';
    const top = el.getBoundingClientRect().top;
    el.style.transform = `translateY(${s.ultimaY - s.grab - top}px) scale(1.015)`;
  };
  useLayoutEffect(posiziona, [ordine]);

  const finisci = (applica: boolean) => {
    const s = g.current;
    if (!s) return;
    window.clearTimeout(s.timer);
    const era = s.attivo;
    const nuovo = corrente.current;
    if (era) riga(s.id)?.style.removeProperty('transform');
    g.current = null;
    corrente.current = null;
    setPreso(null);
    if (era && applica && nuovo && nuovo.join() !== idsRef.current.join()) fine.current(nuovo);
    setOrdine(null);
  };

  const inizia = (s: Gesto) => {
    s.attivo = true;
    setPreso(s.id);
    corrente.current = [...idsRef.current];
    setOrdine([...idsRef.current]);
    navigator.vibrate?.(12);
  };

  const muovi = (e: PointerEvent) => {
    const s = g.current;
    if (!s || e.pointerId !== s.pid) return;
    if (!s.attivo) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < SOGLIA_PX) return;
      // un dito che si muove prima della pressione lunga sta scorrendo la pagina; il mouse invece inizia il trascinamento
      if (s.tocco) { finisci(false); return; }
      s.grab = s.y - (riga(s.id)?.getBoundingClientRect().top ?? s.y);
      inizia(s);
    }
    s.ultimaY = e.clientY;
    const el = riga(s.id);
    if (!el || !cont.current) return;
    // posizione di destinazione: quante altre righe hanno il centro sopra il dito
    const altre = [...cont.current.querySelectorAll<HTMLElement>('[data-rid]')].filter((r) => r !== el);
    const centro = e.clientY - s.grab + el.offsetHeight / 2;
    const sopra = altre.filter((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 < centro; }).length;
    const resto = (corrente.current ?? []).filter((x) => x !== s.id);
    resto.splice(sopra, 0, s.id);
    if (resto.join() !== (corrente.current ?? []).join()) { corrente.current = resto; setOrdine(resto); }
    posiziona();
    // scorrimento automatico ai bordi
    const sc = scrollGenitore(el);
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (e.clientY < r.top + 70) sc.scrollTop -= 10;
      else if (e.clientY > r.bottom - 70) sc.scrollTop += 10;
    }
  };

  useEffect(() => {
    const su = (e: PointerEvent) => { if (g.current && e.pointerId === g.current.pid) finisci(e.type === 'pointerup'); };
    // durante il trascinamento col dito la pagina non deve scorrere
    const blocca = (e: TouchEvent) => { if (g.current?.attivo && e.cancelable) e.preventDefault(); };
    // dopo un trascinamento il rilascio non deve contare come tocco sulla riga
    const clic = (e: MouseEvent) => { if (soppresso.current) { e.stopPropagation(); e.preventDefault(); } };
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', su);
    window.addEventListener('pointercancel', su);
    window.addEventListener('touchmove', blocca, { passive: false });
    window.addEventListener('click', clic, true);
    return () => {
      window.removeEventListener('pointermove', muovi);
      window.removeEventListener('pointerup', su);
      window.removeEventListener('pointercancel', su);
      window.removeEventListener('touchmove', blocca);
      window.removeEventListener('click', clic, true);
    };
  }, []);

  const soppresso = useRef(false);
  useEffect(() => {
    if (preso) { soppresso.current = true; return; }
    const t = window.setTimeout(() => { soppresso.current = false; }, 60);
    return () => window.clearTimeout(t);
  }, [preso]);

  /** Attributi da mettere sulla riga trascinabile. Dentro la riga va un elemento con `data-grip` (la maniglia a sinistra). */
  const presa = (id: string) => ({
    'data-rid': id,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || g.current) return;
      const t = e.target as HTMLElement;
      if (t.closest(IGNORA)) return;
      const tocco = e.pointerType !== 'mouse';
      const el = e.currentTarget;
      const s: Gesto = { id, pid: e.pointerId, x: e.clientX, y: e.clientY, grab: e.clientY - el.getBoundingClientRect().top, attivo: false, tocco, ultimaY: e.clientY };
      g.current = s;
      if (t.closest('[data-grip]')) { e.preventDefault(); inizia(s); posiziona(); return; }
      if (tocco) s.timer = window.setTimeout(() => { if (g.current === s && !s.attivo) { inizia(s); posiziona(); } }, PRESSIONE_MS);
    },
  });

  const ordinati = <T extends { id: string }>(lista: T[]): T[] => {
    if (!ordine) return lista;
    const per = new Map(lista.map((x) => [x.id, x]));
    const out = ordine.map((i) => per.get(i)).filter((x): x is T => !!x);
    return out.length === lista.length ? out : lista;
  };

  return { cont, presa, preso, ordinati };
}
