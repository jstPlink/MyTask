import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { MARGINE_INIZIALE, MARGINE_MAX, MARGINE_MIN, margineAtteso, percentuale, stimaPer, tempoAtteso } from './stima.ts';

let n = 0;
const fatta = (titolo: string, sforzoMin: number | undefined, durataRealeMin: number | undefined): Item =>
  ({ id: `s${++n}`, tipo: 'azione', titolo, stato: 'fatto', creato: 1, aggiornato: 1, sforzoMin, durataRealeMin });

test('stima: senza storico il margine è quello di partenza e non c\'è una stima', () => {
  assert.equal(margineAtteso([]), MARGINE_INIZIALE);
  assert.equal(stimaPer('Pagare il bollo', []), undefined);
});

test('stima: il margine parte da +15% e si sposta del 35% della differenza tra reale e stimato', () => {
  assert.equal(MARGINE_INIZIALE, 0.15);
  // stima 60, reale 30: differenza −50% → il margine scende di 17,5 punti (da +15% a −2,5%, cioè in verde)
  assert.ok(Math.abs(margineAtteso([fatta('Uno', 60, 30)]) - (-0.025)) < 1e-9);
  // stima 60, reale 90: differenza +50% → sale di 17,5 punti (da +15% a +32,5%, in rosso)
  assert.ok(Math.abs(margineAtteso([fatta('Due', 60, 90)]) - 0.325) < 1e-9);
  assert.equal(margineAtteso([fatta('Tre', 60, 60)]), MARGINE_INIZIALE);
});

test('stima: stime troppo abbondanti portano il margine sotto zero, stime troppo corte lo alzano', () => {
  const abbondanti = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Compito ${k}`, 60, 20));
  const corte = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Altro ${k}`, 30, 75));
  assert.ok(margineAtteso(abbondanti) < 0);
  assert.ok(margineAtteso(corte) > MARGINE_INIZIALE);
  assert.ok(margineAtteso(abbondanti) >= MARGINE_MIN && margineAtteso(corte) <= MARGINE_MAX);
});

test('stima: conta l’ordine di completamento (l’ultima attività pesa di più)', () => {
  const prima = { ...fatta('A', 60, 120), completatoTs: 1 };
  const dopo = { ...fatta('B', 60, 30), completatoTs: 2 };
  assert.ok(margineAtteso([prima, dopo]) !== margineAtteso([{ ...prima, completatoTs: 3 }, dopo]));
});

test('stima: percentuale con segno e tempo atteso', () => {
  assert.equal(percentuale(0.15), '+15%');
  assert.equal(percentuale(-0.2), '−20%');
  assert.equal(percentuale(0), '0%');
  assert.equal(tempoAtteso(60, 0.15), 69);
  assert.equal(tempoAtteso(60, -0.5), 30);
});

test('stima: per un titolo simile usa la mediana dei tempi reali e il margine generale', () => {
  const storico = [fatta('Pagare bollo auto', 15, 20), fatta('Pagare il bollo della moto', 15, 30), fatta('Chiamare il dentista', 10, 10)];
  const s = stimaPer('Pagare il bollo', storico)!;
  assert.equal(s.fonte, 'simili');
  assert.equal(s.campioni, 2);
  assert.equal(s.minuti, 25);
  assert.equal(s.margine, margineAtteso(storico));
});

test('stima: le attività non completate o senza tempo reale non contano', () => {
  const aperta: Item = { ...fatta('Pagare il bollo', 15, 20), stato: 'da_fare' };
  const senzaTempo = fatta('Pagare il bollo', 15, undefined);
  assert.equal(stimaPer('Pagare il bollo', [aperta, senzaTempo]), undefined);
});
