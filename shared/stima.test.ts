import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { MARGINE_INIZIALE, intervallo, margineAtteso, stimaPer } from './stima.ts';

let n = 0;
const fatta = (titolo: string, sforzoMin: number | undefined, durataRealeMin: number | undefined): Item =>
  ({ id: `s${++n}`, tipo: 'azione', titolo, stato: 'fatto', creato: 1, aggiornato: 1, sforzoMin, durataRealeMin });

test('stima: senza storico il margine è quello di partenza e non c\'è una stima', () => {
  assert.equal(margineAtteso([]), MARGINE_INIZIALE);
  assert.equal(stimaPer('Pagare il bollo', []), undefined);
});

test('stima: il margine scende se le stime sono precise e sale se sbagliano molto', () => {
  const precise = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Compito ${k}`, 30, 30));
  const sbagliate = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Altro ${k}`, 30, 75));
  assert.ok(margineAtteso(precise) < MARGINE_INIZIALE);
  assert.ok(margineAtteso(sbagliate) > MARGINE_INIZIALE);
});

test('stima: per un titolo simile usa la mediana dei tempi reali e l\'intervallo atteso', () => {
  const storico = [fatta('Pagare bollo auto', 15, 20), fatta('Pagare il bollo della moto', 15, 30), fatta('Chiamare il dentista', 10, 10)];
  const s = stimaPer('Pagare il bollo', storico)!;
  assert.equal(s.fonte, 'simili');
  assert.equal(s.campioni, 2);
  assert.equal(s.minuti, 25);
  const [da, a] = intervallo(s.minuti, s.margine);
  assert.ok(da < 25 && a > 25);
});

test('stima: le attività non completate o senza tempo reale non contano', () => {
  const aperta: Item = { ...fatta('Pagare il bollo', 15, 20), stato: 'da_fare' };
  const senzaTempo = fatta('Pagare il bollo', 15, undefined);
  assert.equal(stimaPer('Pagare il bollo', [aperta, senzaTempo]), undefined);
});
