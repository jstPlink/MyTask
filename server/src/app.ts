import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { Item, SyncRequest, SyncResponse } from '../../shared/types.ts';
import { today } from '../../shared/dates.ts';
import type { Config } from './config.ts';
import { Store } from './db.ts';
import { RateLimiter, hashPassword, hashToken, newToken, verifyPassword } from './auth.ts';
import { IaNonDisponibile, interpretaConGemini } from './ai.ts';

const SESSIONE_MS = 180 * 24 * 3600 * 1000;
const MAX_ITEM_BYTES = 200_000;

export interface AppDeps { config: Config; store: Store; fetchFn?: typeof fetch; now?: () => number }

function itemValido(x: unknown): x is Item {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  return typeof i.id === 'string' && i.id.length > 0 && i.id.length <= 64
    && typeof i.tipo === 'string' && typeof i.titolo === 'string'
    && typeof i.stato === 'string' && typeof i.aggiornato === 'number' && Number.isFinite(i.aggiornato)
    && typeof i.creato === 'number'
    && JSON.stringify(x).length <= MAX_ITEM_BYTES;
}

export async function buildApp({ config, store, fetchFn, now = Date.now }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: config.trustProxy, bodyLimit: 20 * 1024 * 1024 });
  const limiter = new RateLimiter();

  // primo avvio: crea l'unico utente dalle variabili d'ambiente
  if (store.countUsers() === 0 && config.email && config.password) {
    store.createUser(config.email, hashPassword(config.password));
  }

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

  app.get('/api/health', async () => ({ ok: true }));

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
    store.applyChanges(changes);
    return { items: store.changesSince(since), seq: store.maxSeq() };
  });

  app.get('/api/export', async (req, reply) => {
    if (!autentica(req)) return reply.code(401).send({ error: 'non_autenticato' });
    reply.header('content-disposition', `attachment; filename="mytask-${today(new Date(now()))}.json"`);
    return { esportato: new Date(now()).toISOString(), voci: store.allItems() };
  });

  app.post('/api/ai/capture', async (req, reply) => {
    if (!autentica(req)) return reply.code(401).send({ error: 'non_autenticato' });
    const body = req.body as { text?: unknown } | null;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) return reply.code(400).send({ error: 'testo_mancante' });
    try {
      const proposta = await interpretaConGemini(text, today(new Date(now())), { apiKey: config.geminiKey, model: config.geminiModel }, fetchFn);
      return { proposta };
    } catch (e) {
      if (e instanceof IaNonDisponibile) return reply.code(503).send({ error: 'ia_non_disponibile' });
      return reply.code(502).send({ error: 'ia_errore' });
    }
  });

  // interfaccia web (se compilata)
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
