'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, Plus, X } from 'lucide-react';
import { fields } from '../lib/item-fields';
import { statuses, statusLabel, type Item } from '../lib/tracker';

export default function AddItemDialog({deliverable,onClose,onCreated}:{deliverable:boolean;onClose:()=>void;onCreated:(item:Item)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const inFlight=useRef(false);
 const [draft,setDraft]=useState<Item>(()=>({id:`NEW-${crypto.randomUUID()}`,kind:deliverable?'deliverables':'problems',title:'',area:'',status:'Open',severity:'Medium',owner:'',notes:'',version:0,updatedAt:'',updatedBy:''}));
 const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal()},[]);
 function change(key:string,value:string){setDraft(old=>({...old,[key]:value}));setDirty(true);setError('')}
 function close(){if(inFlight.current)return;if(dirty&&!confirm('Discard this new item?'))return;onClose()}
 async function submit(event:FormEvent){
  event.preventDefault();if(inFlight.current)return;
  if(!draft.title.trim()||!draft.area.trim()){setError('Enter a title and area.');return}
  inFlight.current=true;setSaving(true);setError('');
  try{
   const response=await fetch('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
   const data=await response.json() as Item & {error?:string};
   if(!response.ok)throw new Error(data.error||'Could not add this item. Please try again.');
   onCreated(data);
  }catch(error){setError(error instanceof Error?error.message:'Could not add this item. Please try again.')}
  finally{inFlight.current=false;setSaving(false)}
 }
 return <dialog ref={dialog} className="create-dialog" aria-labelledby="add-item-title" onCancel={event=>{event.preventDefault();close()}}>
  <header className="dialog-header"><h2 id="add-item-title">{deliverable?'Add deliverable':'Add issue'}</h2><button type="button" className="icon-button" aria-label="Close new item" disabled={saving} onClick={close}><X size={22}/></button></header>
  <form onSubmit={submit}>
   <div className="dialog-body">
    <p className="form-hint">Add the details your team needs. Title and area are required.</p>
    <fieldset disabled={saving} className="create-fields">
     {!deliverable&&<label>Item type<select value={draft.kind} onChange={e=>change('kind',e.target.value)}><option value="problems">Bug</option><option value="flows">Improvement</option><option value="untested">Test</option></select></label>}
     <label>Title <span aria-hidden="true">*</span><input autoFocus required maxLength={10000} value={draft.title} placeholder={deliverable?'What needs to be delivered?':'What needs to be fixed?'} onChange={e=>change('title',e.target.value)}/></label>
     <label>Area <span aria-hidden="true">*</span><input required maxLength={10000} value={draft.area} placeholder="For example, Front desk or Reports" onChange={e=>change('area',e.target.value)}/></label>
     <div className="edit-grid">
      <label>Status<select value={draft.status} onChange={e=>change('status',e.target.value)}>{statuses.map(status=><option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
      <label>Priority<select value={draft.severity} onChange={e=>change('severity',e.target.value)}>{['Critical','High','Medium','Low'].map(priority=><option key={priority}>{priority}</option>)}</select></label>
      <label>Owner<input maxLength={10000} value={draft.owner} placeholder="Optional" onChange={e=>change('owner',e.target.value)}/></label>
     </div>
     {fields[draft.kind].map(([key,label])=><label key={key}>{label}<textarea rows={3} maxLength={10000} value={draft[key]||''} onChange={e=>change(key,e.target.value)}/></label>)}
     <label>Remarks<textarea rows={3} maxLength={10000} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></label>
    </fieldset>
    {error&&<div className="error" role="alert">{error}</div>}
   </div>
   <footer className="dialog-footer"><span>Saved for everyone on your team</span><div><button type="button" className="secondary" disabled={saving} onClick={close}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={18}/>:<Plus size={18}/>} {saving?'Adding…':deliverable?'Add deliverable':'Add issue'}</button></div></footer>
  </form>
 </dialog>
}
