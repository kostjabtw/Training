import { validateBackup, mergeStates } from './domain.js';
export function createSync(c) {
 let on=false, running=false, timer, message='Ausgeschaltet. Deine Daten werden lokal gespeichert.';
 try {on=localStorage.getItem('team-progress:sync')==='on';}catch{}
 const update=s=>{message=s;c.onStatus?.();};
 async function run(){
  if(!on||running)return;
  if(!navigator.onLine){update('Offline. Änderungen werden beim nächsten Abgleich übertragen.');return;}
  running=true;update('Daten werden abgeglichen …');
  try{
   for(let attempt=0;attempt<3;attempt++){
    const response=await fetch('./api/sync',{headers:{Accept:'application/json'},cache:'no-store'});
    if(response.status===401){update('Bitte mit deinem ChatGPT-Konto anmelden.');return;}
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Cloud-Abgleich derzeit nicht erreichbar. Deine Daten bleiben lokal erhalten.');
    const remote=await response.json(), original=JSON.stringify(c.getState());
    const merged=remote.data?mergeStates(c.getState(),validateBackup(remote.data)):c.getState();
    const data={...merged,active:null};
    const result=await fetch('./api/sync',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:remote.revision,data})});
    if(result.status===409)continue;
    if(!result.ok)throw new Error('Cloud-Abgleich fehlgeschlagen. Deine Daten bleiben lokal erhalten.');
    if(JSON.stringify(c.getState())===original){c.save(merged);c.setState(merged);if(!c.isBusy())c.render();}
    else schedule();
    update('Synchronisiert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));return;
   }
   update('Parallel auf einem anderen Gerät geändert. Bitte erneut abgleichen.');
  }catch(error){update(error.message||'Abgleich fehlgeschlagen. Lokale Daten bleiben erhalten.');}
  finally{running=false;}
 }
 function schedule(){if(on){clearTimeout(timer);timer=setTimeout(run,1500);}}
 function toggle(){on=!on;try{localStorage.setItem('team-progress:sync',on?'on':'off');}catch{}if(on)run();else{clearTimeout(timer);update('Ausgeschaltet. Deine Daten werden lokal gespeichert.');}}
 function start(){if(on)run();window.addEventListener('online',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});setInterval(()=>{if(on&&!document.hidden)run();},60000);}
 return{start,run,schedule,toggle,enabled:()=>on,status:()=>message};
}
