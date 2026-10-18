// Applicazione Fastify di MyTask: API (accesso, sincronizzazione, esportazione, stato di salute) e, se compilata, la web app.
// Il server non interpreta le voci: le conserva come documenti JSON e risolve i conflitti per voce con `aggiornato`.
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ImpostazioniSync, Item, SyncRequest, SyncResponse } from '../../shared/types.ts';
import { today } from '../../shared/dates.ts';
import type { Config } from './config.ts';
import { Store } from './db.ts';
import { RateLimiter, hashPassword, hashToken, newToken, verifyPassword } from './auth.ts';

let versioneLetta: string | undefined;
/** Versione del server: quella del package.json principale. */
function versioneServer(): string {
  if (versioneLetta) return versioneLetta;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as { version?: string };
    versioneLetta = p.version ?? 'sconosciuta';
  } catch {
    versioneLetta = 'sconosciuta';
  }
  return versioneLetta;
}

/** Durata di una sessione (token di accesso): 180 giorni. */
const SESSIONE_MS = 180 * 24 * 3600 * 1000;
/** Dimensione massima di una voce (JSON): le immagini allegate sono già ridotte dall'app. */
const MAX_ITEM_BYTES = 200_000;

/** Dipendenze dell'app; `now` si può sostituire nei test. */
export interface AppDeps { config: Config; store: Store; now?: () => number }

/** Impostazioni: poche chiavi semplici, ognuna con una data di modifica e un valore di dimensione ragionevole. */
function impostazioniValide(x: unknown): x is ImpostazioniSync {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const voci = Object.entries(x as Record<string, unknown>);
  return voci.length <= 10 && voci.every(([k, v]) => {
    const i = v as { valore?: unknown; aggiornato?: unknown } | null;
    return /^[A-Za-z0-9_]{1,40}$/.test(k) && !!i && typeof i.aggiornato === 'number' && Number.isFinite(i.aggiornato)
      && JSON.stringify(i.valore ?? null).length <= 20_000;
  });
}

/** Controllo minimo di una voce ricevuta: i campi indispensabili e la dimensione. */
function itemValido(x: unknown): x is Item {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return typeof i.id === 'string' && i.id.length > 0 && i.id.length <= 64
    && typeof i.tipo === 'string' && typeof i.titolo === 'string'
    && typeof i.stato === 'string' && typeof i.aggiornato === 'number' && Number.isFinite(i.aggiornato)
    && typeof i.creato === 'number'
    && JSON.stringify(x).length <= MAX_ITEM_BYTES;
}

/**
 * Crea il server. Rotte: `GET /api/health` (versione), `POST /api/auth/login` e `/logout`, `GET /api/me`,
 * `POST /api/sync` (invia le modifiche, riceve quelle dopo `since`), `GET /api/export`. Tutte tranne health e login richiedono
 * il token `Bearer`. Al primo avvio crea l'unico utente da `MYTASK_EMAIL` e `MYTASK_PASSWORD`.
 */
export async function buildApp({ config, store, now = Date.now }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: config.trustProxy, bodyLimit: 20 * 1024 * 1024 });
  // limite ai tentativi di accesso sbagliati (per IP ed email)
  const limiter = new RateLimiter();

  // l'app Android carica la pagina da https://localhost: serve il CORS per parlare con il server
  const origini = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost', ...config.corsOrigins]);
  app.addHook('onRequest', async (req, reply) => {
    const o = req.headers.origin;
    if (!o || !origini.has(o)) return;
    reply.header('access-control-allow-origin', o);
    reply.header('vary', 'Origin');
    reply.header('access-control-allow-headers', 'authorization, content-type');
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    reply.header('access-control-max-age', '86400');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });

  // primo avvio: crea l'unico utente dalle variabili d'ambiente
  if (store.countUsers() === 0 && config.email && config.password) {
    store.createUser(config.email, hashPassword(config.password));
  }

  // intestazioni di sicurezza su ogni risposta
  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
  });

  function autentica(req: FastifyRequest): { userId: number; email: string } | undefined {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return undefined;
    return store.findSession(hashToken(h.slice(7)), now());
  }

  app.get('/api/health', async () => ({ ok: true, versione: versioneServer() }));

  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const key = `${req.ip}|${email}`;
    if (!limiter.attempt(key, now())) return reply.code(429).send({ error: 'troppi_tentativi' });
    const user = email ? store.getUser(email) : undefined;
    // verifica sempre un hash, per non rivelare con i tempi se l'email esiste
    const ok = verifyPassword(password, user?.hash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
    if (!user || !ok) return reply.code(401).send({ error: 'credenziali_errate' });
    limiter.reset(key);
    const token = newToken();
    store.createSession(user.id, hashToken(token), now() + SESSIONE_MS);
    store.purgeSessions(now());
    return { token, email: user.email };
  });

  app.post('/api/auth/logout', async (req) => {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) store.deleteSession(hashToken(h.slice(7)));
    return { ok: true };
  });

  app.get('/api/me', async (req, reply) => {
    const s = autentica(req);
    if (!s) return reply.code(401).send({ error: 'non_autenticato' });
    return { email: s.email };
  });

  app.post('/api/sync', async (req, reply): Promise<SyncResponse | undefined> => {
    if (!autentica(req)) { reply.code(401).send({ error: 'non_autenticato' }); return undefined; }
    const body = req.body as Partial<SyncRequest> | null;
    const since = typeof body?.since === 'number' && body.since >= 0 ? body.since : 0;
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    if (!changes.every(itemValido)) { reply.code(400).send({ error: 'voce_non_valida' }); return undefined; }
    if (body?.impostazioni !== undefined && !impostazioniValide(body.impostazioni)) { reply.code(400).send({ error: 'impostazioni_non_valide' }); return undefined; }
    store.applyChanges(changes);
    if (body?.impostazioni) store.applySettings(body.impostazioni);
    return { items: store.changesSince(since), seq: store.maxSeq(), impostazioni: store.allSettings() };
  });

  app.get('/api/export', async (req, reply) => {
    if (!autentica(req)) return reply.code(401).send({ error: 'non_autenticato' });
    reply.header('content-disposition', `attachment; filename="mytask-${today(new Date(now()))}.json"`);
    return { esportato: new Date(now()).toISOString(), voci: store.allItems(), impostazioni: store.allSettings() };
  });

  // interfaccia web (se compilata): file statici e, per ogni altro indirizzo, index.html (l'app gestisce i percorsi)
  const indexFile = path.join(config.webDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    await app.register(fastifyStatic, { root: config.webDir, wildcard: false, index: false });
    app.get('/*', async (req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'non_trovato' });
      let file = req.url.split('?')[0].replace(/^\//, '');
      try { file = decodeURIComponent(file); } catch { file = ''; }
      const abs = path.resolve(config.webDir, file);
      // solo file dentro la cartella dell'app (niente "../")
      if (file && abs.startsWith(config.webDir + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        return reply.sendFile(file);
      }
      reply.header('cache-control', 'no-cache');
      return reply.type('text/html').send(fs.readFileSync(indexFile));
    });
  }

  return app;
}
