import {env} from 'cloudflare:workers';
import {getEditor,isOwner,limited,digest,token} from '../../../lib/auth';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getEditor();
 if(!isOwner(user))return json({error:'Sign in with the tracker owner account to review requests.'},403);
 const {results}=await env.DB!.prepare('SELECT email,name,reason,status,requested_at,reviewed_at FROM access_requests ORDER BY requested_at DESC LIMIT 200').all();
 return json({requests:results});
}
export async function POST(req:Request){
 const raw=await req.text();
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid request origin.'},403);
 if(raw.length>4096)return json({error:'Request too large.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>254||!/^[-a-z0-9._+]+@[-a-z0-9.]+\.[a-z]+$/.test(email))return json({error:'Enter a valid email address.'},400);
 if(b.action==='request'){
  const name=typeof b.name==='string'?b.name.trim():'';
  const reason=typeof b.reason==='string'?b.reason.trim():'';
  if(!name||name.length>100||!reason||reason.length>1000)return json({error:'Enter your name (up to 100 characters) and reason (up to 1,000 characters).'},400);
  if(await limited('request-ip:'+(req.headers.get('cf-connecting-ip')||'local'),10)||await limited('request-email:'+email,3))return json({error:'Too many requests. Please try again in 15 minutes.'},429);
  await env.DB!.prepare("INSERT INTO access_requests(email,name,reason,requested_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,reason=excluded.reason,status='pending',requested_at=excluded.requested_at,reviewed_at=NULL,reviewed_by=NULL WHERE access_requests.status='declined'").bind(email,name,reason,new Date().toISOString()).run();
  return json({ok:true});
 }
 const user=await getEditor();
 if(!isOwner(user))return json({error:'Only the tracker owner can review requests.'},403);
 const request=await env.DB!.prepare('SELECT status FROM access_requests WHERE email=?').bind(email).first<{status:string}>();
 if(!request)return json({error:'Request not found.'},404);
 if(b.action!=='approve'&&b.action!=='decline')return json({error:'Unknown action.'},400);
 if(b.action==='decline'){
  if(request.status!=='pending')return json({error:'Only pending requests can be declined.'},409);
  await env.DB!.prepare("UPDATE access_requests SET status='declined',reviewed_at=?,reviewed_by=? WHERE email=? AND status='pending'").bind(new Date().toISOString(),user!.email,email).run();
  return json({ok:true});
 }
 const secret=token();
 await env.DB!.batch([
  env.DB!.prepare('INSERT INTO auth_users(email,setup_hash,setup_expires) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET setup_hash=excluded.setup_hash,setup_expires=excluded.setup_expires,disabled=0').bind(email,digest(secret),Date.now()+86400000),
  env.DB!.prepare("UPDATE access_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE email=?").bind(new Date().toISOString(),user!.email,email)
 ]);
 return json({ok:true,setupUrl:new URL('/setup',req.url).href+'#email='+encodeURIComponent(email)+'&token='+secret});
}
