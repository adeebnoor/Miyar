(function(root){
'use strict';
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().replace(/\s+/g,' ');
function search(nodes,q,parent){const n=normalize(q),parts=n.split(' ').filter(Boolean);return nodes.filter(r=>(parent===undefined?r.level==='occupation':r.parent===parent)&&parts.every(t=>normalize([r.code,r.titleAr,r.titleEn||'',...(r.aliases||[])].join(' ')).includes(t))).sort((a,b)=>Number(normalize(b.titleAr)===n||b.code===n)-Number(normalize(a.titleAr)===n||a.code===n)||a.code.localeCompare(b.code));}
function skills(text,vocabulary){const n=' '+normalize(text)+' ';return vocabulary.map(s=>({...s,evidence:[s.labelAr,s.labelEn,...s.aliases].filter(t=>t&&(n.includes(' '+normalize(t)+' ')||n.includes(' و'+normalize(t)+' ')||n.includes(' ف'+normalize(t)+' ')))})).filter(s=>s.evidence.length);}
function csv(text){if(text.length>10000000)throw Error('10 MB maximum');const rows=[];let row=[],cell='',quoted=false,closed=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;}else if(c==='"'){if(cell||closed)throw Error('Malformed CSV quote');quoted=true;}else if(c===','||c==='\n'){row.push(cell);cell='';closed=false;if(c==='\n'){rows.push(row);row=[];if(rows.length>10001)throw Error('10,000 rows maximum');}}else if(c==='\r'&&text[i+1]==='\n'){}else {if(closed&&c.trim())throw Error('Malformed CSV quoted cell');cell+=c;}}if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map(x=>x.trim());if(new Set(headers).size!==headers.length)throw Error('Duplicate headers');const aliases={'المسمى':'title','المسمى الوظيفي':'title','الإدارة':'department','الرمز المهني':'occupationCode','المرؤوسون':'directReports','الميزانية':'budgetAmount','الصلاحيات':'authority'};const mapped=headers.map(h=>aliases[h]||h);if(new Set(mapped).size!==mapped.length)throw Error('Duplicate normalized headers');if(rows.some(r=>r.length>headers.length))throw Error('Row contains extra values');return rows.filter(r=>r.some(x=>x.trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[aliases[h]||h,String(r[i]??'').trim()])));}
function diagnose(rows,nodes,missing=[]){if(!rows.length||rows.length>10000)throw Error('Use 1–10,000 rows');const roles=new Map(nodes.filter(r=>r.level==='occupation').map(r=>[r.code,r])),flagged=new Set(missing.map(x=>x.code)),groups=new Map();let aligned=0,assessable=0,scopeFlags=0;const items=rows.map((r,i)=>{if(!r.title)throw Error('Every row needs title / المسمى');const code=normalize(r.occupationCode).replace(/ /g,''),role=roles.get(code),flags=[];const match=!!role&&!flagged.has(code)&&normalize(r.title)===normalize(role.titleAr);if(match)aligned++;else flags.push(!code?'missing_code':!role?'unknown_code':flagged.has(code)?'source_issue':'title_code_review');const scope=['directReports','budgetAmount','authority'].every(k=>r[k]!==undefined&&r[k]!=='');if(scope){const numbers=[Number(r.directReports),Number(r.budgetAmount)];if(numbers.some(x=>!Number.isFinite(x)||x<0)||!Number.isInteger(numbers[0]))flags.push('invalid_scope');else{assessable++;if(/(?:^| )(?:مدير|رئيس|director|head|chief)(?: |$)/.test(normalize(r.title))&&numbers.every(x=>x===0)&&/recommend|يقترح|توصيات|يوصي/.test(normalize(r.authority))){flags.push('title_scope_review');scopeFlags++;}}}const key=normalize(r.title)+'|'+normalize(r.department);groups.set(key,[...(groups.get(key)||[]),i+2]);return {row:i+2,title:r.title,department:r.department||'',occupationCode:code,sourceTitle:role?.titleAr||'',sourcePage:role?.sourcePage,flags,titleCodeAligned:match};});return {totalRows:rows.length,exactTitleCodePairs:aligned,titleCodeAlignmentPercent:Math.round(1000*aligned/rows.length)/10,scopeAssessableRows:assessable,titleScopeReviewRows:scopeFlags,duplicateGroups:[...groups.entries()].filter(([,r])=>r.length>1).map(([key,r])=>({title:key.split('|')[0],department:key.split('|')[1],rows:r})),rows:items};}
function customGrade(f,answers){if(f.method!=='custom')throw Error('Licensed vendor implementation required');if(f.factors.reduce((n,x)=>n+Number(x.weight),0)!==100)throw Error('Weights must total 100');let score=0;const breakdown=f.factors.map(x=>{const l=x.levels.find(y=>y.id===String(answers[x.id]));if(!l)throw Error('Answer every factor');const points=Number(l.points)*Number(x.weight)/10;score+=points;return {factor:x.id,points};});const points=Math.round(score),band=f.bands.find(b=>b.min<=points&&points<=b.max);if(!band)throw Error('Points outside configured bands');return {points,band,breakdown,illustrative:f.illustrative,method:'custom'};}
const required=['title','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors'];
const KEY='miyar-enterprise-local-v1';
function read(storage){const value=JSON.parse(storage.getItem(KEY)||'[]');if(!Array.isArray(value)||value.length>100)throw Error('Invalid local workspace');return value;}
function save(storage,content,existing){const rows=read(storage);if(rows.length>=100&&!existing)throw Error('100 local drafts maximum');const prior=existing?rows.find(x=>x.id===existing.id):null;if(existing&&(!prior||prior.revision!==existing.revision))throw Error('A newer local revision exists; reload first');const id=prior?.id||'LOCAL-'+root.crypto.randomUUID(),revision=(prior?.revision||0)+1,at=new Date().toISOString(),row={id,internalCode:id,title:content.title,revision,content:structuredClone(content),state:'draft',updatedAt:at,createdAt:prior?.createdAt||at,versions:[...(prior?.versions||[]),{revision,content:structuredClone(content),createdAt:at,reason:'Local draft save'}]};const next=[row,...rows.filter(x=>x.id!==id)];const text=JSON.stringify(next);if(text.length>4000000)throw Error('Local workspace exceeds 4 MB');storage.setItem(KEY,text);return row;}
function importDraft(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid position package');
 const source=payload.content;
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Package must contain position content');
 const fields=new Set([...required,'field','seniority','requestType','department','manager','effectiveDate','certifications','occupationCode','occupationRelease','educationLevel','educationFieldCode','constraints','saudization','saudizationSource','saudizationDate','license','licenseSource','licenseDate','headcount','annualCost','directReports','raci','skillRequirements','mappingJustification','provisional','provisionalParent','sourceDecisionId','sourceDecisionInput','importNotes','kpis','performanceBasis','raciBasis','salaryMin','salaryMax','salaryCurrency','salaryPeriod','salarySource','salaryGrade','evaluationSummary']);
 const content={};
 for(const [key,value] of Object.entries(source)){
  if(!fields.has(key))continue;
  if(['raci','skillRequirements','kpis'].includes(key)){
   const allowed=key==='raci'?['responsibility','R','A','C','I']:key==='kpis'?['outcome','metric','target','frequency','deliverable']:['name','type','level','evidence'];
   if(!Array.isArray(value)||value.length>100||value.some(r=>!r||typeof r!=='object'||Array.isArray(r)||Object.entries(r).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>4000)))throw Error('Invalid matrix entries');
  }else if(['headcount','annualCost','directReports','salaryMin','salaryMax'].includes(key)){
   if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12||(['headcount','directReports'].includes(key)&&!Number.isInteger(value))||(key==='headcount'&&value<1))throw Error('Invalid numeric scope');
  }else if(key==='provisional'){
   if(typeof value!=='boolean')throw Error('Invalid provisional flag');
  }else if(typeof value!=='string'||value.length>4000)throw Error('Invalid text field');
  content[key]=structuredClone(value);
 }
 if(!content.title?.trim()||content.title.length>300)throw Error('A position title is required');
 if(content.provisional&&content.occupationCode)throw Error('A provisional role cannot carry a final occupation code');
 validateReferences(content);
 validateSalary(content);
 if(JSON.stringify(content).length>80000)throw Error('Position content exceeds 80 KB');
 return content;
}
function validateReferences(content){
 for(const key of ['saudizationSource','licenseSource'])if(content[key]){
  let url;try{url=new URL(content[key]);}catch{throw Error('Use a valid HTTP or HTTPS source URL');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Use a valid HTTP or HTTPS source URL');
 }
 for(const key of ['saudizationDate','licenseDate','effectiveDate'])if(content[key]){
  const value=content[key],parsed=new Date(value+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||value<'1900-01-01'||(key!=='effectiveDate'&&value>new Date().toISOString().slice(0,10)))throw Error('Use a valid date; verification dates cannot be in the future');
 }
}
function importDecision(payload,reference,education){
 if(payload?.schema!=='miyar-demo-decision/2.1'||payload.outcome!=='match'||!payload.input||typeof payload.input!=='object'||Array.isArray(payload.input)||!payload.role)throw Error('Choose a matched Miyar decision in schema 2.1');
 const take=value=>{if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>4000)throw Error('Invalid decision text');return value;};
 const input=Object.fromEntries(['objective','field','domain','seniority','constraints'].map(k=>[k,take(payload.input[k])]));
 const sourceInput=JSON.stringify(input);if(sourceInput.length>4000)throw Error('Decision input exceeds the supported import size');
 const requested=normalize(take(payload.role.saudiCode)).replace(/ /g,''),occupation=reference.nodes.find(x=>x.level==='occupation'&&x.code===requested);
 const title=take(payload.locale==='en'?payload.role.titleEn||payload.role.title:payload.role.title||payload.role.titleEn);
 const notices=['Imported lookup requires job analysis and fresh institutional review.'];
 const content={title,field:input.field||(input.domain==='all'?'':input.domain),seniority:input.seniority,constraints:input.constraints,requestType:'proposed-role',occupationRelease:reference.id,sourceDecisionId:take(payload.id),sourceDecisionInput:sourceInput};
 if(occupation)content.occupationCode=occupation.code;else notices.push('Occupation '+requested+' was not found in the selected edition; select a reference before submission.');
 if(payload.basis==='tasks')content.responsibilities=input.objective;
 const oldEducation=normalize(take(payload.role.educationCode)).replace(/ /g,'');
 if(oldEducation){
  const candidates=education.fields.filter(x=>x.code===oldEducation||x.code.replace(/^0+/,'')===oldEducation.replace(/^0+/,''));
  if(candidates.length===1){content.educationFieldCode=candidates[0].code;if(candidates[0].code!==oldEducation)notices.push('Education code '+oldEducation+' was mapped to the unique reference '+candidates[0].code+'; the original input remains in your decision file.');}
  else notices.push('Education code '+oldEducation+' could not be mapped uniquely; select the specialization manually.');
 }
 content.importNotes=notices.join('\n');
 return {content:importDraft({content}),notices};
}
function parseMatrix(text,keys){
 const lines=String(text).split('\n').filter(line=>line.trim());
 if(lines.length>100)throw Error('Matrix has more than 100 rows');
 return lines.map(line=>{
  const values=line.split('|');
  if(values.length>keys.length)throw Error('Matrix row has extra columns');
  return Object.fromEntries(keys.map((key,i)=>[key,values[i]?.trim()||'']));
 });
}
function validateSalary(c){
 const hasMin=c.salaryMin!==undefined,hasMax=c.salaryMax!==undefined;
 if(hasMin!==hasMax||(hasMin&&(!Number.isFinite(c.salaryMin)||!Number.isFinite(c.salaryMax)||c.salaryMin<0||c.salaryMax<c.salaryMin||c.salaryMax>1e12)))throw Error('Enter a valid minimum and maximum salary');
 if(c.salaryPeriod&&!['monthly','annual'].includes(c.salaryPeriod))throw Error('Choose monthly or annual salary');
 if(c.salaryCurrency&&!/^[A-Z]{3}$/.test(c.salaryCurrency))throw Error('Use a three-letter currency code');
}
function sentences(value){return [...new Set(String(value||'').split(/[\n;؛]+/).map(s=>s.replace(/^[-•\d]+[.)\s]+/,'').trim()).filter(Boolean))];}
function kpis(c,locale='ar'){
 const ar=locale==='ar',t=(a,b)=>ar?a:b,source=sentences(c.successMeasures);
 if(!source.length)throw Error(t('أدخل مخرجات النجاح أولًا.','Enter success measures first.'));
 const frequency=t('شهريًا؛ اعتماد الهدف خلال أول 30 يومًا','Monthly; confirm target within the first 30 days');
 const types=[
  [t('إنجاز المخرجات في موعدها','On-time delivery'),t('المخرجات المقبولة في موعدها ÷ المخرجات المستحقة × 100','Accepted outputs delivered on time / outputs due × 100'),t('≥ 95% — هدف مقترح','≥ 95% — proposed target'),t('سجل التسليم وتاريخ قبول كل مخرج','Delivery register with acceptance dates')],
  [t('جودة المخرجات','Output quality'),t('المخرجات المقبولة من أول مراجعة ÷ المخرجات المراجعة × 100','Outputs accepted on first review / outputs reviewed × 100'),t('≥ 90% — هدف مقترح','≥ 90% — proposed target'),t('سجل مراجعات الجودة وإعادة العمل','Quality review and rework log')],
  [t('زمن الإنجاز','Completion time'),t('وسيط أيام العمل من بدء الطلب إلى قبوله','Median working days from request start to acceptance'),t('خفض 10% عن خط الأساس بعد 90 يومًا — مقترح','10% below baseline after 90 days — proposed'),t('تقرير خط الأساس واتجاه زمن الإنجاز','Baseline and cycle-time trend report')]
 ];
 const n=Math.min(5,Math.max(3,source.length));
 return Array.from({length:n},(_,i)=>{
  const outcome=source[i%source.length];let entry=types[i%3];const normalized=normalize(outcome);if(i<source.length&&/time|processing|زمن|وقت/.test(normalized))entry=types[2];if(i<source.length&&/quality|defect|جوده|اخطاء/.test(normalized))entry=types[1];
  return {outcome,metric:entry[0]+': '+entry[1],target:i<source.length&&/[0-9٠-٩]/.test(outcome)?outcome:entry[2],frequency,deliverable:entry[3]};
 });
}
function raci(c,locale='ar'){
 const ar=locale==='ar',t=(a,b)=>ar?a:b,tasks=sentences(c.responsibilities).slice(0,12);
 if(!c.title?.trim()||!tasks.length)throw Error(t('أدخل المسمى والمسؤوليات أولًا.','Enter the title and responsibilities first.'));
 const stakeholders=sentences(String(c.stakeholders||'').replace(/[,،]/g,'\n'));
 return tasks.map(responsibility=>({responsibility,R:c.title,A:c.manager||t('حدد صاحب القرار','Assign decision owner'),C:stakeholders[0]||t('حدد الإدارة المستشارة','Assign consulted department'),I:stakeholders.slice(1).join('، ')||c.department||t('حدد الجهة المطلعة','Assign informed department')}));
}
function raciKey(c){let hash=2166136261;for(const ch of JSON.stringify([c.responsibilities,c.title,c.manager,c.stakeholders]))hash=Math.imul(hash^ch.charCodeAt(0),16777619);return 'raci-v1-'+(hash>>>0).toString(16);}
function licenseNotice(c,nodes){
 const code=normalize(c.occupationCode).replace(/ /g,''),r=nodes.find(x=>x.level==='occupation'&&x.code===code);
 if(!r)return null;
 let group;
 if(/^(214|215|216)/.test(code))group='engineering';
 else if(/^2411|^3313/.test(code))group='accounting';
 else if(/^(22|32)/.test(code)&&!/^225/.test(code))group='health';
 else if(/مهندس|engineer/i.test(r.titleAr+' '+(r.titleEn||'')))group='engineering';
 const data={
 engineering:{authorityAr:'الهيئة السعودية للمهندسين',authorityEn:'Saudi Council of Engineers',source:'https://www.saudieng.sa/English/AboutSCE/Pages/PPE.aspx'},
 accounting:{authorityAr:'الهيئة السعودية للمراجعين والمحاسبين',authorityEn:'Saudi Organization for Chartered and Professional Accountants',source:'https://socpa.org.sa/Socpa/Membership/Associate-Membership.aspx?lang=en-us'},
 health:{authorityAr:'الهيئة السعودية للتخصصات الصحية',authorityEn:'Saudi Commission for Health Specialties',source:'https://scfhs.org.sa/en/requirements'}
 };
 return group?{...data[group],group,code,title:r.titleAr,checkedOn:'2026-09-13'}:null;
}
root.MiyarEnterpriseCore={normalize,search,skills,csv,diagnose,customGrade,kpis,raci,raciKey,licenseNotice,validateSalary,sentences,required,read,save,importDraft,importDecision,validateReferences,parseMatrix,KEY};
if(typeof module!=='undefined')module.exports=root.MiyarEnterpriseCore;
})(typeof window!=='undefined'?window:globalThis);
