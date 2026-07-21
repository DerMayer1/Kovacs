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
    $("#usage-health").textContent = `${operating.usage_today.failed_invocations + operating.usage_today.interrupted_invocations} failures`;
  }
}

function renderRecovery() {
  const target = $("#recovery"), recovery = operating?.recovery;
  if (!recovery || (!recovery.resumed_day_id && !recovery.interrupted_invocations && !recovery.pending_draft_kind)) { target.classList.add("hidden"); target.textContent = ""; return; }
  const parts = [];
  if (recovery.resumed_day_id) parts.push("An unfinished day was recovered. Observation remains paused until you explicitly resume.");
  if (recovery.pending_draft_kind) parts.push(`A ${recovery.pending_draft_kind} proposal is still waiting for review.`);
  if (recovery.interrupted_invocations) parts.push(`${recovery.interrupted_invocations} interrupted Codex invocation was marked failed.`);
  target.textContent = parts.join(" "); target.classList.remove("hidden");
}

function addRejectControl(container, draftId) {
  const details = node("details", "inline-control"), summary = node("summary", "", "REJECT PROPOSAL"), reason = node("textarea");
  reason.rows = 2; reason.maxLength = 1000; reason.placeholder = "Why this proposal should not become active";
  const reject = node("button", "danger", "REJECT & KEEP INACTIVE"); reject.addEventListener("click", () => action(() => window.kovacs.rejectDraft(draftId, reason.value)));
  details.append(summary, reason, reject); container.append(details);
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
  if (proposal.proposal.interpreted_profile) {
    const profile = proposal.proposal.interpreted_profile, interpretation = node("div", "interpretation-grid");
    const fields = [["CURRENT POSITION", profile.current_position], ["HOURS / WEEK", profile.available_hours_per_week], ["ACTIVE PROJECTS", profile.active_projects], ["GROWTH EDGES", profile.growth_edges], ["90-DAY OUTCOME", profile.desired_outcome]];
    fields.forEach(([label, item]) => {
      const card = node("div", "interpretation-item"), value = Array.isArray(item.value) ? item.value.join(" · ") : item.value;
      card.append(node("span", "", label), node("strong", "", value === null ? "Not established" : String(value)), node("small", "", `${labelize(item.source)} · ${Math.round(item.confidence * 100)}% — ${item.rationale}`)); interpretation.append(card);
    });
    container.append(node("span", "micro-label", "KOVACS' INTERPRETATION"), interpretation);
    if (proposal.proposal.assumptions?.length) { container.append(node("span", "micro-label", "ASSUMPTIONS TO VERIFY")); appendList(container, proposal.proposal.assumptions); }
    if (proposal.proposal.clarification_questions?.length) { container.append(node("span", "micro-label", "CONSEQUENTIAL QUESTIONS")); appendList(container, proposal.proposal.clarification_questions); }
    container.append(node("span", "micro-label", `DRAFT REVISION ${proposal.revision || 1}`));
    const correction = node("details", "inline-control"), correctionSummary = node("summary", "", "CORRECT INTERPRETED FACTS LOCALLY");
    const controls = {};
    const correctionFields = [
      ["current_position", "CURRENT POSITION", "text"], ["available_hours_per_week", "HOURS / WEEK", "number"],
      ["active_projects", "ACTIVE PROJECTS — ONE PER LINE", "list"], ["growth_edges", "GROWTH EDGES — ONE PER LINE", "list"],
      ["desired_outcome", "DESIRED 90-DAY OUTCOME", "text"],
    ];
    correctionFields.forEach(([key, label, kind]) => {
      const interpreted = profile[key], input = kind === "number" ? node("input") : node("textarea");
      if (kind === "number") { input.type = "number"; input.min = "1"; input.max = "100"; }
      else input.rows = kind === "list" ? 3 : 2;
      input.value = Array.isArray(interpreted.value) ? interpreted.value.join("\n") : interpreted.value ?? "";
      const unknownLabel = node("label", "unknown-control"), unknown = node("input"); unknown.type = "checkbox"; unknown.checked = interpreted.value === null;
      unknownLabel.append(unknown, document.createTextNode(" Explicitly keep this value unknown"));
      correction.append(node("label", "", label), input, unknownLabel); controls[key] = { input, unknown, kind };
    });
    const correctionReason = node("textarea"); correctionReason.rows = 2; correctionReason.placeholder = "Why these facts are being confirmed or corrected";
    const saveFacts = node("button", "", "SAVE FACT CORRECTIONS — NO CODEX CALL");
    saveFacts.addEventListener("click", () => {
      const values = {}, unknowns = [];
      Object.entries(controls).forEach(([key, control]) => {
        if (control.unknown.checked) { unknowns.push(key); return; }
        if (control.kind === "list") values[key] = control.input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
        else if (control.kind === "number") values[key] = Number(control.input.value);
        else values[key] = control.input.value.trim();
      });
      action(() => window.kovacs.correctSetupDraft(proposal.draft_id, values, unknowns, correctionReason.value));
    });
    correction.append(node("label", "", "CORRECTION REASON"), correctionReason, saveFacts); container.append(correction);
    if (proposal.proposal.clarification_questions?.length) {
      const refinement = node("details", "inline-control"), refinementSummary = node("summary", "", "ANSWER QUESTIONS & REINTERPRET");
      const answers = proposal.proposal.clarification_questions.map((question) => { const answer = node("textarea"); answer.rows = 2; answer.placeholder = question; refinement.append(node("label", "", question), answer); return { question, answer }; });
      const questions = Array.from(refinement.childNodes);
      const refine = node("button", "primary", "REINTERPRET WITH ONE CODEX CALL");
      refine.addEventListener("click", () => action(() => window.kovacs.refineSetupDraft(
        proposal.draft_id,
        answers.filter((item) => item.answer.value.trim()).map((item) => ({ question: item.question, answer: item.answer.value.trim() })),
      )));
      refinement.append(refinementSummary, ...questions, refine); container.append(refinement);
    }
  }
  container.append(node("span", "micro-label", "SUCCESS EVIDENCE")); appendList(container, proposal.proposal.mission_success_criteria);
  container.append(node("span", "micro-label", "FIRST ROLLING WEEK"), node("p", "proposal-outcome", proposal.proposal.weekly_outcome)); appendList(container, proposal.proposal.weekly_success_criteria);
  const competencies = node("p", "tags"); proposal.proposal.weekly_competencies.forEach((value) => competencies.append(node("b", "", labelize(value)))); container.append(competencies);
  container.append(node("p", "approval-note", "Confirming stores the goal, available time, current position, projects, and growth edges as visible local memories. Growth edges are marked sensitive."));
  const confirm = node("button", "primary full", "CONFIRM OPERATING SYSTEM"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmSetup(proposal.draft_id))); container.append(confirm);
  const editor = node("details", "inline-control"), editorSummary = node("summary", "", "EDIT PROPOSAL LOCALLY"), mission = node("textarea"), missionCriteria = node("textarea"), week = node("textarea"), weekCriteria = node("textarea"), editReason = node("textarea");
  mission.rows = 2; mission.value = proposal.proposal.mission_title; missionCriteria.rows = 3; missionCriteria.value = proposal.proposal.mission_success_criteria.join("\n"); week.rows = 2; week.value = proposal.proposal.weekly_outcome; weekCriteria.rows = 3; weekCriteria.value = proposal.proposal.weekly_success_criteria.join("\n"); editReason.rows = 2; editReason.placeholder = "Why the proposal changed";
  const save = node("button", "", "SAVE EDITS"); save.addEventListener("click", () => action(() => window.kovacs.reviseSetupDraft(proposal.draft_id, { ...proposal.proposal, mission_title: mission.value.trim(), mission_success_criteria: missionCriteria.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), weekly_outcome: week.value.trim(), weekly_success_criteria: weekCriteria.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) }, editReason.value)));
  editor.append(editorSummary, mission, missionCriteria, week, weekCriteria, editReason, save); container.append(editor);
  addRejectControl(container, proposal.draft_id);
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
  const editor = node("details", "inline-control"), editorSummary = node("summary", "", "EDIT PROPOSAL LOCALLY"), outcome = node("textarea"), criteria = node("textarea"), editReason = node("textarea");
  outcome.rows = 2; outcome.value = proposal.proposal.primary_outcome; criteria.rows = 3; criteria.value = proposal.proposal.success_criteria.join("\n"); editReason.rows = 2; editReason.placeholder = "Why the proposal changed";
  const save = node("button", "", "SAVE EDITS"); save.addEventListener("click", () => action(() => window.kovacs.reviseWeekDraft(proposal.draft_id, { ...proposal.proposal, primary_outcome: outcome.value.trim(), success_criteria: criteria.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) }, editReason.value)));
  editor.append(editorSummary, outcome, criteria, editReason, save); container.append(editor);
  addRejectControl(container, proposal.draft_id);
}

