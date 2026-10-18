// Configurazione del server dalle variabili d'ambiente (file `.env` in Docker): porta, cartelle dei dati e dei backup,
// credenziali del primo avvio, proxy fidato e origini CORS aggiuntive.
import path from 'node:path';

const env = process.env;

export interface Config {
  /** `PORT` (di base 8787) e `HOST` (di base 0.0.0.0). */
  port: number;
  host: string;
  /** `DATA_DIR`: cartella del database SQLite (di base `./data`). */
  dataDir: string;
  /** `BACKUP_DIR`: copie giornaliere del database (di base `<dataDir>/backups`). */
  backupDir: string;
  /** `MYTASK_EMAIL` e `MYTASK_PASSWORD`: servono solo al primo avvio per creare l'unico utente. */
  email: string | undefined;
  password: string | undefined;
  /** `TRUST_PROXY=true`: dietro il tunnel Cloudflare, usa l'IP reale del client per il limite ai tentativi di accesso. */
  trustProxy: boolean;
  /** `WEB_DIR`: cartella della web app compilata (di base `web/dist`). */
  webDir: string;
  /** `CORS_ORIGINS`: origini web aggiuntive ammesse (separate da virgola), oltre a quelle dell'app Android. */
  corsOrigins: string[];
}

/** Legge la configurazione dall'ambiente; `overrides` serve ai test. */
export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = path.resolve(env.DATA_DIR ?? './data');
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dataDir,
    backupDir: path.resolve(env.BACKUP_DIR ?? path.join(dataDir, 'backups')),
    email: env.MYTASK_EMAIL?.trim().toLowerCase() || undefined,
    password: env.MYTASK_PASSWORD || undefined,
    trustProxy: env.TRUST_PROXY === 'true',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    webDir: path.resolve(env.WEB_DIR ?? path.join(import.meta.dirname, '..', '..', 'web', 'dist')),
    ...overrides,
  };
}
