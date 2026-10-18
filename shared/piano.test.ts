import test from 'node:test';
import assert from 'node:assert/strict';
import type { Item } from './types.ts';
import { DISPONIBILITA_SUGGERITA, DURATA_PAUSA, durataRealeInCorso, fasceDelGiorno, minutiDisponibili, minutiLiberiTra, minuti, orario, pianifica, senzaGiorniPassati, type Disponibilita } from './piano.ts';
import { richiesteOrari } from './pianifica.ts';
import { campiDaRisposta, leggiRisposta, opereSenzaTipologia, promptTipologie, riepilogoPerChat } from './ia.ts';
import { inboxNonAssegnata } from './migrazioni.ts';
import { inbox as listaInbox } from './views.ts';
import { coordinateDaLink, distanzaKm, ordinaPerTe } from './esperienze.ts';
import { classificaPriorita, listaAzioni, luoghiUsati, posizionePriorita, punteggioEffettivo } from './views.ts';
import { barLevel, componentiPunteggio, impostaPesi, normalizzaPesi, PESI_PREDEFINITI, score } from './priority.ts';
import { ripristinaChecklistProgetto, spostaInNote } from './migrazioni.ts';
import { suggerisciStasera } from './stasera.ts';
import { leggiDurata, scomponi, scriviDurata, scriviQuando, scriviTrascorso } from './tempo.ts';
import { componiIndirizzo, indirizzoValido, separaIndirizzo } from './indirizzo.ts';
import { figli, prossimoPasso } from './views.ts';
import { completa, riapri } from './recurrence.ts';

// giovedì 15 ottobre 2026, ore 10:00
const NOW = new Date(2026, 9, 15, 10, 0, 0).getTime();
const OGGI = '2026-10-15';
let n = 0;
const mk = (p: Partial<Item>): Item => ({ id: `p${++n}`, tipo: 'azione', titolo: `Voce ${n}`, stato: 'da_fare', creato: NOW, aggiornato: NOW, ...p });
const sera: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '20:00' }]) };

test('piano: ordine per priorità dentro la fascia, in sequenza', () => {
  const a = mk({ titolo: 'Poco importante', importanza: 1, sforzoMin: 30 });
  const b = mk({ titolo: 'Importante', importanza: 5, sforzoMin: 45 });
  const p = pianifica([a, b], sera, OGGI, NOW);
  const oggi = p.giorni[0].blocchi;
  assert.equal(oggi.length, 2);
  assert.equal(oggi[0].item.titolo, 'Importante');
  assert.equal(orario(oggi[0].da), '18:00');
  assert.equal(orario(oggi[0].a), '18:45');
  assert.equal(orario(oggi[1].da), '18:45');
  assert.equal(p.giorni[0].usati, 75);
  assert.equal(p.giorni[0].liberi, 45);
});

test('piano: i meno prioritari che non entrano passano al giorno dopo', () => {
  const grande = mk({ importanza: 5, sforzoMin: 90 });
  const medio = mk({ importanza: 4, sforzoMin: 45 });
  const p = pianifica([grande, medio], sera, OGGI, NOW);
  assert.equal(p.giorni[0].blocchi.length, 1);
  assert.equal(p.giorni[1].blocchi.length, 1);
  assert.equal(p.giorni[1].blocchi[0].item.id, medio.id);
});

test('piano: un task lungo si spezza su più giorni', () => {
  const lungo = mk({ importanza: 5, sforzoMin: 240 });
  const p = pianifica([lungo], sera, OGGI, NOW);
  const parti = p.giorni.flatMap((g) => g.blocchi);
  assert.equal(parti.length, 2);
  assert.deepEqual(parti.map((b) => b.parte), [{ n: 1, di: 2 }, { n: 2, di: 2 }]);
  assert.equal(parti.reduce((s, b) => s + (b.a - b.da), 0), 240);
});

test('piano: i task brevi non si spezzano', () => {
  const quasi = mk({ importanza: 5, sforzoMin: 90 });
  const breve = mk({ importanza: 2, sforzoMin: 45 });
  const stretta: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '19:00' }]) };
  const p = pianifica([breve], stretta, OGGI, NOW);
  assert.equal(p.giorni[0].blocchi[0].parte, undefined);
  assert.ok(quasi);
});

