// Arricchimento in background delle voci di intrattenimento: genere, mood, impegno mentale, durata e pagine
// vengono cercati su Wikidata (e Open Library per le pagine dei libri), servizi gratuiti e senza chiave.
// Al servizio esterno va solo il titolo. I dati trovati si salvano nella voce, quindi si sincronizzano e
// i filtri di "Cosa guardo stasera" li usano. Vale per le voci nuove e per quelle già inserite.
import type { Item, Tipo } from '../../../shared/types.ts';
import { accorciaDescrizione, campiDaDati, daArricchire, descrizioneCompatibile, type DatiTrovati } from '../../../shared/arricchimento.ts';
import { chiaveTitolo } from '../../../shared/testo.ts';
import { getItem, getItems, saveItem, subscribe } from './store.ts';
import { cercaPagine } from './libri.ts';

const WIKIDATA = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
/** Pausa tra una voce e l'altra: i servizi gratuiti rispondono 429 se si va troppo veloci. */
const PAUSA_MS = 1600;
/** Attesa dopo una risposta 429 prima di riprovare (al terzo 429 di fila il ciclo si ferma fino al prossimo avvio). */
const ATTESA_LIMITE_MS = 45_000;

/** Il servizio ha risposto 429 (troppe richieste). */
class LimiteRichieste extends Error {}

/** GET che restituisce il JSON; distingue il limite di richieste dagli altri errori. */
async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 429) throw new LimiteRichieste('429');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Risultato di `wbsearchentities` (ricerca per nome su Wikidata). */
interface RisultatoRicerca { id: string; label?: string; description?: string }
interface Affermazione { mainsnak?: { datavalue?: { value?: { id?: string; amount?: string; unit?: string } } } }
type Claims = Record<string, Affermazione[] | undefined>;

/** Valori delle affermazioni (claims) di una proprietà di Wikidata. */
const valori = (c: Claims, p: string) => (c[p] ?? []).map((a) => a.mainsnak?.datavalue?.value).filter((v): v is NonNullable<typeof v> => !!v);

/** Durata in minuti da una quantità di Wikidata (minuti, ore o secondi). */
function minutiDa(v: { amount?: string; unit?: string } | undefined): number | undefined {
  const n = Number(v?.amount);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const unita = v?.unit?.split('/').pop();
  if (unita === 'Q25235') return n * 60; // ore
  if (unita === 'Q11574') return n / 60; // secondi
  return n; // minuti (Q7727)
}

/**
 * Cerca la voce su Wikidata (prima in italiano, poi in inglese, scartando i risultati non compatibili col tipo):
 * generi (P136), durata (P2047), pagine (P1104) e una breve descrizione da Wikipedia. Per i libri senza pagine
 * prova Open Library. `null` = nessun dato trovato; lancia un errore se la rete non risponde.
 */
