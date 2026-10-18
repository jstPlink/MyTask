import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, leggiRighe, convertiData, converti, norm } from '../scripts/notion.ts';

const CSV = `Name,Date,Note,Parent item,Priority,Rate,Status,Sub-item,Type
Un film di esempio,,"consigliato da mario ecc",,High,,Not started,,Video
Un titolo su Netflix,,netflix,,Very low,,Not started,,Video
Un anime di esempio,,,,Very low,,Not started,,Video
Film romantico,,Romantico,,Very low,,Not started,,Video
Film romantico,,,,Medium,,Not started,,Info
Chiamare il fornitore del gas,2026/02/02,,,High,,Expired,,Admin
Cambiare fornitore,2026/02/02 11:00 AM (GMT+1) → 11:30 AM,"https://youtu.be/x?si=abc
altro testo",,Very high,,Done,,Admin
Dieta,,,,Very high,,In progress,"Creare calendario (https://app.notion.com/p/x)",Admin
Creare calendario,,,Dieta (https://app.notion.com/p/Dieta-2c4?pvs=21),,,Not started,,Admin
Portfolio,,,,Very high,,In progress,"Definire il formato",Admin
Definire il formato,,,Portfolio (https://app.notion.com/p/P?pvs=21),,,Not started,,Admin
Un videogioco,2025/11/16 → 2025/12/01,,,,,Done,,Video
Un film visto,2026/03/07,,,,7,Done,,Video
"Nome con
a capo",,,,Low,,Not started,,Attività
`;

test('CSV: campi tra virgolette, virgole e a capo', () => {
  const righe = parseCsv(CSV);
  assert.equal(righe[0].length, 9);
  assert.ok(righe.some((r) => r[0] === 'Nome con\na capo'));
  assert.equal(leggiRighe(CSV).length, 14);
});

test('date: orari AM/PM, intervalli e giorni singoli', () => {
  assert.deepEqual(convertiData('2026/01/05 12:00 PM (GMT+1) → 12:15 PM'), { inizio: '2026-01-05', oraInizio: '12:00', oraFine: '12:15' });
  assert.deepEqual(convertiData('2025/12/28 10:00 AM (GMT+1) → 1:00 PM'), { inizio: '2025-12-28', oraInizio: '10:00', oraFine: '13:00' });
  assert.deepEqual(convertiData('2026/03/17 → 2026/03/21'), { inizio: '2026-03-17', fine: '2026-03-21' });
  assert.deepEqual(convertiData('2026/04/18'), { inizio: '2026-04-18' });
  assert.deepEqual(convertiData(''), {});
});

test('conversione: tipi, duplicati, note, persone', () => {
  const { items, report } = converti(leggiRighe(CSV), 1000, '2026-10-15');
  const per = (t: string) => items.find((i) => i.titolo === t);

  assert.equal(per('Un film di esempio')?.tipo, 'film');
  assert.equal(per('Un film di esempio')?.consigliatoDa, 'Mario');
  assert.equal(per('Un film di esempio')?.interesse, 4);
  assert.equal(per('Un titolo su Netflix')?.piattaforma, 'Netflix');
  assert.equal(per('Un anime di esempio')?.tipo, 'anime');
  assert.equal(per('Un videogioco')?.tipo, 'gioco');

  // Film romantico compare una volta sola, come film, con la priorità più alta
  const nh = items.filter((i) => i.titolo === 'Film romantico');
  assert.equal(nh.length, 1);
  assert.equal(nh[0].tipo, 'film');
  assert.equal(nh[0].interesse, 3);
  assert.equal(nh[0].genere, 'Romantico');
  assert.ok(report.duplicatiUniti.some((d) => d.startsWith('Film romantico')));

  // le voci chiuse hanno la data di completamento e il voto
  const sq = per('Un film visto');
  assert.equal(sq?.stato, 'fatto');
  assert.equal(sq?.completatoIl, '2026-03-07');
  assert.equal(sq?.voto, 7);

  // link ripuliti, orario → scadenza rigida
  const cf = per('Cambiare fornitore');
  assert.equal(cf?.rigida, true);
  assert.equal(cf?.oraInizio, '11:00');
  assert.deepEqual(cf?.link, ['https://youtu.be/x']);
  assert.equal(cf?.note, 'altro testo');
  assert.equal(cf?.area, 'Burocrazia');

  // le voci aperte con la data già passata finiscono nel report delle scadute
  assert.ok(report.scadute.some((x) => x.startsWith('Chiamare il fornitore')));
});

test('conversione: gerarchia come sotto-task o checklist', () => {
  const { items } = converti(leggiRighe(CSV), 1000, '2026-10-15');
  const dieta = items.find((i) => i.titolo === 'Dieta');
  assert.equal(dieta?.tipo, 'routine');
  assert.equal(dieta?.checklist?.[0].testo, 'Creare calendario');
  assert.equal(dieta?.fascia, 'mattina');
  assert.ok(!items.some((i) => i.tipo === 'azione' && i.titolo === 'Creare calendario'));

  const portfolio = items.find((i) => i.titolo === 'Portfolio');
  assert.equal(portfolio?.tipo, 'progetto');
  const figlio = items.find((i) => i.titolo === 'Definire il formato');
  assert.equal(figlio?.padreId, portfolio?.id);
  assert.equal(figlio?.tipo, 'azione');
});

test('norm: accenti, apostrofi e maiuscole', () => {
  assert.equal(norm("L’Èrba  del Vicino"), "l'erba del vicino");
});
