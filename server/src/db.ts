// Archivio SQLite (modulo integrato `node:sqlite`, nessuna dipendenza nativa): utenti, sessioni, voci e impostazioni.
// Ogni voce è un documento JSON con un numero di sequenza globale: i client chiedono le modifiche con `seq` maggiore dell'ultimo visto.
// Voci e impostazioni appartengono a un utente (`user_id`): ogni account vede solo le sue.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { ImpostazioniSync, Item } from '../../shared/types.ts';

/** Un utente: email e hash scrypt della password. */
export interface Utente { id: number; email: string; hash: string }

/** Archivio su SQLite: un documento JSON per voce, con un numero di sequenza per la sincronizzazione. */
export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migraMultiutente(file);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS watch_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS items (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated INTEGER NOT NULL,
        seq INTEGER NOT NULL,
        PRIMARY KEY (user_id, id)
      );
      CREATE INDEX IF NOT EXISTS items_seq ON items(user_id, seq);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        k TEXT NOT NULL,
        v TEXT NOT NULL,
        updated INTEGER NOT NULL,
        PRIMARY KEY (user_id, k)
      );
      INSERT OR IGNORE INTO meta(k, v) VALUES ('seq', 0);
    `);
  }

  /**
   * Database nato con un solo utente (voci e impostazioni senza proprietario): le tabelle si ricostruiscono con `user_id` e tutto
   * passa al primo utente. Prima si fa una copia accanto al file (`mytask.db.prima-multiutente`). Se non serve non fa nulla.
   */
  private migraMultiutente(file: string) {
    const ha = (t: string) => !!this.db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
    const conUtente = (t: string) => (this.db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((c) => c.name === 'user_id');
    const daMigrare = (['items', 'settings'] as const).filter((t) => ha(t) && !conUtente(t));
    if (daMigrare.length === 0) return;
    if (file !== ':memory:') {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(file, `${file}.prima-multiutente`);
    }
    const proprietario = (this.db.prepare('SELECT MIN(id) AS id FROM users').get() as { id: number | null } | undefined)?.id ?? 1;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (daMigrare.includes('items')) {
        this.db.exec(`
          ALTER TABLE items RENAME TO items_vecchia;
          CREATE TABLE items (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (user_id, id));
          INSERT INTO items(user_id, id, data, updated, seq) SELECT ${proprietario}, id, data, updated, seq FROM items_vecchia;
          DROP TABLE items_vecchia;
          CREATE INDEX IF NOT EXISTS items_seq ON items(user_id, seq);`);
      }
      if (daMigrare.includes('settings')) {
        this.db.exec(`
          ALTER TABLE settings RENAME TO settings_vecchia;
          CREATE TABLE settings (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, k TEXT NOT NULL, v TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user_id, k));
          INSERT INTO settings(user_id, k, v, updated) SELECT ${proprietario}, k, v, updated FROM settings_vecchia;
          DROP TABLE settings_vecchia;`);
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close() { this.db.close(); }

  // utenti e sessioni (si salva l'hash del token, vedi auth.ts)

  countUsers(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  /** Crea l'utente e ne restituisce l'id (l'email è unica: se esiste già il database solleva un errore). */
  createUser(email: string, hash: string): number {
    return Number(this.db.prepare('INSERT INTO users(email, hash) VALUES (?, ?)').run(email, hash).lastInsertRowid);
  }

  getUser(email: string): Utente | undefined {
    return this.db.prepare('SELECT id, email, hash FROM users WHERE email = ?').get(email) as Utente | undefined;
  }

  createSession(userId: number, tokenHash: string, expires: number) {
    this.db.prepare('INSERT INTO sessions(token_hash, user_id, expires) VALUES (?, ?, ?)').run(tokenHash, userId, expires);
  }

  findSession(tokenHash: string, now: number): { userId: number; email: string } | undefined {
    const r = this.db.prepare(
      'SELECT s.user_id AS userId, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?',
    ).get(tokenHash, now) as { userId: number; email: string } | undefined;
    return r;
  }

  deleteSession(tokenHash: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  purgeSessions(now: number) {
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
  }

  // token dedicato all'orologio: serve solo alle rotte `/api/orologio/*` (stato e comandi del timer), non apre la sincronizzazione

  /** Crea il token dell'orologio (ne esiste uno solo: il nuovo sostituisce il precedente). */
  replaceWatchToken(userId: number, tokenHash: string) {
    this.db.prepare('DELETE FROM watch_tokens WHERE user_id = ?').run(userId);
    this.db.prepare('INSERT INTO watch_tokens(token_hash, user_id) VALUES (?, ?)').run(tokenHash, userId);
  }

  hasWatchToken(userId: number): boolean {
    return !!this.db.prepare('SELECT 1 AS x FROM watch_tokens WHERE user_id = ?').get(userId);
  }

  deleteWatchToken(userId: number) {
    this.db.prepare('DELETE FROM watch_tokens WHERE user_id = ?').run(userId);
  }

  findWatchToken(tokenHash: string): { userId: number } | undefined {
    return this.db.prepare('SELECT user_id AS userId FROM watch_tokens WHERE token_hash = ?').get(tokenHash) as { userId: number } | undefined;
  }

  // voci

  /** Una voce per id (anche eliminata logicamente). */
  getItem(userId: number, id: string): Item | undefined {
    const r = this.db.prepare('SELECT data FROM items WHERE user_id = ? AND id = ?').get(userId, id) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as Item) : undefined;
  }

  /** Un'impostazione salvata (valore e data di modifica). */
  getSetting(userId: number, k: string): { valore: unknown; aggiornato: number } | undefined {
    const r = this.db.prepare('SELECT v, updated FROM settings WHERE user_id = ? AND k = ?').get(userId, k) as { v: string; updated: number } | undefined;
    return r ? { valore: JSON.parse(r.v) as unknown, aggiornato: r.updated } : undefined;
  }

  /** Ultimo numero di sequenza assegnato: il client lo salva e lo rimanda come `since`. */
  maxSeq(): number {
    return (this.db.prepare("SELECT v FROM meta WHERE k = 'seq'").get() as { v: number }).v;
  }

  /** Quante voci ha un utente (lo usa lo script di importazione per non sovrascrivere dati esistenti). */
  countItems(userId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM items WHERE user_id = ?').get(userId) as { n: number }).n;
  }

  /** Id del primo utente (quello creato al primo avvio): serve agli script. */
  firstUserId(): number | undefined {
    return (this.db.prepare('SELECT MIN(id) AS id FROM users').get() as { id: number | null }).id ?? undefined;
  }

  /** Applica le modifiche del client: vince la versione con `aggiornato` più recente. Restituisce quante ne ha applicate. */
  applyChanges(userId: number, changes: Item[]): number {
    const get = this.db.prepare('SELECT updated FROM items WHERE user_id = ? AND id = ?');
    const put = this.db.prepare(
      'INSERT INTO items(user_id, id, data, updated, seq) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, updated = excluded.updated, seq = excluded.seq',
    );
    const bump = this.db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'seq' RETURNING v");
    let applied = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const c of changes) {
        const ex = get.get(userId, c.id) as { updated: number } | undefined;
        if (ex && ex.updated >= c.aggiornato) continue;
        const { v } = bump.get() as { v: number };
        put.run(userId, c.id, JSON.stringify(c), c.aggiornato, v);
        applied++;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return applied;
  }

  /** Le voci (anche quelle eliminate logicamente) modificate dopo il numero di sequenza indicato. */
  changesSince(userId: number, seq: number): Item[] {
    const rows = this.db.prepare('SELECT data FROM items WHERE user_id = ? AND seq > ? ORDER BY seq').all(userId, seq) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  /** Impostazioni dell'utente (per ora la sessione di lavoro): vince il valore con la data di modifica più recente. */
  applySettings(userId: number, s: ImpostazioniSync): void {
    const get = this.db.prepare('SELECT updated FROM settings WHERE user_id = ? AND k = ?');
    const put = this.db.prepare('INSERT INTO settings(user_id, k, v, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, k) DO UPDATE SET v = excluded.v, updated = excluded.updated');
    for (const [k, x] of Object.entries(s)) {
      const ex = get.get(userId, k) as { updated: number } | undefined;
      if (ex && ex.updated >= x.aggiornato) continue;
      put.run(userId, k, JSON.stringify(x.valore), x.aggiornato);
    }
  }

  /** Tutte le impostazioni salvate, con la loro data di modifica. */
  allSettings(userId: number): ImpostazioniSync {
    const rows = this.db.prepare('SELECT k, v, updated FROM settings WHERE user_id = ?').all(userId) as { k: string; v: string; updated: number }[];
    return Object.fromEntries(rows.map((r) => [r.k, { valore: JSON.parse(r.v) as unknown, aggiornato: r.updated }]));
  }

  /** Tutte le voci, per l'esportazione. */
  allItems(userId: number): Item[] {
    return this.changesSince(userId, 0);
  }

  /** Copia coerente del database in un nuovo file. */
  backupTo(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.rmSync(file);
    this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  }
}
