const $ = (selector) => document.querySelector(selector);
const shell = $('.shell');
let currentState = null;

function setBusy(value) { document.querySelectorAll('button').forEach((button) => { button.disabled = value; }); }
function showError(error) { const node=$('#error'); node.textContent=error?.message || String(error); node.classList.remove('hidden'); setTimeout(()=>node.classList.add('hidden'),7000); }
function render(state) {
  currentState = state; const status=state?.status || 'idle'; shell.dataset.state=status; $('#state-label').textContent=status.toUpperCase();
  const active=state && status!=='ended'; $('#start-panel').classList.toggle('hidden',Boolean(active)); $('#active-panel').classList.toggle('hidden',!active);
  if(state){ $('#active-objective').textContent=state.objective; }
  const descriptions={idle:['Standing by','Capture is off. Start the day when you are ready.'],observing:['Watching the work','Authorized windows only. Raw frames are not retained.'],paused:['Observation paused','No screen capture or reasoning is active.'],private:['Private mode','Capture is blocked until you resume.'],ended:['Day complete','The observer is stopped.']};
  const copy=descriptions[status]||descriptions.idle; $('#mode-title').textContent=copy[0]; $('#mode-detail').textContent=copy[1];
  $('#pause').classList.toggle('hidden',status!=='observing'); $('#private').classList.toggle('hidden',status!=='observing'); $('#observe').classList.toggle('hidden',status!=='observing'); $('#resume').classList.toggle('hidden',status==='observing');
}
function renderUpdate(update){ render(update.state); if(update.response){const box=$('#message');box.classList.remove('empty');box.innerHTML='';const label=document.createElement('span');label.textContent=`${update.response.profile.toUpperCase()} · ${update.response.intervention.assistance_level}`;const body=document.createElement('p');body.textContent=update.response.intervention.message;box.append(label,body);} else if(update.message){$('#mode-detail').textContent=update.message;} }
async function action(callback){setBusy(true);try{await callback();}catch(error){showError(error);}finally{setBusy(false);}}

window.kovacs.bootstrap().then(({state,settings,defaultProject})=>{ $('#project').value=state?.project||defaultProject; $('#main-goal').textContent=settings.main_goal; render(state); }).catch(showError);
window.kovacs.onUpdate(renderUpdate);
$('#start').addEventListener('click',()=>action(async()=>render(await window.kovacs.startDay($('#project').value,$('#objective').value))));
$('#pause').addEventListener('click',()=>action(async()=>render(await window.kovacs.setStatus('paused'))));
$('#private').addEventListener('click',()=>action(async()=>render(await window.kovacs.setStatus('private'))));
$('#resume').addEventListener('click',()=>action(async()=>render(await window.kovacs.setStatus('observing'))));
$('#observe').addEventListener('click',()=>action(()=>window.kovacs.observeNow()));
$('#end').addEventListener('click',()=>action(()=>window.kovacs.endDay()));
$('#close').addEventListener('click',()=>action(()=>window.kovacs.close()));