function renderDayProposal() {
  const proposal = operating.pending_day, container = $("#day-proposal");
  if (!proposal) { container.classList.add("hidden"); clear(container); return; }
  proposalShell(container, proposal.proposal.objective_changed ? "OBJECTIVE CHALLENGED" : "PROPOSED DAY", proposal.proposal.proposed_objective, proposal.proposal.rationale, proposal.proposal.warnings);
  container.append(node("span", "micro-label", "SUCCESS EVIDENCE")); appendList(container, proposal.proposal.success_criteria);
  const steps = node("div", "proposal-steps"); proposal.proposal.checkpoints.forEach((checkpoint, index) => { const step = node("div", "proposal-step"); step.append(node("i", "", String(index + 1)), node("strong", "", checkpoint.title), node("p", "", checkpoint.evidence_required)); steps.append(step); }); container.append(steps);
  const confirm = node("button", "primary full", "APPROVE & START DAY"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmDay(proposal.draft_id))); container.append(confirm);
  const note = node("p", "approval-note", "Approval is required because the objective and checkpoints become the active operating contract."); container.append(note);
  const editor = node("details", "inline-control"), editorSummary = node("summary", "", "EDIT PROPOSAL LOCALLY");
  const objective = node("textarea"); objective.rows = 2; objective.maxLength = 1000; objective.value = proposal.proposal.proposed_objective;
  const criteria = node("textarea"); criteria.rows = 3; criteria.value = proposal.proposal.success_criteria.join("\n"); criteria.placeholder = "One success criterion per line";
  const checkpointInputs = proposal.proposal.checkpoints.map((checkpoint) => {
    const row = node("div", "proposal-step"), title = node("textarea"), evidence = node("textarea");
    title.rows = 1; title.value = checkpoint.title; evidence.rows = 2; evidence.value = checkpoint.evidence_required;
    row.append(title, evidence); return { row, title, evidence, competency: checkpoint.competency };
  });
  const editReason = node("textarea"); editReason.rows = 2; editReason.placeholder = "Why the proposal changed";
  const save = node("button", "", "SAVE EDITS"); save.addEventListener("click", () => action(() => window.kovacs.reviseDayDraft(proposal.draft_id, {
    ...proposal.proposal, proposed_objective: objective.value.trim(), objective_changed: true,
    success_criteria: criteria.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    checkpoints: checkpointInputs.map((item) => ({ title: item.title.value.trim(), evidence_required: item.evidence.value.trim(), competency: item.competency })),
  }, editReason.value)));
  editor.append(editorSummary, objective, criteria); checkpointInputs.forEach((item) => editor.append(item.row)); editor.append(editReason, save); container.append(editor);
  addRejectControl(container, proposal.draft_id);
}