test('piano: oggi si parte dall\'ora attuale', () => {
  const tardi = new Date(2026, 9, 15, 18, 22, 0).getTime();
  const p = pianifica([mk({ sforzoMin: 30 })], sera, OGGI, tardi);
  assert.equal(orario(p.giorni[0].blocchi[0].da), '18:25');
});

test('piano: gli impegni con orario restano fermi e tolgono tempo', () => {
  const fisso = mk({ inizio: OGGI, oraInizio: '18:30', oraFine: '19:00', importanza: 3 });
  const altro = mk({ importanza: 5, sforzoMin: 30 });
  const p = pianifica([fisso, altro], sera, OGGI, NOW);
  const oggi = p.giorni[0].blocchi;
  assert.equal(oggi.find((b) => b.fisso)?.item.id, fisso.id);
  assert.equal(orario(oggi.find((b) => !b.fisso)!.da), '18:00');
  assert.equal(p.giorni[0].liberi, 60);
});

test('piano: segnala se finisce dopo la scadenza', () => {
  const piena: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '18:30' }]) };
  const a = mk({ importanza: 5, sforzoMin: 30, fine: OGGI });
  const b = mk({ importanza: 4, sforzoMin: 30, fine: OGGI });
  const p = pianifica([a, b], piena, OGGI, NOW);
  const ritardo = p.giorni.flatMap((g) => g.blocchi).filter((x) => x.inRitardo);
  assert.equal(ritardo.length, 1);
});

test('piano: senza fasce non pianifica nulla e usa i valori suggeriti', () => {
  const vuota: Disponibilita = { settimana: Array.from({ length: 7 }, () => []) };
  const p = pianifica([mk({})], vuota, OGGI, NOW);
  assert.equal(p.fuori.length, 1);
  const q = pianifica([mk({})], DISPONIBILITA_SUGGERITA, OGGI, NOW);
  assert.equal(q.fuori.length, 0);
  assert.equal(minuti('09:30'), 570);
});

// ---- migrazioni di persone e checklist

test('migrazione: persone e checklist passano nelle note, ma non la checklist dei progetti', () => {
  const a = mk({ note: 'Idee', persone: ['Mario'], checklist: [{ id: 'x', testo: 'Torta', fatto: true }, { id: 'y', testo: 'Inviti', fatto: false }] });
  const r = spostaInNote(a)!;
  assert.equal(r.persone, undefined);
  assert.equal(r.checklist, undefined);
  assert.equal(r.note, 'Idee\n\nPersone: Mario\n\nChecklist:\n- [x] Torta\n- [ ] Inviti');
  const p = mk({ tipo: 'progetto', persone: ['Anna'], checklist: [{ id: 'z', testo: 'Passo', fatto: false }] });
  const rp = spostaInNote(p)!;
  assert.equal(rp.checklist?.length, 1);
  assert.equal(rp.note, 'Persone: Anna');
  assert.equal(spostaInNote(mk({})), undefined);
});

test('migrazione: la checklist di un progetto già finita nelle note torna nel campo', () => {
  let k = 0;
  const p = mk({ tipo: 'progetto', note: 'Obiettivo chiaro\n\nPersone: Anna\n\nChecklist:\n- [x] Primo\n- [ ] Secondo' });
  const r = ripristinaChecklistProgetto(p, () => `id${++k}`)!;
  assert.deepEqual(r.checklist, [{ id: 'id1', testo: 'Primo', fatto: true }, { id: 'id2', testo: 'Secondo', fatto: false }]);
  assert.equal(r.note, 'Obiettivo chiaro\n\nPersone: Anna');
  assert.equal(ripristinaChecklistProgetto(r, () => 'q'), undefined);
  assert.equal(ripristinaChecklistProgetto(mk({ note: 'Checklist:\n- [ ] a' }), () => 'q'), undefined);
});

// ---- Cosa guardo stasera

test('stasera: tipologia, mood ed energia spostano i suggerimenti', () => {
  const comico = mk({ tipo: 'film', titolo: 'Commedia', genere: 'Comico, Sentimentale', mood: 'Spensierato', energia: 'bassa', interesse: 3 });
  const thriller = mk({ tipo: 'film', titolo: 'Thriller teso', genere: 'Thriller', mood: 'Intenso', energia: 'alta', interesse: 3 });
  const s1 = suggerisciStasera([thriller, comico], { tipologia: 'Comico' });
  assert.equal(s1[0].item.titolo, 'Commedia');
  const s2 = suggerisciStasera([thriller, comico], { energia: 'bassa', mood: 'Spensierato' });
  assert.equal(s2[0].item.titolo, 'Commedia');
  assert.ok(s2[0].motivo.includes('mood spensierato'));
  // senza filtri decide l'interesse; le voci senza dati restano neutre
  const neutro = mk({ tipo: 'film', titolo: 'Senza dati', interesse: 5 });
  assert.equal(suggerisciStasera([comico, neutro], { tipologia: 'Horror' })[0].item.titolo, 'Senza dati');
});

