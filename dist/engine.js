/* Deterministic bilingual demonstration. Scores count matched task groups.
 * They are not probabilities, confidence scores, E5 embeddings or Gemini output.
 * Unknown/ambiguous requests abstain. Official title/code pairs are immutable.
 */
(function(root){
 'use strict';
 function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function contains(text,term){return (' '+text+' ').includes(' '+normalize(term)+' ');}
 function classify(input,roles){
   const objective=normalize(input.objective);
   if(objective.length<12||objective.split(' ').length<3){return {kind:'invalid',message:'اكتب وصفًا أوضح للمهام والنتيجة المطلوبة، في ثلاث كلمات على الأقل.'};}
   if(input.domain==='other'){return {kind:'outside',reason:'المجال المختار غير مغطّى في عينة المهن الهندسية الحالية.',candidates:[]};}
   const allRanked=roles.map(role=>{
     const groups=role.groups.filter(group=>group.terms.some(term=>contains(objective,term)));
     return {role,groups,evidenceCount:groups.length};
   }).sort((a,b)=>b.evidenceCount-a.evidenceCount||a.role.id.localeCompare(b.role.id));
   const ranked=input.domain==='all'?allRanked:allRanked.filter(c=>c.role.id===input.domain);
   const top=ranked[0];
   if(!top||top.evidenceCount<2){return {kind:'outside',reason:'لا توجد أدلة كافية داخل العينة لربط هذا الاحتياج بمسمى ورمز مهني محددين.',candidates:[]};}
   if(input.domain==='all'&&ranked[1]?.evidenceCount===top.evidenceCount){return {kind:'ambiguous',reason:'الاحتياج يجمع مهامًا من أكثر من تخصص. حدّد المجال أو وضّح المهام الأساسية قبل الترشيح.',candidates:ranked.filter(c=>c.evidenceCount===top.evidenceCount).map(c=>c.role.title)};}
   if(input.domain!=='all'&&allRanked[0].role.id!==top.role.id&&allRanked[0].evidenceCount>top.evidenceCount){return {kind:'ambiguous',reason:'المهام المدخلة أقرب إلى تخصص مختلف عن المجال المختار. راجع المجال أو وصف الاحتياج.',candidates:[]};}
   const notes=[];
   if(input.seniority==='leadership')notes.push('المسمى المرجعي لا يثبت مرتبة قيادية؛ تحديد المستوى الإداري يحتاج مراجعة.');
   if(input.seniority==='junior')notes.push('تحتاج نطاقات المسؤولية إلى تكييف لتناسب بداية المسار.');
   if(input.seniority==='senior')notes.push('مستوى الخبرة المطلوب لا يغيّر الرمز المهني في هذه العينة.');
   if(String(input.constraints||'').trim())notes.push('القيود مسجلة للمراجع؛ لم يتحقق المحرك التجريبي من استيفائها.');
   return {kind:'match',role:top.role,groups:top.groups,evidenceCount:top.evidenceCount,notes,review:'pending'};
 }
 function decisionRecord(result,input,eventId){
  return {schema:'miyar-demo-decision/1.0',id:eventId,createdAt:new Date().toISOString(),mode:'deterministic-demo',source:'Supplied data.xlsx (five-record sample)',input:{objective:String(input.objective),domain:String(input.domain),seniority:String(input.seniority),constraints:String(input.constraints||'')},outcome:result.kind,role:result.kind==='match'?{title:result.role.title,titleEn:result.role.titleEn,saudiCode:result.role.code,educationCode:result.role.educationCode}:null,evidence:result.kind==='match'?result.groups.map(g=>g.label):[],reviewStatus:result.review||'not-applicable',reviewScope:'Demo session only; not a professional or regulatory certification',limitations:['No live E5 or Gemini inference','No independently validated accuracy or compliance claim','Education and occupation codes reproduced from supplied sample','Session log is temporary and not an immutable audit ledger']};
 }
 const api={normalize,classify,decisionRecord};
 root.MiyarEngine=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
