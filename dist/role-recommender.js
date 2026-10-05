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
 if(/(?:^|\s)(?:chief|cfo|chro|coo|ceo|نائب الرئيس|executive director|رئيس تنفيذي|مدير تنفيذي)(?:\s|$)/.test(n))return'executive';
 if(/(?:^|\s)(?:director|vp|vice president|head of|head|يراس ادارة|مدير ادارة|مدير عام|رئيس ادارة|رئيس قطاع)(?:\s|$)/.test(n))return'director';
 if(/(?:^|\s)(?:line manager|heads the [a-z ]+ (?:unit|section)|manager|مدير|يراس قسم|رئيس قسم)(?:\s|$)/.test(n))return'manager';
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
 const reportingPattern=/\b((?:report(?:s|ing)?(?:\s+(?:findings|results|progress|status|monthly|weekly))*|(?:submit|send|provide|prepare|present|deliver)\w*\s+(?:\w+\s+){0,4}reports?)\s+(?:to|for))\s+[^,;.!?\n]+|((?:و?يرفع|و?ترفع|و?ارفع|و?رفع|و?تقديم|و?إعداد|و?اعداد|و?إرسال|و?ارسال)\s+(?:تقاريره|تقاريرها|تقارير|التقارير|تقرير|التقرير)(?:\s+[^\s،,;؛.]+){0,4}?\s+(?:إلى|الى|لـ?))\s*[^،,;؛.\n]+|(?:للمدير|لرئيس|للجنة)\s+[^،,;؛.\n]+/gi;
 const exclusionPattern=/\b(?:not responsible for|does not (?:own|manage|perform)|no responsibility for|without|excluding|exclude|no)\s+[^,;.!?\n]+|(?:و?لا يتولى|و?لا تشمل|و?لا يشمل|و?ليس مسؤول[اًا]? عن|و?دون|و?بدون|باستثناء)\s+[^،,;؛.\n]+/gi;
 let text=raw.replace(/\b(?:under the supervision of|reporting line(?: is)?(?: to)?)\s+[^,;.!?\n]+|(?:تحت إشراف|تحت اشراف|يتبع|يرتبط إدارياً بـ|يرتبط اداريا ب)\s*[^،,;؛.\n]+/gi,value=>{reporting.push(value);return '';}).replace(exclusionPattern,value=>{const [scope,tail]=contextualScope(value,exclusionBoundary);excluded.push(scope.trim());return '\n'+tail;});
 text=text.replace(reportingPattern,(value,englishPrefix,arabicPrefix)=>{
  const [scope,tail]=contextualScope(value,/(?:الذي|التي|\bwho\b)/i.test(value)?/$^/:actionBoundary);reporting.push(scope.trim());
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
function parseCount(value){
 const n=normalize(value);if(/^\d+$/.test(n))return Number(n);
 const en='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' '), map=Object.fromEntries(en.map((x,i)=>[x,i]));
 Object.assign(map,{thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,واحد:1,واحدة:1,اثنان:2,اثنين:2,اثنتان:2,اثنتين:2,اثنتا:2,اثنتي:2,ثلاثة:3,ثلاث:3,اربعة:4,اربع:4,خمسة:5,خمس:5,ستة:6,ست:6,سبعة:7,سبع:7,ثمانية:8,ثمان:8,ثماني:8,تسعة:9,تسع:9,عشرة:10,عشر:10,عشرين:20,عشرون:20,ثلاثون:30,ثلاثين:30,اربعون:40,اربعين:40,خمسون:50,خمسين:50,ستون:60,ستين:60,سبعون:70,سبعين:70,ثمانون:80,ثمانين:80,تسعون:90,تسعين:90,مائة:100,مئة:100,احد:1,احدي:1,اثنا:2,اثني:2});
 const parts=n.split(/\s+/).filter(x=>x!=='and'&&x!=='و');let count=0;
 for(let part of parts){if(!(part in map)&&part.startsWith('و'))part=part.slice(1);if(!(part in map))return null;count=part==='hundred'?(count||1)*100:count+map[part];}return count||null;
}
function analyzeLevel(input={}){
 const interpretation=interpret(dutyInput(input)),n=normalize(interpretation.text),ownTitle=input.title||input.jobTitle||'';
 const requested=explicitLevel(input.seniority||input.requestedLevel),titleLevel=explicitLevel(ownTitle)||(/^(?:vp|vice president|chief|cfo|chro|coo|director|head of|manager|line manager|heads|مدير|رئيس|يراس|نائب|مشرف|technician|فني|assistant|clerk|منسق|مدخل)(?:\s|$)/i.test(n)?explicitLevel(n):null);
 let directReports=input.directReports===undefined||input.directReports===''?null:parseCount(input.directReports);if(!Number.isInteger(directReports)||directReports<0)directReports=null;
 const people=[],supervision=[],approval=[],enterprise=[],lower=[];
 const person='(?:(?:payroll|financial|senior|junior)\\s+)?(?:direct reports?|accountants?|engineers?|employees?|staff|people|nurses?|analysts?|officers?|guards?|auditors?|developers?|researchers?|designers?|consultants?|محاسب[اينون]*|موظف[اينون]*|مهندس[اينون]*|ممرض[اينون]*|عامل[اينون]*|مرؤوس[اينون]*|حارس|حراس)';
 const lead='(?:lead(?:s|ing)?|led|manag(?:e|es|ing)|supervis(?:e|es|ing|ion)|oversee(?:s|ing)?|heads?|line manager to|responsible for|يقود|يدير|يشرف علي|يراس|قيادة|ادارة|اشراف علي|مسؤول عن)';
 const countPattern=new RegExp('(?:^|\\s)'+lead+'\\s+(?:(?:a|the)\\s+)?(?:(?:(?:[a-z]+|[ء-ي]+)\\s+){0,3}?(?:team|department|group|unit|function|فريقا?|قسم[ا]?|وحدة|ادارة)\\s+(?:(?:of|من)\\s+)?)?([\\p{L}\\d]+(?:\\s+[\\p{L}]+){0,3}?)\\s+'+person+'(?:\\s|$)','giu');
 const reportsPattern=new RegExp('([\\p{L}\\d]+(?:\\s+[\\p{L}]+){0,2}?)\\s+(?:direct reports|مرؤوسين|مرؤوسون)(?:\\s|$)','giu');
 const arabicAfter=new RegExp(lead+'\\s+('+person+')\\s+([\\p{L}\\d]+(?:\\s+[\\p{L}]+){0,2})','giu');
 for(const raw of interpretation.clauses){const clause=normalize(raw),member=/\b(?:within|part of|member of|one of|alongside|works? with)\b|ضمن|عضو في|احد اعضاء|مع فريق|يعمل في/.test(clause);
  if(!member){for(const match of clause.matchAll(arabicAfter)){const count=parseCount(match[2]);if(count!==null){directReports=Math.max(directReports||0,count);people.push(clause);if(/يشرف|اشراف/.test(clause))supervision.push(clause);}}for(const re of [countPattern,reportsPattern])for(const match of clause.matchAll(re)){const count=parseCount(match[1]);if(count!==null)directReports=Math.max(directReports||0,count);}
   const leads=new RegExp('(?:^|\\s)'+lead+'\\s+(?:(?:a|the)\\s+)?(?:(?:hr|finance|nursing|shift|internal|audit|engineering)\\s+){0,2}(?:team|teams|department|staff|people|employees|guards|nurses|unit|group|function|section|فريق|ادارة|موظفين|افراد|حراس|ممرضين|قسم|وحدة)(?:\\s|$)','i');
   if(leads.test(clause)||[...clause.matchAll(countPattern)].some(m=>parseCount(m[1])!==null)){people.push(clause);if(/supervis|يشرف|اشراف/.test(clause))supervision.push(clause);}
  }
  if(/\b(?:approv(?:e|es|ing)|sign(?:s|ing)? off|budget owner|approval authority)\b|يعتمد|اعتماد|صلاحية اعتماد|صاحب ميزانية/.test(clause))approval.push(clause);
  if(/\b(?:board|ceo|enterprise wide|group wide|subsidiaries|multiple entities)\b|مجلس|مستوي مجموعة|عدة كيانات/.test(clause))enterprise.push(clause);
  if(/\b(?:enter|entry|archive|archiving|routine processing)\b|ادخال|ارشفة|تنفيذ وفق اجراءات/.test(clause))lower.push(clause);
 }
 if(directReports>=2&&!people.length)people.push('direct reports: '+directReports);
 const budget=/budget owner|responsib.*budget|مسؤول.*ميزانية|صاحب ميزانية/.test(n);
 let evidenceCeiling=lower.length?'assistant':'specialist';
 if(people.length)evidenceCeiling=supervision.length===people.length&&!approval.length?'supervisor':'manager';
 if(approval.length&&budget)evidenceCeiling='manager';
 if(people.length&&approval.length&&(enterprise.length||directReports>=15))evidenceCeiling='director';
 const rank={assistant:0,technician:0,specialist:1,supervisor:2,manager:3,director:4,executive:5};
 const declared=requested||titleLevel,levelExceedsEvidence=[requested,titleLevel].some(x=>x&&rank[x]>rank[evidenceCeiling]+1);
 const levelWarning=!levelExceedsEvidence&&[requested,titleLevel].some(x=>x&&rank[x]===rank[evidenceCeiling]+1);
 let leadershipConflict=levelExceedsEvidence||Boolean(declared&&rank[declared]<rank[evidenceCeiling]&&rank[evidenceCeiling]>=3);
 let selected=declared||evidenceCeiling;
 if(managementExcluded(input,interpretation)){if(rank[evidenceCeiling]>=2)leadershipConflict=true;selected='specialist';}
 const evidence={directReports,people,approval,enterprise,title:[ownTitle,requested].filter(Boolean),routine:lower};
 return {id:selected,level:selected,evidenceCeiling,directReports,evidence,scores:{},leadershipConflict,levelExceedsEvidence,levelWarning,requestedLevel:requested,rationaleAr:'المستوى مرتبط بأدلة قيادة الأفراد والاعتماد ونطاق العمل؛ المسمى وحده لا يثبت الصلاحية.',rationaleEn:'Level is bounded by evidence of people leadership, approval and work scope; a title alone does not establish authority. Final grade requires approved evaluation.'};
}
function level(input={}){return analyzeLevel(input).level;}
const sharedWords=new Set(['pipeline','engineer','engineers','security','system','systems','data','team','project','نظام','بيانات','فريق','cost','costs','budget','forecast','report','reports','variance','تكلفة','تكاليف','ميزانية','موازنة','انحرافات','تقرير','تقارير'].map(normalize));
const domainTermCache=new Map();
function domainTerms(f){if(!domainTermCache.has(f.id))domainTermCache.set(f.id,[...new Set([...f.terms,...catalog.roles.filter(r=>r.family===f.id).flatMap(r=>r.taskKeywords)].map(normalize))].filter(x=>!sharedWords.has(x)&&!(f.id==='investment'&&['استحواذ','اندماج'].includes(x))));return domainTermCache.get(f.id);}
const dutyVerbForms={يختبر:'اختبار',يوثق:'توثيق',يسوي:'تسوية',يراجع:'مراجعة',يطور:'تطوير',ينسق:'تنسيق',يحدث:'تحديث',يحلل:'تحليل',يدرب:'تدريب',يخطط:'تخطيط',يقيم:'تقييم',يعد:'اعداد',يصمم:'تصميم'};
function canonicalDuty(text){return normalize(text).split(' ').map(word=>dutyVerbForms[word]||(word.startsWith('و')&&dutyVerbForms[word.slice(1)])||word).join(' ');}
const dutyScoreCache=new Map();
function dutyScore(text,f){
 const scope=canonicalDuty(text),key=f.id+'\0'+scope;if(dutyScoreCache.has(key))return dutyScoreCache.get(key);
 if(f.id==='securitySafety'&&/cyber|firewall|siem|vulnerability|soc|penetration|جدار حماية|جدران حماية|ثغرات|information security|امن معلومات|امن سيبراني|سيبراني|امن بيانات/.test(scope)&&!/(?:guard|patrol|workplace|occupational|visitor|حارس|حراس|حراسة|جولات امنية|سلامة مهنية|معدات وقاية|اخطار مهنية)/.test(scope))return {value:0,specific:[]};
 const terms=domainTerms(f),specific=anchors(scope,terms);let value=score(scope,terms);
 // Shared finance nouns are usable only inside an expressly financial action.
 if(f.id==='finance'){
  const extra=['financial budget','annual budget','budget variance','monthly costs','cost analysis','payroll cost','consolidated statements','bank accounts','ledger balances','الميزانية السنوية','تكلفة الرواتب','توقعات المصروفات','القيود','القوائم','الرواتب ضمن الميزانية','الحسابات البنكية'];
  value+=score(scope,extra);
 }
 if(f.id==='strategy')value+=score(scope,['ربط المبادرات بالأهداف','مواءمة المبادرات بالأهداف','مراجعة التنفيذ الاستراتيجي']);
 const result={value,specific};if(dutyScoreCache.size>=2048)dutyScoreCache.clear();dutyScoreCache.set(key,result);return result;
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
 if(hasResponsibilities&&!ranked.some(x=>x.textScore>0)&&!new RegExp('(?:'+englishAction+'|'+arabicAction+'|'+arabicTask+')','i').test(text))return null;
 if(selected.family.id==='operations'&&textHit?.family.id==='maintenance')selected=textHit;
 const isPayroll=['payroll','salary processing','رواتب','مسير الرواتب'].some(x=>has(text,x));
 const government=['government relations','علاقات حكومية','ابشر','مقيم','muqeem','absher'].some(x=>has(text,x))&&['hc','admin'].includes(selected.family.id);
 const payrollHome=(isPayroll&&selected.family.id==='hc')||government;
 const financePayroll=isPayroll&&selected.family.id==='finance';
 // Payroll is an established HR/Finance shared process, not a nursing-like mismatch.
 const severe=Boolean(fieldHit?.fieldScore&&textHit?.textScore&&fieldHit.family.id!==textHit.family.id&&!(fieldHit.family.id==='operations'&&textHit.family.id==='maintenance')&&!payrollHome&&!financePayroll&&(fieldHit.textScore===0||fieldHit.textScore<textHit.textScore/3));
 if(financePayroll&&!selected.textScore)selected=ranked.find(x=>x.family.id==='hc');
 const conflict=financePayroll||Boolean(!payrollHome&&fieldHit?.fieldScore&&textHit?.textScore&&fieldHit.family.id!==textHit.family.id&&!(fieldHit.family.id==='operations'&&textHit.family.id==='maintenance'));
 const actionCue=new RegExp('(?:^|\\s)(?:'+englishAction+'|'+arabicAction+'|'+arabicTask+')(?:\\s|$)','i');
 const clauseFamilies=new Set(interpretation.clauses.map(clause=>catalog.families.map(f=>({id:f.id,action:actionCue.test(clause),value:dutyScore(clause,f).value})).sort((a,b)=>b.value-a.value)[0]).filter(x=>x?.value>=12||(x?.value>0&&x.action)).map(x=>x.id));
 const workstreams=[...ranked].filter(x=>x.textScore>0&&(x.family.id===selected.family.id||clauseFamilies.has(x.family.id)||x.textScore>=Math.max(18,(textHit?.textScore||0)*.65))).sort((a,b)=>b.textScore-a.textScore).map(x=>({family:x.family,anchors:anchors(text,domainTerms(x.family)),specialtyClauses:x.specialtyClauses.length}));
 if(selected.family.id==='hc'&&fieldHit?.family.id==='hc'&&analyzeLevel(input).evidence.people.length){const peopleClause=interpretation.clauses.find(c=>/(?:team|department|employees|staff|فريق|ادارة).*(?:employee|staff|موظف)/.test(normalize(c)));if(peopleClause&&!selected.specialtyClauses.includes(normalize(peopleClause)))selected.specialtyClauses.push(normalize(peopleClause));}
 const analysis=analyzeLevel(input);if(['manager','director','executive'].includes(analysis.evidenceCeiling)&&selected.fieldScore>0)selected.specialtyClauses.push(...analysis.evidence.people,...analysis.evidence.approval);
 const specializedDutyCount=new Set([...selected.specialtyClauses.map(canonicalDuty),...interpretation.clauses.map(canonicalDuty).filter(clause=>catalog.families.some(f=>dutyScore(clause,f).value>0))]).size;
 const insufficient=Boolean((hasResponsibilities||!text.trim())&&specializedDutyCount<2);
 if(!selected.textScore&&!selected.titleScore&&!selected.fieldScore&&!severe)return null;
 return {family:selected.family,fieldFamily:fieldHit?.fieldScore?fieldHit.family:null,textFamily:financePayroll?ranked.find(x=>x.family.id==='hc').family:textHit?.textScore?textHit.family:null,conflict,severeConflict:severe,insufficientEvidence:insufficient,text,field,interpretation,contextInterpretation,workstreams,evidenceSource:hasResponsibilities?'responsibilities':'objective-or-title-lookup',evidence:{fieldTaskScore:fieldHit?.textScore||0,strongestTaskScore:textHit?.textScore||0,specialtyClauses:selected.specialtyClauses.length,specializedDutyCount}};
}
function scopeError(detection,locale){const ar=locale==='ar';let message;
 if(detection?.severeConflict){const x=ar?detection.fieldFamily.ar:detection.fieldFamily.en,y=ar?detection.textFamily.ar:detection.textFamily.en;message=ar?'تعارض الإدارة مع المهام: المهام تشير إلى مجال '+y+' بينما الإدارة '+x+'. صحح الإدارة أو المهام.':'Department/task conflict: tasks indicate '+y+' while the department is '+x+'. Correct the department or duties.';}
 else message=ar?'عائلة غير مدعومة أو أدلة تخصصية غير كافية: أدخل مسؤوليتين تخصصيتين مستقلتين على الأقل.':'Unsupported family or insufficient specialized evidence: enter at least two independent specialized duties.';
 const error=new Error(message);error.code=detection?.severeConflict?'MIYAR_DOMAIN_CONFLICT':'MIYAR_UNSUPPORTED_SCOPE';return error;
}
function validateScope(input={},locale='en'){const detection=detect(input);if(!detection||detection.severeConflict)throw scopeError(detection,locale);return detection;}
function recommend(input={},nodes=null,education=null){
 const detection=detect(input);if(!detection)return null;if(detection.severeConflict)throw scopeError(detection,input.locale||'en');
 const {family,text}=detection,roles=catalog.roles.filter(r=>r.family===family.id);
 const levelAnalysis=analyzeLevel(input);let requested=levelAnalysis.level;
 if(levelAnalysis.leadershipConflict)return {status:'blocked',candidate:null,finalTitle:null,detection,levelAnalysis,directReports:levelAnalysis.directReports,checks:[{id:levelAnalysis.levelExceedsEvidence?'levelExceedsEvidence':'leadership',status:'fail',ar:'المستوى المطلوب أعلى مما تدل عليه المهام أو يتعارض معها. أضف مسؤوليات القيادة والاعتماد، أو غيّر المستوى.',en:'Requested level conflicts with duty evidence. Add owned leadership and approval responsibilities or change the level.'}],message:levelAnalysis.levelExceedsEvidence?'المستوى المطلوب ('+(input.seniority||input.requestedLevel||input.title||input.jobTitle)+') أعلى مما تدل عليه المهام. أضف مسؤوليات القيادة والاعتماد، أو غيّر المستوى.':'أدلة القيادة تتعارض مع المستوى المدخل',anchors:[]};
 const ranked=roles.filter(r=>['specialist','assistant','technician'].includes(r.level)).map(r=>({role:r,score:score(text,r.taskKeywords)})).sort((a,b)=>b.score-a.score);
 let intent=ranked[0]?.score?ranked[0].role.intent:'general';
 if(family.id==='finance'&&['payroll cost','تكلفة الرواتب','تكاليف الرواتب'].some(x=>has(text,x)))intent='cost';
 // Preserve the expert's mixed HC portfolio only for genuinely multi-workstream scope.
 if(family.id==='hc'&&['hc projects','human capital projects','مشاريع راس المال البشري'].some(x=>has(text,x))&&['procurement','rfp','مشتريات','opex','ميزانية'].some(x=>has(text,x))){intent='portfolio';}
 const noManagement=managementExcluded(input,detection.interpretation);
 let chosenLevel=noManagement?'specialist':requested;
 const engineeringEvidence=['design','designs','engineering design','engineering calculations','professional license','professional licence','تصميم','التصاميم','حساب هندسي','حسابات هندسية','ترخيص مهني','تصميم هندسي'].some(x=>has(text,x)||has(input.title||'',x));
 // Executing repairs never grants an engineering title. Keep management scope.
 if(['maintenance','engineering'].includes(family.id)&&!['manager','director','executive'].includes(chosenLevel)&&!engineeringEvidence){chosenLevel='technician';intent=family.id==='maintenance'&&['hvac','تكييف','التكييف','air conditioning'].some(x=>has(text,x))?'hvac':'technician';}
 if(family.id==='finance'&&!['manager','director','executive'].includes(chosenLevel)&&['invoice entry','enter invoices','supplier invoices','إدخال فواتير الموردين','فواتير الموردين'].some(x=>has(text,x))&&['enter','entry','إدخال','أرشفة','archive','match','مطابقة'].some(x=>has(text,x))){chosenLevel='assistant';intent='payableClerk';}
 if(family.id==='hc'&&!['manager','director','executive'].includes(chosenLevel)&&intent!=='payroll'&&roles.some(r=>r.intent==='coordinator'&&score(text,r.taskKeywords)>0)&&anchors(text,['entry','enter','archive','schedule','إدخال','أرشفة','تنسيق المقابلات','تحديث ملفات']).length>=2&&!['screen','screening','source candidates','job offers','فرز','استقطاب','عروض وظيفية'].some(x=>has(text,x))){chosenLevel='assistant';intent='coordinator';}
 if(family.id==='securitySafety'&&intent==='guard'&&!['manager','director','executive','supervisor'].includes(chosenLevel))chosenLevel='assistant';
 if(family.id==='securitySafety'&&chosenLevel==='specialist')intent='safety';
 let candidate=roles.find(r=>r.intent===intent&&r.level===chosenLevel);
 if(!candidate)candidate=roles.find(r=>r.intent==='general'&&r.level===chosenLevel);
 if(!candidate&&chosenLevel==='executive'&&levelAnalysis.evidenceCeiling==='director')candidate=roles.find(r=>r.level==='director');
 // Level-specific catalog gaps block publication instead of silently falling back.
 if(detection.insufficientEvidence||!candidate){const choices=[...roles].sort((a,b)=>(b.level===chosenLevel)-(a.level===chosenLevel)||score(text,b.taskKeywords)-score(text,a.taskKeywords)).slice(0,3);const confirmed=choices.find(r=>r.titleEn===input.confirmedRole);if(confirmed&&confirmed.level===chosenLevel)candidate=confirmed;else return {status:'needs-confirmation',candidate:null,finalTitle:null,candidates:choices,detection,levelAnalysis,directReports:levelAnalysis.directReports,checks:[],anchors:[],message:'الأدلة مختصرة؛ اختر الدور الأقرب أو أضف تفاصيل المهام.'};}
 const source=nodes?.find(x=>x.level==='occupation'&&String(x.code)===candidate.ssco)||null;
 const educationCodes=candidate.educationCodes.filter(c=>!education||education.some(x=>x.code===c));
 const constraintText=[input.constraints,...detection.interpretation.excluded].filter(Boolean).join(' ');
 const exclusion=candidate.excludeTerms.find(x=>has(constraintText,x));
 const forbidden=candidate.forbiddenTitles.find(x=>has(candidate.titleAr,x)||has(candidate.titleEn,x));
 const checks=[
  {id:'leadership',status:levelAnalysis.leadershipConflict?'fail':levelAnalysis.levelWarning?'warn':'pass',ar:levelAnalysis.leadershipConflict?'أدلة القيادة تتعارض مع المستوى المدخل؛ أكد المستوى قبل التوليد':'فُحصت أدلة القيادة مع المستوى',en:levelAnalysis.leadershipConflict?'Leadership evidence conflicts with entered level; confirm the level before generation':'Leadership evidence checked against level'},
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
root.MiyarRoleRecommender={catalog,normalize,has,anchors,score,interpret,explicitLevel,parseCount,analyzeLevel,level,detect,validateScope,recommend,familyDefinition};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MiyarRoleRecommender;
})(typeof window!=='undefined'?window:globalThis);
