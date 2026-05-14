const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('swtd', {
  ping: () => ipcRenderer.invoke('swtd:ping')
})
