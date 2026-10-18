// Password e sessioni: hash scrypt per le password, token casuali (salvati solo come hash SHA-256) e limite ai tentativi di accesso.
import crypto from 'node:crypto';

/** Lunghezza in byte dell'hash scrypt. */
const KEYLEN = 64;

/** Hash scrypt con sale casuale, nel formato `scrypt$sale$hash` (base64). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Confronta la password con l'hash salvato, a tempo costante. */
export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/** Token di sessione casuale (256 bit) che il client conserva e invia come `Bearer`. */
export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Nel database si salva solo l'hash del token: se il database trapela, i token non sono usabili. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Limita i tentativi di accesso: massimo `max` ogni `windowMs` per chiave (IP + email). */
export class RateLimiter {
  /** Istanti dei tentativi recenti, per chiave. */
  private hits = new Map<string, number[]>();
  private max: number;
  private windowMs: number;

  constructor(max = 8, windowMs = 15 * 60 * 1000) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /** Restituisce true se il tentativo è consentito e lo registra. */
  attempt(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Azzera i tentativi di una chiave (dopo un accesso riuscito). */
  reset(key: string) { this.hits.delete(key); }
}
