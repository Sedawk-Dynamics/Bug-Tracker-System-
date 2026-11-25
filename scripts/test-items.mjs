import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000');
assert(['localhost','127.0.0.1'].includes(base.hostname), 'Tests only run against a local server.');
const email = `items-test-${randomUUID()}@example.invalid`;
const session = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(session).digest('hex');
const ids = [];
const deletedIds = [];
const db = new DatabaseSync(process.env.DATABASE_PATH || './storage/tracker.db');
db.exec('PRAGMA busy_timeout=5000');
function sql(command){db.exec(command)}
async function request(method,body,{authenticated=true,origin=base.origin,deleted=false}={}){
 const response=await fetch(new URL(deleted?'/api/items?deleted=1':'/api/items',base),{method,headers:{'Content-Type':'application/json',Origin:origin,...(authenticated?{Cookie:`__Host-tracker=${session}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await response.text();
 return {status:response.status,data:JSON.parse(text)};
}
try{
 sql(`INSERT INTO auth_users (email,disabled) VALUES ('${email}',0); INSERT INTO auth_sessions (hash,email,expires) VALUES ('${hash}','${email}',${Date.now()+600000});`);
 const sample={id:`NEW-${randomUUID()}`,title:'Local integration fixture',area:'Tests',kind:'problems',status:'Open',severity:'Medium',owner:'',notes:'',problem:'Test details',fix:'Verify persistence'};
 ids.push(sample.id);
 assert.equal((await request('GET',undefined,{authenticated:false})).status,401);
 assert.equal((await fetch(base,{redirect:'manual'})).status,307);
 assert.equal((await request('POST',sample,{authenticated:false})).status,401);
 assert.equal((await request('PUT',sample,{authenticated:false})).status,401);
 assert.equal((await request('POST',sample,{origin:'https://example.invalid'})).status,403);
 for(const invalid of [null,[],{...sample,title:' '},{...sample,area:''},{...sample,kind:'invalid'},{...sample,status:'Ready to test'},{...sample,status:'Blocked'},{...sample,severity:'invalid'},{...sample,title:'x'.repeat(10001)}])assert.equal((await request('POST',invalid)).status,400);
 console.log('PASS: authorization, Origin and input validation');
 for(const kind of ['problems','flows','untested','deliverables']){
  const body={...sample,id:`NEW-${randomUUID()}`,kind};ids.push(body.id);
  const created=await request('POST',body);assert.equal(created.status,201);assert.equal(created.data.version,1);assert.equal(created.data.kind,kind);
  assert.equal((await request('POST',body)).status,200);
  const updated=await request('PUT',{...created.data,status:'Done',notes:'Verified update'});assert.equal(updated.status,200);assert.equal(updated.data.version,2);
  assert.equal((await request('PUT',{...created.data,notes:'Stale edit'})).status,409);
  assert.equal((await request('PUT',{...updated.data,status:'Blocked'})).status,400);
  const listed=await request('GET');assert.equal(listed.status,200);
  const matches=listed.data.filter(item=>item.id===body.id);assert.equal(matches.length,1);assert.equal(matches[0].notes,'Verified update');assert.equal(matches[0].status,'Done');assert.equal(matches[0].problem,body.problem);
 }
 console.log('PASS: all four item types, retry without duplicates, persisted edits and version conflicts');
 // Exercise compatibility with stored records from the previous workflow.
 sql(`UPDATE custom_items SET payload=json_set(payload,'$.status','Ready to test') WHERE id='${ids[1]}'; UPDATE custom_items SET payload=json_set(payload,'$.status','Blocked') WHERE id='${ids[2]}';`);
 const normalized=(await request('GET')).data;
 assert.equal(normalized.find(item=>item.id===ids[1]).status,'In progress');
 assert.equal(normalized.find(item=>item.id===ids[2]).status,'Open');
 const code=ts.transpileModule(readFileSync('lib/tracker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const tracker=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 assert.deepEqual(tracker.statuses,['Open','In progress','Done']);
 for(const [status,section] of [['Open','pending'],['Blocked','pending'],['In progress','progress'],['Ready to test','progress'],['Done','fixed']]){
  assert(tracker.matchesSection({kind:'problems',status},section));
  assert(!tracker.matchesSection({kind:'deliverables',status},section));
 }
 console.log('PASS: legacy status mapping and issue/deliverable filter separation');
 const all=(await request('GET')).data;
 const imported=all.filter(item=>!item.id.startsWith('NEW-'));
 const targets=[...all.filter(item=>ids.includes(item.id)),imported.find(item=>item.kind!=='deliverables'),imported.find(item=>item.kind==='deliverables')].filter(Boolean);
 for(const item of targets){
  const body={id:item.id,version:item.version};
  assert.equal((await request('DELETE',body,{authenticated:false})).status,401);
  assert.equal((await request('DELETE',body,{origin:'https://example.invalid'})).status,403);
  assert.equal((await request('DELETE',{...body,version:item.version+1})).status,409);
  deletedIds.push(item.id);
  assert.equal((await request('DELETE',body)).status,200);
  assert.equal((await request('DELETE',body)).status,200);
  assert(!(await request('GET')).data.some(row=>row.id===item.id));
  assert.equal((await request('PUT',item)).status,410);
  assert.equal((await request('GET',undefined,{deleted:true,authenticated:false})).status,401);
  const trash=(await request('GET',undefined,{deleted:true})).data;
  const entry=trash.find(row=>row.id===item.id);assert(entry);assert.equal(entry.title,item.title);
  const restoration={id:item.id,deletedAt:entry.deletedAt};
  assert.equal((await request('PATCH',restoration,{authenticated:false})).status,401);
  assert.equal((await request('PATCH',restoration,{origin:'https://example.invalid'})).status,403);
  assert.equal((await request('PATCH',{...restoration,deletedAt:'stale'})).status,409);
  assert.equal((await request('PATCH',restoration)).status,200);
  const recovered=(await request('GET')).data.find(row=>row.id===item.id);assert(recovered);assert.equal(recovered.status,item.status);assert.equal(recovered.notes,item.notes);assert.equal(recovered.title,item.title);
  assert(!(await request('GET',undefined,{deleted:true})).data.some(row=>row.id===item.id));
  assert.equal((await request('PATCH',restoration)).status,409);
  assert.equal((await request('DELETE',body)).status,200);
  assert.equal((await request('PATCH',restoration)).status,409);
  const second=(await request('GET',undefined,{deleted:true})).data.find(row=>row.id===item.id);
  assert.equal((await request('PATCH',{id:item.id,deletedAt:second.deletedAt})).status,200);
 }
 assert.equal((await request('DELETE',null)).status,400);
 assert.equal((await request('DELETE',{id:'missing-item',version:0})).status,409);
 console.log('PASS: restore, retained details, stale Undo rejection; deletion of imported and custom issues/deliverables, authorization, conflicts, persistence and no resurrection');
}finally{
 sql(`DELETE FROM deleted_items WHERE id IN (${deletedIds.map(id=>`'${id}'`).join(',')||"''"}); DELETE FROM custom_items WHERE id IN (${ids.map(id=>`'${id}'`).join(',')||"''"}); DELETE FROM auth_sessions WHERE email='${email}'; DELETE FROM auth_users WHERE email='${email}';`);
 console.log('Removed temporary local test records.');
}
