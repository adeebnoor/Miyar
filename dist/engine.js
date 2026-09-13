/* Explainable sample matching, not a semantic model or a confidence estimate. */
(function(root){
 'use strict';
 function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c<='٩'?1632:1776))).replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function contains(text,term){return (' '+text+' ').includes(' '+normalize(term)+' ');}
 const alias={industrial:['مهندسة صناعية','الهندسة الصناعية','industrial engineering'],civil:['مهندسة مدنية','الهندسة المدنية','civil engineering'],mechanical:['مهندسة ميكانيكية','الهندسة الميكانيكية','mechanical engineering'],chemical:['مهندسة كيميائية','الهندسة الكيميائية','chemical engineering'],mining:['مهندسة تعدين','هندسة التعدين','mining engineering']};
 const anchors={industrial:['الهدر','هدر','waste','ازدواجية','الازدواجية','duplication','industrial','صناعي','الصناعية','رسم العمليات','process mapping','تحسين العمليات'],civil:['مدني','المدنية','إنشائي','إنشائية','الإنشائية','تربة','التربة','خرسانة','الخرسانة','تشييد','التشييد','construction','civil','soil','buildings'],mechanical:['ميكانيكي','ميكانيكية','الميكانيكية','mechanical','mechanics','آلات','الآلات'],chemical:['الكيميائي','كيميائي','كيميائية','الكيميائية','كيمياء','chemical','chemicals','مفاعلات','المفاعلات','reactor','reactors'],mining:['تعدين','التعدين','مناجم','المناجم','منجم','mining','mine','mines','خام','الخام','ore','mineral','minerals']};
 function names(role){return [role.title,role.titleEn,...(alias[role.id]||[])].map(normalize);}
 function search(query,roles){
  const q=normalize(query),tokens=q.split(' ').filter(Boolean);
  return roles.map(role=>{
   const labels=names(role),code=normalize(role.code),education=normalize(role.educationCode);
   const ordered=q.split(' ').sort().join(' ');
   const exact=labels.some(label=>label.split(' ').sort().join(' ')===ordered)||code===q||education===q;
   const haystack=normalize([role.title,role.titleEn,role.code,role.educationCode,...(alias[role.id]||[])].join(' '));
   return {role,exact,basis:code===q?'occupation-code':education===q?'education-code':'title',found:!q||tokens.every(t=>haystack.includes(t))};
  }).filter(r=>r.found||r.exact).sort((a,b)=>Number(b.exact)-Number(a.exact)||a.role.id.localeCompare(b.role.id));
 }
 function classify(input,roles){
  const objective=normalize(input.objective),domain=input.domain||'all';
  const outside=(reason,reasonEn,candidates=[])=>({kind:'outside',reason,reasonEn,candidates});
  const ambiguous=(reason,reasonEn,candidates=[])=>({kind:'ambiguous',reason,reasonEn,candidates});
  if(domain==='other')return outside('المجال المختار غير مغطّى في عينة المهن الهندسية الحالية.','The selected field is outside the current engineering sample.');
  const direct=search(objective,roles).filter(r=>r.exact&&r.basis!=='education-code');
  let top,basis='tasks';
  if(direct.length===1){
   if(domain!=='all'&&domain!==direct[0].role.id)return ambiguous('المسمى أو الرمز لا يتوافق مع المجال المختار. راجع المجال.','The title or code conflicts with the selected field. Review the field.',[direct[0].role.id]);
   top={role:direct[0].role,groups:[],evidenceCount:0};basis=direct[0].basis;
  }else{
   if(!objective||objective.length<12||objective.split(' ').length<3){
    if(/^\d+$/.test(objective))return outside('لم يُعثر على رمز مهني مطابق في العينة. ابحث في الدليل لعرض رموز التعليم والنتائج الجزئية.','No matching occupation code in the sample. Use the library for education codes and partial matches.');
    return {kind:'invalid',message:'اكتب مسمى أو رمزًا مهنيًا موجودًا، أو وصفًا للمهام في ثلاث كلمات على الأقل.',messageEn:'Enter an existing title or occupation code, or describe the tasks in at least three words.'};
   }
   if(/(?:^|\s)(?:لا|ليس|ليست|بدون|دون|not|no|without|excluding)(?:\s|$)/u.test(objective))return ambiguous('يتضمن الوصف نفيًا أو استثناءً. اكتب المهام المطلوبة بصياغة مثبتة، وانقل الاستثناءات إلى حقل القيود.','The description contains a negation or exclusion. State the required tasks positively and move exclusions to the constraints field.');
   const outsideContexts=['المالية','مالي','مالية','المحاسبة','محاسبة','الرواتب','التوظيف','الموارد البشرية','التسويق','تسويق','الويب','البرمجة','تقنية المعلومات','financial','finance','accounting','payroll','recruitment','human resources','marketing','website','software','IT support'];
   const explicitEngineering=['هندسة','الهندسة','مهندس','مهندسة','مهندسون','engineer','engineering','mechanical','chemical','mining','construction','civil','ميكانيكية','الميكانيكية','كيميائي','الكيميائي','كيميائية','الكيميائية','تعدين','التعدين','إنشائي','إنشائية','الإنشائية'];
   if(outsideContexts.some(t=>contains(objective,t))&&!explicitEngineering.some(t=>contains(objective,t)))return outside('الوصف يشير إلى عمل إداري أو تخصص خارج العينة الهندسية. الكلمات المشتركة مثل الأداء والهدر لا تكفي لتعيين مهنة هندسية.','The description points to administrative work or a discipline beyond the engineering sample. Shared words such as performance and waste do not establish an engineering occupation.');
   const allRanked=roles.map(role=>{const groups=role.groups.filter(group=>group.terms.some(term=>contains(objective,term)));const anchored=(anchors[role.id]||[]).some(term=>contains(objective,term));return {role,groups,evidenceCount:groups.length,anchored};}).filter(c=>c.anchored&&c.evidenceCount>=2).sort((a,b)=>b.evidenceCount-a.evidenceCount||a.role.id.localeCompare(b.role.id));
   const ranked=domain==='all'?allRanked:allRanked.filter(c=>c.role.id===domain);top=ranked[0];
   if(!top)return outside('لا توجد أدلة تخصصية كافية داخل العينة. عدم العثور على تطابق لا يثبت أن المهنة جديدة؛ راجع دليلًا مهنيًا أشمل.','There is insufficient discipline-specific evidence in this sample. No match does not mean a new occupation; consult a broader occupational reference.');
   if(domain==='all'&&ranked[1]?.evidenceCount===top.evidenceCount)return ambiguous('تساوت أدلة أكثر من تخصص. قارن الأدوار ووضّح المسؤوليات الأساسية قبل اختيار المرجع.','Multiple disciplines have equal task evidence. Compare the roles and clarify the core responsibilities before selecting a reference.',ranked.filter(c=>c.evidenceCount===top.evidenceCount).map(c=>c.role.id));
   if(domain!=='all'&&allRanked[0].role.id!==top.role.id&&allRanked[0].evidenceCount>top.evidenceCount)return ambiguous('المهام أقرب إلى مجال مختلف عن الاختيار. راجع المجال أو الاحتياج.','The evidence points to a different field. Review the field or the request.');
  }
  const notes=[],notesEn=[];
  if(basis!=='tasks'){notes.push('عُثر على سجل بالمسمى أو الرمز فقط؛ لم تُقيّم ملاءمة المهام أو مستوى الدور.');notesEn.push('Record found by title or code only; task fit and role level have not been assessed.');}
  if(input.seniority==='leadership'){notes.push('المسمى المرجعي لا يثبت مرتبة قيادية؛ تحديد المستوى الإداري يحتاج مراجعة.');notesEn.push('The reference title does not establish management level; the level requires review.');}
  if(input.seniority==='junior'){notes.push('تحتاج المسؤوليات إلى تكييف لبداية المسار.');notesEn.push('Adapt responsibilities for an early-career role.');}
  if(input.seniority==='senior'){notes.push('مستوى الخبرة لا يغيّر الرمز المهني في هذه العينة.');notesEn.push('Experience level does not change the sample code.');}
  if(String(input.constraints||'').trim()){notes.push('القيود مسجلة للمراجع؛ لم يتحقق المحرك التجريبي من استيفائها.');notesEn.push('Constraints are recorded for review; the demo has not verified they are met.');}
  return {kind:'match',role:top.role,groups:top.groups,evidenceCount:top.evidenceCount,basis,notes,notesEn,review:'pending'};
 }
 function decisionRecord(result,input,eventId){return {schema:'miyar-demo-decision/2.1',locale:input.locale||'ar',id:eventId,createdAt:new Date().toISOString(),mode:'deterministic-demo',source:'Supplied data.xlsx (five-record sample)',input:{objective:String(input.objective),domain:String(input.domain),seniority:String(input.seniority),constraints:String(input.constraints||'')},outcome:result.kind,basis:result.basis||null,role:result.kind==='match'?{title:result.role.title,titleEn:result.role.titleEn,saudiCode:result.role.code,educationCode:result.role.educationCode}:null,evidence:result.kind==='match'?result.groups.map(g=>input.locale==='en'?g.labelEn:g.label):[],reviewStatus:result.review||'not-applicable',reviewScope:'Demo only; not a professional or regulatory certification',limitations:['No live E5 or Gemini inference','No independently validated accuracy or compliance claim','Education and occupation codes reproduced from supplied sample','No match does not establish a new occupation','Title/code lookup does not establish task fit','Session log is temporary and not an immutable audit ledger']};}
 const api={normalize,search,classify,decisionRecord};root.MiyarEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