test('stasera: la compagnia riconosce partner e amici e non filtra per durata', () => {
  const coppia = mk({ tipo: 'serie', titolo: 'Serie in coppia', conChi: 'il mio partner', interesse: 3 });
  const altro = mk({ tipo: 'film', titolo: 'Film qualsiasi', interesse: 3 });
  assert.equal(suggerisciStasera([altro, coppia], { compagnia: 'partner' })[0].item.titolo, 'Serie in coppia');
  assert.equal(suggerisciStasera([altro, coppia], {}).length, 2);
});

test('piano: dopo un\'attività grande c\'è una pausa curiosità, poi si riparte', () => {
  const grande = mk({ titolo: 'Grande', importanza: 5, sforzoMin: 90 });
  const piccola = mk({ titolo: 'Piccola', importanza: 3, sforzoMin: 30 });
  const cur = mk({ tipo: 'curiosita', titolo: 'Come funziona il GPS', interesse: 5 });
  const serata: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]) };
  const b = pianifica([grande, piccola, cur], serata, OGGI, NOW).giorni[0].blocchi;
  assert.deepEqual(b.map((x) => x.item.titolo), ['Grande', 'Come funziona il GPS', 'Piccola']);
  assert.equal(b[1].pausa, true);
  assert.equal(b[1].a - b[1].da, DURATA_PAUSA);
  assert.equal(orario(b[2].da), '19:45'); // la pausa sposta in avanti l'attività successiva
});

test('piano: niente pausa senza curiosità, con soli lavori piccoli o senza spazio', () => {
  const grande = mk({ importanza: 5, sforzoMin: 90 });
  const piccola = mk({ importanza: 3, sforzoMin: 30 });
  const cur = mk({ tipo: 'curiosita', titolo: 'Una curiosità' });
  const serata: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]) };
  assert.ok(!pianifica([grande, piccola], serata, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa));
  assert.ok(!pianifica([piccola, mk({ importanza: 2, sforzoMin: 45 }), cur], serata, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa));
  const stretta: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '19:40' }]) };
  assert.ok(!pianifica([grande, cur], stretta, OGGI, NOW).giorni[0].blocchi.some((x) => x.pausa)); // 90 min + pausa non lasciano spazio ad altro lavoro
});

test('piano: ogni curiosità serve a una sola pausa e le pause sono al massimo due al giorno', () => {
  const grandi = [1, 2, 3, 4, 5].map((n) => mk({ titolo: `G${n}`, importanza: 5, sforzoMin: 60 }));
  const curs = [1, 2, 3].map((n) => mk({ tipo: 'curiosita', titolo: `C${n}` }));
  const lunga: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '09:00', a: '19:00' }]) };
  const p = pianifica([...grandi, ...curs], lunga, OGGI, NOW);
  const pause = p.giorni.flatMap((g) => g.blocchi).filter((x) => x.pausa);
  assert.equal(new Set(pause.map((x) => x.item.id)).size, pause.length);
  for (const g of p.giorni) assert.ok(g.blocchi.filter((x) => x.pausa).length <= 2);
  assert.ok(pause.length >= 1);
});

// ---- stima del tempo scritta a mano

test('tempo: legge minuti, ore e giorni scritti a mano', () => {
  const m = (t: string) => { const r = leggiDurata(t); return r.ok ? r.minuti : 'errore'; };
  assert.equal(m('45m'), 45);
  assert.equal(m('6h'), 360);
  assert.equal(m('4d'), 5760);
  assert.equal(m('4g'), 5760);
  assert.equal(m('5g 6h'), 5 * 1440 + 360);
  assert.equal(m('1h30'), 90);
  assert.equal(m('1h 30m'), 90);
  assert.equal(m('1:30'), 90);
  assert.equal(m('1,5h'), 90);
  assert.equal(m('90'), 90);
  assert.equal(m('2 ore'), 120);
  assert.equal(m('1 giorno 2 ore 15 min'), 1440 + 120 + 15);
  assert.equal(m(''), undefined);
  assert.equal(m('abc'), 'errore');
  assert.equal(m('5 6h'), 'errore');
  assert.equal(m('0'), 'errore');
  assert.equal(m('3x'), 'errore');
});

