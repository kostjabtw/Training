import {readFile,writeFile,mkdir,readdir,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
await rm(new URL('build/',root),{recursive:true,force:true});
await mkdir(new URL('build/server/',root),{recursive:true});await mkdir(new URL('build/.openai/',root),{recursive:true});
const assets={};const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
for(const name of await readdir(new URL('dist/',root))){const bytes=await readFile(new URL('dist/'+name,root));assets['/'+name]={body:bytes.toString('base64'),type:types[path.extname(name)]||'application/octet-stream'};}
assets['/']=assets['/index.html'];
const domain=(await read('dist/domain.js')).replace("import { plan } from './plan.js';",'');
const code=(await read('dist/plan.js'))+'\n'+domain+'\n'+await read('worker/api.js')+'\nconst assets='+JSON.stringify(assets)+`;\nexport default {async fetch(request,env){try{const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return await api(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const asset=assets[url.pathname];if(!asset)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});}catch{return new Response(JSON.stringify({error:'Dienst vorübergehend nicht verfügbar.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}}};`;
await writeFile(new URL('build/server/index.js',root),code);await copyFile(new URL('.openai/hosting.json',root),new URL('build/.openai/hosting.json',root));
console.log('Worker und eingebettete Web-App erstellt.');
