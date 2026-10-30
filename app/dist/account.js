import {createClient} from './supabase-client.js';
export const supabase=createClient('https://cigbalsmzvojxjdzbvcs.supabase.co','sb_publishable_t_oTq6araw-5zIhKSKL4jw_8fg7ygMY',{auth:{flowType:'pkce',storageKey:'team-progress:supabase-session',detectSessionInUrl:true}});
const ACCOUNT_KEY='team-progress:supabase-account';
let account=null,recovery=false;
supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){recovery=true;window.dispatchEvent(new Event('progress-password-recovery'));}});
export const recoveryRequired=()=>recovery;
export const currentAccount=()=>account;
export function forgetAccount(){account=null;localStorage.removeItem(ACCOUNT_KEY);}
export async function resolveAccount(){
 const {data,error}=await supabase.auth.getSession();if(error)throw error;
 if(!data.session){forgetAccount();return{account:null};}
 let user=data.session.user;
 if(navigator.onLine){const result=await supabase.auth.getUser();if(result.error)throw new Error('Deine Anmeldung konnte nicht geprüft werden. Bitte erneut anmelden.');user=result.data.user;}
 account={id:user.id,email:user.email||''};localStorage.setItem(ACCOUNT_KEY,JSON.stringify(account));return{account,offline:!navigator.onLine};
}
export function scopedKey(){if(!account)throw new Error('Bitte zuerst anmelden.');return 'team-progress:supabase-data:'+account.id;}
export const accountStorageKey=ACCOUNT_KEY;
export async function signOut(){const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;forgetAccount();}
export async function authenticate(mode,email,password){
 const redirectTo=location.origin+location.pathname;let result;
 if(mode==='login')result=await supabase.auth.signInWithPassword({email,password});
 else if(mode==='signup')result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
 else if(mode==='magic')result=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});
 else if(mode==='reset')result=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
 else if(mode==='password'){result=await supabase.auth.updateUser({password});if(!result.error)recovery=false;}
 else throw new Error('Ungültige Aktion.');
 if(result.error)throw result.error;return result.data;
}
export async function cloudRequest(method,body){
 const {data:{session}}=await supabase.auth.getSession();
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(!session)return response({},401);
 if(method==='GET'){
 const {data,error}=await supabase.from('progress_states').select('revision,payload').eq('user_id',session.user.id).maybeSingle();
 if(error)return response({error:error.message},error.code==='PGRST301'?401:503);
 return response({userId:session.user.id,revision:data?.revision||0,data:data?.payload||null});
 }
 if(body.userId!==session.user.id)return response({error:'account_changed'},409);
 const {data,error}=await supabase.rpc('save_progress',{expected_revision:body.revision,new_payload:body.data});
 if(error)return response({error:error.message},error.code==='40001'?409:error.code==='42501'?401:503);
 return response({revision:data});
}
