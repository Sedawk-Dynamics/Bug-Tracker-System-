import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
export const isOwner=(user:{email:string}|null)=>{const owner=env.OWNER_EMAIL?.trim().toLowerCase();return Boolean(owner && user?.email.toLowerCase()===owner)};
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export function hashPassword(password:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(password,salt,32,{N:16384,r:8,p:5,maxmem:33554432}).toString('hex')}
export function verifyPassword(password:string,stored:string){const [salt,hash]=stored.split(':');const actual=hashPassword(password,salt).split(':')[1];return hash.length===actual.length&&timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(actual,'hex'))}
export async function getEditor(){const h=await headers();const session=h.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-tracker='))?.slice(15);if(!session)return null;const user=await env.DB!.prepare('SELECT u.email FROM auth_sessions s JOIN auth_users u ON s.email=u.email WHERE s.hash=? AND s.expires>? AND u.disabled=0').bind(digest(session),Date.now()).first<{email:string}>();return user?{email:user.email,displayName:user.email}:null}
export async function limited(key:string,max:number){const now=Date.now(),bucket=Math.floor(now/900000);const result=await env.DB!.prepare('INSERT INTO auth_limits (key,bucket,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count').bind(digest(key),bucket).first<{count:number}>();return (result?.count||0)>max}
export function sessionCookie(value:string,age=28800){return `__Host-tracker=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`}

