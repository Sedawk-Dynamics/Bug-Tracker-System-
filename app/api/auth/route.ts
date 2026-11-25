import { env } from '../../../lib/env';
import { publicOrigin,clientIp } from '../../../lib/request';
import { digest,token,hashPassword,verifyPassword,limited,clearLimit,sessionCookie } from '../../../lib/auth';
export const dynamic='force-dynamic';
const json=(body:any,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
export async function POST(req:Request){
 const raw=await req.text();
 if(req.headers.get('origin')!==publicOrigin(req))return json({error:'Invalid request origin.'},403);
 if(raw.length>4096)return json({error:'Request too large.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
 if(!b||typeof b!=='object')return json({error:'Invalid request.'},400);
 if(b.action==='logout'){const cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-tracker='))?.slice(15);if(cookie)await env.DB.prepare('DELETE FROM auth_sessions WHERE hash=?').bind(digest(cookie)).run();return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)})}
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(!email||email.length>254||typeof b.password!=='string'||b.password.length>128)return json({error:'Enter your email and password.'},400);
 // Counted per account and address, so a stranger's failed attempts cannot lock out the real owner.
 const ip=clientIp(req),attempt='login:'+email+'|'+ip;
 if(await limited('ip:'+ip,50)||await limited(attempt,10))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const user=await env.DB.prepare('SELECT * FROM auth_users WHERE email=? AND disabled=0').bind(email).first<any>();
 if(b.action==='setup'){
 if(b.password.length<15)return json({error:'Use a password of at least 15 characters.'},400);
 if(!user||typeof b.token!=='string'||!user.setup_hash||digest(b.token)!==user.setup_hash||user.setup_expires<Date.now())return json({error:'This setup link is invalid or expired. Ask the owner for a new link.'},400);
 const stored=await hashPassword(b.password);
 const result=await env.DB.prepare('UPDATE auth_users SET password=?,setup_hash=NULL,setup_expires=NULL WHERE email=? AND setup_hash=? RETURNING email').bind(stored,email,user.setup_hash).first();if(!result)return json({error:'This setup link has already been used.'},409);
 await env.DB.prepare('DELETE FROM auth_sessions WHERE email=?').bind(email).run();
 }else if(b.action==='login'){
 const dummy='00000000000000000000000000000000:'+ '00'.repeat(32);
 const valid=await verifyPassword(b.password,user?.password||dummy);if(!user?.password||!valid)return json({error:'Email or password is incorrect.'},401);
 }else return json({error:'Unknown action.'},400);
 await clearLimit(attempt);
 const session=token();await env.DB.batch([env.DB.prepare('DELETE FROM auth_limits WHERE bucket<?').bind(Math.floor(Date.now()/900000)),env.DB.prepare('DELETE FROM auth_sessions WHERE expires<?').bind(Date.now()),env.DB.prepare('INSERT INTO auth_sessions(hash,email,expires) VALUES(?,?,?)').bind(digest(session),email,Date.now()+28800000)]);
 return json({ok:true},200,{'Set-Cookie':sessionCookie(session)});
}
