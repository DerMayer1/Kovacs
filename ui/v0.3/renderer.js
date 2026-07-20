const $ = (selector) => document.querySelector(selector);
const shell = $(".shell");
let ambient = null;
let operating = null;
let defaultProject = "";
let currentTab = "today";

const labelize = (value) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
function clear(element) { while (element.firstChild) element.firstChild.remove(); }
function setBusy(value) { document.querySelectorAll("button, input, textarea, select").forEach((element) => { element.disabled = value; }); }
function showError(error) { const target = $("#error"); target.textContent = error?.message || String(error); target.classList.remove("hidden"); setTimeout(() => target.classList.add("hidden"), 8000); }
async function action(callback) { setBusy(true); try { const result = await callback(); if (result?.profile !== undefined || result?.active_day !== undefined) operating = result; render(); } catch (error) { showError(error); } finally { setBusy(false); } }

function appendList(parent, values) {
  const list = node("ul"); values.forEach((value) => list.append(node("li", "", value))); parent.append(list);
}

function renderMode(message) {
  const status = ambient?.status || "idle"; shell.dataset.state = status; $("#state-label").textContent = status.toUpperCase();
  const copy = {
    idle: ["Standing by", operating?.profile ? "Plan the day when you are ready." : "Configure the operating system to begin."],
    observing: ["Watching the work", "Authorized windows only. Raw frames are not retained."],
    paused: ["Observation paused", "No screen capture or ambient reasoning is active."],
    private: ["Private mode", "Capture is blocked until you resume."],
    ended: ["Day complete", "Observation is stopped. Evidence remains local."],
  }[status] || ["Standing by", "Capture is off."];
  $("#mode-title").textContent = copy[0]; $("#mode-detail").textContent = message || copy[1];
  $("#usage").classList.toggle("hidden", !operating?.profile);
  if (operating) {
    $("#usage-calls").textContent = `${operating.usage_today.invocation_count} calls`;
    $("#usage-context").textContent = `${operating.usage_today.prompt_characters.toLocaleString()} chars`;
  }
}

function proposalShell(container, eyebrow, title, rationale, warnings) {
  clear(container); container.classList.remove("hidden");
  const heading = node("div", "proposal-heading"); heading.append(node("span", "", eyebrow), node("strong", "", title)); container.append(heading);
  const reason = node("p", "proposal-reason", rationale); container.append(reason);
  if (warnings.length) { const warning = node("div", "warning"); warning.append(node("span", "", "WATCH")); appendList(warning, warnings); container.append(warning); }
}

function renderSetup() {
  const proposal = operating?.pending_setup;
  $("#setup-form").classList.toggle("hidden", Boolean(proposal));
  const container = $("#setup-proposal");
  if (!proposal) { container.classList.add("hidden"); clear(container); return; }
  proposalShell(container, "PROPOSED 90-DAY MISSION", proposal.proposal.mission_title, proposal.proposal.rationale, proposal.proposal.warnings);
  container.append(node("span", "micro-label", "SUCCESS EVIDENCE")); appendList(container, proposal.proposal.mission_success_criteria);
  container.append(node("span", "micro-label", "FIRST ROLLING WEEK"), node("p", "proposal-outcome", proposal.proposal.weekly_outcome)); appendList(container, proposal.proposal.weekly_success_criteria);
  const competencies = node("p", "tags"); proposal.proposal.weekly_competencies.forEach((value) => competencies.append(node("b", "", labelize(value)))); container.append(competencies);
  const confirm = node("button", "primary full", "CONFIRM OPERATING SYSTEM"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmSetup(proposal.draft_id))); container.append(confirm);
}

function renderHierarchy() {
  const profile = operating.profile; const container = $("#hierarchy"); clear(container);
  const mission = node("div", "hierarchy-item"); mission.append(node("span", "", "90 DAYS"), node("strong", "", profile.mission.title));
  const week = node("div", "hierarchy-item current"); week.append(node("span", "", "THIS WEEK"), node("strong", "", profile.week.primary_outcome));
  container.append(mission, week);
}

