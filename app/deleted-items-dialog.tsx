'use client';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { Item } from '../lib/tracker';
export type DeletedItem=Item & {deletedAt:string;deletedBy:string};
export default function DeletedItemsDialog({onClose,onRestore}:{onClose:()=>void;onRestore:(item:DeletedItem)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [rows,setRows]=useState<DeletedItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[query,setQuery]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/items?deleted=1',{cache:'no-store'});if(!r.ok)throw new Error('Could not load deleted items. Check that you are signed in.');setRows(await r.json() as DeletedItem[])}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{dialog.current?.showModal();void load()},[]);
 async function restore(item:DeletedItem){if(busy)return;setBusy(item.id);setError('');try{await onRestore(item);setRows(old=>old.filter(row=>row.id!==item.id))}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <dialog ref={dialog} aria-labelledby="deleted-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}>
  <header className="dialog-header"><h2 id="deleted-title">Recently deleted</h2><button className="icon-button" aria-label="Close recently deleted" disabled={!!busy} onClick={onClose}><X size={22}/></button></header>
  <div className="dialog-body"><p>Restore issues and Project deliverables with their saved details and status. Deleted items stay here until restored.</p>
   <input type="search" aria-label="Search deleted items" placeholder="Search title or ID" value={query} onChange={e=>setQuery(e.target.value)}/>
   {error&&<div className="error" role="alert">{error}</div>}
   {loading?<p role="status">Loading deleted items...</p>:rows.filter(item=>(item.title+' '+item.id).toLowerCase().includes(query.toLowerCase())).map(item=><div className="deleted-row" key={item.id}><div><strong>{item.title}</strong><p>{item.kind==='deliverables'?'deliverable':'Issue'} · {item.id}</p><small>Deleted {new Date(item.deletedAt).toLocaleString()} by {item.deletedBy}</small></div><button className="secondary" disabled={!!busy} onClick={()=>restore(item)}><RotateCcw size={16}/>{busy===item.id?'Restoring...':'Restore'}</button></div>)}
   {!loading&&!error&&rows.length===0&&<p className="empty">No deleted items.</p>}
   {!loading&&rows.length>0&&!rows.some(item=>(item.title+' '+item.id).toLowerCase().includes(query.toLowerCase()))&&<p className="empty">No matching deleted items.</p>}
  </div><footer className="dialog-footer"><button className="secondary" disabled={!!busy||loading} onClick={load}>Refresh</button><button className="secondary" disabled={!!busy} onClick={onClose}>Close</button></footer>
 </dialog>
}
