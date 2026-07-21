const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kovacs", {
  bootstrap: () => ipcRenderer.invoke("v03:bootstrap"),
  draftSetup: (input) => ipcRenderer.invoke("v03:setup:draft", input),
  confirmSetup: (draft_id) => ipcRenderer.invoke("v03:setup:confirm", { draft_id }),
  reviseSetupDraft: (draft_id, proposal, reason) => ipcRenderer.invoke("v03:setup:revise", { draft_id, proposal, reason }),
  draftWeek: (input) => ipcRenderer.invoke("v03:week:draft", input),
  confirmWeek: (draft_id) => ipcRenderer.invoke("v03:week:confirm", { draft_id }),
  reviseWeekDraft: (draft_id, proposal, reason) => ipcRenderer.invoke("v03:week:revise", { draft_id, proposal, reason }),
  draftDay: (project, objective) => ipcRenderer.invoke("v03:day:draft", { project, objective }),
  confirmDay: (draft_id) => ipcRenderer.invoke("v03:day:confirm", { draft_id }),
  rejectDraft: (draft_id, reason) => ipcRenderer.invoke("v03:draft:reject", { draft_id, reason }),
  reviseDayDraft: (draft_id, proposal, reason) => ipcRenderer.invoke("v03:day:draft:revise", { draft_id, proposal, reason }),
  reviseObjective: (objective, reason) => ipcRenderer.invoke("v03:day:objective", { objective, reason }),
  setStatus: (status) => ipcRenderer.invoke("v03:status", { status }),
  observeNow: () => ipcRenderer.invoke("v03:observe"),
  completeCheckpoint: (input) => ipcRenderer.invoke("v03:checkpoint", input),
  transitionCheckpoint: (checkpoint_id, status, reason) => ipcRenderer.invoke("v03:checkpoint:transition", { checkpoint_id, status, reason }),
  endDay: (input) => ipcRenderer.invoke("v03:day:end", input),
  draftEndDay: (narrative) => ipcRenderer.invoke("v03:day:end:draft", { narrative }),
  confirmEndDay: (draft_id) => ipcRenderer.invoke("v03:day:end:confirm", { draft_id }),
  rejectEndDay: (draft_id, reason) => ipcRenderer.invoke("v03:day:end:reject", { draft_id, reason }),
  setMemoryStatus: (memory_id, status) => ipcRenderer.invoke("v03:memory:status", { memory_id, status }),
  setMemoryPinned: (memory_id, pinned) => ipcRenderer.invoke("v03:memory:pin", { memory_id, pinned }),
  deleteMemory: (memory_id) => ipcRenderer.invoke("v03:memory:delete", { memory_id }),
  reviewEvidence: (evidence_id) => ipcRenderer.invoke("v03:evidence:review", { evidence_id }),
  deleteMemoriesByDay: (day_id) => ipcRenderer.invoke("v03:memory:delete-day", { day_id }),
  deleteMemoriesBySession: (session_id) => ipcRenderer.invoke("v03:memory:delete-session", { session_id }),
  setRetention: (memory_days, sensitive_days) => ipcRenderer.invoke("v03:retention", { memory_days, sensitive_days }),
  feedback: (request_id, kind, note) => ipcRenderer.invoke("v03:feedback", { request_id, kind, note }),
  backup: () => ipcRenderer.invoke("v03:backup"),
  close: () => ipcRenderer.invoke("v03:close"),
  onUpdate: (listener) => {
    const handler = (_event, update) => listener(update);
    ipcRenderer.on("v03:update", handler);
    return () => ipcRenderer.removeListener("v03:update", handler);
  },
});