function renderWeekProposal() {
  const proposal = operating.pending_week, container = $("#week-proposal");
  if (!proposal) { container.classList.add("hidden"); clear(container); return; }
  proposalShell(container, "PROPOSED ROLLING WEEK", proposal.proposal.primary_outcome, proposal.proposal.rationale, proposal.proposal.warnings);
  container.append(node("span", "micro-label", "SUCCESS EVIDENCE")); appendList(container, proposal.proposal.success_criteria);
  const competencies = node("p", "tags"); proposal.proposal.competencies.forEach((value) => competencies.append(node("b", "", labelize(value)))); container.append(competencies);
  const confirm = node("button", "primary full", "CONFIRM NEW WEEK"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmWeek(proposal.draft_id))); container.append(confirm);
}

function renderDayProposal() {
  const proposal = operating.pending_day, container = $("#day-proposal");
  if (!proposal) { container.classList.add("hidden"); clear(container); return; }
  proposalShell(container, proposal.proposal.objective_changed ? "OBJECTIVE CHALLENGED" : "PROPOSED DAY", proposal.proposal.proposed_objective, proposal.proposal.rationale, proposal.proposal.warnings);
  container.append(node("span", "micro-label", "SUCCESS EVIDENCE")); appendList(container, proposal.proposal.success_criteria);
  const steps = node("div", "proposal-steps"); proposal.proposal.checkpoints.forEach((checkpoint, index) => { const step = node("div", "proposal-step"); step.append(node("i", "", String(index + 1)), node("strong", "", checkpoint.title), node("p", "", checkpoint.evidence_required)); steps.append(step); }); container.append(steps);
  const confirm = node("button", "primary full", "APPROVE & START DAY"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmDay(proposal.draft_id))); container.append(confirm);
  const note = node("p", "approval-note", "Approval is required because the objective and checkpoints become the active operating contract."); container.append(note);
}

function renderActiveDay() {
  const day = operating.active_day, active = Boolean(day);
  $("#day-start").classList.toggle("hidden", active || Boolean(operating.pending_day) || Boolean(operating.pending_week));
  $("#active-day").classList.toggle("hidden", !active);
  if (!day) return;
  $("#active-objective").textContent = day.objective;
  const complete = day.checkpoints.filter((checkpoint) => checkpoint.status === "completed").length;
  $("#progress").textContent = `${complete}/${day.checkpoints.length} checkpoints evidenced`;
  const container = $("#checkpoints"); clear(container);
  day.checkpoints.forEach((checkpoint) => {
    const item = node("div", `checkpoint ${checkpoint.status}`);
    const marker = node("i", "", checkpoint.status === "completed" ? "✓" : String(checkpoint.position + 1));
    const copy = node("div"); copy.append(node("strong", "", checkpoint.title), node("p", "", checkpoint.evidence_required), node("span", "", labelize(checkpoint.competency)));
    item.append(marker, copy);
    if (checkpoint.status === "active") { const button = node("button", "tiny", "RECORD"); button.addEventListener("click", () => $("#checkpoint-form").classList.remove("hidden")); item.append(button); }
    container.append(item);
  });
  const status = ambient?.status;
  $("#pause").classList.toggle("hidden", status !== "observing"); $("#private").classList.toggle("hidden", status !== "observing"); $("#observe").classList.toggle("hidden", status !== "observing"); $("#resume").classList.toggle("hidden", status === "observing");
}

function renderCompetencies() {
  const container = $("#competencies"); clear(container);
  operating.competencies.forEach((item) => {
    const card = node("div", "competency"); const top = node("div"); top.append(node("strong", "", labelize(item.competency)), node("b", `level ${item.level}`, labelize(item.level))); card.append(top);
    const meter = node("div", "meter"); const fill = node("i"); fill.style.width = `${Math.round(item.confidence * 100)}%`; meter.append(fill); card.append(meter, node("p", "", item.evidence_count ? `${item.evidence_count} sourced evidence record${item.evidence_count === 1 ? "" : "s"}` : "No evidence yet")); container.append(card);
  });
}

