// Avvio del server: apre il database, fa una copia giornaliera (si tengono le ultime 14), mette in ascolto l'app.
// Eseguito direttamente da Node (`node server/src/index.ts`), come nel container Docker.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.ts';
import { Store } from './db.ts';
import { buildApp } from './app.ts';

const config = loadConfig();
const store = new Store(path.join(config.dataDir, 'mytask.db'));
const app = await buildApp({ config, store });

if (store.countUsers() === 0) {
  console.warn('Nessun utente: imposta MYTASK_EMAIL e MYTASK_PASSWORD per creare l\'account al primo avvio.');
}

/** Quante copie giornaliere del database restano nella cartella dei backup. */
const BACKUP_TENUTI = 14;

/** Copia del giorno (`mytask-AAAA-MM-GG.db`, sovrascritta se già presente) e cancellazione delle più vecchie. */
function backup() {
  try {
    const nome = `mytask-${new Date().toISOString().slice(0, 10)}.db`;
    store.backupTo(path.join(config.backupDir, nome));
    const vecchi = fs.readdirSync(config.backupDir).filter((f) => /^mytask-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -BACKUP_TENUTI);
    for (const f of vecchi) fs.rmSync(path.join(config.backupDir, f));
  } catch (e) {
    console.error('Backup non riuscito:', e);
  }
}

// subito all'avvio e poi ogni 24 ore
backup();
setInterval(backup, 24 * 3600 * 1000).unref();

await app.listen({ port: config.port, host: config.host });
console.log(`MyTask in ascolto su http://${config.host}:${config.port} (dati in ${config.dataDir})`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    store.close();
    process.exit(0);
  });
}
