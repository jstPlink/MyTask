// Versione dell'app, inserita in fase di build da vite.config.ts (è quella del package.json principale).
declare const __APP_VERSION__: string;

export const VERSIONE: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'sconosciuta';