function renderMemories() {
  const container = $("#memories"); clear(container);
  if (!operating.memories.length) { container.append(node("p", "empty-copy", "No durable memory exists yet.")); return; }
  operating.memories.forEach((memory) => {
    const card = node("article", `memory ${memory.status}`); const meta = node("div", "memory-meta"); meta.append(node("span", "", labelize(memory.kind)), node("b", "", memory.status === "pending_confirmation" ? "REVIEW" : memory.pinned ? "PINNED" : memory.source.toUpperCase()));
    card.append(meta, node("p", "", memory.claim)); const actions = node("div", "memory-actions");
    if (memory.status === "pending_confirmation") { const confirm = node("button", "tiny", "CONFIRM"); confirm.addEventListener("click", () => action(() => window.kovacs.setMemoryStatus(memory.memory_id, "active"))); actions.append(confirm); }
    const pin = node("button", "tiny", memory.pinned ? "UNPIN" : "PIN"); pin.addEventListener("click", () => action(() => window.kovacs.setMemoryPinned(memory.memory_id, !memory.pinned)));
    const remove = node("button", "tiny danger", "DELETE"); remove.addEventListener("click", () => action(() => window.kovacs.deleteMemory(memory.memory_id))); actions.append(pin, remove); card.append(actions); container.append(card);
  });
}

function render(message) {
  renderMode(message);
  const configured = Boolean(operating?.profile);
  $("#setup-view").classList.toggle("hidden", configured);
  $("#tabs").classList.toggle("hidden", !configured);
  if (!configured) { renderSetup(); return; }
  ["today", "growth", "memory"].forEach((name) => $("#" + name + "-view").classList.toggle("hidden", currentTab !== name));
  document.querySelectorAll("#tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === currentTab));
  renderHierarchy(); renderWeekProposal(); renderDayProposal(); renderActiveDay(); renderCompetencies(); renderMemories();
}

window.kovacs.bootstrap().then((data) => { ambient = data.ambient; operating = data.operating; defaultProject = data.defaultProject; $("#project").value = operating.active_day?.project || defaultProject; render(); }).catch(showError);
window.kovacs.onUpdate((update) => { ambient = update.ambient; operating = update.operating; if (update.response) { const box = $("#intervention"); box.classList.remove("empty"); clear(box); box.append(node("span", "", `${update.response.profile.toUpperCase()} · ${update.response.intervention.assistance_level}`), node("p", "", update.response.intervention.message), node("small", "", update.response.checkpoint)); } render(update.message); });

document.querySelectorAll("#tabs button").forEach((button) => button.addEventListener("click", () => { currentTab = button.dataset.tab; render(); }));
$("#draft-setup").addEventListener("click", () => action(() => window.kovacs.draftSetup({ current_position: $("#current-position").value, available_hours_per_week: Number($("#available-hours").value), active_projects: $("#active-projects").value, weaknesses: $("#weaknesses").value, desired_outcome: $("#desired-outcome").value })));
$("#draft-week").addEventListener("click", () => action(() => window.kovacs.draftWeek({ priorities: $("#week-priorities").value, constraints: $("#week-constraints").value })));
$("#draft-day").addEventListener("click", () => action(() => window.kovacs.draftDay($("#project").value || defaultProject, $("#objective").value)));
$("#pause").addEventListener("click", () => action(() => window.kovacs.setStatus("paused")));
$("#private").addEventListener("click", () => action(() => window.kovacs.setStatus("private")));
$("#resume").addEventListener("click", () => action(() => window.kovacs.setStatus("observing")));
$("#observe").addEventListener("click", () => action(() => window.kovacs.observeNow()));
$("#cancel-checkpoint").addEventListener("click", () => $("#checkpoint-form").classList.add("hidden"));
$("#checkpoint-form").addEventListener("submit", (event) => { event.preventDefault(); const checkpoint = operating.active_day.checkpoints.find((item) => item.status === "active"); if (!checkpoint) return showError(new Error("No active checkpoint.")); action(async () => { const result = await window.kovacs.completeCheckpoint({ checkpoint_id: checkpoint.checkpoint_id, outcome: $("#checkpoint-outcome").value, result: $("#checkpoint-result").value, validation: $("#checkpoint-validation").value, assistance_level: $("#assistance").value }); $("#checkpoint-form").classList.add("hidden"); $("#checkpoint-result").value = ""; $("#checkpoint-validation").value = ""; return result; }); });
$("#open-end").addEventListener("click", () => $("#end-form").classList.remove("hidden")); $("#cancel-end").addEventListener("click", () => $("#end-form").classList.add("hidden"));
$("#end-form").addEventListener("submit", (event) => { event.preventDefault(); action(() => window.kovacs.endDay({ outcome: $("#day-outcome").value, output_summary: $("#day-output").value, validation_summary: $("#day-validation").value, lesson: $("#day-lesson").value })); });
$("#close").addEventListener("click", () => action(() => window.kovacs.close()));