test('tempo: scrive e scompone le durate', () => {
  assert.equal(scriviDurata(45), '45m');
  assert.equal(scriviDurata(390), '6h 30m');
  assert.equal(scriviDurata(1440), '1g');
  assert.equal(scriviDurata(7500), '5g 5h');
  assert.equal(scriviDurata(undefined), '');
  assert.deepEqual(scomponi(1440 + 135), { g: 1, h: 2, m: 15 });
  const r = leggiDurata(scriviDurata(8123));
  assert.ok(r.ok && r.minuti === 8123);
});

// ---- indirizzo del server al login

test('indirizzo: separa lo schema e ricompone', () => {
  assert.deepEqual(separaIndirizzo('https://mytask.fplinio.it/'), { schema: 'https', resto: 'mytask.fplinio.it' });
  assert.deepEqual(separaIndirizzo('HTTP://192.168.1.5:8787'), { schema: 'http', resto: '192.168.1.5:8787' });
  assert.deepEqual(separaIndirizzo('mytask.fplinio.it'), { schema: 'https', resto: 'mytask.fplinio.it' });
  assert.deepEqual(separaIndirizzo('mytask.fplinio.it', 'http'), { schema: 'http', resto: 'mytask.fplinio.it' });
  assert.equal(componiIndirizzo('https', 'mytask.fplinio.it'), 'https://mytask.fplinio.it');
  assert.equal(componiIndirizzo('http', 'https://altro.it/'), 'https://altro.it');
  assert.ok(indirizzoValido('mytask.fplinio.it') && indirizzoValido('192.168.1.5:8787') && indirizzoValido('localhost:5173'));
  assert.ok(!indirizzoValido('') && !indirizzoValido('mytask') && !indirizzoValido('ciao come va'));
});

// ---- ordine dei passi di un progetto e ora di completamento

test('progetto: l\'ordine scelto decide il prossimo passo', () => {
  const prog = mk({ tipo: 'progetto', titolo: 'Progetto' });
  const a = mk({ padreId: prog.id, titolo: 'A', ordine: 2 });
  const b = mk({ padreId: prog.id, titolo: 'B', ordine: 0 });
  const c = mk({ padreId: prog.id, titolo: 'C', ordine: 1 });
  const nuovo = mk({ padreId: prog.id, titolo: 'Nuovo senza ordine', creato: NOW + 5000 });
  assert.deepEqual(figli([prog, a, b, c, nuovo], prog.id).map((x) => x.titolo), ['B', 'C', 'A', 'Nuovo senza ordine']);
  assert.equal(prossimoPasso(prog, [prog, a, b, c, nuovo])?.titolo, 'B');
  // chiuso il primo, il prossimo è il secondo in ordine
  assert.equal(prossimoPasso(prog, [prog, a, { ...b, stato: 'fatto' }, c, nuovo])?.titolo, 'C');
});

test('completamento: si salva anche l\'ora e riaprendo si toglie', () => {
  const x = mk({});
  const fatta = completa(x, OGGI, NOW + 123456);
  assert.equal(fatta.completatoTs, NOW + 123456);
  assert.equal(fatta.completatoIl, OGGI);
  const riaperta = riapri(fatta, NOW + 200000);
  assert.equal(riaperta.completatoTs, undefined);
  assert.equal(riaperta.completatoIl, undefined);
});

// ---- formato di data/ora e tempo trascorso

test('cronologia: data e ora e tempo trascorso', () => {
  const t = new Date(2026, 9, 16, 14, 32).getTime(); // venerdì 16 ottobre 2026, 14:32
  assert.equal(scriviQuando(t), 'ven 16 ott · 14:32');
  assert.equal(scriviQuando(t, true), 'ven 16 ott');
  assert.equal(scriviTrascorso(12 * 60000), '12 min');
  assert.equal(scriviTrascorso((18 * 60 + 38) * 60000), '18 h 38 min');
  assert.equal(scriviTrascorso(3 * 3600000), '3 h');
  assert.equal(scriviTrascorso((2 * 1440 + 3 * 60 + 10) * 60000), '2 g 3 h');
  assert.equal(scriviTrascorso(20000), 'meno di un minuto');
});

