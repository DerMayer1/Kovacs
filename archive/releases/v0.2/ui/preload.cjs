const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kovacs", {
  bootstrap: () => ipcRenderer.invoke("ambient:bootstrap"),
  startDay: (project, objective) => ipcRenderer.invoke("ambient:start", { project, objective }),
  setStatus: (status) => ipcRenderer.invoke("ambient:status", { status }),
  observeNow: () => ipcRenderer.invoke("ambient:observe"),
  endDay: () => ipcRenderer.invoke("ambient:end"),
  close: () => ipcRenderer.invoke("ambient:close"),
  onUpdate: (listener) => {
    const handler = (_event, update) => listener(update);
    ipcRenderer.on("ambient:update", handler);
    return () => ipcRenderer.removeListener("ambient:update", handler);
  },
});
