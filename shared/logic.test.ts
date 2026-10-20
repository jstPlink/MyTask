import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { diffDays, addDays, addMonths, startOfWeek, formatShort } from './dates.ts';
import { chiavePriorita, daysOverdue, livelloPriorita, battitoBpm, intensitaBattito, impostaPesi, normalizzaPesi, PESI_PREDEFINITI, score } from './priority.ts';
import { completa, nextOccurrence } from './recurrence.ts';
import { dueToday, toggleOggi, weekCount } from './routine.ts';
import { classificaPriorita, posizionePriorita, stimaProgetto, vistaOggi, avanzamento, listaProgetti, listaAzioni, raggruppaPerProgetto, cercaSimili } from './views.ts';
import { suggerisciStasera } from './stasera.ts';
import { listaGameDesign, punteggioGameDesign } from './gamedesign.ts';

const NOW = Date.UTC(2026, 9, 15, 10, 0, 0);
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `i${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });

test('date: differenze, mesi e settimane', () => {
  assert.equal(diffDays('2026-10-15', '2026-10-01'), 14);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(startOfWeek('2026-10-15'), '2026-10-12'); // giovedì → lunedì
  assert.equal(formatShort('2026-10-21'), '21 ott');
});

test('punteggio: somma pesata di scadenza, importanza e tempo stimato (50 / 40 / 10)', () => {
  assert.equal(score(mk({ importanza: 3, fine: OGGI, sforzoMin: 15 }), OGGI), 80); // 50 + 20 + 10
  assert.equal(score(mk({ importanza: 1 }), OGGI), 3); // senza data, importanza minima, tempo non indicato (30 → 3)
  assert.equal(score(mk({ importanza: 5, sforzoMin: 120 }), OGGI), 40);
  assert.equal(score(mk({ importanza: 3, fine: OGGI }), OGGI), 73);
});

test('punteggio: i pesi si portano a somma 1 e cambiano il risultato', () => {
  assert.deepEqual(normalizzaPesi({ scadenza: 2, importanza: 1, tempo: 1 }), { scadenza: 0.5, importanza: 0.25, tempo: 0.25 });
  assert.deepEqual(normalizzaPesi({ scadenza: 0, importanza: 0, tempo: 0 }), PESI_PREDEFINITI, 'tutti a zero: tornano quelli di base');
  const x = mk({ importanza: 5, fine: addDays(OGGI, 10), sforzoMin: 120 });
  impostaPesi({ scadenza: 1, importanza: 0, tempo: 0 });
  assert.equal(score(x, OGGI), 35); // solo la scadenza (entro 30 giorni)
  impostaPesi({ scadenza: 0, importanza: 1, tempo: 0 });
  assert.equal(score(x, OGGI), 100); // solo l'importanza
  impostaPesi(undefined);
});

test('priorità: importanza alta senza data batte importanza bassa', () => {
  assert.ok(chiavePriorita(mk({ importanza: 5 }), OGGI, NOW) > chiavePriorita(mk({ importanza: 1 }), OGGI, NOW));
});

test('livello del pallino: dal punteggio, da 60 rosso, da 35 ambra', () => {
  assert.equal(livelloPriorita(mk({ importanza: 3, fine: OGGI }), OGGI), 3); // 73
  assert.equal(livelloPriorita(mk({ importanza: 5 }), OGGI), 2); // 43
  assert.equal(livelloPriorita(mk({ importanza: 2, fine: addDays(OGGI, 5) }), OGGI), 2); // 43
  assert.equal(livelloPriorita(mk({ importanza: 3 }), OGGI), 1); // 23
  assert.equal(livelloPriorita(mk({ importanza: 1 }), OGGI), 1); // 3
});

test('scaduta: solo se la data è passata e la voce è aperta', () => {
  assert.equal(daysOverdue(mk({ fine: '2026-10-01' }), OGGI), 14);
  assert.equal(daysOverdue(mk({ fine: '2026-10-01', stato: 'fatto' }), OGGI), 0);
  assert.equal(daysOverdue(mk({}), OGGI), 0);
});

test('ricorrenza: completare sposta la scadenza, non chiude la voce', () => {
  const i = mk({ fine: '2026-10-10', ricorrenza: { ogni: 1, unita: 'anni' } });
  const c = completa(i, OGGI, NOW);
  assert.equal(c.stato, 'da_fare');
  assert.equal(c.fine, '2027-10-10');
  assert.deepEqual(c.log, [OGGI]);
  assert.equal(nextOccurrence('2026-10-01', { ogni: 1, unita: 'settimane' }, OGGI), '2026-10-22');
  const semplice = completa(mk({}), OGGI, NOW);
  assert.equal(semplice.stato, 'fatto');
  assert.equal(semplice.completatoIl, OGGI);
});

test('routine: la quota settimanale la toglie da Oggi quando è raggiunta', () => {
  let r = mk({ tipo: 'routine', volteSettimana: 2 });
  assert.equal(dueToday(r, OGGI), true);
  r = toggleOggi(r, '2026-10-12', NOW);
  r = toggleOggi(r, '2026-10-13', NOW);
  assert.equal(weekCount(r, OGGI), 2);
  assert.equal(dueToday(r, OGGI), false);
  assert.equal(dueToday(toggleOggi(r, OGGI, NOW), OGGI), true); // fatta oggi: resta visibile, spuntata
  assert.equal(dueToday({ ...r, stato: 'parcheggiato' }, OGGI), false);
});

test('Oggi: un progetto compare con il solo prossimo passo', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Progetto', importanza: 4 });
  const a = mk({ padreId: p.id, titolo: 'Passo 1' });
  const b = mk({ padreId: p.id, titolo: 'Passo 2' });
  const v = vistaOggi([p, a, b], OGGI, NOW);
  const titoli = v.fare.map((e) => e.item.titolo);
  assert.deepEqual(titoli, ['Passo 1']);
  assert.equal(v.fare[0].padre?.titolo, 'Progetto');
  assert.deepEqual(avanzamento(p, [p, a, b]), { fatti: 0, totale: 2 });
  assert.equal(listaProgetti([p, a, b], OGGI, NOW)[0].prossimo?.titolo, 'Passo 1');
});

test('Attività: i task di un progetto stanno insieme sotto di esso, gli altri restano singoli', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Bagno' });
  const a = mk({ titolo: 'A', padreId: p.id, importanza: 5, fine: '2026-10-16' });
  const libera = mk({ titolo: 'Libera', importanza: 3 });
  const b = mk({ titolo: 'B', padreId: p.id, importanza: 1 });
  const tutte = [p, a, libera, b];
  const g = raggruppaPerProgetto(listaAzioni(tutte, OGGI, NOW), tutte);
  assert.equal(g.length, 2);
  assert.equal(g[0].progetto?.titolo, 'Bagno');
  assert.deepEqual(g[0].voci.map((e) => e.item.titolo), ['A', 'B']);
  assert.deepEqual({ fatti: g[0].fatti, totale: g[0].totale }, { fatti: 0, totale: 2 });
  assert.equal(g[1].progetto, undefined);
  assert.equal(g[1].voci[0].item.titolo, 'Libera');
});

test('Stima del progetto: somma dei passi ancora da fare, senza quelli chiusi o archiviati', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Trasloco' });
  const a = mk({ padreId: p.id, sforzoMin: 90 });
  const b = mk({ padreId: p.id, sforzoMin: 30, stato: 'in_corso' });
  const fatto = mk({ padreId: p.id, sforzoMin: 60, stato: 'fatto' });
  const senza = mk({ padreId: p.id });
  assert.equal(stimaProgetto(p, [p, a, b, fatto, senza]), 120);
  assert.equal(stimaProgetto(p, [p, senza]), 0);
});

test('Classifica unica: la stessa posizione in Oggi, in Attività, nel progetto e nella scheda', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Bagno', importanza: 2 });
  const a = mk({ titolo: 'Passo A', padreId: p.id });
  const b = mk({ titolo: 'Passo B', padreId: p.id });
  const x = mk({ titolo: 'Libera alta', importanza: 5 });
  const y = mk({ titolo: 'Libera bassa', importanza: 1 });
  const tutte = [p, a, b, x, y];
  const classifica = classificaPriorita(tutte, OGGI, NOW);
  // la classifica segue la lista delle attività, passi dei progetti compresi
  assert.deepEqual(listaAzioni(tutte, OGGI, NOW).map((e) => classifica.get(e.item.id)), [1, 2, 3, 4]);
  // il progetto ha la posizione del suo passo più avanti
  assert.equal(classifica.get(p.id), classifica.get(a.id));
  // Oggi mostra le stesse posizioni (non un conteggio proprio)
  for (const e of vistaOggi(tutte, OGGI, NOW).fare) assert.equal(classifica.get(e.item.id), classificaPriorita(tutte, OGGI, NOW).get(e.item.id));
  // la scheda della nota dice lo stesso numero
  assert.equal(posizionePriorita(tutte, a, OGGI, NOW).pos, classifica.get(a.id));
  assert.equal(posizionePriorita(tutte, p, OGGI, NOW).pos, classifica.get(p.id));
  assert.equal(posizionePriorita(tutte, x, OGGI, NOW).tot, 4);
});

test('Priorità: le 5 note con la posizione migliore in assoluto, anche con scadenza futura, e i numeri partono da 1', () => {
  const futura = mk({ titolo: 'Futura', importanza: 5, fine: addDays(OGGI, 3) });
  const libere = [1, 2, 3, 4, 5, 6].map((k) => mk({ titolo: `Libera ${k}`, importanza: 2 }));
  const tutte = [...libere, futura];
  const classifica = classificaPriorita(tutte, OGGI, NOW);
  const fare = vistaOggi(tutte, OGGI, NOW).fare;
  assert.equal(fare.length, 5);
  assert.equal(fare[0].item.titolo, 'Futura', 'la nota con scadenza futura è la prima');
  assert.deepEqual(fare.map((e) => classifica.get(e.item.id)), [1, 2, 3, 4, 5]);
});

test('Oggi: prossimi 7 giorni e voci parcheggiate', () => {
  const tra3 = mk({ fine: addDays(OGGI, 3) });
  const tra20 = mk({ fine: addDays(OGGI, 20) });
  const park = mk({ stato: 'parcheggiato' });
  const v = vistaOggi([tra3, tra20, park], OGGI, NOW);
  assert.deepEqual(v.prossimi.map((e) => e.item.id), [tra3.id]);
  assert.ok(!v.fare.some((e) => e.item.id === park.id));
});

test('Priorità: il gruppo «Curiosità» propone le cinque più interessanti, a parità le più vecchie, separate dalle attività', () => {
  const cur = (titolo: string, interesse: number, aggiornato: number, extra: Partial<Item> = {}) => mk({ tipo: 'curiosita', titolo, interesse, aggiornato, ...extra });
  const buone = [cur('A', 5, NOW), cur('B', 5, NOW - 1000), cur('C', 4, NOW), cur('D', 3, NOW - 5000), cur('E', 3, NOW), cur('F', 2, NOW)];
  const escluse = [cur('Parcheggiata', 5, NOW, { stato: 'parcheggiato' }), cur('Fatta', 5, NOW, { stato: 'fatto' }), cur('In inbox', 5, NOW, { inbox: true })];
  const v = vistaOggi([...buone, ...escluse], OGGI, NOW);
  assert.deepEqual(v.curiosita.map((c) => c.titolo), ['B', 'A', 'C', 'D', 'E']);
  // le curiosità non entrano nelle attività né nella loro classifica
  assert.ok(!v.fare.some((e) => e.item.tipo === 'curiosita'));
  assert.deepEqual(vistaOggi([], OGGI, NOW).curiosita, []);
});

test('stasera: preferisce interesse alto e rispetta la durata', () => {
  const breve = mk({ tipo: 'film', titolo: 'Film breve', interesse: 4, durataMin: 77 });
  const lungo = mk({ tipo: 'film', titolo: 'Film lungo', interesse: 4, durataMin: 180 });
  const basso = mk({ tipo: 'film', titolo: 'Film poco interessante', interesse: 1, durataMin: 100 });
  const s = suggerisciStasera([lungo, basso, breve], { durata: 'breve' });
  assert.equal(s[0].item.titolo, 'Film breve');
  const serie = mk({ tipo: 'serie', titolo: 'Serie interessante', interesse: 5 });
  assert.equal(suggerisciStasera([breve, serie], { durata: 'serie' })[0].item.titolo, 'Serie interessante');
});

test('titoli: maiuscole, accenti e apostrofi non contano', async () => {
  const { chiaveTitolo } = await import('./testo.ts');
  assert.equal(chiaveTitolo("L’Èrba  del Vicino!"), "l'erba del vicino");
  assert.equal(chiaveTitolo('Sensi  e sensibilità'), chiaveTitolo('sensi e sensibilita'));
  assert.notEqual(chiaveTitolo('Serie s1'), chiaveTitolo('Serie s2'));
});

test('notifiche native: promemoria, insistenza e routine', async () => {
  const { pianificaNotifiche } = await import('./pianifica.ts');
  const ora = new Date(2026, 9, 15, 10, 0, 0); // giovedì 15 ottobre 2026, 10:00
  const scad = mk({ titolo: 'Scadenza', fine: '2026-10-20', promemoria: [{ giorniPrima: 1, ora: '09:00' }, { giorniPrima: 7, ora: '09:00' }] });
  const n = pianificaNotifiche([scad], ora);
  assert.equal(n.length, 1); // quello a 7 giorni (8 ottobre) è già passato
  assert.equal(new Date(n[0].quando).getDate(), 19);
  assert.equal(new Date(n[0].quando).getHours(), 9);
  assert.equal(n[0].corpo, 'Scade domani');
  assert.equal(n[0].id, pianificaNotifiche([scad], ora)[0].id); // stabile

  const insiste = mk({ titolo: 'Urgente', fine: '2026-10-15', insisti: { ogniMinuti: 60 } });
  const ins = pianificaNotifiche([insiste], ora);
  assert.equal(ins.length, 12);
  assert.equal(ins[0].quando - ora.getTime(), 3600000);
  assert.equal(new Set(ins.map((x) => x.id)).size, 12);
  assert.equal(pianificaNotifiche([{ ...insiste, stato: 'fatto' }], ora).length, 0);

  const r = mk({ tipo: 'routine', titolo: 'Leggere', oraPromemoria: '22:30', log: ['2026-10-15'] });
  const rn = pianificaNotifiche([r], ora, 3);
  assert.equal(rn.length, 2); // oggi già fatta: restano domani e dopodomani
  assert.equal(new Date(rn[0].quando).getDate(), 16);
  assert.equal(pianificaNotifiche([{ ...r, stato: 'parcheggiato' }], ora).length, 0);
});

test('ricerca: tutte le parole, anche nelle note, senza accenti né maiuscole', async () => {
  const { cercaVoci } = await import('./views.ts');
  const a = mk({ titolo: 'Rinnovare la carta d’identità', note: 'portare le foto' });
  const b = mk({ titolo: 'Comprare le foto stampate', stato: 'fatto' });
  const c = mk({ titolo: 'Altro', eliminato: true });
  assert.deepEqual(cercaVoci([a, b, c], 'IDENTITA').map((x) => x.id), [a.id]);
  assert.deepEqual(cercaVoci([a, b, c], 'foto').map((x) => x.id), [a.id, b.id]); // aperte prima delle chiuse
  assert.deepEqual(cercaVoci([a, b, c], 'foto stampate').map((x) => x.id), [b.id]);
  assert.deepEqual(cercaVoci([a, b, c], '   '), []);
  assert.deepEqual(cercaVoci([a, b, c], 'altro'), []); // le voci eliminate non compaiono
});

test('cattura: trova le note con le stesse parole anche in forme diverse', () => {
  const a = mk({ titolo: 'Pagare il bollo auto' });
  const b = mk({ titolo: 'Pagamento bollo della moto' });
  const c = mk({ titolo: 'Chiamare il dentista' });
  const trovate = cercaSimili([a, b, c], 'pagare bollo').map((i) => i.id);
  assert.ok(trovate.includes(a.id) && trovate.includes(b.id));
  assert.ok(!trovate.includes(c.id));
  assert.deepEqual(cercaSimili([a, b, c], ''), []);
});

test('battito del pallino: fermo senza intensità, da 11 a 88 bpm (+10%), cala di poco con la posizione', () => {
  assert.equal(battitoBpm(0), 0);
  assert.equal(battitoBpm(15), 11);
  assert.equal(battitoBpm(100), 88);
  assert.ok(battitoBpm(60) > battitoBpm(35) && battitoBpm(35) > battitoBpm(15));
  assert.equal(battitoBpm(130), 88);
  assert.equal(battitoBpm(100, 1), 88);
  assert.equal(battitoBpm(100, 6), Math.round(88 * 0.9)); // 5 posti sotto: -10%
  assert.equal(battitoBpm(100, 100), Math.round(88 * 0.7)); // il calo si ferma al 30%
});

test('game design: pesa più l\'interesse, poi il tempo, infine la difficoltà', () => {
  const base = { interesse: 3, sforzoMin: 600, difficolta: 3 };
  const p = (x: Partial<Item>) => punteggioGameDesign(mk({ tipo: 'gamedesign', ...base, ...x }));
  const dInteresse = p({ interesse: 5 }) - p({ interesse: 1 });
  const dTempo = p({ sforzoMin: 60 }) - p({ sforzoMin: 43200 });
  const dDifficolta = p({ difficolta: 1 }) - p({ difficolta: 5 });
  assert.ok(dInteresse > dTempo && dTempo > dDifficolta);
  assert.equal(Math.round(dInteresse), 50);
  assert.equal(Math.round(dTempo), 30);
  assert.equal(Math.round(dDifficolta), 20);
  assert.equal(Math.round(p({ interesse: 5, sforzoMin: 60, difficolta: 1 })), 100);
  assert.equal(Math.round(p({ interesse: 1, sforzoMin: 43200, difficolta: 5 })), 0);
  assert.equal(Math.round(punteggioGameDesign(mk({ tipo: 'gamedesign', interesse: 3 }))), 50); // senza tempo e difficoltà restano neutri
});

test('game design: la lista è in ordine di priorità e salta archiviate e bozze', () => {
  const a = mk({ tipo: 'gamedesign', titolo: 'A', interesse: 5, sforzoMin: 60, difficolta: 1 });
  const b = mk({ tipo: 'gamedesign', titolo: 'B', interesse: 2, sforzoMin: 43200, difficolta: 5 });
  const c = mk({ tipo: 'gamedesign', titolo: 'C', interesse: 5, stato: 'parcheggiato' });
  const d = mk({ tipo: 'gamedesign', titolo: 'D', interesse: 5, inbox: true });
  assert.deepEqual(listaGameDesign([b, c, d, a]).map((e) => e.item.titolo), ['A', 'B']);
});

test('ordine: segue il punteggio della formula e cambia con i pesi', () => {
  impostaPesi(undefined);
  const scadeOggi = mk({ importanza: 3, fine: OGGI }); // 73
  const importante = mk({ importanza: 5 }); // 43
  const k = (i: Item) => chiavePriorita(i, OGGI, NOW);
  assert.ok(k(scadeOggi) > k(importante));
  impostaPesi({ scadenza: 0, importanza: 1, tempo: 0 });
  assert.ok(k(importante) > k(scadeOggi));
  impostaPesi(undefined);
});

test('battito legato alla formula: il grigio è fermo, ambra e rosso battono con il punteggio', () => {
  impostaPesi(undefined);
  const b = (x: Item) => intensitaBattito(x, OGGI);
  assert.equal(b(mk({ importanza: 3 })), 0); // 23: grigia, ferma
  assert.equal(b(mk({ importanza: 5 })), 43); // ambra
  assert.equal(b(mk({ importanza: 3, fine: OGGI })), 73); // rossa
  assert.ok(battitoBpm(b(mk({ importanza: 3, fine: OGGI }))) > battitoBpm(b(mk({ importanza: 5 }))));
});
