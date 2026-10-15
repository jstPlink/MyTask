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

const BACKUP_TENUTI = 14;

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
