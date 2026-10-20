import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { SESSIONE_FERMA, formatoCronometro, istantiPromemoriaTimer, minutiMisurati, altreInCorso, notaInCorso, msTrattoInCorso, prossimoTask, sessioneValida, tempoLavorato, type Sessione } from './sessione.ts';

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

test('sessione: il cronometro parte dalla nota in corso, la più recente se sono più di una', () => {
  const base = { tipo: 'azione' as const, titolo: 'T', creato: 1, aggiornato: 1 };
  const prima = { ...base, id: 'a', stato: 'da_fare' as const };
  const vecchia = { ...base, id: 'b', stato: 'in_corso' as const, inCorsoTs: 100 };
  const recente = { ...base, id: 'c', stato: 'in_corso' as const, inCorsoTs: 200 };
  assert.equal(notaInCorso([prima, vecchia, recente])?.id, 'c');
  assert.equal(notaInCorso([prima]), undefined);
  assert.equal(notaInCorso([{ ...recente, eliminato: true }, prima]), undefined);
  assert.equal(notaInCorso([{ ...recente, tipo: 'film' as const }]), undefined);
});

test('sessione: una sola nota in corso, le altre tornano da fare', () => {
  const base = { tipo: 'azione' as const, titolo: 'T', creato: 1, aggiornato: 1 };
  const a = { ...base, id: 'a', stato: 'in_corso' as const };
  const b = { ...base, id: 'b', stato: 'in_corso' as const };
  const film = { ...base, id: 'f', tipo: 'film' as const, stato: 'in_corso' as const };
  assert.deepEqual(altreInCorso([a, b, film], 'b').map((x) => x.id), ['a']);
  assert.deepEqual(altreInCorso([a], 'a'), []);
});

test('sessione: le notifiche periodiche del timer cadono ogni N minuti dall\'inizio del tratto, solo mentre corre', () => {
  const inizio = 1_000_000;
  const s: Sessione = { stato: 'lavoro', taskId: 'a', inizio, aggiornato: 1 };
  const m = 60_000;
  // appena iniziato: 5, 10, 15 minuti…
  assert.deepEqual(istantiPromemoriaTimer(s, 5, inizio, 16 * m), [inizio + 5 * m, inizio + 10 * m, inizio + 15 * m]);
  // a 7 minuti dall'inizio la prossima è a 10, non a 12
  assert.deepEqual(istantiPromemoriaTimer(s, 5, inizio + 7 * m, 10 * m), [inizio + 10 * m, inizio + 15 * m]);
  // un istante a meno di 5 secondi da adesso si salta
  assert.equal(istantiPromemoriaTimer(s, 5, inizio + 5 * m - 1000, 6 * m)[0], inizio + 10 * m);
  assert.equal(istantiPromemoriaTimer(s, 1, inizio, 24 * 3_600_000, 10).length, 10, 'al massimo `max` notifiche');
  assert.deepEqual(istantiPromemoriaTimer({ stato: 'pausa', taskId: 'a', aggiornato: 1 }, 5, inizio), [], 'in pausa niente');
  assert.deepEqual(istantiPromemoriaTimer(SESSIONE_FERMA, 5, inizio), []);
  assert.deepEqual(istantiPromemoriaTimer(s, 0, inizio), []);
});
