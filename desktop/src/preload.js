const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mytaskDesktop', { impostaServer: (url) => ipcRenderer.invoke('mytask:server', url) });
