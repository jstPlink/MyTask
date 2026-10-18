// Gemini e Groq con la chiave dell'utente, chiamati direttamente dal telefono (o dal sito): la chiave resta su questo
// dispositivo e va solo al servizio scelto. Nessun passaggio dal server di MyTask.
import { MODELLI_PREDEFINITI, NOMI_PROVIDER, type Provider } from '../../../shared/ia.ts';

const KEY = 'mytask.ia';
const listeners = new Set<() => void>();

export interface ConfigProvider { chiave: string; modello: string }
export type ConfigIA = Partial<Record<Provider, ConfigProvider>>;
export interface Messaggio { ruolo: 'utente' | 'ia'; testo: string }

function leggi(): ConfigIA {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ConfigIA; } catch { return {}; }
}
let corrente: ConfigIA = leggi();

export const getConfigIA = () => corrente;
export const subscribeIA = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function salvaProvider(p: Provider, cfg: ConfigProvider | undefined) {
  const nuovo = { ...corrente };
  if (cfg && cfg.chiave.trim()) nuovo[p] = { chiave: cfg.chiave.trim(), modello: cfg.modello.trim() || MODELLI_PREDEFINITI[p] };
  else delete nuovo[p];
  corrente = nuovo;
  try { localStorage.setItem(KEY, JSON.stringify(nuovo)); } catch { /* ignora */ }
  listeners.forEach((l) => l());
}

export const providerCollegati = (): Provider[] => (['gemini', 'groq'] as Provider[]).filter((p) => !!corrente[p]?.chiave);

interface Opzioni { sistema?: string; json?: boolean; segnale?: AbortSignal }

function errore(p: Provider, stato: number, dettaglio: string): Error {
  const nome = NOMI_PROVIDER[p];
  if (stato === 400 && /api key|API_KEY/i.test(dettaglio)) return new Error(`${nome}: chiave non valida.`);
  if (stato === 401 || stato === 403) return new Error(`${nome}: chiave non valida o senza permesso.`);
  if (stato === 404) return new Error(`${nome}: modello non trovato, controlla il nome del modello.`);
  if (stato === 429) return new Error(`${nome}: troppe richieste, riprova tra poco.`);
  return new Error(`${nome}: errore ${stato}${dettaglio ? ` (${dettaglio.slice(0, 120)})` : ''}`);
}

/** Manda la conversazione al servizio scelto e restituisce la risposta in testo. */
export async function chiediIA(p: Provider, messaggi: Messaggio[], opz: Opzioni = {}): Promise<string> {
  const cfg = corrente[p];
  if (!cfg?.chiave) throw new Error(`${NOMI_PROVIDER[p]}: chiave non inserita.`);
  if (!navigator.onLine) throw new Error('Sei offline.');
  if (p === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.modello)}:generateContent`, {
      method: 'POST',
      signal: opz.segnale,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.chiave },
      body: JSON.stringify({
        ...(opz.sistema ? { systemInstruction: { parts: [{ text: opz.sistema }] } } : {}),
        contents: messaggi.map((m) => ({ role: m.ruolo === 'utente' ? 'user' : 'model', parts: [{ text: m.testo }] })),
        generationConfig: { temperature: opz.json ? 0.1 : 0.6, ...(opz.json ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    if (!res.ok) throw errore(p, res.status, await res.text().catch(() => ''));
    const r = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const testo = (r.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('').trim();
    if (!testo) throw new Error('Gemini: risposta vuota.');
    return testo;
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: opz.segnale,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.chiave}` },
    body: JSON.stringify({
      model: cfg.modello,
      temperature: opz.json ? 0.1 : 0.6,
      ...(opz.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        ...(opz.sistema ? [{ role: 'system', content: opz.sistema }] : []),
        ...messaggi.map((m) => ({ role: m.ruolo === 'utente' ? 'user' : 'assistant', content: m.testo })),
      ],
    }),
  });
  if (!res.ok) throw errore(p, res.status, await res.text().catch(() => ''));
  const r = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const testo = (r.choices?.[0]?.message?.content ?? '').trim();
  if (!testo) throw new Error('Groq: risposta vuota.');
  return testo;
}
