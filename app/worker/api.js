export async function api(request, env) {
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 const path=new URL(request.url).pathname;
 if(path==='/api/health')return json({sync:!!env.DB});
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user)return json({error:'Anmeldung erforderlich.'},401);
 if(path!=='/api/sync')return json({error:'Not found'},404);
 if(!env.DB)return json({error:'Synchronisierung nicht eingerichtet.'},503);
 if(request.method==='GET'){
  const row=await env.DB.prepare('SELECT revision, payload FROM training_states WHERE user_id = ?').bind(user).first();
  return json(row?{revision:row.revision,data:JSON.parse(row.payload)}:{revision:0,data:null});
 }
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Ungültiger Ursprung.'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON erforderlich.'},415);
 if(Number(request.headers.get('Content-Length'))>2000000)return json({error:'Zu große Sicherung.'},413);
 const raw=await request.text();if(raw.length>2000000)return json({error:'Zu große Sicherung.'},413);
 let body,data;try{body=JSON.parse(raw);data=validateBackup(body.data);if(!Number.isInteger(body.revision)||body.revision<0)throw Error();}catch{return json({error:'Ungültige Daten.'},400);}
 data.active=null;
 const result=await env.DB.prepare('INSERT INTO training_states (user_id, revision, payload) VALUES (?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET revision = training_states.revision + 1, payload = excluded.payload WHERE training_states.revision = ?').bind(user,JSON.stringify(data),body.revision).run();
 if(!result.meta.changes)return json({error:'Parallel geändert.'},409);
 return json({revision:body.revision+1});
}