test('piano: in modalità flessibile contano solo gli orari inseriti per il giorno', () => {
  const a = mk({ importanza: 5, sforzoMin: 30 });
  const flex: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]), flessibile: true };
  assert.equal(fasceDelGiorno(flex, OGGI).length, 0);
  assert.equal(pianifica([a], flex, OGGI, NOW).giorni[0].blocchi.length, 0);
  const conOrari: Disponibilita = { ...flex, eccezioni: { [OGGI]: [{ da: '14:00', a: '15:00' }] } };
  const b = pianifica([a], conOrari, OGGI, NOW).giorni[0].blocchi;
  assert.equal(b.length, 1);
  assert.equal(orario(b[0].da), '14:00');
  // un giorno senza orari resta senza tempo libero, anche se in modalità fissa avrebbe le fasce della settimana
  assert.equal(minutiDisponibili(conOrari, '2026-10-16', OGGI, NOW), 0);
  assert.ok(minutiDisponibili({ ...flex, flessibile: false }, '2026-10-16', OGGI, NOW) > 0);
});

test('piano: senzaGiorniPassati toglie i giorni vecchi', () => {
  const r = senzaGiorniPassati({ '2026-10-10': [], '2026-10-15': [{ da: '10:00', a: '11:00' }], '2026-10-16': [] }, OGGI);
  assert.deepEqual(Object.keys(r ?? {}), ['2026-10-10', '2026-10-15', '2026-10-16']);
  assert.equal(senzaGiorniPassati({ '2026-07-01': [] }, OGGI), undefined);
});

test("notifiche: la richiesta serale degli orari c'è solo in modalità flessibile e salta i giorni già inseriti", () => {
  const flex: Disponibilita = { settimana: Array.from({ length: 7 }, () => []), flessibile: true, oraChiedi: '21:30' };
  assert.equal(richiesteOrari({ ...flex, flessibile: false }, new Date(NOW)).length, 0);
  assert.equal(richiesteOrari(null, new Date(NOW)).length, 0);
  const r = richiesteOrari(flex, new Date(NOW), 3);
  assert.equal(r.length, 3);
  assert.equal(r[0].giorno, '2026-10-16');
  assert.equal(new Date(r[0].quando).getHours(), 21);
  assert.equal(new Date(r[0].quando).getMinutes(), 30);
  const gia = richiesteOrari({ ...flex, eccezioni: { '2026-10-16': [] } }, new Date(NOW), 3);
  assert.deepEqual(gia.map((x) => x.giorno), ['2026-10-17', '2026-10-18']);
  // dopo l'ora scelta la richiesta di stasera è già passata
  const tardi = richiesteOrari(flex, new Date(2026, 9, 15, 22, 0), 2);
  assert.deepEqual(tardi.map((x) => x.giorno), ['2026-10-17']);
});

test('piano: una nota in corso resta dove era, anche se arrivano note più urgenti', () => {
  const a = mk({ titolo: 'Iniziata', importanza: 1, sforzoMin: 30, stato: 'in_corso', pianoData: OGGI, pianoDa: minuti('19:00') });
  const b = mk({ titolo: 'Urgente', importanza: 5, sforzoMin: 30 });
  const g = pianifica([a, b], { settimana: Array.from({ length: 7 }, () => [{ da: '18:00', a: '21:00' }]) }, OGGI, NOW).giorni[0];
  const ba = g.blocchi.find((x) => x.item.id === a.id)!;
  const bb = g.blocchi.find((x) => x.item.id === b.id)!;
  assert.equal(orario(ba.da), '19:00');
  assert.equal(orario(bb.da), '18:00');
  assert.ok(bb.a <= ba.da, 'la nota urgente entra prima, senza toccare quella iniziata');
});

test('priorità: un passo di progetto non ha priorità più bassa dei passi che lo seguono', () => {
  const p = mk({ tipo: 'progetto', titolo: 'Progetto', importanza: 3 });
  const s1 = mk({ padreId: p.id, ordine: 0, importanza: 1, titolo: 'Primo' });
  const s2 = mk({ padreId: p.id, ordine: 1, importanza: 5, titolo: 'Secondo' });
  const items = [p, s1, s2];
  const eff1 = punteggioEffettivo(s1, items, OGGI, NOW);
  const eff2 = punteggioEffettivo(s2, items, OGGI, NOW);
  assert.ok(eff1 >= eff2, 'il primo eredita il punteggio più alto dei successivi');
  assert.equal(eff1, eff2);
  const lista = listaAzioni(items, OGGI, NOW).map((e) => e.item.titolo);
  assert.ok(lista.indexOf('Primo') < lista.indexOf('Secondo'));
});

