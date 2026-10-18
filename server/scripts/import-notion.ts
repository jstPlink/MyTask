// Uso:
//   node server/scripts/import-notion.ts <file_all.csv> [--dry-run] [--force] [--report percorso.md] [--json items.json]
//   node server/scripts/import-notion.ts --from-json items.json [--force]
// Importa l'export di Notion nel database di MyTask (cartella DATA_DIR, per default ./data). Si usa una volta sola, a mano;
// senza --force non sovrascrive un database che ha già delle voci.
// Le regole di smistamento sono in regole.locale.ts (personali, non su git) oppure regole.esempio.ts.
// Con --json si scrive il risultato in un file; con --from-json lo si carica poi nel database
// (utile per prepararlo sul proprio computer e caricarlo nel container, dove le regole personali non ci sono).
import fs from 'node:fs';
import path from 'node:path';
import type { Item } from '../../shared/types.ts';
import { loadConfig } from '../src/config.ts';
import { Store } from '../src/db.ts';
import { today } from '../../shared/dates.ts';
import { converti, leggiRighe, reportMarkdown } from './notion.ts';
import { caricaRegole } from './regole.ts';

const args = process.argv.slice(2);
const valore = (nome: string) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const opzioniConValore = new Set(['--report', '--json', '--from-json']);
const file = args.find((a, i) => !a.startsWith('--') && !opzioniConValore.has(args[i - 1]));
const force = args.includes('--force');
const dry = args.includes('--dry-run');
const daJson = valore('--from-json');
const reportPath = valore('--report') ?? path.join('docs', 'report-importazione.md');
const jsonOut = valore('--json');

let items: Item[];
if (daJson) {
  items = JSON.parse(fs.readFileSync(daJson, 'utf8')) as Item[];
  console.log(`Lette ${items.length} voci da ${daJson}`);
} else {
  if (!file) {
    console.error('Uso: node server/scripts/import-notion.ts <file_all.csv> [--dry-run] [--force] [--report percorso.md] [--json items.json]');
    console.error('     node server/scripts/import-notion.ts --from-json items.json [--force]');
    process.exit(1);
  }
  const { regole, origine } = await caricaRegole();
  console.log(`Regole di smistamento: ${origine}`);
  const righe = leggiRighe(fs.readFileSync(file, 'utf8'));
  const risultato = converti(righe, Date.now(), today(), regole);
  items = risultato.items;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportMarkdown(risultato.report, today()));
  console.log(`Righe: ${righe.length} → voci: ${risultato.report.voci}, persone: ${risultato.report.persone}. Report: ${reportPath}`);
  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(items));
    console.log(`Voci scritte in ${jsonOut}`);
  }
}

if (dry) {
  console.log('Prova a secco: il database non è stato toccato.');
  process.exit(0);
}

const config = loadConfig();
const store = new Store(path.join(config.dataDir, 'mytask.db'));
if (store.countItems() > 0 && !force) {
  console.error(`Il database ha già ${store.countItems()} voci. Per sostituirle serve --force (le modifiche fatte nell'app andrebbero perse).`);
  process.exit(1);
}
if (force) store.db.exec('DELETE FROM items');
store.applyChanges(items);
console.log(`Importate ${items.length} voci in ${path.join(config.dataDir, 'mytask.db')}.`);
store.close();
