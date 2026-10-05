/* One deterministic recommendation/validation path, shared by Quick Trial and OD. */
(function(root){
'use strict';
const catalog=root.MiyarRoleCatalog||(typeof require==='function'?require('./role-catalog.js'):null);
function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/ًا|اً/g,'').replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩۰-۹]/g,c=>'٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean).map(w=>w.replace(/^(?:و|ب|ك)ال(?=.{3,})/,'ال').replace(/^لل(?=.{3,})/,'ال').replace(/^ب(?=شؤون)/,'').replace(/^ال(?=.{3,})/,'')).join(' ');}
// Arabic conjunctions attach to task nouns (وتخطيط، واستثمار). Keep word
// boundaries in English so "it" cannot match "audit" or "investment".
function includesTerm(n,q){
 if(n.includes(' '+q+' ')||(/^[\u0600-\u06ff]/.test(q)&&n.includes(' و'+q+' ')))return true;
 // Inflections of an English occupational/task noun are the same anchor.
 if(/^[a-z][a-z ]{3,}$/.test(q)){const variants=[q+'s',q+'es'];if(q.endsWith('y'))variants.push(q.slice(0,-1)+'ies');return variants.some(x=>n.includes(' '+x+' '));}
 return false;
}
const has=(text,term)=>includesTerm(' '+normalize(text)+' ',normalize(term));
const anchors=(text,terms)=>{const n=' '+normalize(text)+' ';return [...new Set(terms.map(normalize))].filter(q=>q&&includesTerm(n,q));};
const score=(text,terms)=>anchors(text,terms).reduce((n,x)=>n+Math.min(50,x.length),0);
function explicitLevel(text){
 const n=normalize(text);
 if(/(?:^|\s)(?:chief|chro|ceo|executive director|رئيس تنفيذي|مدير تنفيذي)(?:\s|$)/.test(n))return'executive';
 if(/(?:^|\s)(?:director|head of|head|مدير ادارة|مدير عام|رئيس ادارة|رئيس قطاع)(?:\s|$)/.test(n))return'director';
 if(/(?:^|\s)(?:manager|مدير|رئيس قسم)(?:\s|$)/.test(n))return'manager';
 if(/(?:^|\s)(?:supervisor|مشرف)(?:\s|$)/.test(n))return'supervisor';
 if(/(?:^|\s)(?:technician|فني)(?:\s|$)/.test(n))return'technician';
 if(/(?:^|\s)(?:assistant|clerk|coordinator|مساعد|كاتب|مدخل|منسق)(?:\s|$)/.test(n))return'assistant';
 if(['اخصائي','اختصاصي','محلل','مسؤول','مهندس','مهني','specialist','analyst','officer','professional','engineer','individual contributor'].some(x=>has(n,x)))return'specialist';
 return null;
}
// A boundary is an independently stated action, not a noun such as
// "development" in "permits and development stage gates".
const englishAction='(?:manag(?:e|es|ed|ing)|supervis(?:e|es|ed|ing)|allocat(?:e|es|ed|ing)|record(?:s|ed|ing)?|sourc(?:e|es|ed|ing)|qualif(?:y|ies|ied|ying)|lead(?:s|ing)?|led|develop(?:s|ed|ing)?|evaluat(?:e|es|ed|ing)|analy[sz](?:e|es|ed|ing)|prepar(?:e|es|ed|ing)|coordinat(?:e|es|ed|ing)|perform(?:s|ed|ing)?|conduct(?:s|ed|ing)?|oversee(?:s|ing)?|deliver(?:s|ed|ing)?|test(?:s|ed|ing)?|document(?:s|ed|ing)?|monitor(?:s|ed|ing)?|track(?:s|ed|ing)?|control(?:s|led|ling)?|assess(?:es|ed|ing)?|review(?:s|ed|ing)?|follow(?:s|ed|ing)?\\s+up|align(?:s|ed|ing)?|improv(?:e|es|ed|ing)|cascad(?:e|es|ed|ing)|maintain(?:s|ed|ing)?|design(?:s|ed|ing)?|process(?:es|ed|ing)?|support(?:s|ed|ing)?|reconcil(?:e|es|ed|ing)|approv(?:e|es|ed|ing)|sign(?:s|ed|ing)?\\s+off|enter(?:s|ed|ing)?|archiv(?:e|es|ed|ing)|repair(?:s|ed|ing)?|inspect(?:s|ed|ing)?|calculat(?:e|es|ed|ing)|administer(?:s|ed|ing)?|train(?:s|ed|ing)?)';
const arabicAction='(?:يقوم|يتولى|يعد|يراجع|يدير|يحلل|يطور|ينسق|يختبر|يوثق|يرفع|يتابع|يراقب|يقيم|يصمم|يربط|يضبط|يخطط|يعالج|يشرف|ينفذ|يحسن|يقود|يعتمد|يسوي|يسجل|يصلح|يفحص|يدخل|يؤرشف|يحسب|يدرب|يحدث)';
const arabicTask='(?:إعداد|اعداد|رفع|اختبار|توثيق|متابعة|مراقبة|تحليل|تقييم|تطوير|صياغة|تصميم|ربط|ضبط|تنسيق|معالجة|إدارة|ادارة|الإشراف|الاشراف|تنفيذ|تحسين|قيادة|تخطيط|اعتماد|إعطاء|اعطاء|تسوية|أرشفة|ارشفة|مطابقة|حساب|إدخال|ادخال|إصلاح|اصلاح|تفتيش|تسجيل|تنظيف|هندسة|بناء|تحديث|استقطاب|توظيف|مراجعة|جدولة)';
const actionBoundary=new RegExp('\\s+(?:and|but|while)\\s+(?='+englishAction+'\\b)|\\s+(?:و\\s*|(?:و?لكن(?:ه|ها)?)\\s+)(?=(?:'+arabicAction+'|'+arabicTask+')\\s)','i');
// With a negated Arabic noun list, a conjunction alone is ambiguous. A new
// finite verb or an explicit "لكن" establishes a positive independent duty.
const exclusionBoundary=new RegExp('\\s+(?:and|but|while)\\s+(?='+englishAction+'\\b)|\\s+و\\s*(?='+arabicAction+'\\s)|\\s+(?:و?لكن(?:ه|ها)?)\\s+(?=(?:'+arabicAction+'|'+arabicTask+')\\s)','i');
function contextualScope(value,boundary){const at=value.search(boundary);return at<0?[value,'']:[value.slice(0,at),value.slice(at).replace(/^\s*(?:and|but|while|و?لكن(?:ه|ها)?|و)\s*/i,'')];}
function interpret(input={}){
 const raw=[input.objective||input.strategyObjective,input.responsibilities].filter(Boolean).join('\n'),reporting=[],excluded=[],collaboration=[];
 // Recipients, stakeholders and exclusions remain visible as context. They do
 // not establish ownership of a recipient's function or level.
 const reportingPattern=/\b((?:report(?:s|ing)?(?:\s+(?:findings|results|progress|status|monthly|weekly))*|(?:submit|send|provide|prepare|present|deliver)\w*\s+(?:\w+\s+){0,4}reports?)\s+(?:to|for))\s+[^,;.!?\n]+|((?:و?يرفع|و?ترفع|و?ارفع|و?رفع|و?تقديم|و?إعداد|و?اعداد|و?إرسال|و?ارسال)\s+(?:تقارير|التقارير|تقرير|التقرير)(?:\s+[^\s،,;؛.]+){0,4}?\s+(?:إلى|الى|لـ?))\s*[^،,;؛.\n]+|(?:للمدير|لرئيس|للجنة)\s+[^،,;؛.\n]+/gi;
 const exclusionPattern=/\b(?:not responsible for|does not (?:own|manage|perform)|no responsibility for|without|excluding|exclude|no)\s+[^,;.!?\n]+|(?:و?لا يتولى|و?لا تشمل|و?لا يشمل|و?ليس مسؤول[اًا]? عن|و?دون|و?بدون|باستثناء)\s+[^،,;؛.\n]+/gi;
 let text=raw.replace(exclusionPattern,value=>{const [scope,tail]=contextualScope(value,exclusionBoundary);excluded.push(scope.trim());return '\n'+tail;});
 text=text.replace(reportingPattern,(value,englishPrefix,arabicPrefix)=>{
  const [scope,tail]=contextualScope(value,actionBoundary);reporting.push(scope.trim());
  // Keep the reporting activity and its work-specific modifiers, while removing
  // the recipient (e.g. "prepare project status reports for Strategy Director").
  const prefix=englishPrefix||arabicPrefix||'';
  const activity=prefix.replace(/\s+(?:to|for|إلى|الى|لـ?)$/i,'');
  return activity+'\n'+tail;
 });
 const stakeholder='(?:the\\s+)?(?:Finance Director|Finance Manager|Chief Executive|Audit Committee|Engineering|Investment|Procurement|Finance|PMO|Strategy|Human Resources|Human Capital|Internal Audit|GRC|Legal|Operations|HR|HC|المدير المالي|مدير المالية|الرئيس التنفيذي|لجنة المراجعة|الهندسة|الاستثمار|المشتريات|المالية|الاستراتيجية|الموارد البشرية|رأس المال البشري|راس المال البشري|المراجعة الداخلية|الشؤون القانونية|العمليات)(?![\\p{L}\\p{N}])';
 const stakeholderPattern=new RegExp('(?:\\bin (?:coordination|collaboration) with|\\bwith|بالتنسيق مع|بالتعاون مع|مع)\\s+'+stakeholder+'(?:\\s*(?:and|&|و)\\s*'+stakeholder+')*','giu');
 text=text.replace(stakeholderPattern,value=>{collaboration.push(value.trim());return ' ';});
 const clauses=text.split(new RegExp(actionBoundary.source+'|[\\n;؛،,.!?]+','gi')).map(x=>x.trim()).filter(Boolean);
 return {raw,text:clauses.join('\n'),clauses,reporting,excluded,collaboration,method:'context-aware-rules-not-semantic-inference'};
}
// Objectives describe intended outcomes; independently supplied duties establish
// occupational ownership. A title or objective cannot repair contradictory duties.
function dutyInput(input={}){return String(input.responsibilities??'').trim()?{...input,objective:'',strategyObjective:''}:input;}
function managementExcluded(input,interpretation=interpret(dutyInput(input))){
 return [input.constraints,...interpretation.excluded].filter(Boolean).some(value=>{
  if(!/\b(?:no|without|exclude|excluding|avoid|not responsible|does not)\b|دون|بدون|لا|باستثناء/i.test(value))return false;
  return /(?:\b(?:no|without|exclude|excluding|avoid|no responsibility for|not responsible for)\s+(?:any\s+)?|\bor\s+)(?:(?:admin(?:istrative)?|management|managerial|director|executive)(?:\s+(?:duties|responsibilities|authority|role|level))?(?=\s*(?:$|[,;.!]|\bor\b))|(?:manage|managing|supervise|supervising)\s+(?:a\s+|the\s+)?(?:team|staff|employees)\b)|(?:دون|بدون|لا(?:\s+يتولى)?|باستثناء|أو)\s+(?:مهام\s+)?(?:اداري|إداري|ادارية|إدارية|قيادي|إشراف|ادارة فريق|إدارة فريق|قيادة فريق)/i.test(value);
 });
}
function analyzeLevel(input={}){
 const interpretation=interpret(dutyInput(input)),n=normalize(interpretation.text);
 const ownTitle=input.title||input.jobTitle||'';
 const requested=explicitLevel(input.seniority||input.requestedLevel);
 // Title words in recipients, collaborators and excluded duties never confer seniority.
 const titleLevel=explicitLevel(ownTitle)||(/^(?:director|head of|chief|manager|مدير|رئيس|مشرف|technician|فني|assistant|clerk|منسق|مدخل)\b|^(?:مدير|رئيس|مشرف|فني|منسق|مدخل)\s/i.test(interpretation.text.trim())?explicitLevel(interpretation.text):null);
 const numberPatterns=[/(?:team|department|group|staff|unit)\s+(?:of\s+)?(\d+)\s+(?:direct\s+reports?|accountants?|engineers?|employees?|staff|people|nurses?|analysts?|officers?|guards?|auditors?|developers?|researchers?|designers?|consultants?)/gi,/(?:lead|manage|supervise|oversee|responsible for)\w*\s+(?:a\s+|the\s+)?(\d+)\s+(?:direct\s+reports?|accountants?|engineers?|employees?|staff|people|nurses?|analysts?|officers?|guards?|auditors?|developers?|researchers?|designers?|consultants?)/gi,/(\d+)\s+(?:direct reports|مرؤوس(?:ين|ون)?(?: مباشر(?:ين|ون)?)?)/gi,/(?:فريقا?|ادارة|قسم|وحدة)\s+(?:من\s+)?(\d+)\s*(?:محاسب|موظف|مهندس|ممرض|عامل|مرؤوس|حارس|حراس)/gi,/(?:يقود|يدير|يشرف علي|قيادة|ادارة|اشراف علي)\s+(\d+)\s*(?:محاسب|موظف|مهندس|ممرض|عامل|مرؤوس|حارس|حراس)/gi];
 let directReports=input.directReports===undefined||input.directReports===''?null:Number(normalize(input.directReports));
 if(!Number.isInteger(directReports)||directReports<0)directReports=null;
 numberPatterns.push(/(?:team|department|group|unit)\s+(?:of\s+)?(\d+)\b/gi,/(?:فريقا?|ادارة|قسم|وحدة)\s+(?:من\s+)?(\d+)\b/gi);
 const counts=numberPatterns.flatMap(re=>[...n.matchAll(re)].map(x=>Number(x[1])));if(counts.length)directReports=Math.max(directReports||0,...counts);
 const peoplePatterns=[/\b(?:lead|leads|leading|led|manage|manages|managing|supervise|supervises|supervising|oversee|oversees|overseeing)\s+(?:a\s+|the\s+)?(?:team|department|staff|people|employees|guards|nurses|unit|group)\b/g,/(?:قيادة|ادارة|اشراف علي|يقود|يدير|يشرف علي)\s+(?:فريقا?|ادارة|موظفين|افراد|حراس|ممرضين|قسم|وحدة)/g];
 const people=peoplePatterns.flatMap(re=>[...n.matchAll(re)].map(x=>x[0]));if(directReports>=3)people.push('directReports >= 3');
 const approval=[...n.matchAll(/\b(?:approv(?:e|es|ing|al)|sign(?:s|ing)? off|budget owner|approval authority)\b|(?:يعتمد|اعتماد|صلاحية اعتماد|صاحب ميزانية)/g)].map(x=>x[0]);
 const enterprise=[...normalize(interpretation.raw.replace(/(?:without|excluding|دون|بدون)[^,;،؛\n]+/gi,'')).matchAll(/\b(?:board|chief executive|ceo|group wide|group level|multiple entities|enterprise wide)\b|(?:مجلس ادارة|مجلس|رئيس تنفيذي|مستوي مجموعة|عدة كيانات)/g)].map(x=>x[0]);
 const lower=[...n.matchAll(/\b(?:enter(?:ing)? invoices|invoice entry|data entry|archive(?:s|ing)?|routine processing|under procedures)\b|(?:ادخال|ارشفة|تنفيذ وفق اجراءات)/g)].map(x=>x[0]);
 const scores={executive:0,director:0,manager:0,supervisor:0,specialist:1,assistant:lower.length*2,technician:0};
 if(people.length)scores.manager+=3;if(directReports>=3)scores.manager+=3;if(approval.length)scores.manager+=2;if(enterprise.length)scores.director+=3;if(directReports>=15)scores.director+=3;
 if(titleLevel)scores[titleLevel]=(scores[titleLevel]||0)+6;if(requested)scores[requested]=(scores[requested]||0)+6;
 let inferred=people.length?'manager':lower.length>=2?'assistant':'specialist';
 if(people.length&&approval.length&&(enterprise.length||directReports>=15))inferred='director';
 let selected=requested||titleLevel||inferred;
 const rank={assistant:0,technician:0,specialist:1,supervisor:2,manager:3,director:4,executive:5};
 let leadershipConflict=Boolean(requested&&rank[requested]<rank[inferred]&&rank[inferred]>=3);
 if(!requested&&rank[inferred]>rank[selected])selected=inferred;
 if(managementExcluded(input,interpretation)){if(rank[inferred]>=3)leadershipConflict=true;selected='specialist';}
 const evidence={directReports,people,approval,enterprise,title:[ownTitle||'',requested||''].filter(Boolean),routine:lower};
 return {id:selected,level:selected,directReports,evidence,scores,leadershipConflict,requestedLevel:requested,rationaleAr:'المستوى مستدل من المسمى وقيادة الأفراد وصلاحية الاعتماد والنطاق المؤسسي؛ الدرجة النهائية تحتاج تقييمًا معتمدًا.',rationaleEn:'Level considers own title, people leadership, approval authority and organizational scope; final grade requires approved evaluation.'};
}
function level(input={}){return analyzeLevel(input).level;}
const sharedWords=new Set(['cost','costs','budget','forecast','report','reports','variance','تكلفة','تكاليف','ميزانية','موازنة','انحرافات','تقرير','تقارير'].map(normalize));
const domainTermCache=new Map();
function domainTerms(f){if(!domainTermCache.has(f.id))domainTermCache.set(f.id,[...new Set([...f.terms,...catalog.roles.filter(r=>r.family===f.id).flatMap(r=>r.taskKeywords)].map(normalize))].filter(x=>!sharedWords.has(x)&&!(f.id==='investment'&&['استحواذ','اندماج'].includes(x))));return domainTermCache.get(f.id);}
const dutyVerbForms={يختبر:'اختبار',يوثق:'توثيق',يسوي:'تسوية',يراجع:'مراجعة',يطور:'تطوير',ينسق:'تنسيق',يحدث:'تحديث',يحلل:'تحليل',يدرب:'تدريب',يخطط:'تخطيط',يقيم:'تقييم',يعد:'اعداد',يصمم:'تصميم'};
function canonicalDuty(text){return normalize(text).split(' ').map(word=>dutyVerbForms[word]||(word.startsWith('و')&&dutyVerbForms[word.slice(1)])||word).join(' ');}
function dutyScore(text,f){
 const scope=canonicalDuty(text);
 if(f.id==='securitySafety'&&/cyber|information security|امن معلومات|امن سيبراني|سيبراني|امن بيانات/.test(scope)&&!/(?:guard|patrol|workplace|occupational|visitor|حارس|حراس|حراسة|جولات امنية|سلامة مهنية|معدات وقاية|اخطار مهنية)/.test(scope))return {value:0,specific:[]};
 const terms=domainTerms(f),specific=anchors(scope,terms);let value=score(scope,terms);
 // Shared finance nouns are usable only inside an expressly financial action.
 if(f.id==='finance'){
  const extra=['financial budget','annual budget','budget variance','monthly costs','cost analysis','payroll cost','consolidated statements','bank accounts','ledger balances','الميزانية السنوية','تكلفة الرواتب','توقعات المصروفات','القيود','القوائم','الرواتب ضمن الميزانية','الحسابات البنكية'];
  value+=score(scope,extra);
 }
 if(f.id==='strategy')value+=score(scope,['ربط المبادرات بالأهداف','مواءمة المبادرات بالأهداف','مراجعة التنفيذ الاستراتيجي']);
 return {value,specific};
}
function detect(input={}){
 const field=input.domain||input.department||'',hasResponsibilities=Boolean(String(input.responsibilities??'').trim()),contextInterpretation=interpret(input),interpretation=hasResponsibilities?interpret(dutyInput(input)):contextInterpretation,text=interpretation.text;
 const titleText=[input.title,input.jobTitle].filter(Boolean).join(' ');
 const ranked=catalog.families.map(f=>{const d=dutyScore(text,f),uniqueClauses=[...new Set(interpretation.clauses.map(normalize))],specialtyClauses=uniqueClauses.filter(clause=>dutyScore(clause,f).value>0);return {family:f,fieldScore:score(field,f.terms),textScore:d.value,titleScore:score(titleText,[...f.terms,...catalog.roles.filter(r=>r.family===f.id).flatMap(r=>[r.titleAr,r.titleEn])]),specialtyClauses};});
 const broadField=['ادارة عامة','عام','general administration','general','all'].some(x=>normalize(field)===normalize(x));
 const titleHit=[...ranked].sort((a,b)=>b.titleScore-a.titleScore)[0];
 const fieldHit=broadField?null:[...ranked].sort((a,b)=>b.fieldScore-a.fieldScore||b.textScore-a.textScore)[0],textHit=[...ranked].sort((a,b)=>b.textScore-a.textScore)[0];
 // Culinary inventory/cost is not finance or supply-chain ownership.
 const culinary=/\b(?:chef|culinary|kitchen|cooking|prepare dishes|food cost)\b|(?:تحضير اطباق|اعداد اطباق|مطبخ|طهاة|طاهي)/.test(normalize(text));
 if(culinary&&!(fieldHit?.fieldScore&&['finance','supplyChain'].includes(fieldHit.family.id)&&fieldHit.specialtyClauses.length>=2))return null;
 let selected=fieldHit?.fieldScore?fieldHit:textHit?.textScore?textHit:titleHit?.titleScore?titleHit:null;
 if(!selected)return null;
 if(selected.family.id==='operations'&&textHit?.family.id==='maintenance')selected=textHit;
 const isPayroll=['payroll','salary processing','رواتب','مسير الرواتب'].some(x=>has(text,x));
 const payrollHome=isPayroll&&selected.family.id==='hc';
 const financePayroll=isPayroll&&selected.family.id==='finance';
 // Payroll is an established HR/Finance shared process, not a nursing-like mismatch.
 const severe=Boolean(fieldHit?.fieldScore&&textHit?.textScore&&fieldHit.family.id!==textHit.family.id&&!(fieldHit.family.id==='operations'&&textHit.family.id==='maintenance')&&!payrollHome&&!financePayroll&&(fieldHit.textScore===0||fieldHit.textScore<textHit.textScore/3));
 if(financePayroll&&!selected.textScore)selected=ranked.find(x=>x.family.id==='hc');
 const conflict=financePayroll||Boolean(!payrollHome&&fieldHit?.fieldScore&&textHit?.textScore&&fieldHit.family.id!==textHit.family.id&&!(fieldHit.family.id==='operations'&&textHit.family.id==='maintenance'));
 const actionCue=new RegExp('(?:^|\\s)(?:'+englishAction+'|'+arabicAction+'|'+arabicTask+')(?:\\s|$)','i');
 const clauseFamilies=new Set(interpretation.clauses.map(clause=>catalog.families.map(f=>({id:f.id,action:actionCue.test(clause),value:dutyScore(clause,f).value})).sort((a,b)=>b.value-a.value)[0]).filter(x=>x?.value>=12||(x?.value>0&&x.action)).map(x=>x.id));
 const workstreams=[...ranked].filter(x=>x.textScore>0&&(x.family.id===selected.family.id||clauseFamilies.has(x.family.id)||x.textScore>=Math.max(18,(textHit?.textScore||0)*.65))).sort((a,b)=>b.textScore-a.textScore).map(x=>({family:x.family,anchors:anchors(text,domainTerms(x.family)),specialtyClauses:x.specialtyClauses.length}));
 if(selected.family.id==='hc'&&fieldHit?.family.id==='hc'&&analyzeLevel(input).evidence.people.length){const peopleClause=interpretation.clauses.find(c=>/(?:team|department|employees|staff|فريق|ادارة).*(?:employee|staff|موظف)/.test(normalize(c)));if(peopleClause&&!selected.specialtyClauses.includes(normalize(peopleClause)))selected.specialtyClauses.push(normalize(peopleClause));}
 const specializedDutyCount=new Set([...selected.specialtyClauses.map(canonicalDuty),...interpretation.clauses.map(canonicalDuty).filter(clause=>catalog.families.some(f=>dutyScore(clause,f).value>0))]).size;
 const insufficient=Boolean(hasResponsibilities&&specializedDutyCount<2);
 if(!selected.textScore&&!selected.titleScore&&!severe)return null;
 return {family:selected.family,fieldFamily:fieldHit?.fieldScore?fieldHit.family:null,textFamily:financePayroll?ranked.find(x=>x.family.id==='hc').family:textHit?.textScore?textHit.family:null,conflict,severeConflict:severe,insufficientEvidence:insufficient,text,field,interpretation,contextInterpretation,workstreams,evidenceSource:hasResponsibilities?'responsibilities':'objective-or-title-lookup',evidence:{fieldTaskScore:fieldHit?.textScore||0,strongestTaskScore:textHit?.textScore||0,specialtyClauses:selected.specialtyClauses.length,specializedDutyCount}};
}
function scopeError(detection,locale){const ar=locale==='ar';let message;
 if(detection?.severeConflict){const x=ar?detection.fieldFamily.ar:detection.fieldFamily.en,y=ar?detection.textFamily.ar:detection.textFamily.en;message=ar?'تعارض الإدارة مع المهام: المهام تشير إلى مجال '+y+' بينما الإدارة '+x+'. صحح الإدارة أو المهام.':'Department/task conflict: tasks indicate '+y+' while the department is '+x+'. Correct the department or duties.';}
 else message=ar?'عائلة غير مدعومة أو أدلة تخصصية غير كافية: أدخل مسؤوليتين تخصصيتين مستقلتين على الأقل.':'Unsupported family or insufficient specialized evidence: enter at least two independent specialized duties.';
 const error=new Error(message);error.code=detection?.severeConflict?'MIYAR_DOMAIN_CONFLICT':'MIYAR_UNSUPPORTED_SCOPE';return error;
}
function validateScope(input={},locale='en'){const detection=detect(input);if(!detection||detection.severeConflict||detection.insufficientEvidence)throw scopeError(detection,locale);return detection;}
function recommend(input={},nodes=null,education=null){
 const detection=detect(input);if(!detection)return null;if(detection.severeConflict)throw scopeError(detection,input.locale||'en');if(detection.insufficientEvidence)return null;
 const {family,text}=detection,roles=catalog.roles.filter(r=>r.family===family.id);
 const levelAnalysis=analyzeLevel(input);let requested=levelAnalysis.requestedLevel||levelAnalysis.level;
 const ranked=roles.filter(r=>['specialist','assistant','technician'].includes(r.level)).map(r=>({role:r,score:score(text,r.taskKeywords)})).sort((a,b)=>b.score-a.score);
 let intent=ranked[0]?.score?ranked[0].role.intent:'general';
 if(family.id==='finance'&&['payroll cost','تكلفة الرواتب','تكاليف الرواتب'].some(x=>has(text,x)))intent='cost';
 // Preserve the expert's mixed HC portfolio only for genuinely multi-workstream scope.
 if(family.id==='hc'&&['hc projects','human capital projects','مشاريع راس المال البشري'].some(x=>has(text,x))&&['procurement','rfp','مشتريات','opex','ميزانية'].some(x=>has(text,x))){intent='portfolio';if(!explicitLevel(input.seniority||input.requestedLevel))requested='manager';}
 const noManagement=managementExcluded(input,detection.interpretation);
 let chosenLevel=noManagement?'specialist':requested;
 const engineeringEvidence=['design','designs','engineering design','engineering calculations','professional license','professional licence','licensed engineer','تصميم','التصاميم','حساب هندسي','حسابات هندسية','ترخيص مهني','تصميم هندسي'].some(x=>has(text,x)||has(input.title||'',x));
 // Executing repairs never grants an engineering title. Keep management scope.
 if(['maintenance','engineering'].includes(family.id)&&!['manager','director','executive'].includes(chosenLevel)&&!engineeringEvidence){chosenLevel='technician';intent=family.id==='maintenance'&&['hvac','تكييف','التكييف','air conditioning'].some(x=>has(text,x))?'hvac':'technician';}
 if(family.id==='finance'&&!['manager','director','executive'].includes(chosenLevel)&&['invoice entry','enter invoices','supplier invoices','إدخال فواتير الموردين','فواتير الموردين'].some(x=>has(text,x))&&['enter','entry','إدخال','أرشفة','archive','match','مطابقة'].some(x=>has(text,x))){chosenLevel='assistant';intent='payableClerk';}
 if(family.id==='hc'&&!['manager','director','executive'].includes(chosenLevel)&&intent!=='payroll'&&roles.some(r=>r.intent==='coordinator'&&score(text,r.taskKeywords)>0)&&['entry','enter','archive','schedule','إدخال','أرشفة','تنسيق المقابلات','تحديث ملفات'].some(x=>has(text,x))){chosenLevel='assistant';intent='coordinator';}
 if(family.id==='securitySafety'&&intent==='guard'&&!['manager','director','executive','supervisor'].includes(chosenLevel))chosenLevel='assistant';
 if(family.id==='securitySafety'&&chosenLevel==='specialist')intent='safety';
 let candidate=roles.find(r=>r.intent===intent&&r.level===chosenLevel);
 if(!candidate)candidate=roles.find(r=>r.intent==='general'&&r.level===chosenLevel);
 // Level-specific catalog gaps block publication instead of silently falling back.
 if(!candidate)return null;
 const source=nodes?.find(x=>x.level==='occupation'&&String(x.code)===candidate.ssco)||null;
 const educationCodes=candidate.educationCodes.filter(c=>!education||education.some(x=>x.code===c));
 const constraintText=[input.constraints,...detection.interpretation.excluded].filter(Boolean).join(' ');
 const exclusion=candidate.excludeTerms.find(x=>has(constraintText,x));
 const forbidden=candidate.forbiddenTitles.find(x=>has(candidate.titleAr,x)||has(candidate.titleEn,x));
 const checks=[
  {id:'leadership',status:levelAnalysis.leadershipConflict?'fail':'pass',ar:levelAnalysis.leadershipConflict?'أدلة القيادة تتعارض مع المستوى المدخل؛ أكد المستوى قبل التوليد':'فُحصت أدلة القيادة مع المستوى',en:levelAnalysis.leadershipConflict?'Leadership evidence conflicts with entered level; confirm the level before generation':'Leadership evidence checked against level'},
  {id:'level',status:candidate.level===requested?'pass':'warn',ar:candidate.level===requested?'المسمى يطابق المستوى المطلوب':'تم تقييد المستوى بالقيود أو بالتغطية المتاحة؛ راجع المستوى',en:candidate.level===requested?'Title matches the requested level':'Level constrained by exclusions or catalog coverage; review the level'},
  {id:'domain',status:detection.conflict?'warn':'pass',ar:detection.conflict?'يوجد اختلاف بين المجال المدخل وإشارات الوصف':'المجال والمسمى متسقان مع المدخلات',en:detection.conflict?'Entered field and task signals differ':'Field and title are consistent with the input'},
  {id:'constraints',status:exclusion||forbidden?'fail':constraintText?'warn':'pass',ar:exclusion||forbidden?'تعارض مع قيد أو مسمى ممنوع':constraintText?'فُحصت القيود المعروفة؛ يلزم التحقق البشري من كامل النص':'لا توجد قيود إضافية مدخلة',en:exclusion||forbidden?'Conflict with an exclusion or forbidden title':constraintText?'Known exclusions checked; full free-text constraints need human review':'No additional constraints supplied'},
  {id:'ssco',status:nodes?(source?'pass':'fail'):'warn',ar:source?'الرمز موجود في نسخة SSCO المرفقة، وربطه بالدور مقترح':nodes?'الرمز غير موجود في الدليل':'لم يُحمّل دليل SSCO للتحقق بعد',en:source?'Code exists in supplied SSCO; role mapping is proposed':nodes?'Code is missing from the directory':'SSCO directory has not been loaded for validation'},
  {id:'education',status:educationCodes.length?'warn':'warn',ar:educationCodes.length?'رموز تعليم مقترحة من الدليل؛ لا تعني اشتراطًا رسميًا':'لا يوجد ربط تعليمي متحقق؛ حدده مع المختص',en:educationCodes.length?'Proposed education codes; not an official qualification requirement':'No verified education mapping; specify it with a reviewer'}
 ];
 if(candidate.licenseReviewRequired)checks.push({id:'license',status:'warn',ar:candidate.licenseNoteAr,en:candidate.licenseNoteEn});
 if(candidate.mappingStatus==='adjacent-reference-for-review')checks.push({id:'mapping-scope',status:'warn',ar:candidate.mappingNoteAr,en:candidate.mappingNoteEn});
 if(detection.workstreams.length>1)checks.push({id:'mixed-scope',status:'warn',ar:'الوصف يشمل أكثر من وظيفة؛ راجع الدور الرئيسي أو افصل نطاقات العمل قبل الاعتماد',en:'Multiple functions appear in the description; confirm the primary role or split the work scopes before approval'});
 const found=anchors(text,[...family.terms,...candidate.taskKeywords]);
 const rawScore=score(text,[...family.terms,...candidate.taskKeywords]);
 return {candidate:{...candidate,educationCodes},source,detection,requestedLevel:requested,levelAnalysis,directReports:levelAnalysis.directReports,checks,anchors:found,score:{keyword:rawScore,embedding:null,calibratedConfidence:null},finalTitle:checks.some(x=>x.status==='fail')?null:{ar:candidate.titleAr,en:candidate.titleEn},status:checks.some(x=>x.status==='fail')?'blocked':'proposed-for-review'};
}
function familyDefinition(input){const d=detect(input);if(!d)return null;const f=d.family,roles=catalog.roles.filter(r=>r.family===f.id);return {...f,departmentAr:f.ar,departmentEn:f.en,ssco:[...new Set(roles.map(r=>r.referenceTitleAr))],education:[],qualificationAr:'مؤهل مرتبط بالمجال؛ يحدد وفق المهام وسياسة الجهة',qualificationEn:'Relevant qualification, subject to tasks and organization policy',technicalAr:['تحليل الاحتياج','توثيق الأدلة','متابعة النتائج'],technicalEn:['Needs analysis','Evidence documentation','Outcome monitoring'],careerAr:['أخصائي أول','مدير'],careerEn:['Senior Specialist','Manager']};}
root.MiyarRoleRecommender={catalog,normalize,has,anchors,score,interpret,explicitLevel,analyzeLevel,level,detect,validateScope,recommend,familyDefinition};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MiyarRoleRecommender;
})(typeof window!=='undefined'?window:globalThis);