function renderActiveDay() {
  const day = operating.active_day, active = Boolean(day);
  $("#day-start").classList.toggle("hidden", active || Boolean(operating.pending_day) || Boolean(operating.pending_week));
  $("#active-day").classList.toggle("hidden", !active);
  if (!day) return;
  $("#active-objective").textContent = day.objective;
  $("#revised-objective").value = day.objective;
  const complete = day.checkpoints.filter((checkpoint) => checkpoint.status === "completed").length;
  $("#progress").textContent = `${complete}/${day.checkpoints.length} checkpoints evidenced`;
  const container = $("#checkpoints"); clear(container);
  day.checkpoints.forEach((checkpoint) => {
    const item = node("div", `checkpoint ${checkpoint.status}`);
    const marker = node("i", "", checkpoint.status === "completed" ? "✓" : String(checkpoint.position + 1));
    const copy = node("div"); copy.append(node("strong", "", checkpoint.title), node("p", "", checkpoint.evidence_required), node("span", "", labelize(checkpoint.competency)));
    item.append(marker, copy);
    if (checkpoint.status === "active") {
      const controls = node("div", "checkpoint-actions"), record = node("button", "tiny", "RECORD"); record.addEventListener("click", () => $("#checkpoint-form").classList.remove("hidden")); controls.append(record);
      const reason = node("textarea"); reason.rows = 1; reason.maxLength = 1000; reason.placeholder = "Reason to block, defer, or abandon";
      ["blocked", "deferred", "abandoned"].forEach((status) => { const button = node("button", "tiny", status.toUpperCase()); button.addEventListener("click", () => action(() => window.kovacs.transitionCheckpoint(checkpoint.checkpoint_id, status, reason.value))); controls.append(button); });
      copy.append(reason, controls);
    }
    if (checkpoint.status === "blocked" || checkpoint.status === "deferred") {
      const resume = node("button", "tiny", "MAKE ACTIVE"); resume.addEventListener("click", () => action(() => window.kovacs.transitionCheckpoint(checkpoint.checkpoint_id, "active", "User resumed this checkpoint"))); copy.append(resume);
    }
    if (checkpoint.status_reason) copy.append(node("small", "", checkpoint.status_reason));
    container.append(item);
  });
  const status = ambient?.status;
  $("#pause").classList.toggle("hidden", status !== "observing"); $("#private").classList.toggle("hidden", status !== "observing"); $("#observe").classList.toggle("hidden", status !== "observing"); $("#resume").classList.toggle("hidden", status === "observing");
}

