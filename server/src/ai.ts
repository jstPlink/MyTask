// Cattura rapida con Gemini. Il modulo è dietro a una funzione sola, così il provider si può cambiare.
import type { Proposta } from '../../shared/capture.ts';

const TIPI = ['azione', 'progetto', 'esperienza', 'film', 'serie', 'anime', 'gioco', 'libro', 'ricetta', 'curiosita'];

export class IaNonDisponibile extends Error {}

export interface IaConfig { apiKey: string | undefined; model: string }

const PROMPT = (testo: string, oggi: string) => `Sei l'assistente di un'app personale di task e idee, in italiano.
Data di oggi: ${oggi}.
Interpreta questa riga di appunto e restituisci SOLO un oggetto JSON con questi campi:
- tipo: uno tra ${TIPI.join(', ')}
  (azione = cosa da fare; esperienza = uscita, luogo o evento; film/serie/anime/gioco/libro/ricetta = cose da guardare, giocare, leggere o cucinare; curiosita = qualcosa da approfondire)
- titolo: titolo breve e pulito, senza le informazioni già estratte negli altri campi
- piattaforma: es. Netflix, Disney+, Prime Video, Steam (stringa vuota se assente)
- consigliatoDa: nome di chi l'ha consigliato (stringa vuota se assente)
- conChi: nome della persona con cui farlo (stringa vuota se assente)
- inizio: data YYYY-MM-DD se l'appunto indica un giorno (altrimenti stringa vuota)
- sicura: true se il tipo è chiaro, false se è incerto

Appunto: """${testo.slice(0, 500)}"""`;

export async function interpretaConGemini(testo: string, oggi: string, cfg: IaConfig, fetchFn: typeof fetch = fetch): Promise<Proposta> {
  if (!cfg.apiKey) throw new IaNonDisponibile('Chiave Gemini non configurata');
  const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(testo, oggi) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            tipo: { type: 'STRING', enum: TIPI },
            titolo: { type: 'STRING' },
            piattaforma: { type: 'STRING' },
            consigliatoDa: { type: 'STRING' },
            conChi: { type: 'STRING' },
            inizio: { type: 'STRING' },
            sicura: { type: 'BOOLEAN' },
          },
          required: ['tipo', 'titolo', 'sicura'],
        },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new IaNonDisponibile(`Gemini ha risposto ${res.status}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new IaNonDisponibile('Risposta vuota');
  return validaProposta(JSON.parse(raw));
}

export function validaProposta(o: unknown): Proposta {
  const r = o as Record<string, unknown>;
  const tipo = typeof r.tipo === 'string' && TIPI.includes(r.tipo) ? r.tipo : 'curiosita';
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);
  const data = s(r.inizio);
  return {
    tipo: tipo as Proposta['tipo'],
    titolo: s(r.titolo) ?? 'Senza titolo',
    piattaforma: s(r.piattaforma),
    consigliatoDa: s(r.consigliatoDa),
    conChi: s(r.conChi),
    inizio: data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined,
    sicura: r.sicura === true && TIPI.includes(String(r.tipo)),
  };
}