test('priorità: i pesi sono configurabili e si normalizzano', () => {
  const urgente = mk({ importanza: 1, fine: OGGI });
  const importante = mk({ importanza: 5 });
  const base = score(urgente, OGGI, NOW) - score(importante, OGGI, NOW);
  try {
    impostaPesi({ urgenza: 0, importanza: 1, sforzo: 0, eta: 0, fissa: 0 });
    assert.ok(score(importante, OGGI, NOW) > score(urgente, OGGI, NOW), "con solo l'importanza vince la nota importante");
    impostaPesi({ urgenza: 10, importanza: 0, sforzo: 0, eta: 0, fissa: 0 });
    assert.equal(score(urgente, OGGI, NOW), 100);
    assert.deepEqual(normalizzaPesi({ urgenza: 0, importanza: 0, sforzo: 0, eta: 0, fissa: 0 }), PESI_PREDEFINITI);
    assert.equal(Math.round(normalizzaPesi({ urgenza: 2, importanza: 2, sforzo: 0, eta: 0, fissa: 0 }).urgenza * 100), 50);
  } finally {
    impostaPesi(undefined);
  }
  assert.equal(score(urgente, OGGI, NOW) - score(importante, OGGI, NOW), base, 'tornano i pesi di base');
});

test('priorità: la posizione nella scheda è quella che si legge in Oggi, anche a parità di punteggio', () => {
  const a = mk({ titolo: 'Uguale A', importanza: 3, creato: NOW - 5000 });
  const b = mk({ titolo: 'Uguale B', importanza: 3, creato: NOW - 1000 });
  const c = mk({ titolo: 'Più importante', importanza: 5 });
  const items = [b, a, c];
  const classifica = classificaPriorita(items, OGGI, NOW);
  assert.equal(classifica.get(c.id), 1);
  assert.equal(classifica.get(a.id), 2, 'a parità vince la più vecchia');
  assert.equal(classifica.get(b.id), 3);
  for (const x of items) assert.equal(posizionePriorita(items, x, OGGI, NOW).pos, classifica.get(x.id));
  assert.equal(posizionePriorita(items, a, OGGI, NOW).tot, 3);
});

test("piano: una nota in corso senza posto salvato parte dall'ora in cui è passata in corso", () => {
  const inizio = new Date(2026, 9, 15, 9, 0).getTime();
  const a = mk({ importanza: 1, sforzoMin: 30, stato: 'in_corso', inCorsoTs: inizio });
  const adesso = new Date(2026, 9, 15, 10, 55).getTime();
  const g = pianifica([a], { settimana: Array.from({ length: 7 }, () => [{ da: '08:00', a: '21:00' }]) }, OGGI, adesso).giorni[0];
  assert.equal(orario(g.blocchi[0].da), '09:00');
});

test('priorità: la scadenza fissa è un parametro a parte e fa salire la nota', () => {
  const stessa = { importanza: 3, fine: '2026-10-16' };
  const fissa = mk({ ...stessa, rigida: true });
  const normale = mk({ ...stessa });
  assert.equal(componentiPunteggio(fissa, OGGI, NOW).fissa, componentiPunteggio(fissa, OGGI, NOW).urgenza);
  assert.equal(componentiPunteggio(normale, OGGI, NOW).fissa, 0);
  assert.equal(componentiPunteggio(fissa, OGGI, NOW).urgenza, componentiPunteggio(normale, OGGI, NOW).urgenza, "l'urgenza non cambia: la fissa è separata");
  assert.ok(score(fissa, OGGI, NOW) > score(normale, OGGI, NOW));
  assert.equal(componentiPunteggio(mk({ rigida: true }), OGGI, NOW).fissa, 0, "senza data non c'è scadenza fissa");
});

