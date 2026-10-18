// Indirizzo del server scritto dall'utente nella schermata di accesso dell'app: schema (http o https) separato dal resto.

export type Schema = 'http' | 'https';

/** Separa "https://mytask.tuodominio.it/" in schema e resto ("mytask.tuodominio.it"). Senza schema vale https. */
export function separaIndirizzo(testo: string, predefinito: Schema = 'https'): { schema: Schema; resto: string } {
  const t = testo.trim();
  const m = /^(https?):\/\/(.*)$/i.exec(t);
  const schema = (m ? m[1].toLowerCase() : predefinito) as Schema;
  const resto = (m ? m[2] : t).replace(/^\/+/, '').replace(/\/+$/, '');
  return { schema, resto };
}

/** Un indirizzo è plausibile se ha un punto (dominio o IP) oppure è "localhost", con eventuale porta. */
export function indirizzoValido(resto: string): boolean {
  return /^(localhost|[^\s/:]+\.[^\s/:]+)(:\d{1,5})?(\/\S*)?$/i.test(resto.trim());
}

/** Schema scelto + testo scritto; se nel testo c'è già uno schema, vince quello. */
export function componiIndirizzo(schema: Schema, testo: string): string {
  const p = separaIndirizzo(testo, schema);
  return `${p.schema}://${p.resto}`;
}
