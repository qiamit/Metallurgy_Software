const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bridge", {
  saveTempFrame: (dataUrl) => ipcRenderer.invoke("save-temp-frame", dataUrl),
  uploadFrame: (payload) => ipcRenderer.invoke("upload-frame", payload),
});
