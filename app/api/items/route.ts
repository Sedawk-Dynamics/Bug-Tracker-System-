import { randomUUID } from 'node:crypto';
import { env } from '../../../lib/env';
import { publicOrigin } from '../../../lib/request';
import { canEditTracker } from '../../../lib/permissions';
import { getSeed } from '../../../lib/seed';
import { getEditor } from '../../../lib/auth';
import { normalizeStatus, statuses } from '../../../lib/tracker';

export const dynamic = 'force-dynamic';
const kinds = ['problems', 'flows', 'untested', 'deliverables'];
const fields = ['title','area','severity','problem','why','fix','expected','current','how','advantages','what','reason','needed','owner','notes','status'];
type Stored = {id:string; kind:string; payload:string; version:number; updated_at:string; updated_by:string};
function fromRow(row:Stored){return {...JSON.parse(row.payload),id:row.id,kind:row.kind,version:row.version,updatedAt:row.updated_at,updatedBy:row.updated_by}}

async function listItems(trash:boolean,canEdit:boolean){
 const [{results}, {results:custom}, {results:deleted}] = await Promise.all([
  env.DB.prepare('SELECT * FROM updates').all<Stored>(),
  env.DB.prepare('SELECT * FROM custom_items ORDER BY updated_at DESC, id').all<Stored>(),
  env.DB.prepare('SELECT id,deleted_at,deleted_by FROM deleted_items ORDER BY deleted_at DESC').all<{id:string;deleted_at:string;deleted_by:string}>(),
 ]);
 const removed=new Set(deleted.map(row=>row.id));
 const saved = new Map(results.map(row=>[row.id,row]));
 const originalItems = getSeed().map(item=>{
  const row=saved.get(item.id);
  return {...item,status:'Open',owner:'',notes:'',...(row?JSON.parse(row.payload):{}),version:row?.version||0,updatedAt:row?.updated_at||'',updatedBy:row?.updated_by||''};
 });
 return [...originalItems,...custom.map(fromRow)].filter(item=>trash?removed.has(item.id):!removed.has(item.id)).map(item=>({...item,status:normalizeStatus(item.status),...(canEdit?{}:{updatedBy:''}),...(trash?{deletedAt:deleted.find(row=>row.id===item.id)?.deleted_at,deletedBy:deleted.find(row=>row.id===item.id)?.deleted_by}:{})})).sort((a,b)=>trash?String(b.deletedAt).localeCompare(String(a.deletedAt)):0);
}

// The full list is built once per change, then shared by everyone who asks for it.
const boot=randomUUID();
const cached=new Map<string,{version:string;data:Promise<Buffer>}>();
function cachedList(version:string,canEdit:boolean){
 const key=canEdit?'editor':'visitor', hit=cached.get(key);
 if(hit?.version===version)return hit.data;
 const data=listItems(false,canEdit).then(items=>Buffer.from(JSON.stringify(items)));
 cached.set(key,{version,data});
 data.catch(()=>{if(cached.get(key)?.data===data)cached.delete(key)});
 return data;
}

export async function GET(request:Request) {
 const params=new URL(request.url).searchParams, trash=params.get('deleted')==='1';
 const canEdit=canEditTracker(await getEditor());
 if(trash){
  if(!canEdit)return Response.json({error:'Sign in to view deleted items.'},{status:401,headers:{'Cache-Control':'no-store'}});
  return Response.json(await listItems(true,true),{headers:{'Cache-Control':'no-store'}});
 }
 // Read before the items, so a change made meanwhile is picked up by the next request.
 const revision=await env.DB.prepare('SELECT value FROM revision').first<{value:number}>();
 const version=[boot,revision?.value??0,canEdit?'e':'v'].join('.');
 const headers={'Cache-Control':'no-store','X-Tracker-Version':version};
 if(params.get('since')===version)return new Response(null,{status:204,headers});
 return new Response(await cachedList(version,canEdit) as BodyInit,{headers:{...headers,'Content-Type':'application/json'}});
}

