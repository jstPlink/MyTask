import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from '../../shared/types.ts';
import { loadConfig } from './config.ts';
import { Store } from './db.ts';
import { buildApp } from './app.ts';

const item = (id: string, aggiornato: number, extra: Partial<Item> = {}): Item => ({
  id, tipo: 'azione', titolo: `Voce ${id}`, stato: 'da_fare', creato: 1, aggiornato, ...extra,
});

async function setup() {
  const store = new Store(':memory:');
  const config = loadConfig({ email: 'tu@example.com', password: 'una-password-lunga', webDir: '/nonexistent' });
  const app = await buildApp({ config, store });
  const login = async (password = 'una-password-lunga') => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'Tu@Example.com', password } });
    return r;
  };
  return { app, store, login };
}

test('login: password corretta restituisce un token, errata no', async () => {
  const { app, login } = await setup();
  const ok = await login();
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().token.length > 30);
  assert.equal((await login('sbagliata')).statusCode, 401);
  await app.close();
});

test('login: dopo troppi tentativi sbagliati arriva 429', async () => {
  const { app, login } = await setup();
  let ultimo = 0;
  for (let i = 0; i < 10; i++) ultimo = (await login('no')).statusCode;
  assert.equal(ultimo, 429);
  await app.close();
});

test('sync: senza token è vietato', async () => {
  const { app } = await setup();
  const r = await app.inject({ method: 'POST', url: '/api/sync', payload: { since: 0, changes: [] } });
  assert.equal(r.statusCode, 401);
  await app.close();
});

test('sync: invia le modifiche e riceve quelle altrui; vince la più recente', async () => {
  const { app, login } = await setup();
  const token = (await login()).json().token as string;
  const h = { authorization: `Bearer ${token}` };
  const sync = async (since: number, changes: Item[]) =>
    (await app.inject({ method: 'POST', url: '/api/sync', headers: h, payload: { since, changes } })).json() as { items: Item[]; seq: number };

  const a = await sync(0, [item('a', 100), item('b', 100)]);
  assert.equal(a.items.length, 2);
  assert.equal(a.seq, 2);

  // un altro dispositivo parte da zero e vede tutto
  assert.equal((await sync(0, [])).items.length, 2);
  // chi è già aggiornato non riceve nulla
  assert.equal((await sync(a.seq, [])).items.length, 0);

  // modifica più recente vince, più vecchia viene ignorata
  await sync(a.seq, [item('a', 200, { titolo: 'Nuovo' })]);
  await sync(0, [item('a', 150, { titolo: 'Vecchio' })]);
  const tutte = (await sync(0, [])).items;
  assert.equal(tutte.find((x) => x.id === 'a')?.titolo, 'Nuovo');

  // le cancellazioni viaggiano come voci con eliminato = true
  const d = await sync(0, [item('b', 300, { eliminato: true })]);
  assert.equal(d.items.find((x) => x.id === 'b')?.eliminato, true);
  await app.close();
});

test('sync: rifiuta voci malformate', async () => {
  const { app, login } = await setup();
  const token = (await login()).json().token as string;
  const r = await app.inject({
    method: 'POST', url: '/api/sync', headers: { authorization: `Bearer ${token}` },
    payload: { since: 0, changes: [{ id: 'x' }] },
  });
  assert.equal(r.statusCode, 400);
  await app.close();
});

test('CORS: ammesso solo per l\'app Android, anche per la richiesta preliminare', async () => {
  const { app } = await setup();
  const ok = await app.inject({ method: 'OPTIONS', url: '/api/sync', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
  assert.equal(ok.statusCode, 204);
  assert.equal(ok.headers['access-control-allow-origin'], 'https://localhost');
  assert.match(String(ok.headers['access-control-allow-headers']), /authorization/);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://localhost' }, payload: { email: 'tu@example.com', password: 'una-password-lunga' } });
  assert.equal(login.headers['access-control-allow-origin'], 'https://localhost');
  const altro = await app.inject({ method: 'OPTIONS', url: '/api/sync', headers: { origin: 'https://sito-qualunque.example' } });
  assert.equal(altro.headers['access-control-allow-origin'], undefined);
  await app.close();
});

test('health: indica la versione del server', async () => {
  const { app } = await setup();
  const r = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(r.json().ok, true);
  assert.match(r.json().versione, /^\d+\.\d+\.\d+$/);
  await app.close();
});

test('impostazioni: passano da un dispositivo all\'altro e vince la modifica più recente', async () => {
  const { app, login } = await setup();
  const token = (await login()).json().token as string;
  const h = { authorization: `Bearer ${token}` };
  const sync = async (payload: object) => (await app.inject({ method: 'POST', url: '/api/sync', headers: h, payload })).json() as { impostazioni?: Record<string, { valore: unknown; aggiornato: number }> };
  const primo = { taskId: 'a', inizio: 1 };
  const secondo = { taskId: 'b', inizio: 2 };

  // il telefono imposta un valore; il sito, che parte da zero, lo riceve
  await sync({ since: 0, changes: [], impostazioni: { sessione: { valore: primo, aggiornato: 1000 } } });
  assert.deepEqual((await sync({ since: 0, changes: [] })).impostazioni?.sessione, { valore: primo, aggiornato: 1000 });
  // una modifica più vecchia non sostituisce quella già salvata, una più recente sì
  assert.equal((await sync({ since: 0, changes: [], impostazioni: { sessione: { valore: secondo, aggiornato: 500 } } })).impostazioni?.sessione?.aggiornato, 1000);
  assert.deepEqual((await sync({ since: 0, changes: [], impostazioni: { sessione: { valore: secondo, aggiornato: 2000 } } })).impostazioni?.sessione?.valore, secondo);
  // chiavi o valori non ammessi vengono rifiutati
  assert.equal((await app.inject({ method: 'POST', url: '/api/sync', headers: h, payload: { since: 0, changes: [], impostazioni: { 'chiave non valida!': { valore: 1, aggiornato: 1 } } } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/sync', headers: h, payload: { since: 0, changes: [], impostazioni: { x: { valore: 'a'.repeat(30000), aggiornato: 1 } } } })).statusCode, 400);
  await app.close();
});