async function cercaDati(titolo: string, tipo: Tipo): Promise<DatiTrovati | null> {
  const t = titolo.trim();
  if (t.length < 2) return null;
  let trovato: RisultatoRicerca | undefined;
  for (const lingua of ['it', 'en']) {
    const r = await json<{ search?: RisultatoRicerca[] }>(`${WIKIDATA}action=wbsearchentities&type=item&limit=8&language=${lingua}&uselang=${lingua}&search=${encodeURIComponent(t)}`);
    const buoni = (r.search ?? []).filter((x) => descrizioneCompatibile(tipo, x.description));
    trovato = buoni.find((x) => chiaveTitolo(x.label ?? '') === chiaveTitolo(t)) ?? buoni[0];
    if (trovato) break;
  }
  const dati: DatiTrovati = { generi: [] };
  if (trovato) {
    const e = await json<{ entities?: Record<string, { claims?: Claims; sitelinks?: Record<string, { title: string }> }> }>(`${WIKIDATA}action=wbgetentities&props=claims|sitelinks&sitefilter=itwiki|enwiki&ids=${trovato.id}`);
    const claims = e.entities?.[trovato.id]?.claims ?? {};
    // breve descrizione dalle prime frasi di Wikipedia (italiano, altrimenti inglese)
    const link = e.entities?.[trovato.id]?.sitelinks;
    const voce = link?.itwiki ?? link?.enwiki;
    if (voce) {
      try {
        const r = await json<{ extract?: string }>(`https://${link?.itwiki ? 'it' : 'en'}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(voce.title.replace(/ /g, '_'))}`);
        dati.descrizione = accorciaDescrizione(r.extract);
      } catch (err) {
        if (err instanceof LimiteRichieste) throw err;
      }
    }
    const idGeneri = valori(claims, 'P136').map((v) => v.id).filter((x): x is string => !!x).slice(0, 12);
    if (idGeneri.length) {
      const g = await json<{ entities?: Record<string, { labels?: Record<string, { value: string }> }> }>(`${WIKIDATA}action=wbgetentities&props=labels&languages=it|en&ids=${idGeneri.join('|')}`);
      dati.generi = Object.values(g.entities ?? {}).map((x) => x.labels?.it?.value ?? x.labels?.en?.value).filter((x): x is string => !!x);
    }
    dati.durataMin = minutiDa(valori(claims, 'P2047')[0]);
    const pagine = Number(valori(claims, 'P1104')[0]?.amount);
    if (Number.isFinite(pagine) && pagine > 0) dati.pagine = pagine;
  }
  if (tipo === 'libro' && !dati.pagine) dati.pagine = await cercaPagine(t);
  const nulla = !dati.generi.length && !dati.durataMin && !dati.pagine && !dati.descrizione;
  return nulla ? null : dati;
}

/** True mentre un ciclo è in esecuzione (ne gira uno solo). */
let inCorso = false;
/** Ciclo in attesa di partire. */
let timer: ReturnType<typeof setTimeout> | undefined;
const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Arricchisce, una alla volta, le voci a cui mancano dati. Si ferma se si è offline o se il servizio chiede di rallentare. */
async function elabora() {
  if (inCorso) return;
  inCorso = true;
  const provate = new Set<string>();
  let limiti = 0;
  try {
    for (;;) {
      if (!navigator.onLine) return;
      const prossima = daArricchire(getItems()).find((i) => !provate.has(i.id));
      if (!prossima) return;
      provate.add(prossima.id);
      try {
        const dati = await cercaDati(prossima.titolo, prossima.tipo);
        const attuale: Item = getItem(prossima.id) ?? prossima;
        // non si sovrascrive nulla: se nel frattempo è cambiato qualcosa, vale la versione più recente
        saveItem({ ...attuale, ...(dati ? campiDaDati(attuale, dati) : {}), arricchitoIl: Date.now(), descrittoIl: Date.now() });
        limiti = 0;
      } catch (e) {
        if (e instanceof LimiteRichieste) {
          provate.delete(prossima.id);
          if (++limiti >= 3) return;
          await pausa(ATTESA_LIMITE_MS);
          continue;
        }
        return; // rete assente o servizio non raggiungibile: si riprova più tardi
      }
      await pausa(PAUSA_MS);
    }
  } finally {
    inCorso = false;
  }
}

/** (Ri)programma un ciclo di arricchimento dopo `ritardo` ms, annullando quello già in attesa. */
function pianifica(ritardo = 4000) {
  clearTimeout(timer);
  timer = setTimeout(() => { void elabora(); }, ritardo);
}

/** Avvia l'arricchimento: all'apertura, a ogni modifica dei dati (voci nuove o in arrivo dalla sincronizzazione) e al ritorno della rete e ogni 30 minuti. */
export function avviaArricchimento() {
  subscribe(() => pianifica());
  window.addEventListener('online', () => pianifica(2000));
  pianifica(6000);
  setInterval(() => pianifica(0), 30 * 60_000);
}
