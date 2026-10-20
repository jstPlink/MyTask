// MyTask per computer: una finestra che mostra il sito MyTask del tuo server (stesso indirizzo che si usa nel browser).
// Il sito è una PWA con archivio locale, quindi continua a funzionare anche senza rete come nel browser.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const configFile = () => path.join(app.getPath('userData'), 'config.json');

function leggiServer() {
  try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')).server || ''; } catch { return ''; }
}
function salvaServer(server) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify({ server }));
}
/** Normalizza l'indirizzo scritto dall'utente (aggiunge https:// se manca, toglie le barre finali). */
function normalizza(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

let finestra;

function mostraImpostazione(errore) {
  const query = { server: leggiServer() };
  if (errore) query.errore = errore;
  finestra.loadFile(path.join(__dirname, 'setup.html'), { query });
}

async function apriServer(url) {
  try {
    const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    mostraImpostazione('Il server non risponde a questo indirizzo.');
    return;
  }
  finestra.loadURL(url);
}

function creaFinestra() {
  finestra = new BrowserWindow({
    width: 1280, height: 860, minWidth: 420, minHeight: 600,
    title: 'MyTask', backgroundColor: '#F1F0EC', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  // i link verso altri siti si aprono nel browser, non dentro l'app
  finestra.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  finestra.webContents.on('will-navigate', (e, url) => {
    const server = leggiServer();
    if (url.startsWith('file:') || (server && url.startsWith(server))) return;
    e.preventDefault();
    void shell.openExternal(url);
  });
  // se la pagina non si carica (server spento, nessuna rete) si torna alla schermata dell'indirizzo con un avviso
  finestra.webContents.on('did-fail-load', (_e, codice, _d, url, principale) => {
    if (principale && codice !== -3 && !url.startsWith('file:')) mostraImpostazione("Impossibile raggiungere il server. Controlla la rete o l'indirizzo.");
  });
  const server = leggiServer();
  if (server) void apriServer(server); else mostraImpostazione();
}

ipcMain.handle('mytask:server', async (_e, url) => {
  const u = normalizza(url);
  if (!u) return false;
  salvaServer(u);
  await apriServer(u);
  return true;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (finestra) { if (finestra.isMinimized()) finestra.restore(); finestra.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'MyTask', submenu: [
        { label: 'Ricarica', accelerator: 'CmdOrCtrl+R', click: () => finestra.reload() },
        { label: "Cambia indirizzo del server", click: () => mostraImpostazione() },
        { label: 'Schermo intero', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Esci', role: 'quit' },
      ] },
      { label: 'Modifica', role: 'editMenu' },
    ]));
    creaFinestra();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) creaFinestra(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
