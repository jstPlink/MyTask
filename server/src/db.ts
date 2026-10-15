import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Item } from '../../shared/types.ts';

export interface Utente { id: number; email: string; hash: string }

/** Archivio su SQLite: un documento JSON per voce, con un numero di sequenza per la sincronizzazione. */
export class Store {
  readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
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
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated INTEGER NOT NULL,
        seq INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS items_seq ON items(seq);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
      INSERT OR IGNORE INTO meta(k, v) VALUES ('seq', 0);
    `);
  }

  close() { this.db.close(); }

  // utenti e sessioni

  countUsers(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  }

  createUser(email: string, hash: string) {
    this.db.prepare('INSERT INTO users(email, hash) VALUES (?, ?)').run(email, hash);
  }

  getUser(email: string): Utente | undefined {
    return this.db.prepare('SELECT id, email, hash FROM users WHERE email = ?').get(email) as Utente | undefined;
  }

  updateHash(userId: number, hash: string) {
    this.db.prepare('UPDATE users SET hash = ? WHERE id = ?').run(hash, userId);
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

  // voci

  maxSeq(): number {
    return (this.db.prepare("SELECT v FROM meta WHERE k = 'seq'").get() as { v: number }).v;
  }

  countItems(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n;
  }

  /** Applica le modifiche del client: vince la versione con `aggiornato` più recente. Restituisce quante ne ha applicate. */
  applyChanges(changes: Item[]): number {
    const get = this.db.prepare('SELECT updated FROM items WHERE id = ?');
    const put = this.db.prepare(
      'INSERT INTO items(id, data, updated, seq) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated, seq = excluded.seq',
    );
    const bump = this.db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'seq' RETURNING v");
    let applied = 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const c of changes) {
        const ex = get.get(c.id) as { updated: number } | undefined;
        if (ex && ex.updated >= c.aggiornato) continue;
        const { v } = bump.get() as { v: number };
        put.run(c.id, JSON.stringify(c), c.aggiornato, v);
        applied++;
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return applied;
  }

  changesSince(seq: number): Item[] {
    const rows = this.db.prepare('SELECT data FROM items WHERE seq > ? ORDER BY seq').all(seq) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  allItems(): Item[] {
    return this.changesSince(0);
  }

  /** Copia coerente del database in un nuovo file. */
  backupTo(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.rmSync(file);
    this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  }
}
