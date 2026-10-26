import { validateBackup, mergeStates } from './domain.js';
import { currentAccount } from './account.js';
export function createSync(c) {
 let stopped=false,running=false,timer,interval,controller,message='Cloud-Speicher wird verbunden …',dirty=false;
 const update=s=>{message=s;c.onStatus?.();};
 function stop(){stopped=true;clearTimeout(timer);clearInterval(interval);controller?.abort();}
 function authLost(){stop();c.onAuthLost?.();}
 async function run(){
  if(stopped||running||!currentAccount())return false;
  if(!navigator.onLine){update('Offline · Änderungen bleiben auf diesem Gerät und werden später hochgeladen.');return false;}
  running=true;controller=new AbortController();update('Wird in der Cloud gespeichert …');
  const userId=currentAccount().id;
  try{
   for(let attempt=0;attempt<3;attempt++){
    const response=await fetch('./api/sync',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
    if(response.status===401){authLost();return false;}
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Cloud derzeit nicht erreichbar · Änderungen bleiben auf diesem Gerät.');
    const remote=await response.json();
    if(remote.userId!==userId||currentAccount()?.id!==userId){authLost();return false;}
    const original=JSON.stringify(c.getState());
    const merged=remote.data?mergeStates(c.getState(),validateBackup(remote.data)):c.getState();
    const result=await fetch('./api/sync',{method:'PUT',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,revision:remote.revision,data:{...merged,active:null}})});
    if(result.status===401){authLost();return false;}
    if(result.status===409){const error=await result.json();if(error.error==='account_changed'){authLost();return false;}continue;}
    if(!result.ok)throw new Error('Cloud-Speichern fehlgeschlagen · Änderungen bleiben auf diesem Gerät.');
    if(stopped||currentAccount()?.id!==userId)return false;
    if(JSON.stringify(c.getState())===original){c.save(merged);c.setState(merged);dirty=false;if(!c.isBusy())c.render();update('In der Cloud gespeichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));}
    else schedule();
    return true;
   }
   update('Parallel geändert · Der nächste Abgleich erfolgt automatisch.');return false;
  }catch(error){if(!stopped)update(error.message||'Cloud-Speichern fehlgeschlagen.');return false;}
  finally{running=false;}
 }
 function schedule(){if(!stopped){dirty=true;update(navigator.onLine?'Auf diesem Gerät gespeichert · Cloud-Abgleich ausstehend …':'Offline · Änderungen bleiben auf diesem Gerät.');clearTimeout(timer);timer=setTimeout(run,1200);}}
 function start(){run();window.addEventListener('online',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped)run();});interval=setInterval(()=>{if(!document.hidden)run();},30000);}
 return{start,run,schedule,stop,enabled:()=>!stopped,status:()=>message,pending:()=>dirty};
}