function renderEndDayProposal() {
  const draft = operating.pending_end_day, container = $("#end-proposal");
  if (!draft) { container.classList.add("hidden"); clear(container); return; }
  const proposal = draft.proposal;
  proposalShell(container, "PROPOSED END DAY", labelize(proposal.outcome), proposal.narrative_summary, proposal.missing_proof || []);
  const facts = node("div", "interpretation-grid");
  [["OUTPUT", proposal.output_summary], ["VALIDATION", proposal.validation_summary], ["EVIDENCE SOURCE", labelize(proposal.evidence_source)], ["LESSON", proposal.lesson]].forEach(([label, value]) => {
    const item = node("div", "interpretation-item"); item.append(node("span", "", label), node("strong", "", value)); facts.append(item);
  });
  container.append(facts);
  if (proposal.carry_forward.length) { container.append(node("span", "micro-label", "CARRY FORWARD")); appendList(container, proposal.carry_forward); }
  if (proposal.assumptions.length) { container.append(node("span", "micro-label", "ASSUMPTIONS")); appendList(container, proposal.assumptions); }
  container.append(node("p", "approval-note", "Confirming closes observation, records the structured evidence, and retains the lesson locally. Until then, the day remains active."));
  const confirm = node("button", "danger solid full", "CONFIRM & END DAY"); confirm.addEventListener("click", () => action(() => window.kovacs.confirmEndDay(draft.draft_id))); container.append(confirm);
  const reject = node("button", "tiny danger", "REJECT INTERPRETATION"); reject.addEventListener("click", () => action(() => window.kovacs.rejectEndDay(draft.draft_id, "User rejected the End Day interpretation"))); container.append(reject);
}

function renderCompetencies() {
  const container = $("#competencies"); clear(container);
  operating.competencies.forEach((item) => {
    const card = node("div", "competency"); const top = node("div"); top.append(node("strong", "", labelize(item.competency)), node("b", `level ${item.level}`, labelize(item.level))); card.append(top);
    const meter = node("div", "meter"); const fill = node("i"); fill.style.width = `${Math.round(item.confidence * 100)}%`; meter.append(fill); card.append(meter, node("p", "", item.evidence_count ? `${item.evidence_count} sourced evidence record${item.evidence_count === 1 ? "" : "s"}` : "No evidence yet")); container.append(card);
  });
}

function renderEvidence() {
  const container = $("#evidence-history"); clear(container);
  if (!operating.recent_evidence.length) { container.append(node("p", "empty-copy", "No evidence recorded yet.")); return; }
  operating.recent_evidence.forEach((evidence) => {
    const card = node("article", "memory"), meta = node("div", "memory-meta"); meta.append(node("span", "", labelize(evidence.competency)), node("b", "", labelize(evidence.source)));
    card.append(meta, node("p", "", evidence.summary));
    if (evidence.validation) card.append(node("small", "", evidence.validation));
    if (evidence.source === "self_reported" || evidence.source === "observed") { const review = node("button", "tiny", "MARK REVIEWED"); review.addEventListener("click", () => action(() => window.kovacs.reviewEvidence(evidence.evidence_id))); card.append(review); }
    container.append(card);
  });
}