test('priorità: senza scadenza fissa il punteggio resta quello di sempre (una nota urgente è alta)', () => {
  const urgente = mk({ importanza: 3, fine: OGGI, sforzoMin: 30 });
  assert.equal(score(urgente, OGGI, NOW), 69, '45% urgenza (100) + 35% importanza (50) + 10% sforzo (60)');
  assert.ok(barLevel(score(urgente, OGGI, NOW)) === 3, 'resta nel livello alto (rosso)');
  const fissa = mk({ importanza: 3, fine: OGGI, sforzoMin: 30, rigida: true });
  assert.ok(score(fissa, OGGI, NOW) > 69 && score(fissa, OGGI, NOW) <= 100);
});

test('esperienze: i luoghi già inseriti si propongono dal più usato, senza doppioni', () => {
  const items = [mk({ tipo: 'esperienza', zona: 'Torino' }), mk({ tipo: 'esperienza', zona: 'Lucca' }), mk({ tipo: 'esperienza', zona: 'Torino ' }), mk({ tipo: 'esperienza' }), mk({ tipo: 'esperienza', zona: 'Roma', eliminato: true })];
  assert.deepEqual(luoghiUsati(items), ['Torino', 'Lucca']);
});

test('esperienze «Per te»: interesse, data più vicina e distanza', () => {
  const torino = { lat: 45.07, lon: 7.68 };
  const lucca = { lat: 43.84, lon: 10.5 };
  const vicinoPoco = mk({ tipo: 'esperienza', titolo: 'Vicino', interesse: 2, zona: 'Torino' });
  const lontanoMolto = mk({ tipo: 'esperienza', titolo: 'Lontano', interesse: 5, zona: 'Lucca' });
  const urgenteVicino = mk({ tipo: 'esperienza', titolo: 'Urgente', interesse: 3, zona: 'Torino', inizio: '2026-10-16' });
  const coord = (i: Item) => (i.zona === 'Torino' ? torino : lucca);
  const r = ordinaPerTe([vicinoPoco, lontanoMolto, urgenteVicino], OGGI, torino, coord);
  assert.equal(r[0].item.titolo, 'Urgente', 'data vicina e luogo vicino vincono');
  assert.ok((r.find((x) => x.item.titolo === 'Lontano')!.km ?? 0) > 250);
  assert.ok(distanzaKm(torino, torino) < 0.001);
  // senza posizione la distanza non conta: vince l'interesse (a parità di data)
  const senza = ordinaPerTe([vicinoPoco, lontanoMolto], OGGI, undefined, coord);
  assert.equal(senza[0].item.titolo, 'Lontano');
  assert.equal(senza[0].km, undefined);
  assert.deepEqual(coordinateDaLink('https://www.google.com/maps/place/Duomo/@45.0703,7.6869,17z'), { lat: 45.0703, lon: 7.6869 });
  assert.deepEqual(coordinateDaLink('https://maps.google.com/?q=43.84,10.5'), { lat: 43.84, lon: 10.5 });
  assert.equal(coordinateDaLink('https://maps.google.com/?q=Duomo'), undefined);
});

test("inbox: le note senza tipo scelto sono «non assegnate» e restano in Inbox finché non si sceglie", () => {
  const vecchia = mk({ inbox: true, tipo: 'azione', creato: NOW, aggiornato: NOW });
  const modificata = mk({ inbox: true, tipo: 'azione', creato: NOW, aggiornato: NOW + 5 });
  const gia = inboxNonAssegnata(vecchia)!;
  assert.equal(gia.tipo, 'nota');
  assert.equal(inboxNonAssegnata(modificata), undefined, "se l'ha già toccata, non si cambia");
  assert.equal(inboxNonAssegnata(mk({ tipo: 'azione' })), undefined, "fuori dall'Inbox non si tocca");
  const senzaFlag = mk({ tipo: 'nota' });
  assert.deepEqual(listaInbox([gia, senzaFlag, mk({ tipo: 'azione' })]).map((i) => i.id).sort(), [gia.id, senzaFlag.id].sort());
});

