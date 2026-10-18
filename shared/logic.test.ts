import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { diffDays, addDays, addMonths, startOfWeek, formatShort } from './dates.ts';
import { score, daysOverdue, barLevel, battitoBpm } from './priority.ts';
import { completa, nextOccurrence } from './recurrence.ts';
import { dueToday, toggleOggi, weekCount } from './routine.ts';
import { vistaOggi, avanzamento, listaProgetti, listaAzioni, raggruppaPerProgetto, cercaSimili } from './views.ts';
import { suggerisciStasera } from './stasera.ts';

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

test('priorità: la scadenza rigida vale di più di quella flessibile', () => {
  const flessibile = mk({ fine: addDays(OGGI, 5), importanza: 3 });
  const rigida = mk({ fine: addDays(OGGI, 5), importanza: 3, rigida: true });
  assert.ok(score(rigida, OGGI, NOW) > score(flessibile, OGGI, NOW));
});

test('priorità: importanza alta senza data batte importanza bassa', () => {
  assert.ok(score(mk({ importanza: 5 }), OGGI, NOW) > score(mk({ importanza: 1 }), OGGI, NOW));
  assert.equal(barLevel(80), 3);
  assert.equal(barLevel(40), 2);
  assert.equal(barLevel(10), 1);
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

test('Oggi: prossimi 7 giorni e voci parcheggiate', () => {
  const tra3 = mk({ fine: addDays(OGGI, 3) });
  const tra20 = mk({ fine: addDays(OGGI, 20) });
  const park = mk({ stato: 'parcheggiato' });
  const v = vistaOggi([tra3, tra20, park], OGGI, NOW);
  assert.deepEqual(v.prossimi.map((e) => e.item.id), [tra3.id]);
  assert.ok(!v.fare.some((e) => e.item.id === park.id));
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

test('importazione da file: elenco o esportazione, voci non valide scartate', async () => {
  const { validaVoci } = await import('./validate.ts');
  const buona = { id: 'a1', tipo: 'film', titolo: 'Titolo', stato: 'da_fare' };
  const r = validaVoci([buona, { id: 'a1', tipo: 'film', titolo: 'Doppione', stato: 'da_fare' }, { id: 'b', tipo: 'inventato', titolo: 'X', stato: 'da_fare' }, { id: 'c', tipo: 'film', titolo: '  ', stato: 'da_fare' }, null, 'testo'], 5000);
  assert.equal(r.voci.length, 1);
  assert.equal(r.scartate, 5);
  assert.equal(r.voci[0].creato, 5000);
  assert.equal(r.voci[0].aggiornato, 5000);
  assert.equal(validaVoci({ esportato: 'oggi', voci: [buona] }).voci.length, 1);
  assert.throws(() => validaVoci({ cose: [] }), /elenco di voci/);
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

test('battito del pallino: fermo senza scadenza, da 10 a 80 bpm secondo l urgenza', () => {
  assert.equal(battitoBpm(0), 0);
  assert.equal(battitoBpm(15), 10);
  assert.equal(battitoBpm(100), 80);
  assert.ok(battitoBpm(60) > battitoBpm(35) && battitoBpm(35) > battitoBpm(15));
  assert.equal(battitoBpm(130), 80);
});