function renderMemories() {
  const container = $("#memories"); clear(container);
  $("#delete-day-memories").classList.toggle("hidden", !operating.active_day);
  $("#delete-session-memories").classList.toggle("hidden", !ambient?.session_id);
  if (!operating.memories.length) { container.append(node("p", "empty-copy", "No durable memory exists yet.")); return; }
  operating.memories.forEach((memory) => {
    const card = node("article", `memory ${memory.status}`); const meta = node("div", "memory-meta"); meta.append(node("span", "", labelize(memory.kind)), node("b", "", memory.status === "pending_confirmation" ? "REVIEW" : memory.pinned ? "PINNED" : memory.source.toUpperCase()));
    card.append(meta, node("p", "", memory.claim)); const actions = node("div", "memory-actions");
    if (memory.status === "pending_confirmation") { const confirm = node("button", "tiny", "CONFIRM"); confirm.addEventListener("click", () => action(() => window.kovacs.setMemoryStatus(memory.memory_id, "active"))); actions.append(confirm); }
    const pin = node("button", "tiny", memory.pinned ? "UNPIN" : "PIN"); pin.addEventListener("click", () => action(() => window.kovacs.setMemoryPinned(memory.memory_id, !memory.pinned)));
    const remove = node("button", "tiny danger", "DELETE"); remove.addEventListener("click", () => action(() => window.kovacs.deleteMemory(memory.memory_id))); actions.append(pin, remove); card.append(actions); container.append(card);
  });
}

function renderContextDiagnostics() {
  const container = $("#context-decisions"); clear(container);
  const decisions = operating.context_diagnostics || [];
  if (!decisions.length) { container.append(node("p", "empty-copy", "No context decisions have been recorded yet.")); return; }
  decisions.forEach((decision) => {
    const card = node("article", `context-decision ${decision.decision}`), meta = node("div", "memory-meta");
    meta.append(node("span", "", `${decision.decision.toUpperCase()} · ${labelize(decision.reason)}`), node("b", "", `${Math.round(decision.confidence * 100)}%`));
    const path = decision.perception_path.replaceAll("_", " → ").toUpperCase();
    const delta = decision.changed_fields.length ? decision.changed_fields.map(labelize).join(" · ") : "No semantic delta";
    const security = decision.screenshot_blocked_reason ? ` · image blocked: ${labelize(decision.screenshot_blocked_reason)}` : decision.image_attached ? " · image attached" : " · no image";
    const sensitive = decision.sensitive_categories?.length ? ` · protected: ${decision.sensitive_categories.map(labelize).join(", ")}` : "";
    card.append(meta, node("p", "", `${decision.application} · ${path}`), node("small", "", `${delta}${security}${sensitive}`));
    container.append(card);
  });
  const retrievals = $("#retrieval-diagnostics"); clear(retrievals);
  const diagnostics = operating.retrieval_diagnostics || [];
  if (!diagnostics.length) retrievals.append(node("p", "empty-copy", "No memory retrieval decision has been recorded yet."));
  diagnostics.forEach((diagnostic) => {
    const card = node("article", "context-decision"), meta = node("div", "memory-meta");
    meta.append(node("span", "", labelize(diagnostic.retrieval_path)), node("b", "", `${diagnostic.results.length} result${diagnostic.results.length === 1 ? "" : "s"}`));
    card.append(meta, node("p", "", diagnostic.project || "Global context"), node("small", "", diagnostic.results.map((item) => `${item.memory_id.slice(0, 12)} · ${item.score.toFixed(2)} · ${item.provenance}`).join("\n") || "No eligible memory"));
    retrievals.append(card);
  });
}