async function write(request:Request, creating:boolean){
 const user=await getEditor();
 if(!user) return Response.json({error:'Please sign in before saving.'},{status:401});
 if(!canEditTracker(user)) return Response.json({error:'This account has view-only access.'},{status:403});
 if(request.headers.get('origin')!==publicOrigin(request)) return Response.json({error:'Invalid request origin.'},{status:403});
 const raw=await request.text();
 if(raw.length>50000) return Response.json({error:'This update is too large.'},{status:413});
 let body; try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid update.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body)) return Response.json({error:'Invalid update.'},{status:400});
 if(!statuses.includes(body.status)||typeof body.title!=='string'||!body.title.trim()||typeof body.area!=='string'||!body.area.trim()) return Response.json({error:'Enter a title, area and valid status.'},{status:400});
 const payload:Record<string,string>={};
 for(const key of fields) if(key in body){
  if(typeof body[key]!=='string'||body[key].length>10000) return Response.json({error:'Text fields must be under 10,000 characters.'},{status:400});
  payload[key]=body[key].trim();
 }
 if(typeof body.id==='string'&&await env.DB.prepare('SELECT id FROM deleted_items WHERE id=?').bind(body.id).first())return Response.json({error:'This item has been deleted.'},{status:410});
 const original=getSeed().find(item=>item.id===body.id);
 const custom=!creating&&!original&&typeof body.id==='string'?await env.DB.prepare('SELECT * FROM custom_items WHERE id=?').bind(body.id).first<Stored>():null;
 const kind=creating?body.kind:original?.kind||custom?.kind;
 if(!kinds.includes(kind)) return Response.json({error:creating?'Choose a valid item type.':'Item not found.'},{status:creating?400:404});
 if((creating||kind==='problems'||kind==='deliverables'||'severity' in payload)&&!['Critical','High','Medium','Low'].includes(payload.severity)) return Response.json({error:'Choose a valid priority.'},{status:400});
 const now=new Date().toISOString();
 if(creating){
  // A UUID retained by the form makes retries safe after a lost response.
  if(typeof body.id!=='string'||!/^NEW-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)) return Response.json({error:'Invalid new item ID.'},{status:400});
  payload.owner??=''; payload.notes??='';
  const row=await env.DB.prepare('INSERT INTO custom_items (id,kind,payload,version,updated_at,updated_by) VALUES (?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(body.id,kind,JSON.stringify(payload),now,user.displayName).first<Stored>();
  if(row)return Response.json(fromRow(row),{status:201});
  const existing=await env.DB.prepare('SELECT * FROM custom_items WHERE id=?').bind(body.id).first<Stored>();
  if(existing&&existing.updated_by===user.displayName&&existing.kind===kind&&existing.payload===JSON.stringify(payload))return Response.json(fromRow(existing));
  return Response.json({error:'This item ID already exists. Close and open a new form.'},{status:409});
 }
 if(!Number.isInteger(body.version)||body.version<0) return Response.json({error:'Invalid item version.'},{status:400});
 const merged={...(custom?JSON.parse(custom.payload):{}),...payload};
 let row;
 if(custom){
  row=await env.DB.prepare('UPDATE custom_items SET payload=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND version=? AND NOT EXISTS (SELECT 1 FROM deleted_items WHERE id=?) RETURNING version').bind(JSON.stringify(merged),now,user.displayName,body.id,body.version,body.id).first<{version:number}>();
 }else if(body.version===0){
  row=await env.DB.prepare('INSERT INTO updates (id,payload,version,updated_at,updated_by) SELECT ?,?,1,?,? WHERE NOT EXISTS (SELECT 1 FROM deleted_items WHERE id=?) ON CONFLICT(id) DO NOTHING RETURNING version').bind(body.id,JSON.stringify(payload),now,user.displayName,body.id).first<{version:number}>();
 }else{
  row=await env.DB.prepare('UPDATE updates SET payload=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND version=? AND NOT EXISTS (SELECT 1 FROM deleted_items WHERE id=?) RETURNING version').bind(JSON.stringify(payload),now,user.displayName,body.id,body.version,body.id).first<{version:number}>();
 }
 if(!row)return Response.json({error:'Someone updated this item. Reload the latest version before saving again.'},{status:409});
 return Response.json({...original,...merged,id:body.id,kind,version:row.version,updatedAt:now,updatedBy:user.displayName});
}
export async function POST(request:Request){return write(request,true)}
export async function PUT(request:Request){return write(request,false)}

export async function DELETE(request:Request){
 const user=await getEditor();
 if(!user)return Response.json({error:'Please sign in before deleting.'},{status:401});
 if(!canEditTracker(user))return Response.json({error:'This account has view-only access.'},{status:403});
 if(request.headers.get('origin')!==publicOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 const raw=await request.text();
 if(raw.length>2000)return Response.json({error:'Request is too large.'},{status:413});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body.id!=='string'||!Number.isInteger(body.version)||body.version<0)return Response.json({error:'Provide an item and valid version.'},{status:400});
 const existing=await env.DB.prepare('SELECT deleted_at FROM deleted_items WHERE id=?').bind(body.id).first<{deleted_at:string}>();if(existing)return Response.json({id:body.id,deleted:true,deletedAt:existing.deleted_at});
 const deletedAt=new Date().toISOString();
 const original=getSeed().some(item=>item.id===body.id);
 const row=await env.DB.prepare('INSERT INTO deleted_items (id,deleted_at,deleted_by) SELECT ?,?,? WHERE ?=COALESCE((SELECT version FROM custom_items WHERE id=?),(SELECT version FROM updates WHERE id=?),?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(body.id,deletedAt,user.displayName,body.version,body.id,body.id,original?0:-1).first();
 if(!row)return Response.json({error:'This item changed or no longer exists. Refresh before deleting.'},{status:409});
 return Response.json({id:body.id,deleted:true,deletedAt});
}

export async function PATCH(request:Request){
 const user=await getEditor();
 if(!user||!canEditTracker(user))return Response.json({error:'Sign in to restore items.'},{status:401});
 if(request.headers.get('origin')!==publicOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
 const raw=await request.text();if(raw.length>2000)return Response.json({error:'Request is too large.'},{status:413});
 let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body.id!=='string'||typeof body.deletedAt!=='string'||!body.deletedAt)return Response.json({error:'Choose a deleted item to restore.'},{status:400});
 const restored=await env.DB.prepare('DELETE FROM deleted_items WHERE id=? AND deleted_at=? RETURNING id').bind(body.id,body.deletedAt).first();
 if(!restored)return Response.json({error:'This deletion changed or was already restored. Refresh Recently deleted.'},{status:409});
 return Response.json({id:body.id,restored:true});
}
