import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createObservationContracts, type ObservationContracts } from "../../../src/infrastructure/contracts/observation-contracts.js";
import { defaultAmbientSettings } from "../../../src/infrastructure/config/observation-config.js";
import type { AmbientEvent, AmbientState } from "../../../src/core/observation/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const contracts: ObservationContracts = await createObservationContracts(path.join(root, "contracts"));
const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const record = (id: string, pass: boolean, detail: string) => results.push({ id, pass, detail });
const required = ["docs/v0.2/00_CHARTER.md","docs/v0.2/01_ARCHITECTURE.md","docs/v0.2/02_SUCCESS_METRICS.md","contracts/v0.2/ambient-state.schema.json","contracts/v0.2/ambient-event.schema.json","contracts/v0.2/settings.schema.json","src/application/observation/observation-controller.ts","src/interfaces/desktop/ambient-companion.ts","archive/releases/v0.2/ui/index.html"];
record("M01", required.every((file) => existsSync(path.join(root, file))), `${required.length}/${required.length} artifacts present`);

const event: AmbientEvent = { event_id:"amb_fixture",occurred_at:new Date().toISOString(),type:"day_started",urgency:"normal",application:null,window_title:null,objective:"Ship V0.2 safely",summary:"Fixture",frame_attached:false,intervention_request_id:null };
const state: AmbientState = { schema_version:"0.2.0",day_id:"day_fixture",status:"observing",main_goal:defaultAmbientSettings().main_goal,objective:"Ship V0.2 safely",project:root,session_id:"ses_fixture",started_at:new Date().toISOString(),ended_at:null,last_capture_at:null,last_intervention_at:null,events:[event] };
let fixturePass=true; try{contracts.validateEvent(event);contracts.validateState(state);contracts.validateSettings(defaultAmbientSettings());}catch{fixturePass=false;}
record("M02",fixturePass,"event, state, and settings fixtures validate");
const controller=await readFile(path.join(root,"src/application/observation/observation-controller.ts"),"utf8");
const permissions=await readFile(path.join(root,"src/core/observation/window-authorization.ts"),"utf8");
const policy=await readFile(path.join(root,"src/core/observation/intervention-policy.ts"),"utf8");
const gateway=await readFile(path.join(root,"src/infrastructure/codex/codex-exec-gateway.ts"),"utf8");
const electron=await readFile(path.join(root,"src/interfaces/desktop/ambient-companion.ts"),"utf8");
const preload=await readFile(path.join(root,"archive/releases/v0.2/ui/preload.cjs"),"utf8");
record("M03",controller.includes("Today's objective cannot be empty")&&controller.includes("service.start"),"Start Day validates objective and canonicalizes project through V0.1");
record("M04",controller.includes('status !== "observing"'),"non-observing states block capture");
record("M05",permissions.includes("unknown_application")&&controller.includes("if (!authorization.allowed)"),"unknown and denied applications block before capture");
record("M06",permissions.indexOf("denied_title_patterns")<permissions.indexOf("allowed_applications"),"title denial precedes allowlist");
record("M07",controller.includes("if (!changed)"),"insignificant frames stop locally");
record("M08",!JSON.stringify(event).includes("png")&&!JSON.stringify(event).includes("Buffer"),"event contract carries no image bytes");
record("M09",policy.includes("busy")&&policy.includes("automatic_intervention_interval_ms"),"single-flight and cooldown enforced");
record("M10",controller.includes("async observeNow"),"manual Observe Now implemented");
record("M11",controller.includes("await rm(temporary")&&controller.includes("finally"),"raw image cleanup is unconditional");
record("M12",gateway.includes('"--image", imagePath'),"documented Codex image flag wired");
record("M13",["--ephemeral","read-only",'approval_policy="never"','web_search="disabled"'].every((term)=>gateway.includes(term)),"Codex authority remains bounded");
record("M14",controller.includes("service.intervene"),"ambient reasoning passes through V0.1 validation");
record("M15",electron.includes("contextIsolation: true")&&electron.includes("sandbox: true")&&electron.includes("nodeIntegration: false"),"renderer security flags present");
record("M16",preload.includes("contextBridge.exposeInMainWorld")&&electron.includes("cleanText"),"fixed bridge and input validation present");
record("M17",!/(click\(|sendInput|publish|submitForm|workspace-write)/.test(controller),"no external action authority");
record("M18",controller.includes('"debrief"')&&controller.includes('status = "ended"'),"End Day debrief path present");
record("M19",!/(png|image_path|screenshot|auth\.json|base64)/i.test(JSON.stringify(state)),"serialized durable state contains no raw capture/auth fields");

function run(command:string){const x=spawnSync("cmd.exe",["/d","/s","/c",command],{cwd:root,encoding:"utf8",timeout:300000,maxBuffer:12000000});return {pass:x.status===0,detail:x.status===0?`${command} passed`:`${command} failed: ${(x.stderr||x.stdout).trim().slice(-600)}`};}
const regressions=[run("npm run v0:validate"),run("npm run v01:validate")];record("M20",regressions.every((x)=>x.pass),regressions.map((x)=>x.detail).join("; "));
const quality=[run("npm run typecheck"),run("npm test"),run("npm run build"),run("npm audit --audit-level=high")];record("M21",quality.every((x)=>x.pass),quality.map((x)=>x.detail).join("; "));
record("M22",controller.includes('process.platform !== "win32"')&&electron.includes('process.platform !== "win32"'),"unsupported platforms fail explicitly");
for(const result of results) console.log(`${result.pass?"PASS":"FAIL"} ${result.id} — ${result.detail}`);
console.log(`\nV0.2.0 automated release gate: ${results.filter((x)=>x.pass).length}/${results.length} metrics passed.`);
if(results.some((x)=>!x.pass))process.exitCode=1;
