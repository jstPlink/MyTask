import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { EMIVITA_GIORNI, MARGINE_INIZIALE, MARGINE_MAX, MARGINE_MIN, livelloMargine, margineAtteso, pesoNota, percentuale, storicoNote, ultimeNote, stimaPer, tempoAtteso } from './stima.ts';

let n = 0;
const fatta = (titolo: string, sforzoMin: number | undefined, durataRealeMin: number | undefined): Item =>
  ({ id: `s${++n}`, tipo: 'azione', titolo, stato: 'fatto', creato: 1, aggiornato: 1, sforzoMin, durataRealeMin });

test('stima: senza storico il margine è quello di partenza e non c\'è una stima', () => {
  assert.equal(margineAtteso([]), MARGINE_INIZIALE);
  assert.equal(stimaPer('Pagare il bollo', []), undefined);
});

test('stima: il margine è lo scostamento medio, con segno', () => {
  assert.equal(MARGINE_INIZIALE, 0);
  // stima 60, reale 30: −50% (verde); stima 60, reale 90: +50% (rosso); reale uguale: 0%
  assert.ok(Math.abs(margineAtteso([fatta('Uno', 60, 30)]) - (-0.5)) < 1e-9);
  assert.ok(Math.abs(margineAtteso([fatta('Due', 60, 90)]) - 0.5) < 1e-9);
  assert.equal(margineAtteso([fatta('Tre', 60, 60)]), MARGINE_INIZIALE);
});

test('stima: stime troppo abbondanti portano il margine sotto zero, stime troppo corte lo alzano', () => {
  const abbondanti = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Compito ${k}`, 60, 20));
  const corte = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Altro ${k}`, 30, 75));
  assert.ok(margineAtteso(abbondanti) < 0);
  assert.ok(margineAtteso(corte) > MARGINE_INIZIALE);
  assert.ok(margineAtteso(abbondanti) >= MARGINE_MIN && margineAtteso(corte) <= MARGINE_MAX);
});

test('stima: le attività recenti pesano di più (emivita)', () => {
  const GG = 86_400_000;
  const adesso = 100 * GG;
  const vecchia = { ...fatta('Vecchia', 60, 90), completatoTs: adesso - EMIVITA_GIORNI * GG }; // +50%, peso 0,5
  const recente = { ...fatta('Recente', 60, 54), completatoTs: adesso }; // −10%, peso 1
  const m = margineAtteso([vecchia, recente], adesso);
  assert.ok(Math.abs(m - (0.5 * 0.5 + 1 * -0.1) / 1.5) < 1e-9);
  assert.ok(m < 0.25, 'meno della media semplice (+20%) perché la nota recente conta di più');
  assert.ok(Math.abs(margineAtteso([vecchia, recente], adesso) - margineAtteso([recente, vecchia], adesso)) < 1e-12, 'non conta l ordine in lista');
});

test('stima: esempio con sei attività, emivita 21 giorni', () => {
  const GG = 86_400_000;
  const adesso = 100 * GG;
  const dati: [number, number, number][] = [[30, 60, 90], [24, 30, 45], [18, 120, 130], [10, 45, 40], [4, 60, 55], [1, 30, 28]];
  const items = dati.map(([giorni, st, re], k) => ({ ...fatta(`Es ${k}`, st, re), completatoTs: adesso - giorni * GG }));
  let somma = 0, pesi = 0;
  for (const [giorni, st, re] of dati) { const w = 0.5 ** (giorni / 21); somma += w * (re - st) / st; pesi += w; }
  assert.ok(Math.abs(margineAtteso(items, adesso) - somma / pesi) < 1e-9);
  assert.ok(margineAtteso(items, adesso) > 0.03 && margineAtteso(items, adesso) < 0.14);
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
  assert.ok(Math.abs(s.margine - margineAtteso(storico)) < 1e-6, "stesso margine (le due chiamate usano l ora di adesso)");
});

test('stima: le attività non completate o senza tempo reale non contano', () => {
  const aperta: Item = { ...fatta('Pagare il bollo', 15, 20), stato: 'da_fare' };
  const senzaTempo = fatta('Pagare il bollo', 15, undefined);
  assert.equal(stimaPer('Pagare il bollo', [aperta, senzaTempo]), undefined);
});

test('stima: ultimeNote dà lo scostamento delle ultime note, dalla meno recente', () => {
  const note = [1, 2, 3, 4, 5].map((k) => ({ ...fatta(`Nota ${k}`, 60, 60 + k * 6), completatoTs: k * 1000 })); // +10%, +20%, …
  const u = ultimeNote(note, 3);
  assert.equal(u.length, 3);
  assert.ok(Math.abs(u[0] - 0.3) < 1e-9 && Math.abs(u[2] - 0.5) < 1e-9, 'le ultime tre, in ordine di completamento');
  assert.deepEqual(ultimeNote([]), []);
  assert.deepEqual(ultimeNote([fatta('Senza stima', undefined, 30)]), [], 'senza stima non conta');
});

test('stima: il livello del margine dipende dalla distanza da zero, uguale in positivo e in negativo', () => {
  for (const [p, atteso] of [[0, 'buono'], [15, 'buono'], [16, 'medio'], [30, 'medio'], [31, 'sbagliato'], [120, 'sbagliato']] as const) {
    assert.equal(livelloMargine(p / 100), atteso, `+${p}%`);
    assert.equal(livelloMargine(-p / 100), atteso, `−${p}%`);
  }
  assert.equal(livelloMargine(0.151), 'buono', '15,1% si arrotonda a 15%');
  assert.equal(livelloMargine(0.156), 'medio', '15,6% si arrotonda a 16%');
});

test('stima: lo storico elenca le note misurate dalla più recente, con scostamento e peso', () => {
  const GG = 86_400_000;
  const adesso = 100 * GG;
  const a = { ...fatta('Vecchia', 60, 90), completatoTs: adesso - 21 * GG };
  const b = { ...fatta('Recente', 60, 54), completatoTs: adesso };
  const senza = fatta('Senza stima', undefined, 30);
  const st = storicoNote([a, b, senza], adesso);
  assert.deepEqual(st.map((n) => n.item.titolo), ['Recente', 'Vecchia']);
  assert.ok(Math.abs(st[0].scostamento - (-0.1)) < 1e-9 && Math.abs(st[1].scostamento - 0.5) < 1e-9);
  assert.equal(st[0].peso, 1);
  assert.ok(Math.abs(st[1].peso - 0.5) < 1e-9, 'dopo 21 giorni il peso si dimezza');
  assert.equal(storicoNote([a, b], adesso, 1).length, 1);
  assert.equal(pesoNota(adesso, adesso), 1);
});
