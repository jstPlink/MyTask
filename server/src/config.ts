import path from 'node:path';

const env = process.env;

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  backupDir: string;
  email: string | undefined;
  password: string | undefined;
  geminiKey: string | undefined;
  geminiModel: string;
  trustProxy: boolean;
  webDir: string;
  /** Origini web aggiuntive ammesse (separate da virgola), oltre a quelle dell'app Android. */
  corsOrigins: string[];
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = path.resolve(env.DATA_DIR ?? './data');
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    dataDir,
    backupDir: path.resolve(env.BACKUP_DIR ?? path.join(dataDir, 'backups')),
    email: env.MYTASK_EMAIL?.trim().toLowerCase() || undefined,
    password: env.MYTASK_PASSWORD || undefined,
    geminiKey: env.GEMINI_API_KEY || undefined,
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    trustProxy: env.TRUST_PROXY === 'true',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    webDir: path.resolve(env.WEB_DIR ?? path.join(import.meta.dirname, '..', '..', 'web', 'dist')),
    ...overrides,
  };
}
