import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { SESSIONE_FERMA, formatoCronometro, minutiMisurati, msTrattoInCorso, prossimoTask, sessioneValida, tempoLavorato, type Sessione } from './sessione.ts';

const item = (id: string, lavoratoMs?: number): Item => ({ id, tipo: 'azione', titolo: id, stato: 'da_fare', creato: 1, aggiornato: 1, lavoratoMs });

test('sessione: il tempo lavorato somma il già accumulato e il tratto che corre sul task', () => {
  const s: Sessione = { stato: 'lavoro', taskId: 'a', inizio: 1_000_000, aggiornato: 1 };
  assert.equal(msTrattoInCorso(s, 1_000_000 + 90_000), 90_000);
  assert.equal(tempoLavorato(item('a', 60_000), s, 1_000_000 + 90_000), 150_000);
  assert.equal(tempoLavorato(item('b', 60_000), s, 1_000_000 + 90_000), 60_000, 'sugli altri task non corre');
  assert.equal(msTrattoInCorso({ stato: 'pausa', taskId: 'a', aggiornato: 1 }, 5_000_000), 0, 'in pausa il cronometro è fermo');
  assert.equal(msTrattoInCorso(SESSIONE_FERMA, 5_000_000), 0);
});

test('sessione: una misura sotto i 30 secondi non conta, il resto è in minuti interi', () => {
  assert.equal(minutiMisurati(20_000), undefined);
  assert.equal(minutiMisurati(40_000), 1);
  assert.equal(minutiMisurati(42 * 60_000 + 10_000), 42);
});

test('sessione: formato del cronometro', () => {
  assert.equal(formatoCronometro(0), '00:00');
  assert.equal(formatoCronometro(42 * 60_000 + 10_000), '42:10');
  assert.equal(formatoCronometro(3_600_000 + 5 * 60_000 + 9_000), '1:05:09');
});

test('sessione: il prossimo task è il successivo in lista, o il primo se si è in fondo', () => {
  assert.equal(prossimoTask(['a', 'b', 'c'], 'a'), 'b');
  assert.equal(prossimoTask(['a', 'b', 'c'], 'c'), 'a');
  assert.equal(prossimoTask(['a', 'b', 'c'], 'b', ['c']), 'a', 'gli esclusi non si scelgono');
  assert.equal(prossimoTask(['a'], 'a'), undefined);
  assert.equal(prossimoTask(['a', 'b'], undefined), 'a');
  assert.equal(prossimoTask(['a', 'b'], 'x'), 'a', 'se il task attuale non è più in lista si riparte dal primo');
});

test('sessione: si accettano solo stati coerenti (da disco o dal server)', () => {
  assert.deepEqual(sessioneValida({ stato: 'ferma', aggiornato: 5 }), { stato: 'ferma', aggiornato: 5 });
  assert.equal(sessioneValida({ stato: 'lavoro', taskId: 'a' }), null, 'senza inizio non può correre');
  assert.equal(sessioneValida({ stato: 'pausa' }), null, 'senza task non ha senso');
  assert.equal(sessioneValida({ stato: 'boh' }), null);
  assert.equal(sessioneValida(null), null);
  const ok = sessioneValida({ stato: 'lavoro', taskId: 'a', inizio: 10, controllo: 12, aggiornato: 13 });
  assert.deepEqual(ok, { stato: 'lavoro', taskId: 'a', inizio: 10, controllo: 12, aggiornato: 13 });
  assert.equal(sessioneValida({ stato: 'pausa', taskId: 'a', inizio: 10, aggiornato: 1 })?.inizio, undefined, 'in pausa l\'inizio non si tiene');
});
