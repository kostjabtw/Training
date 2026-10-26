const ACCOUNT_KEY='team-progress:account';
let account=null;
export const currentAccount=()=>account;
export function forgetAccount(){account=null;localStorage.removeItem(ACCOUNT_KEY);}
export async function resolveAccount(){
 if(!navigator.onLine){
  let saved;try{saved=JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'null');}catch{}
  if(saved&&typeof saved.id==='string'&&saved.id.length<=200){account=saved;return {account,offline:true};}
  return {account:null,offline:true};
 }
 const response=await fetch('./api/me',{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Anmeldung konnte nicht geprüft werden. Bitte erneut versuchen.');
 const result=await response.json();
 if(!result.user){forgetAccount();return {account:null,offline:false};}
 if(typeof result.user.id!=='string'||!result.user.id||result.user.id.length>200)throw new Error('Ungültige Anmeldung.');
 account={id:result.user.id,email:typeof result.user.email==='string'?result.user.email:''};
 localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));return {account,offline:false};
}
export function scopedKey(){if(!account)throw new Error('Bitte zuerst anmelden.');return 'team-progress:account-data:'+encodeURIComponent(account.id);}
export const accountStorageKey=ACCOUNT_KEY;
