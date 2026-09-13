/* Local, explicitly saved OD drafts. Internal IDs are never occupation codes. */
(function(root){
 'use strict';
 const E=root.MiyarEngine||(typeof require==='function'?require('./engine.js'):null);
 const P=root.MiyarPosition||(typeof require==='function'?require('./position.js'):null);
 const KEY='miyar-position-workspace-v1',SCHEMA='miyar-position-draft/1.0';
 const requestTypes=[['additional-headcount','عدد إضافي لمهنة موجودة','Additional headcount for an existing occupation'],['proposed-role','دور تنظيمي مقترح — مرجعه يحتاج تحققًا','Proposed organizational role — reference to verify'],['redesign','إعادة تصميم منصب قائم','Redesign an existing position']];
 function sanitize(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid');
  const input=P.blank();for(const f of P.fields){const v=value[f.id]??'';if(typeof v!=='string'||v.length>3000)throw new Error('invalid');input[f.id]=v;}
  if(input.requestType&&!requestTypes.some(t=>t[0]===input.requestType))throw new Error('invalid');
  for(const k of ['businessReviewed','reviewStale','evaluationStale'])input[k]=value[k]===true;
  return input;
 }
 function read(storage){
  try{const raw=storage.getItem(KEY);if(!raw)return {records:[],error:null};if(raw.length>2000000)throw new Error('invalid');const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>50)throw new Error('invalid');const seen=new Set();const records=list.map(x=>{if(!x||!/^MJR-[a-z0-9-]+$/i.test(x.id)||seen.has(x.id)||!Number.isInteger(x.revision)||x.revision<1||!Number.isFinite(Date.parse(x.updatedAt)))throw new Error('invalid');seen.add(x.id);return {id:x.id,revision:x.revision,updatedAt:x.updatedAt,input:sanitize(x.input)};});return {records,error:null};}catch{return {records:[],error:'storage'};}
 }
 function save(storage,input,current=null){
  const state=read(storage);if(state.error)throw new Error('storage');const clean=sanitize(input);if(!clean.title.trim())throw new Error('title');
  const old=current&&state.records.find(x=>x.id===current.id);if(current&&(!old||old.revision!==current.revision))throw new Error('conflict');
  if(!old&&state.records.length>=50)throw new Error('limit');
  const id=old?.id||'MJR-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  const record={id,revision:(old?.revision||0)+1,updatedAt:new Date().toISOString(),input:clean};
  const records=state.records.filter(x=>x.id!==id);records.unshift(record);const raw=JSON.stringify(records);if(raw.length>2000000)throw new Error('limit');storage.setItem(KEY,raw);return record;
 }
 function transfer(input){return {schema:SCHEMA,input:sanitize(input),reviewScope:'User-reported entries. Import requires re-review; this is not an approval.'};}
 function importDraft(raw){
  if(typeof raw!=='string'||raw.length>150000)throw new Error('invalid');const parsed=JSON.parse(raw);const value=parsed?.schema==='miyar-position-package/1.1'?parsed.editableDraft:parsed;
  if(value?.schema!==SCHEMA)throw new Error('invalid');const input=sanitize(value.input);
  input.reviewStale=input.reviewStale||input.businessReviewed;input.businessReviewed=false;
  input.evaluationStale=input.evaluationStale||P.evaluation(input).status==='reported-unverified';return input;
 }
 function search(query,records){const tokens=E.normalize(query).split(' ').filter(Boolean);return records.filter(r=>{const text=E.normalize([r.id,r.input.title,r.input.department,r.input.purpose,r.input.responsibilities].join(' '));return tokens.every(t=>text.includes(t));});}
 function quality(input){
  const items=[],add=(id,ar,en)=>items.push({id,ar,en});const missing=P.completeness(input).missing;
  if(missing.length)add('missing','استكمل الحقول الأساسية قبل المراجعة.','Complete the core fields before review.');
  const placeholders=P.fields.filter(f=>f.required&&/^(?:test|tbd|n a|na|اختبار|تجربة|لاحقا|غير محدد|لا يوجد|\d+)$/u.test(E.normalize(input[f.id])));
  if(placeholders.length)add('placeholder','توجد قيم مؤقتة في حقول أساسية؛ استبدلها بوصف قابل للمراجعة.','Some core fields contain placeholders; replace them with reviewable descriptions.');
  const lines=String(input.responsibilities||'').split(/\n+/).map(E.normalize).filter(Boolean);
  if(lines.length<3)add('tasks','اكتب ثلاث مسؤوليات مميزة على الأقل لتوضيح نطاق الدور.','Describe at least three distinct responsibilities to clarify scope.');
  if(new Set(lines).size<lines.length)add('duplicate-tasks','توجد مسؤوليات مكررة؛ ادمج التكرار وحدّد المخرجات.','Some responsibilities are repeated; consolidate them and specify outputs.');
  if(input.title&&E.normalize(input.title)===E.normalize(input.manager))add('reporting','المسمى والمدير متطابقان؛ تحقق من عدم وجود تبعية ذاتية.','The position and manager titles are identical; check for a self-reporting relationship.');
  if(input.successMeasures&&!/[0-9٠-٩۰-۹]/.test(input.successMeasures))add('measure','راجع مؤشرات النجاح: أضف مستهدفًا ومدة، أو اشرح معيار الإنجاز النوعي.','Review success measures: add a target and timeframe, or explain the qualitative completion criterion.');
  return items;
 }
 const stop=new Set(['the','and','with','for','from','role','position','هذا','هذه','علي','الي','في','من','مع','عن','ان','دور','العمل','تحسين']);
 function tokens(text){return new Set(E.normalize(text).split(' ').filter(t=>t.length>2&&!stop.has(t)));}
 function overlaps(input,records,roles,currentId){
  const title=E.normalize(input.title),reference=[];
  if(title)for(const r of roles){if([r.title,r.titleEn].some(t=>title.includes(E.normalize(t))))reference.push({role:r,basis:'title'});}
  const match=E.classify({objective:input.purpose+'\n'+input.responsibilities,domain:'all',seniority:'professional'},roles);
  if(match.kind==='match'&&!reference.some(r=>r.role.id===match.role.id))reference.push({role:match.role,basis:'tasks'});
  const task=tokens(input.purpose+' '+input.responsibilities);
  const saved=records.filter(r=>r.id!==currentId).map(r=>{const exact=!!title&&title===E.normalize(r.input.title);const other=tokens(r.input.purpose+' '+r.input.responsibilities);const common=[...task].filter(t=>other.has(t));return {record:r,exact,common};}).filter(r=>r.exact||(r.common.length>=4&&r.common.length/Math.max(1,Math.min(task.size,tokens(r.record.input.purpose+' '+r.record.input.responsibilities).size))>=0.5)).slice(0,5);
  return {reference,saved};
 }
 const api={KEY,requestTypes,sanitize,read,save,transfer,importDraft,search,quality,overlaps};root.MiyarWorkspace=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
