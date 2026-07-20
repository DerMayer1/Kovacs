const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kovacs", {
  bootstrap: () => ipcRenderer.invoke("v03:bootstrap"),
  draftSetup: (input) => ipcRenderer.invoke("v03:setup:draft", input),
  confirmSetup: (draft_id) => ipcRenderer.invoke("v03:setup:confirm", { draft_id }),
  draftWeek: (input) => ipcRenderer.invoke("v03:week:draft", input),
  confirmWeek: (draft_id) => ipcRenderer.invoke("v03:week:confirm", { draft_id }),
  draftDay: (project, objective) => ipcRenderer.invoke("v03:day:draft", { project, objective }),
  confirmDay: (draft_id) => ipcRenderer.invoke("v03:day:confirm", { draft_id }),
  setStatus: (status) => ipcRenderer.invoke("v03:status", { status }),
  observeNow: () => ipcRenderer.invoke("v03:observe"),
  completeCheckpoint: (input) => ipcRenderer.invoke("v03:checkpoint", input),
  endDay: (input) => ipcRenderer.invoke("v03:day:end", input),
  setMemoryStatus: (memory_id, status) => ipcRenderer.invoke("v03:memory:status", { memory_id, status }),
  setMemoryPinned: (memory_id, pinned) => ipcRenderer.invoke("v03:memory:pin", { memory_id, pinned }),
  deleteMemory: (memory_id) => ipcRenderer.invoke("v03:memory:delete", { memory_id }),
  close: () => ipcRenderer.invoke("v03:close"),
  onUpdate: (listener) => {
    const handler = (_event, update) => listener(update);
    ipcRenderer.on("v03:update", handler);
    return () => ipcRenderer.removeListener("v03:update", handler);
  },
});