test("IA: autocompila la tipologia delle opere senza toccare quello che c'è già", () => {
  const film = mk({ tipo: 'film', titolo: 'Inception' });
  const conGenere = mk({ tipo: 'film', titolo: 'Heat', genere: 'Azione' });
  const attivita = mk({ tipo: 'azione', titolo: "Non è un'opera" });
  const serie = mk({ tipo: 'serie', titolo: 'Dark', mood: 'Intenso' });
  const libro = mk({ tipo: 'libro', titolo: 'Il nome della rosa' });
  const da = opereSenzaTipologia([film, conGenere, attivita, serie, libro]);
  assert.deepEqual(da.map((o) => o.titolo), ['Inception', 'Dark', 'Il nome della rosa']);
  assert.match(promptTipologie(da), /0\. \[Film\] Inception/);
  const risposta = leggiRisposta('Ecco:\n```json\n{"risultati":[{"n":0,"tipologie":["fantascienza","Thriller","Inventata"],"mood":"Emozionante","energia":"alta"},{"n":1,"tipologie":["Thriller"],"mood":"Rilassante","energia":"media"},{"n":2,"tipologie":["Drammatico"],"mood":"Intenso"}]}\n```');
  assert.equal(risposta.length, 3);
  assert.deepEqual(campiDaRisposta(film, risposta[0]), { genere: 'Fantascienza, Thriller', mood: 'Emozionante', energia: 'alta' });
  assert.deepEqual(campiDaRisposta(serie, risposta[1]), { genere: 'Thriller', energia: 'media' }, "il mood c'è già e non si cambia");
  assert.deepEqual(campiDaRisposta(libro, risposta[2]), { genere: 'Drammatico' }, 'per i libri solo la tipologia');
  assert.deepEqual(leggiRisposta('non è json'), []);
});

test('IA: il riepilogo per la chat è compatto e non include le note private', () => {
  const a = mk({ tipo: 'azione', titolo: 'Pagare la bolletta', fine: '2026-10-16', note: 'testo segreto lungo' });
  const r = riepilogoPerChat([a, mk({ tipo: 'film', titolo: 'Dune' })], OGGI, NOW);
  assert.match(r, /Pagare la bolletta/);
  assert.match(r, /Dune/);
  assert.ok(!r.includes('testo segreto'));
});

test("durata reale: conta solo il tempo libero segnato, non le pause", () => {
  const disp: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '10:00', a: '10:30' }, { da: '18:00', a: '21:00' }]) };
  const inizio = new Date(2026, 9, 15, 10, 0).getTime();
  const fine = new Date(2026, 9, 15, 19, 0).getTime();
  assert.equal(minutiLiberiTra(disp, inizio, fine), 30 + 60, "30 minuti al mattino e 1 ora la sera, non 9 ore");
  const nota = mk({ sforzoMin: 120, stato: 'in_corso', inCorsoTs: inizio });
  assert.equal(durataRealeInCorso(nota, fine, disp), 90);
  assert.equal(durataRealeInCorso(mk({ sforzoMin: 60 }), fine, disp), undefined, "senza «in corso» non c'è una misura");
  // più giorni: la notte e le ore non libere non pesano
  const dopodomani = new Date(2026, 9, 17, 18, 30).getTime();
  assert.equal(minutiLiberiTra(disp, inizio, dopodomani), 30 + 180 + 30 + 180 + 30 + 30);
  // senza tempo libero impostato: tempo trascorso, al massimo 8 ore
  assert.equal(durataRealeInCorso(nota, fine, null), 480);
});

test('piano: una nota in corso che non entra nella fascia prosegue nella fascia libera successiva, col margine solo in fondo', () => {
  // iniziata alle 13:00, 2 ore di base: la fascia libera 13-14 ne copre solo una; il resto va alla sera
  const a = mk({ titolo: 'Lunga', importanza: 3, sforzoMin: 120, stato: 'in_corso', pianoData: OGGI, pianoDa: minuti('13:00') });
  const disp: Disponibilita = { settimana: Array.from({ length: 7 }, () => [{ da: '13:00', a: '14:00' }, { da: '18:00', a: '21:00' }]) };
  const adesso = new Date(2026, 9, 15, 13, 10).getTime();
  const b = pianifica([a], disp, OGGI, adesso, undefined, 0.5).giorni[0].blocchi.filter((x) => x.item.id === a.id);
  assert.equal(b.length, 2);
  assert.equal(orario(b[0].da), '13:00');
  assert.equal(orario(b[0].a), '14:00');
  assert.equal(b[0].margineMin, 0, 'nel primo pezzo non si vede il margine: il tempo di base non è ancora tutto');
  assert.deepEqual(b[0].parte, { n: 1, di: 2 });
  assert.equal(orario(b[1].da), '18:00');
  assert.equal(orario(b[1].a), '20:00'); // totale 180 min (120 + 50% di margine): 60 nella prima fascia, 120 nella seconda
  assert.equal(b[1].margineMin, 60, "il margine sta in coda all'ultimo pezzo");
});
