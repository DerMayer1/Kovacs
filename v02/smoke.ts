import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAmbientContracts } from "../src/v02/contracts.js";
import { defaultAmbientSettings } from "../src/v02/config.js";
import { AmbientStateStore } from "../src/v02/state-store.js";
import { AmbientController } from "../src/v02/controller.js";
import type { KovacsService } from "../src/v01/service.js";
import type { ProfileResponse } from "../src/v01/types.js";

if(process.platform!=="win32")throw new Error("V0.2 smoke is Windows-only.");
const root=path.resolve("."),temporary=await mkdtemp(path.join(os.tmpdir(),"kovacs-v02-smoke-")),project=path.join(temporary,"project");await mkdir(project);
const response=(profile:"coach"|"debrief",index:number):ProfileResponse=>({schema_version:"0.1.0",request_id:`req_smoke_${index}`,profile,recommendation:"display",assessment:"Authorized evidence supports a bounded intervention.",intervention:{type:profile==="debrief"?"debrief":"hint",message:"Verify the next observable behavior.",assistance_level:"A2",contains_complete_solution:false},reason:"Evidence before action.",observed_context:["Authorized window"],checkpoint:"Report the result.",memory_candidates:[],external_action_requests:[]});
let calls=0;const service={start:async(p:string,t:string)=>({schema_version:"0.1.0",session_id:"ses_smoke",project:path.resolve(p),task:t,mode:"training",status:"active",started_at:new Date().toISOString(),ended_at:null,events:[]}),intervene:async(_s:string,profile:"coach"|"debrief")=>({response:response(profile,++calls),cached:false,redaction_count:0,context_truncated:false,gateway_duration_ms:1})};
try{const contracts=await createAmbientContracts(path.join(root,"contracts"));const store=new AmbientStateStore(path.join(temporary,"data"),contracts);const controller=new AmbientController(service as unknown as KovacsService,store,{...defaultAmbientSettings(),automatic_intervention_interval_ms:30000},{getActiveWindow:async()=>({application:"Code.exe",title:"V0.2 smoke",windowId:1})},{capture:async()=>({sample:Buffer.alloc(64,200),png:Buffer.from("raw-frame-fixture")})});await controller.initialize();await controller.startDay(project,"Prove the ambient lifecycle");await controller.tick();await controller.setStatus("paused");const paused=controller.getState()?.last_capture_at;await controller.tick();await controller.setStatus("private");await controller.tick();await controller.setStatus("observing");await controller.endDay();const state=controller.getState();const serialized=JSON.stringify(state);const checks={windows_platform:true,coach_intervention:calls>=1,pause_private_blocked:state?.last_capture_at===paused,ended:state?.status==="ended",no_raw_event_data:!serialized.includes("raw-frame-fixture")&&!serialized.includes("active-window.png")};console.log(JSON.stringify({checks,state},null,2));if(Object.values(checks).some((x)=>!x))process.exitCode=1;}finally{await rm(temporary,{recursive:true,force:true});}
