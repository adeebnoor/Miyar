/* One deterministic recommendation/validation path, shared by Quick Trial and OD. */
(function(root){
'use strict';
const catalog=root.MiyarRoleCatalog||(typeof require==='function'?require('./role-catalog.js'):null);
function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩۰-۹]/g,c=>'٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean).map(w=>w.replace(/^(?:و|ب|ك)ال(?=.{3,})/,'ال').replace(/^لل(?=.{3,})/,'ال').replace(/^ب(?=شؤون)/,'').replace(/^ال(?=.{3,})/,'')).join(' ');}
// Arabic conjunctions attach to task nouns (وتخطيط، واستثمار). Keep word
// boundaries in English so "it" cannot match "audit" or "investment".
const has=(text,term)=>{const n=' '+normalize(text)+' ',q=normalize(term);return n.includes(' '+q+' ')||(/^[\u0600-\u06ff]/.test(q)&&n.includes(' و'+q+' '));};
const anchors=(text,terms)=>[...new Set(terms.map(normalize))].filter(x=>x&&has(text,x));
const score=(text,terms)=>anchors(text,terms).reduce((n,x)=>n+Math.min(50,x.length),0);
function explicitLevel(text){
 if(['رئيس تنفيذي','تنفيذي','chro','chief','executive'].some(x=>has(text,x)))return'executive';
 if(['اخصائي','اختصاصي','محلل','مسؤول','مهندس','مهني','specialist','analyst','officer','professional','engineer','individual contributor'].some(x=>has(text,x)))return'specialist';
 if(['مدير','رئيس قسم','رئيس ادارة','manager','director','head'].some(x=>has(text,x)))return'manager';
 return null;
}
function interpret(input={}){
 const raw=[input.objective||input.strategyObjective,input.responsibilities].filter(Boolean).join('\n'),reporting=[],excluded=[];
 // Recipients and exclusions remain visible as context; they are not evidence
 // that the requested role owns the recipient's function or excluded work.
 const reportingPattern=/\b(?:report(?:s|ing)?(?:\s+(?:findings|results|progress|status|monthly|weekly))*\s+(?:to|for)|(?:submit|send|provide|prepare|present|deliver)\w*\s+(?:\w+\s+){0,4}reports?\s+(?:to|for))\s+[^,;.!?\n]+|(?:و?يرفع|و?ترفع|و?ارفع|و?رفع|و?تقديم|و?إعداد|و?اعداد|و?إرسال|و?ارسال)\s+(?:تقارير|التقارير|تقرير|التقرير)(?:\s+(?:دورية|شهرية|أسبوعية|شهريا|شهريًا))?\s+(?:إلى|الى|لـ?)\s*[^،,;؛.\n]+|(?:للمدير|لرئيس|للجنة)\s+[^،,;؛.\n]+/gi;
 const separated=raw.replace(/\s+(?:and|but|while)\s+(?=(?:manage|lead|develop|evaluate|analy[sz]e|prepare|coordinate|perform|conduct|oversee|deliver)\w*\b)/gi,'\n').replace(/\s+(?=و(?:يقوم|يتولى|يعد|يراجع|يدير|يحلل|يطور|ينسق)\s)/g,'\n');
 let text=separated;
 const exclusionPattern=/\b(?:not responsible for|does not (?:own|manage|perform)|no responsibility for|without|excluding|exclude|no)\s+[^,;.!?\n]+|(?:و?لا يتولى|و?لا تشمل|و?لا يشمل|و?ليس مسؤول[اًا]? عن|و?دون|و?بدون|باستثناء)\s+[^،,;؛.\n]+/gi;
 text=text.replace(exclusionPattern,x=>{excluded.push(x.trim());return ' ';});
 text=text.replace(reportingPattern,x=>{reporting.push(x.trim());return ' ';});
 const clauses=text.split(/[\n;؛،,.!?]+/).map(x=>x.trim()).filter(Boolean);
 return {raw,text:clauses.join('\n'),clauses,reporting,excluded,method:'context-aware-rules-not-semantic-inference'};
}
function level(input){return explicitLevel(input.seniority||input.requestedLevel)||explicitLevel(interpret(input).text)||'specialist';}
function detect(input={}){
 const field=input.domain||input.department||'',interpretation=interpret(input),text=interpretation.text;
 const ranked=catalog.families.map(f=>({family:f,fieldScore:score(field,f.terms),textScore:score(text,f.terms)+Math.max(0,...catalog.roles.filter(r=>r.family===f.id&&r.level==='specialist').map(r=>score(text,r.taskKeywords)))}));
 const broadField=['ادارة عامة','عام','general administration','general','all'].some(x=>normalize(field)===normalize(x));
 const fieldHit=broadField?null:[...ranked].sort((a,b)=>b.fieldScore-a.fieldScore||b.textScore-a.textScore)[0];
 const textHit=[...ranked].sort((a,b)=>b.textScore-a.textScore)[0];
 let selected=fieldHit?.fieldScore?fieldHit:textHit?.textScore?textHit:null;
 // Maintenance is an explicit sub-domain of operations, not HR operations.
 if(selected?.family.id==='operations'&&textHit?.family.id==='maintenance')selected=textHit;
 if(!selected)return null;
 const secondary=[...ranked].filter(x=>x.family.id!==selected.family.id&&x.textScore>0).sort((a,b)=>b.textScore-a.textScore)[0];
 const secondaryHR=selected.family.id==='finance'&&secondary?.family.id==='hc'&&['رواتب','payroll'].some(x=>has(text,x));
 const conflict=secondaryHR||Boolean(fieldHit?.fieldScore&&textHit?.textScore&&fieldHit.family.id!==textHit.family.id&&!(fieldHit.family.id==='operations'&&textHit.family.id==='maintenance'));
 const clauseFamilies=new Set(interpretation.clauses.map(clause=>catalog.families.map(f=>({id:f.id,value:score(clause,f.terms)+Math.max(0,...catalog.roles.filter(r=>r.family===f.id&&r.level==='specialist').map(r=>score(clause,r.taskKeywords)))})).sort((a,b)=>b.value-a.value)[0]).filter(x=>x?.value>=12).map(x=>x.id));
 const workstreams=[...ranked].filter(x=>x.textScore>0&&(x.family.id===selected.family.id||clauseFamilies.has(x.family.id)||x.textScore>=Math.max(18,(textHit?.textScore||0)*.65))).sort((a,b)=>b.textScore-a.textScore).map(x=>({family:x.family,anchors:anchors(text,[...x.family.terms,...catalog.roles.filter(r=>r.family===x.family.id&&r.level==='specialist').flatMap(r=>r.taskKeywords)])}));
 return {family:selected.family,fieldFamily:fieldHit?.fieldScore?fieldHit.family:null,textFamily:secondaryHR?secondary.family:textHit?.textScore?textHit.family:null,conflict,text,field,interpretation,workstreams};
}
function recommend(input={},nodes=null,education=null){
 const detection=detect(input);if(!detection)return null;
 const {family,text}=detection,roles=catalog.roles.filter(r=>r.family===family.id);
 let requested=level(input);
 const ranked=roles.filter(r=>r.level==='specialist').map(r=>({role:r,score:score(text,r.taskKeywords)})).sort((a,b)=>b.score-a.score);
 let intent=ranked[0]?.score?ranked[0].role.intent:'general';
 // Preserve the expert's mixed HC portfolio only for genuinely multi-workstream scope.
 if(family.id==='hc'&&['hc projects','human capital projects','مشاريع راس المال البشري'].some(x=>has(text,x))&&['procurement','rfp','مشتريات','opex','ميزانية'].some(x=>has(text,x))){intent='portfolio';if(!explicitLevel(input.seniority||input.requestedLevel))requested='manager';}
 const noManagement=/(?:no|without|exclude|avoid)\s+(?:any\s+)?(?:admin(?:istrative)?|manage\w*|director|executive)|(?:دون|بدون|لا)\s+(?:مهام\s+)?(?:اداري|إداري|ادارية|إدارية|قيادي|إشراف|ادارة فريق|إدارة فريق)/i.test([input.constraints,...detection.interpretation.excluded].join(' '));
 let chosenLevel=noManagement?'specialist':requested;
 let candidate=roles.find(r=>r.intent===intent&&r.level===chosenLevel);
 if(!candidate)candidate=roles.find(r=>r.intent==='general'&&r.level===chosenLevel);
 if(!candidate)candidate=roles.find(r=>r.intent===intent&&r.level==='manager')||roles.find(r=>r.intent===intent&&r.level==='specialist')||roles[0];
 if(!candidate)return null;
 const source=nodes?.find(x=>x.level==='occupation'&&String(x.code)===candidate.ssco)||null;
 const educationCodes=candidate.educationCodes.filter(c=>!education||education.some(x=>x.code===c));
 const constraintText=[input.constraints,...detection.interpretation.excluded].filter(Boolean).join(' ');
 const exclusion=candidate.excludeTerms.find(x=>has(constraintText,x));
 const forbidden=candidate.forbiddenTitles.find(x=>has(candidate.titleAr,x)||has(candidate.titleEn,x));
 const checks=[
  {id:'level',status:candidate.level===requested?'pass':'warn',ar:candidate.level===requested?'المسمى يطابق المستوى المطلوب':'تم تقييد المستوى بالقيود أو بالتغطية المتاحة؛ راجع المستوى',en:candidate.level===requested?'Title matches the requested level':'Level constrained by exclusions or catalog coverage; review the level'},
  {id:'domain',status:detection.conflict?'warn':'pass',ar:detection.conflict?'يوجد اختلاف بين المجال المدخل وإشارات الوصف':'المجال والمسمى متسقان مع المدخلات',en:detection.conflict?'Entered field and task signals differ':'Field and title are consistent with the input'},
  {id:'constraints',status:exclusion||forbidden?'fail':constraintText?'warn':'pass',ar:exclusion||forbidden?'تعارض مع قيد أو مسمى ممنوع':constraintText?'فُحصت القيود المعروفة؛ يلزم التحقق البشري من كامل النص':'لا توجد قيود إضافية مدخلة',en:exclusion||forbidden?'Conflict with an exclusion or forbidden title':constraintText?'Known exclusions checked; full free-text constraints need human review':'No additional constraints supplied'},
  {id:'ssco',status:nodes?(source?'pass':'fail'):'warn',ar:source?'الرمز موجود في نسخة SSCO المرفقة، وربطه بالدور مقترح':nodes?'الرمز غير موجود في الدليل':'لم يُحمّل دليل SSCO للتحقق بعد',en:source?'Code exists in supplied SSCO; role mapping is proposed':nodes?'Code is missing from the directory':'SSCO directory has not been loaded for validation'},
  {id:'education',status:educationCodes.length?'warn':'warn',ar:educationCodes.length?'رموز تعليم مقترحة من الدليل؛ لا تعني اشتراطًا رسميًا':'لا يوجد ربط تعليمي متحقق؛ حدده مع المختص',en:educationCodes.length?'Proposed education codes; not an official qualification requirement':'No verified education mapping; specify it with a reviewer'}
 ];
 if(candidate.mappingStatus==='adjacent-reference-for-review')checks.push({id:'mapping-scope',status:'warn',ar:candidate.mappingNoteAr,en:candidate.mappingNoteEn});
 if(detection.workstreams.length>1)checks.push({id:'mixed-scope',status:'warn',ar:'الوصف يشمل أكثر من وظيفة؛ راجع الدور الرئيسي أو افصل نطاقات العمل قبل الاعتماد',en:'Multiple functions appear in the description; confirm the primary role or split the work scopes before approval'});
 const found=anchors(text,[...family.terms,...candidate.taskKeywords]);
 const rawScore=score(text,[...family.terms,...candidate.taskKeywords]);
 return {candidate:{...candidate,educationCodes},source,detection,requestedLevel:requested,checks,anchors:found,score:{keyword:rawScore,embedding:null,calibratedConfidence:null},finalTitle:checks.some(x=>x.status==='fail')?null:{ar:candidate.titleAr,en:candidate.titleEn},status:checks.some(x=>x.status==='fail')?'blocked':'proposed-for-review'};
}
function familyDefinition(input){const d=detect(input);if(!d)return null;const f=d.family,roles=catalog.roles.filter(r=>r.family===f.id);return {...f,departmentAr:f.ar,departmentEn:f.en,ssco:[...new Set(roles.map(r=>r.referenceTitleAr))],education:[],qualificationAr:'مؤهل مرتبط بالمجال؛ يحدد وفق المهام وسياسة الجهة',qualificationEn:'Relevant qualification, subject to tasks and organization policy',technicalAr:['تحليل الاحتياج','توثيق الأدلة','متابعة النتائج'],technicalEn:['Needs analysis','Evidence documentation','Outcome monitoring'],careerAr:['أخصائي أول','مدير'],careerEn:['Senior Specialist','Manager']};}
root.MiyarRoleRecommender={catalog,normalize,has,anchors,score,interpret,level,detect,recommend,familyDefinition};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MiyarRoleRecommender;
})(typeof window!=='undefined'?window:globalThis);
