import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { MARGINE_PREDEFINITO, fattoreLunghezza, impostaParametriMargine, normalizzaMargine, quotaErrore, pesoEta, pesoNota, EMIVITA_GIORNI, MARGINE_INIZIALE, MARGINE_MAX, MARGINE_MIN, livelloMargine, livelloNota, margineAtteso, precisione, PESO_GIUSTA, PESO_SBAGLIATA, percentuale, storicoNote, ultimeNote, stimaPer, tempoAtteso } from './stima.ts';

let n = 0;
const fatta = (titolo: string, sforzoMin: number | undefined, durataRealeMin: number | undefined): Item =>
  ({ id: `s${++n}`, tipo: 'azione', titolo, stato: 'fatto', creato: 1, aggiornato: 1, sforzoMin, durataRealeMin });

test('stima: senza storico il margine è quello di partenza e non c\'è una stima', () => {
  assert.equal(margineAtteso([]), MARGINE_INIZIALE);
  assert.equal(stimaPer('Pagare il bollo', []), undefined);
});

test('stima: con una sola nota il margine è il suo scostamento, con segno', () => {
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

test('stima: una stima precisa pesa di più, in più o in meno è uguale', () => {
  assert.equal(precisione(0), 1);
  assert.ok(precisione(0.1) > precisione(0.3) && precisione(0.3) > precisione(0.8));
  assert.ok(Math.abs(precisione(0.2) - precisione(-0.2)) < 1e-12);
  assert.ok(pesoNota(60, 0, 0) > pesoNota(60, 0.3, 0) && pesoNota(60, 0.3, 0) > pesoNota(60, 1, 0));
  assert.ok(Math.abs(pesoNota(60, 0, 0) - PESO_GIUSTA) < 1e-9 && pesoNota(60, 5, 0) >= PESO_SBAGLIATA - 1e-9);
});

test('stima: prima un grosso eccesso e poi una stima giusta: il margine si corregge di molto', () => {
  const m1 = margineAtteso([fatta('Uno', 60, 108)]); // +80%
  const m2 = margineAtteso([fatta('Uno', 60, 108), fatta('Due', 60, 60)]); // poi 0%
  assert.ok(Math.abs(m1 - 0.8) < 1e-9);
  assert.ok(m2 < m1 * 0.5, `dopo la nota giusta il margine scende a meno della metà (${m2})`);
  assert.ok(m2 > 0, 'ma non va a zero con una sola nota');
});

test('stima: errori opposti con lo stesso peso si compensano', () => {
  assert.ok(Math.abs(margineAtteso([fatta('Uno', 60, 108), fatta('Due', 60, 12)])) < 1e-9);
});

test('stima: errori sempre dello stesso segno portano il margine verso quell errore', () => {
  const corte = [1, 2, 3, 4, 5, 6].map((k) => fatta(`Corta ${k}`, 60, 96)); // +60% ogni volta
  assert.ok(Math.abs(margineAtteso(corte) - 0.6) < 1e-9);
});

test('stima: una nota completata da più tempo pesa meno (emivita)', () => {
  const GG = 86_400_000, adesso = 1000 * GG;
  const sbagliata = (giorniFa: number) => ({ ...fatta('Sbagliata', 60, 108), completatoTs: adesso - giorniFa * GG }); // +80%
  const giusta = { ...fatta('Giusta', 60, 60), completatoTs: adesso };
  assert.ok(margineAtteso([sbagliata(EMIVITA_GIORNI), giusta], adesso) < margineAtteso([sbagliata(1), giusta], adesso));
  assert.ok(Math.abs(pesoEta(EMIVITA_GIORNI) - 0.5) < 1e-9);
});

test('stima: l\'ordine delle note non conta, e con l\'età piatta due note uguali pesano uguale', () => {
  const GG = 86_400_000, adesso = 1000 * GG;
  const note = [{ ...fatta('Vecchia', 60, 90), completatoTs: adesso - 200 * GG }, { ...fatta('Nuova', 60, 90), completatoTs: adesso }, { ...fatta('Media', 60, 66), completatoTs: adesso - 50 * GG }];
  assert.ok(Math.abs(margineAtteso(note, adesso) - margineAtteso([note[2], note[0], note[1]], adesso)) < 1e-12);
  impostaParametriMargine({ ...MARGINE_PREDEFINITO, eta: { emivita: 21, minimo: 1 } });
  const st = storicoNote(note, adesso);
  const quota = (t: string) => st.find((n) => n.item.titolo === t)!.quota;
  assert.ok(Math.abs(quota('Vecchia') - quota('Nuova')) < 1e-12);
  assert.ok(Math.abs(st.reduce((s, n) => s + n.quota, 0) - 1) < 1e-9);
  impostaParametriMargine(undefined);
});

test('stima: note tutte molto vecchie danno comunque un margine', () => {
  assert.ok(Math.abs(margineAtteso([fatta('Antica', 60, 90)], 5000 * 86_400_000) - 0.5) < 1e-9);
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

test('stima: ultimeNote dà scostamento, minuti e livello delle ultime note, dalla meno recente', () => {
  const note = [1, 2, 3, 4, 5].map((k) => ({ ...fatta(`Nota ${k}`, 60, 60 + k * 6), completatoTs: k * 1000 })); // +10%, +20%, …
  const u = ultimeNote(note, 3);
  assert.equal(u.length, 3);
  assert.ok(Math.abs(u[0].scostamento - 0.3) < 1e-9 && Math.abs(u[2].scostamento - 0.5) < 1e-9, 'le ultime tre, in ordine di completamento');
  assert.deepEqual(u.map((x) => x.differenzaMin), [18, 24, 30]);
  assert.deepEqual(ultimeNote([]), []);
  assert.deepEqual(ultimeNote([fatta('Senza stima', undefined, 30)]), [], 'senza stima non conta');
});

test('stima: una nota lunga pesa un po\' di più di una breve con la stessa precisione', () => {
  assert.ok(pesoNota(120, 0.1, 0) > pesoNota(20, 0.1, 0));
});

test('stima: il giudizio sulla singola nota tiene conto anche dei minuti', () => {
  assert.equal(livelloNota(10, 15), 'medio', '+50% ma solo 5 minuti: non è sbagliata (sotto i 10) ma 5 minuti sono ancora una differenza media');
  assert.equal(livelloNota(10, 14), 'buono', '+40% ma 4 minuti: buona');
  assert.equal(livelloNota(20, 30), 'medio', '+50% ma 10 minuti di differenza: al massimo media');
  assert.equal(livelloNota(20, 31), 'sbagliato', '+55% e 11 minuti: sbagliata');
  assert.equal(livelloNota(120, 150), 'medio', '+25% su 30 minuti: media');
  assert.equal(livelloNota(120, 90), 'medio', '−25%: media, uguale in negativo');
  assert.equal(livelloNota(60, 66), 'buono', '+10%: buona');
  assert.equal(livelloNota(60, 120), 'sbagliato', '+100% e 60 minuti: sbagliata');
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
  const b = { ...fatta('Recente', 60, 60), completatoTs: adesso };
  const senza = fatta('Senza stima', undefined, 30);
  const st = storicoNote([a, b, senza], adesso);
  assert.deepEqual(st.map((n) => n.item.titolo), ['Recente', 'Vecchia']);
  assert.ok(Math.abs(st[0].scostamento) < 1e-9 && Math.abs(st[1].scostamento - 0.5) < 1e-9);
  assert.equal(Math.max(...st.map((n) => n.peso)), 1);
  assert.ok(st[0].peso > st[1].peso, 'la nota giusta e recente è quella che pesa di più');
  assert.equal(storicoNote([a, b], adesso, 1).length, 1);
});

test('stima: anche le curiosità completate con stima e tempo reale contano nel margine', () => {
  const curiosita: Item = { ...fatta('Capire i nodi', 60, 90), tipo: 'curiosita' };
  assert.ok(Math.abs(margineAtteso([curiosita]) - 0.5) < 1e-9);
  assert.equal(storicoNote([curiosita]).length, 1);
});

test('bilanciatore del margine: valori di base delle tre curve', () => {
  const d = MARGINE_PREDEFINITO;
  assert.ok(Math.abs(pesoEta(0, d) - 1) < 1e-9 && Math.abs(pesoEta(21, d) - 0.5) < 1e-9);
  for (const m of [5, 15, 40, 60, 90, 300]) assert.ok(Math.abs(fattoreLunghezza(m, d) - Math.min(1.4, Math.max(0.6, Math.sqrt(m / 60)))) < 1e-9, `${m} min`);
  assert.ok(Math.abs(quotaErrore(0, d) - PESO_GIUSTA) < 1e-9);
  assert.ok(Math.abs(quotaErrore(0.25, d) - (PESO_SBAGLIATA + (PESO_GIUSTA - PESO_SBAGLIATA) * Math.exp(-1))) < 1e-9);
});

test('bilanciatore del margine: i punti trascinati sono i valori delle curve', () => {
  const p = normalizzaMargine({ eta: { emivita: 30, minimo: 0.4 }, lunghezza: { breve: 0.8, breveMin: 30, lunga: 1.9, lungaMin: 90 }, errore: { giusta: 0.5, sbagliata: 0.5, scala: 0.25 } });
  assert.ok(Math.abs(pesoEta(100000, p) - 0.4) < 1e-9, 'non scende sotto il minimo');
  assert.ok(Math.abs(fattoreLunghezza(5, p) - 0.8) < 1e-9 && Math.abs(fattoreLunghezza(30, p) - 0.8) < 1e-9);
  assert.ok(Math.abs(fattoreLunghezza(90, p) - 1.9) < 1e-9 && Math.abs(fattoreLunghezza(600, p) - 1.9) < 1e-9, 'oltre il punto lungo il peso resta quello');
  assert.ok(fattoreLunghezza(60, p) > 0.8 && fattoreLunghezza(60, p) < 1.9);
  const stretti = normalizzaMargine({ ...p, lunghezza: { breve: 0.8, breveMin: 100, lunga: 1.9, lungaMin: 20 } });
  assert.ok(stretti.lunghezza.lungaMin > stretti.lunghezza.breveMin, 'il punto lungo resta dopo quello breve');
  assert.equal(quotaErrore(0, p), quotaErrore(2, p), 'giusta e sbagliata uguali: l errore non conta');
});

test('bilanciatore del margine: le curve cambiano il margine e si ripristinano', () => {
  const GG = 86_400_000;
  const adesso = 30 * GG;
  const note = [{ ...fatta('Uno', 60, 108), completatoTs: 0 }, { ...fatta('Due', 60, 66), completatoTs: adesso }];
  const base = margineAtteso(note, adesso);
  impostaParametriMargine({ ...MARGINE_PREDEFINITO, eta: { emivita: 100, minimo: 0 } });
  assert.ok(margineAtteso(note, adesso) > base, 'con una memoria più lunga la vecchia nota sbagliata pesa di più');
  impostaParametriMargine(undefined);
  assert.equal(margineAtteso(note, adesso), base);
});

test('bilanciatore del margine: i valori fuori dai limiti o mancanti tornano validi', () => {
  const p = normalizzaMargine({ eta: { emivita: 1, minimo: 7 } });
  assert.deepEqual(p.eta, { emivita: 3, minimo: 1 });
  assert.deepEqual(p.errore, MARGINE_PREDEFINITO.errore);
});
