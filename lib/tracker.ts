export type Item = {id:string; title:string; area:string; kind:string; status:string; owner:string; notes:string; version:number; updatedAt:string; updatedBy:string; severity?:string; [key:string]:any};
export const statuses=['Open','In progress','Done'];
export const statusLabel:Record<string,string>={'Open':'Pending','In progress':'In progress','Done':'Completed'};
export function normalizeStatus(status:string){return status==='Blocked'?'Open':status==='Ready to test'?'In progress':status}
export const sections=[
 {key:'all',label:'All issues',title:'All issues',hint:'Everything in one place',description:'All bugs, improvements and testing tasks.'},
 {key:'pending',label:'Pending',title:'Pending fixes',hint:'Waiting to be picked up',description:'Open and blocked items that need your attention.'},
 {key:'progress',label:'In progress',title:'Fixes in progress',hint:'Work is underway',description:'Items the team is currently working on.'},
 {key:'fixed',label:'Completed',title:'Completed fixes',hint:'Tested and completed',description:'Resolved items, kept here for reference.'},
 {key:'deliverables',label:'Deliverables',title:'Project deliverables',hint:'Project deliverables',description:'Track the flows and tasks from your pending deliverables sheet.'}
];
export function matchesSection(item:Item,key:string){if(key==='deliverables')return item.kind==='deliverables';if(item.kind==='deliverables')return false;const status=normalizeStatus(item.status);return key==='all'||(key==='pending'&&(status==='Open'||status==='Blocked'))||(key==='progress'&&status==='In progress')||(key==='fixed'&&status==='Done')}
export function mergeItems(current:Item[],incoming:Item[]){const map=new Map(current.map(i=>[i.id,i]));for(const item of incoming){const old=map.get(item.id);if(!old||item.version>=old.version)map.set(item.id,item)}return [...map.values()]}