function render(message) {
  renderMode(message);
  renderRecovery();
  const configured = Boolean(operating?.profile);
  $("#setup-view").classList.toggle("hidden", configured);
  $("#tabs").classList.toggle("hidden", !configured);
  if (!configured) { renderSetup(); return; }
  ["today", "growth", "memory", "context"].forEach((name) => $("#" + name + "-view").classList.toggle("hidden", currentTab !== name));
  document.querySelectorAll("#tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === currentTab));
  renderHierarchy(); renderWeekProposal(); renderDayProposal(); renderActiveDay(); renderEndDayProposal(); renderCompetencies(); renderEvidence(); renderMemories(); renderContextDiagnostics();
}

window.kovacs.bootstrap().then((data) => { ambient = data.ambient; operating = data.operating; defaultProject = data.defaultProject; $("#project").value = operating.active_day?.project || defaultProject; $("#memory-days").value = operating.retention.memory_retention_days ?? ""; $("#sensitive-days").value = operating.retention.sensitive_memory_retention_days; render(); }).catch(showError);
window.kovacs.onUpdate((update) => { ambient = update.ambient; operating = update.operating; if (update.response) { const box = $("#intervention"); box.classList.remove("empty"); clear(box); box.append(node("span", "", `${update.response.profile.toUpperCase()} · ${update.response.intervention.assistance_level}`), node("p", "", update.response.intervention.message), node("small", "", update.response.checkpoint)); const actions = node("div", "feedback-actions"); [["useful", "USEFUL"], ["not_useful", "NOT USEFUL"], ["wrong_context", "WRONG CONTEXT"], ["unnecessary_interruption", "INTERRUPTED"], ["already_known", "ALREADY KNEW"]].forEach(([kind, label]) => { const button = node("button", "tiny", label); button.addEventListener("click", () => action(() => window.kovacs.feedback(update.response.request_id, kind))); actions.append(button); }); const expand = node("button", "tiny", "EXPAND"); expand.addEventListener("click", () => action(async () => { await window.kovacs.feedback(update.response.request_id, "expanded"); return window.kovacs.observeNow(); })); actions.append(expand); box.append(actions); } render(update.message); });

document.querySelectorAll("#tabs button").forEach((button) => button.addEventListener("click", () => { currentTab = button.dataset.tab; render(); }));
$("#draft-setup").addEventListener("click", () => action(() => window.kovacs.draftSetup({ narrative: $("#setup-narrative").value })));
$("#draft-week").addEventListener("click", () => action(() => window.kovacs.draftWeek({ priorities: $("#week-priorities").value, constraints: $("#week-constraints").value })));
$("#draft-day").addEventListener("click", () => action(() => window.kovacs.draftDay($("#project").value || defaultProject, $("#objective").value)));
$("#pause").addEventListener("click", () => action(() => window.kovacs.setStatus("paused")));
$("#private").addEventListener("click", () => action(() => window.kovacs.setStatus("private")));
$("#resume").addEventListener("click", () => action(() => window.kovacs.setStatus("observing")));
$("#observe").addEventListener("click", () => action(() => window.kovacs.observeNow()));
$("#cancel-checkpoint").addEventListener("click", () => $("#checkpoint-form").classList.add("hidden"));
$("#checkpoint-form").addEventListener("submit", (event) => { event.preventDefault(); const checkpoint = operating.active_day.checkpoints.find((item) => item.status === "active"); if (!checkpoint) return showError(new Error("No active checkpoint.")); action(async () => { const result = await window.kovacs.completeCheckpoint({ checkpoint_id: checkpoint.checkpoint_id, outcome: $("#checkpoint-outcome").value, result: $("#checkpoint-result").value, validation: $("#checkpoint-validation").value, assistance_level: $("#assistance").value, evidence_source: $("#checkpoint-source").value }); $("#checkpoint-form").classList.add("hidden"); $("#checkpoint-result").value = ""; $("#checkpoint-validation").value = ""; return result; }); });
$("#save-objective").addEventListener("click", () => action(() => window.kovacs.reviseObjective($("#revised-objective").value, $("#objective-reason").value)));
$("#open-end").addEventListener("click", () => $("#end-form").classList.remove("hidden")); $("#cancel-end").addEventListener("click", () => $("#end-form").classList.add("hidden"));
$("#end-form").addEventListener("submit", (event) => { event.preventDefault(); action(async () => { const result = await window.kovacs.draftEndDay($("#end-narrative").value); $("#end-form").classList.add("hidden"); return result; }); });
$("#save-retention").addEventListener("click", () => action(() => window.kovacs.setRetention($("#memory-days").value ? Number($("#memory-days").value) : null, Number($("#sensitive-days").value))));
$("#backup").addEventListener("click", () => action(async () => { const result = await window.kovacs.backup(); $("#backup-result").textContent = `Database: ${result.database} · JSON: ${result.export}`; }));
$("#delete-day-memories").addEventListener("click", () => { if (operating.active_day && window.confirm("Delete every unpinned memory attributed to the current day?")) action(() => window.kovacs.deleteMemoriesByDay(operating.active_day.day_id)); });
$("#delete-session-memories").addEventListener("click", () => { if (ambient?.session_id && window.confirm("Delete every unpinned memory attributed to the current observation session?")) action(() => window.kovacs.deleteMemoriesBySession(ambient.session_id)); });
$("#close").addEventListener("click", () => action(() => window.kovacs.close()));
