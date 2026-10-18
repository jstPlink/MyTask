// Conversione dell'export CSV di Notion (tabella "Activities") nel modello di MyTask.
// Le regole di smistamento sono scritte qui in modo esplicito: è la "pulizia con IA" concordata,
// fatta una volta sola e riproducibile. Ogni scelta incerta finisce nel report.
import crypto from 'node:crypto';
import type { Item, Tipo, VoceChecklist } from '../../shared/types.ts';
import { NOMI_TIPO } from '../../shared/types.ts';
import type { Regole } from './regole.ts';
import { REGOLE as REGOLE_ESEMPIO } from './regole.esempio.ts';

// ---------------------------------------------------------------- CSV

/** Lettore CSV minimo: virgolette, virgole e a capo dentro i campi. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}

export interface RigaNotion {
  name: string; date: string; note: string; parent: string; priority: string;
  rate: string; status: string; type: string;
}

export function leggiRighe(csv: string): RigaNotion[] {
  const [head, ...rows] = parseCsv(csv);
  const idx = (n: string) => head.indexOf(n);
  const col = (r: string[], n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? '') : '');
  return rows.map((r) => ({
    name: col(r, 'Name').trim(),
    date: col(r, 'Date').trim(),
    note: col(r, 'Note').trim(),
    parent: col(r, 'Parent item').replace(/\s*\(https?:\/\/[^)]*\)\s*$/, '').trim(),
    priority: col(r, 'Priority').trim(),
    rate: col(r, 'Rate').trim(),
    status: col(r, 'Status').trim(),
    type: col(r, 'Type').trim(),
  })).filter((r) => r.name);
}

// ---------------------------------------------------------------- utilità

export function norm(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
}

function chiave(nome: string): string {
  return norm(nome).replace(/\s*\(1\)$/, '').replace('of the spotless mind', 'of a spotless mind');
}

const PRIORITA: Record<string, number> = { 'very high': 5, high: 4, medium: 3, low: 2, 'very low': 1 };

function idStabile(tipo: string, key: string): string {
  return 'n' + crypto.createHash('sha1').update(`${tipo}|${key}`).digest('hex').slice(0, 12);
}

function pulisciUrl(u: string): string {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|igsh$|si$|igshid$)/i.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return u;
  }
}

function ora24(h: string, m: string, ap: string): string {
  let hh = Number(h) % 12;
  if (ap.toUpperCase() === 'PM') hh += 12;
  return `${String(hh).padStart(2, '0')}:${m}`;
}

export interface DateConvertite { inizio?: string; fine?: string; oraInizio?: string; oraFine?: string }

/** "2026/01/05 12:00 PM (GMT+1) → 12:15 PM", "2026/03/17 → 2026/03/21", "2026/04/18" */
export function convertiData(s: string): DateConvertite {
  if (!s) return {};
  const [a, b] = s.split('→').map((x) => x.trim());
  const reData = /^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i;
  const ma = a.match(reData);
  if (!ma) return {};
  const out: DateConvertite = { inizio: `${ma[1]}-${ma[2]}-${ma[3]}` };
  if (ma[4]) out.oraInizio = ora24(ma[4], ma[5], ma[6]);
  if (b) {
    const mb = b.match(reData);
    if (mb) {
      const fine = `${mb[1]}-${mb[2]}-${mb[3]}`;
      if (fine !== out.inizio) out.fine = fine;
      if (mb[4]) out.oraFine = ora24(mb[4], mb[5], mb[6]);
    } else {
      const mt = b.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (mt) out.oraFine = ora24(mt[1], mt[2], mt[3]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- regole di smistamento
// Le tabelle (titoli, persone, luoghi) stanno in regole.esempio.ts / regole.locale.ts: vedi regole.ts.

function tabella<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [norm(k), v]));
}

function prepara(r: Regole) {
  return {
    serie: new Set(r.serie.map(norm)),
    anime: new Set(r.anime.map(norm)),
    tipoForzato: tabella(r.tipoForzato),
    routine: tabella(r.routine),
    zone: tabella(r.zone),
    personeVoce: tabella(r.personeVoce),
    daContattare: new Set(r.daContattare),
    noteSpeciali: tabella(r.noteSpeciali),
    aree: r.aree.map(([nome, re]) => [nome, new RegExp(re, 'i')] as const),
    rigide: new Set(r.rigide.map(norm)),
    daVerificare: tabella(r.daVerificare),
  };
}

const VIDEO_TIPI: Tipo[] = ['film', 'serie', 'anime'];
const COLLEZIONI: Tipo[] = ['film', 'serie', 'anime', 'gioco', 'libro', 'ricetta', 'curiosita', 'esperienza'];

const TIPO_NOTION: Record<string, Tipo> = {
  Admin: 'azione', 'Attività': 'esperienza', Video: 'film', Gioco: 'gioco', Libri: 'libro', Cibo: 'ricetta', Info: 'curiosita',
};

// ---------------------------------------------------------------- conversione

interface Voce {
  key: string;
  riga: RigaNotion;
  uniti: RigaNotion[]; // righe duplicate fuse in questa
  figli: Voce[];
  tipo: Tipo;
  daSistema: boolean; // true se il tipo non è quello "naturale" del tipo Notion
}

export interface Report {
  righeIniziali: number;
  voci: number;
  persone: number;
  perTipo: Record<string, number>;
  duplicatiUniti: string[];
  riclassificate: { titolo: string; da: string; a: string }[];
  checklist: { padre: string; voci: number }[];
  sottoTask: { padre: string; figli: number }[];
  campiEstratti: { titolo: string; campi: string }[];
  linkPuliti: string[];
  daVerificare: string[];
  inRevisione: string[];
  senzaPriorita: number;
}

const NOMI_TIPI_NOTION = (t: string) => t || '(vuoto)';

export function converti(righe: RigaNotion[], now: number, oggi: string, regole: Regole = REGOLE_ESEMPIO): { items: Item[]; report: Report } {
  const R = prepara(regole);
  const report: Report = {
    righeIniziali: righe.length, voci: 0, persone: 0, perTipo: {}, duplicatiUniti: [], riclassificate: [],
    checklist: [], sottoTask: [], campiEstratti: [], linkPuliti: [], daVerificare: [], inRevisione: [], senzaPriorita: 0,
  };

  // 1. unione dei duplicati
  const gruppi = new Map<string, RigaNotion[]>();
  for (const r of righe) {
    const k = chiave(r.name);
    gruppi.set(k, [...(gruppi.get(k) ?? []), r]);
  }
  const voci = new Map<string, Voce>();
  for (const [k, rs] of gruppi) {
    const ricchezza = (r: RigaNotion) => [r.date, r.note, r.priority, r.rate, r.parent].filter(Boolean).length;
    const primaria = [...rs].sort((a, b) => ricchezza(b) - ricchezza(a))[0];
    if (rs.length > 1) report.duplicatiUniti.push(`${primaria.name} (${rs.length} voci)`);
    voci.set(k, { key: k, riga: primaria, uniti: rs, figli: [], tipo: 'azione', daSistema: false });
  }

  // 2. tipo finale
  for (const v of voci.values()) {
    const tipiNotion = v.uniti.map((r) => r.type);
    const base = TIPO_NOTION[v.riga.type] ?? 'azione';
    let tipo: Tipo = base;
    if (R.tipoForzato[v.key]) tipo = R.tipoForzato[v.key];
    else if (v.riga.type === 'Video') tipo = R.anime.has(v.key) ? 'anime' : R.serie.has(v.key) ? 'serie' : 'film';
    else if (tipiNotion.includes('Video') && v.riga.type === 'Info') tipo = 'film'; // duplicato Info + Video
    v.tipo = tipo;
    v.daSistema = tipo !== base;
    if (v.daSistema && !(v.riga.type === 'Video' && VIDEO_TIPI.includes(tipo))) {
      report.riclassificate.push({ titolo: v.riga.name, da: NOMI_TIPI_NOTION(v.riga.type), a: NOMI_TIPO[tipo] });
    }
  }

  // 3. gerarchia
  const figliDi = new Map<string, Voce[]>();
  for (const v of voci.values()) {
    const p = v.uniti.map((r) => r.parent).find(Boolean);
    if (p && voci.has(chiave(p))) figliDi.set(chiave(p), [...(figliDi.get(chiave(p)) ?? []), v]);
  }
  const eFiglio = new Set([...figliDi.values()].flat().map((v) => v.key));

  const items: Item[] = [];
  const nomiPersone = new Map<string, boolean>(); // nome → daContattare

  const sorgenti = (v: Voce) => v.uniti;

  function costruisci(v: Voce, extra: Partial<Item> = {}): Item {
    const r = v.riga;
    const unite = sorgenti(v);
    const stati = unite.map((x) => x.status);
    const stato: Item['stato'] = stati.includes('Done') ? 'fatto' : stati.includes('In progress') ? 'in_corso' : 'da_fare';
    const prio = Math.max(0, ...unite.map((x) => PRIORITA[x.priority.toLowerCase()] ?? 0));
    const eColl = COLLEZIONI.includes(v.tipo);

    const item: Item = {
      id: idStabile(v.tipo, v.key), tipo: v.tipo, titolo: r.name.replace(/\s+/g, ' ').replace(/\s*\(1\)$/, ''),
      stato, creato: now, aggiornato: now,
    };

    // priorità: importanza per le azioni, interesse per il resto
    if (prio > 0) {
      if (v.tipo === 'azione' || v.tipo === 'progetto') item.importanza = prio;
      else if (eColl) item.interesse = prio;
    } else if (v.tipo === 'azione' || v.tipo === 'progetto') report.senzaPriorita++;

    // date
    const dataRiga = unite.find((x) => x.date)?.date ?? '';
    const d = convertiData(dataRiga);
    Object.assign(item, d);
    if (stato === 'fatto') item.completatoIl = d.fine ?? d.inizio;
    if (d.oraInizio) item.rigida = true;
    if (R.rigide.has(v.key)) item.rigida = true;

    // voto
    const rate = Number(unite.find((x) => x.rate)?.rate);
    if (rate) item.voto = rate;

    // note, link e dati nascosti nelle note
    const note = [...new Set(unite.map((x) => x.note).filter(Boolean))].join('\n').trim();
    const urls = [...note.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
    let testo = note;
    if (urls.length) {
      item.link = urls.map(pulisciUrl);
      report.linkPuliti.push(item.titolo);
      for (const u of urls) testo = testo.replace(u, '');
      testo = testo.replace(/\n{2,}/g, '\n').trim();
    }
    const speciale = R.noteSpeciali[norm(testo)];
    const campi: string[] = [];
    if (speciale) {
      if (speciale.consigliatoDa) { item.consigliatoDa = speciale.consigliatoDa; campi.push(`consigliato da ${speciale.consigliatoDa}`); nomiPersone.set(speciale.consigliatoDa, false); }
      if (speciale.conChi) { item.conChi = speciale.conChi; campi.push(`con ${speciale.conChi}`); nomiPersone.set(speciale.conChi, false); }
      if (speciale.piattaforma) { item.piattaforma = speciale.piattaforma; campi.push(speciale.piattaforma); }
      if (speciale.genere) { item.genere = speciale.genere; campi.push(`genere ${speciale.genere}`); }
      testo = speciale.note ?? '';
    }
    if (testo) item.note = testo;
    if (campi.length) report.campiEstratti.push({ titolo: item.titolo, campi: campi.join(', ') });

    // persone, zona, area
    const p = R.personeVoce[v.key];
    if (p) { item.persone = p; for (const n of p) if (!nomiPersone.has(n)) nomiPersone.set(n, R.daContattare.has(n)); }
    if (R.zone[v.key]) item.zona = R.zone[v.key];
    if (v.tipo === 'azione' || v.tipo === 'progetto') {
      const area = R.aree.find(([, re]) => re.test(item.titolo))?.[0];
      if (area) item.area = area;
    }

    // revisione manuale: era "Expired" senza una data

    // routine
    if (v.tipo === 'routine') {
      const cfg = R.routine[v.key];
      if (cfg) {
        item.fascia = cfg.fascia; item.obiettivo = cfg.obiettivo; item.stato = cfg.stato;
        if (cfg.volteSettimana) item.volteSettimana = cfg.volteSettimana;
      }
      delete item.interesse; delete item.importanza;
      item.log = [];
    }

    // voci da verificare a mano
    const dv = R.daVerificare[v.key];
    if (dv) report.daVerificare.push(`${item.titolo}: ${dv}`);

    return { ...item, ...extra };
  }

  for (const v of voci.values()) {
    if (eFiglio.has(v.key)) continue;
    const item = costruisci(v);
    const figli = (figliDi.get(v.key) ?? []);
    if (figli.length) {
      const subTask = item.tipo === 'progetto' && item.stato !== 'fatto';
      if (subTask) {
        for (const f of figli) {
          const c = costruisci(f, { tipo: 'azione', padreId: item.id });
          c.id = idStabile('azione', f.key);
          delete c.interesse;
          items.push(c);
        }
        report.sottoTask.push({ padre: item.titolo, figli: figli.length });
      } else {
        item.checklist = figli.map((f, i): VoceChecklist => ({
          id: `c${i + 1}`, testo: f.riga.name.replace(/\s+/g, ' ').trim(), fatto: f.uniti.some((x) => x.status === 'Done'),
        }));
        report.checklist.push({ padre: item.titolo, voci: figli.length });
      }
    }
    items.push(item);
  }

  // 4. persone
  for (const [nome, daContattare] of nomiPersone) {
    items.push({
      id: idStabile('persona', norm(nome)), tipo: 'persona', titolo: nome, stato: 'da_fare', creato: now, aggiornato: now,
      daContattare: daContattare || R.daContattare.has(nome) || undefined,
    });
  }
  report.persone = nomiPersone.size;

  // 5. riepiloghi
  for (const i of items) report.perTipo[NOMI_TIPO[i.tipo]] = (report.perTipo[NOMI_TIPO[i.tipo]] ?? 0) + 1;
  report.voci = items.filter((i) => i.tipo !== 'persona').length;
  const aperte = items.filter((i) => i.stato !== 'fatto' && i.stato !== 'saltato' && i.stato !== 'parcheggiato');
  report.inRevisione = aperte
    .filter((i) => i.tipo !== 'persona' && i.tipo !== 'routine')
    .filter((i) => ((i.fine ?? i.inizio) ?? '9999') < oggi)
    .map((i) => `${i.titolo} (${i.fine ?? i.inizio ?? 'senza data'})`);

  return { items, report };
}

export function reportMarkdown(r: Report, oggi: string): string {
  const lista = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '_nessuna_');
  const perTipo = Object.entries(r.perTipo).sort((a, b) => b[1] - a[1]).map(([t, n]) => `| ${t} | ${n} |`).join('\n');
  return `# Report importazione da Notion

Data: ${oggi}

Righe lette dall'export: **${r.righeIniziali}**. Voci create in MyTask: **${r.voci}**, più **${r.persone}** persone.

## Voci per tipo

| Tipo | Voci |
|---|---|
${perTipo}

## Cosa è stato fatto

### Duplicati uniti (${r.duplicatiUniti.length})
${lista(r.duplicatiUniti)}

### Tipo cambiato rispetto a Notion (${r.riclassificate.length})
Film, serie e anime sono stati separati dal vecchio tipo "Video"; qui sotto restano gli altri spostamenti.

${lista(r.riclassificate.map((x) => `${x.titolo}: ${x.da} → ${x.a}`))}

### Sotto-attività ordinarie (${r.sottoTask.length} progetti)
${lista(r.sottoTask.map((x) => `${x.padre}: ${x.figli} sotto-task`))}

### Trasformate in checklist (${r.checklist.length})
${lista(r.checklist.map((x) => `${x.padre}: ${x.voci} voci`))}

### Dati estratti dalle note (${r.campiEstratti.length})
${lista(r.campiEstratti.map((x) => `${x.titolo}: ${x.campi}`))}

### Link ripuliti da parametri di tracciamento (${r.linkPuliti.length})
${lista(r.linkPuliti)}

## Da verificare a mano
${lista(r.daVerificare)}

Azioni senza priorità in Notion (nell'app usano importanza 3 finché non la imposti): **${r.senzaPriorita}**.

## In Revisione dopo l'importazione (${r.inRevisione.length})
${lista(r.inRevisione)}
`;
}
