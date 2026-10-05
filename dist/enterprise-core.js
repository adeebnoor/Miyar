(function(root){
'use strict';
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().replace(/\s+/g,' ');
function search(nodes,q,parent){const n=normalize(q),parts=n.split(' ').filter(Boolean);return nodes.filter(r=>(parent===undefined?r.level==='occupation':r.parent===parent)&&parts.every(t=>normalize([r.code,r.titleAr,r.titleEn||'',...(r.aliases||[])].join(' ')).includes(t))).sort((a,b)=>Number(normalize(b.titleAr)===n||b.code===n)-Number(normalize(a.titleAr)===n||a.code===n)||a.code.localeCompare(b.code));}
function skills(text,vocabulary){const n=' '+normalize(text)+' ';return vocabulary.map(s=>({...s,evidence:[s.labelAr,s.labelEn,...s.aliases].filter(t=>t&&(n.includes(' '+normalize(t)+' ')||n.includes(' و'+normalize(t)+' ')||n.includes(' ف'+normalize(t)+' ')))})).filter(s=>s.evidence.length);}
function csv(text){
 if(text.length>10000000)throw Error('10 MB maximum');const rows=[];let row=[],cell='',quoted=false,closed=false;text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;}else if(c==='"'){if(cell||closed)throw Error('Malformed CSV quote');quoted=true;}else if(c===delimiter||c==='\n'){row.push(cell);cell='';closed=false;if(c==='\n'){rows.push(row);row=[];if(rows.length>10001)throw Error('10,000 rows maximum');}}else if(c==='\r'&&text[i+1]==='\n'){}else {if(closed&&c.trim())throw Error('Malformed CSV quoted cell');cell+=c;}}
 if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}const headers=(rows.shift()||[]).map(x=>x.trim());if(new Set(headers).size!==headers.length)throw Error('Duplicate headers');const aliases={'المسمى':'title','المسمى الوظيفي':'title','الادارة':'department','الرمز المهني':'occupationCode','المرؤوسون':'directReports','الميزانية':'budgetAmount','الصلاحيات':'authority','معرف المنصب':'positionId','المنصب الاب':'parentPositionId','الدرجة':'grade'},known=['title','department','occupationCode','directReports','budgetAmount','authority','positionId','parentPositionId','grade','caseId','expectedCode','miyarCode','baselineCode','humanMinutes','miyarMinutes'],aliasMap=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[normalize(k),v])),mapped=headers.map(h=>aliasMap[normalize(h)]||known.find(k=>k.toLowerCase()===h.toLowerCase())||h);
 if(new Set(mapped).size!==mapped.length)throw Error('Duplicate normalized headers');if(rows.some(r=>r.length>headers.length))throw Error('Row contains extra values');return rows.map((r,i)=>({r,i})).filter(({r})=>r.some(x=>x.trim())).map(({r,i})=>Object.defineProperty(Object.fromEntries(mapped.map((h,j)=>[h,String(r[j]??'').trim()])), '__row',{value:i+2,enumerable:false}));
}
function gradeRank(value){const m=String(value||'').match(/^(?:G|grade\s*|الدرجة\s*)?0*(\d+)(?:\b|$)/i);return m?Number(m[1]):null;}
function scopeNumber(value){const digits='٠١٢٣٤٥٦٧٨٩',persian='۰۱۲۳۴۵۶۷۸۹';return Number(String(value??'').normalize('NFKC').replace(/[٠-٩۰-۹]/g,c=>String(digits.indexOf(c)>=0?digits.indexOf(c):persian.indexOf(c))).replace(/−/g,'-').replace(/[,٬]/g,'').trim());}
function diagnose(rows,nodes,missing=[]){
 if(!rows.length||rows.length>10000)throw Error('Use 1–10,000 rows');const roles=new Map(nodes.filter(r=>r.level==='occupation').map(r=>[r.code,r])),flagged=new Set(missing.map(x=>x.code)),groups=new Map(),errors=[];let matcher=root.MiyarRoleRecommender;if(!matcher&&typeof require==='function'){try{matcher=require('./role-recommender.js');}catch{}}
 const budgets=rows.map(r=>scopeNumber(r.budgetAmount)).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b),medianBudget=budgets.length?(budgets[Math.floor((budgets.length-1)/2)]+budgets[Math.ceil((budgets.length-1)/2)])/2:null;let aligned=0,assessable=0;
 const items=rows.map((r,i)=>{const row=Number.isInteger(r.__row)?r.__row:i+2,title=String(r.title||'').trim(),code=normalize(r.occupationCode).replace(/ /g,''),role=roles.get(code),flags=[];let status='unknown';if(!title){flags.push('missing_title');errors.push({row,field:'title',code:'missing_title'});}else if(!code)flags.push('missing_code');else if(!role)flags.push('unknown_code');else if(flagged.has(code))flags.push('source_issue');else{const m=matcher?.matchTitleCode?.(title,code,nodes);status=m?.status||(normalize(title)===normalize(role.titleAr)||normalize(title)===normalize(role.titleEn)?'matched':'unknown');if(status==='matched')aligned++;else flags.push(status==='inconsistent'?'title_code_inconsistent':'title_code_unknown');}
  const supplied=k=>r[k]!==undefined&&String(r[k]).trim()!=='';const reports=supplied('directReports')?scopeNumber(r.directReports):null,budget=supplied('budgetAmount')?scopeNumber(r.budgetAmount):null;
  if(reports!==null&&(!Number.isInteger(reports)||reports<0))flags.push('invalid_direct_reports');if(budget!==null&&(!Number.isFinite(budget)||budget<0))flags.push('invalid_budget');if(flags.some(x=>x==='invalid_direct_reports'||x==='invalid_budget'))flags.push('invalid_scope');
  if(['directReports','budgetAmount','authority'].every(supplied)&&!flags.includes('invalid_scope')){assessable++;if(/(?:^| )(?:مدير|رئيس|director|head|chief)(?: |$)/.test(normalize(title))&&reports===0&&budget===0&&/recommend|يقترح|توصيات|يوصي/.test(normalize(r.authority)))flags.push('title_scope_review');}
  if(/^(?:all|unlimited|absolute|كافة|كافه|كل|مطلقه|مطلقة|جميع)(?: الصلاحيات| authority| authorities)?$/.test(normalize(r.authority)))flags.push('absolute_authority');if(Number.isFinite(budget)&&medianBudget&&budget>medianBudget*10)flags.push('budget_outlier');if(reports>15)flags.push('wide_span');
  const key=normalize(title)+'|'+normalize(r.department);if(title)groups.set(key,[...(groups.get(key)||[]),row]);return {row,title,department:r.department||'',positionId:String(r.positionId||'').trim(),parentPositionId:String(r.parentPositionId||'').trim(),grade:String(r.grade||'').trim(),directReports:reports,budgetAmount:budget,occupationCode:code,sourceTitle:role?.titleAr||'',sourceTitleEn:role?.titleEn||'',sourcePage:role?.sourcePage,flags,titleCodeStatus:status,titleCodeAligned:status==='matched',layer:null};});
 const byId=new Map(),ids=new Map();for(const r of items)if(r.positionId){ids.set(r.positionId,[...(ids.get(r.positionId)||[]),r]);if(!byId.has(r.positionId))byId.set(r.positionId,r);}for(const [,group]of ids)if(group.length>1)for(const r of group)r.flags.push('duplicate_position_id');
 let layers=0;const memo=new Map();function depth(start){if(memo.has(start))return memo.get(start);const path=[],seen=new Map();let current=start,base=null;while(current){if(memo.has(current)){base=memo.get(current);break;}if(seen.has(current)){for(const x of path.slice(seen.get(current)))if(!x.flags.includes('hierarchy_cycle'))x.flags.push('hierarchy_cycle');break;}if(!current.positionId||current.flags.includes('duplicate_position_id'))break;seen.set(current,path.length);path.push(current);if(!current.parentPositionId){base=0;break;}const parent=byId.get(current.parentPositionId);if(!parent){if(!current.flags.includes('missing_parent'))current.flags.push('missing_parent');break;}current=parent;}for(let i=path.length-1;i>=0;i--){base=base===null?null:base+1;memo.set(path[i],base);}if(!memo.has(start))memo.set(start,null);return memo.get(start);}
 const hierarchyProvided=items.some(r=>r.positionId||r.parentPositionId||r.grade);for(const r of items){if(hierarchyProvided&&!r.positionId)r.flags.push('missing_position_id');if(r.parentPositionId&&!byId.has(r.parentPositionId)&&!r.flags.includes('missing_parent'))r.flags.push('missing_parent');r.layer=depth(r);if(r.layer!==null)layers=Math.max(layers,r.layer);const parent=byId.get(r.parentPositionId),rank=gradeRank(r.grade),pRank=gradeRank(parent?.grade);if(parent&&parent!==r&&!r.flags.includes('hierarchy_cycle')&&rank!==null&&pRank!==null&&rank>=pRank)r.flags.push('grade_inversion');if(r.grade&&rank===null)r.flags.push('unknown_grade');}
 for(const r of items){r.actualDirectReports=items.filter(child=>child!==r&&child.parentPositionId===r.positionId).length;if(hierarchyProvided&&r.positionId&&Number.isInteger(r.directReports)&&r.directReports!==r.actualDirectReports)r.flags.push('direct_reports_mismatch');}
 const spans=items.map(r=>r.directReports).filter(n=>Number.isInteger(n)&&n>0).sort((a,b)=>a-b),spanOfControl=spans.length?{managers:spans.length,averageSpan:Math.round(10*spans.reduce((a,b)=>a+b,0)/spans.length)/10,medianSpan:spans.length%2?spans[(spans.length-1)/2]:(spans[spans.length/2-1]+spans[spans.length/2])/2,singleReportManagers:spans.filter(n=>n===1).length,narrowManagers:spans.filter(n=>n<=3).length,wideManagers:spans.filter(n=>n>=15).length}:null;
 return {spanOfControl,totalRows:rows.length,validRows:items.filter(r=>r.title).length,rowErrors:errors,exactTitleCodePairs:aligned,titleCodeAlignmentPercent:Math.round(1000*aligned/rows.length)/10,scopeAssessableRows:assessable,titleScopeReviewRows:items.filter(r=>r.flags.some(x=>['title_scope_review','absolute_authority','budget_outlier','wide_span','invalid_scope'].includes(x))).length,hierarchy:{layers,roots:items.filter(r=>r.positionId&&!r.parentPositionId).length,missingParents:items.filter(r=>r.flags.includes('missing_parent')).map(r=>r.row),cycleRows:items.filter(r=>r.flags.includes('hierarchy_cycle')).map(r=>r.row),gradeInversions:items.filter(r=>r.flags.includes('grade_inversion')).map(r=>({row:r.row,positionId:r.positionId,parentPositionId:r.parentPositionId,grade:r.grade,parentGrade:byId.get(r.parentPositionId)?.grade}))},duplicateGroups:[...groups.entries()].filter(([,r])=>r.length>1).map(([key,r])=>({title:key.split('|')[0],department:key.split('|')[1],rows:r})),rows:items};
}
function evaluationWarnings(answers){const people=Number(answers.people),warnings=[];for(const factor of ['autonomy','impact'])if(Number.isFinite(people)&&Number.isFinite(Number(answers[factor]))&&Math.abs(people-Number(answers[factor]))>2)warnings.push({code:'factor_inconsistency',factor,peopleLevel:people,otherLevel:Number(answers[factor])});return warnings;}
function validateEvaluation(f,answers,evidence={},options={}){for(const factor of f.factors){if(!factor.levels.some(l=>l.id===String(answers[factor.id])))throw Error('Answer every factor');const text=String(evidence[factor.id]||'').trim();if(text.length<40||/^(?:documented evidence|evidence|دليل موثق|الدليل)\s*\d*$/i.test(text))throw Object.assign(Error('Provide at least 40 characters of job-specific evidence for every factor'),{field:factor.id,evidence:true});}const evidenceGroups=new Map();for(const factor of f.factors){const text=normalize(evidence[factor.id]);evidenceGroups.set(text,[...(evidenceGroups.get(text)||[]),factor.id]);}const repeated=[...evidenceGroups.values()].find(ids=>ids.length>2);if(repeated)throw Object.assign(Error('Provide distinct job-specific evidence for each factor; the same text is repeated in more than two factors'),{field:repeated[2],evidence:true});const warnings=evaluationWarnings(answers);if(warnings.length&&String(evidence.consistencyJustification||'').trim().length<40)throw Object.assign(Error('Explain inconsistent people, autonomy and impact levels with at least 40 characters'),{field:'consistencyJustification'});if(options.committee){const committee=evidence.committee;if(!Array.isArray(committee)||committee.length<2||new Set(committee.map(x=>normalize(x.evaluatorId))).size!==committee.length||committee.some(x=>String(x.evaluatorId||'').trim().length<3))throw Object.assign(Error('Record at least two distinct evaluators and their factor ratings'),{field:'committee'});for(const member of committee){for(const factor of f.factors)if(!factor.levels.some(l=>l.id===String(member.answers?.[factor.id])))throw Object.assign(Error('Each evaluator must rate every factor'),{field:'committee'});if(evaluationWarnings(member.answers).length&&String(evidence.consistencyJustification||'').trim().length<40)throw Object.assign(Error('Explain inconsistent people, autonomy and impact levels with at least 40 characters'),{field:'consistencyJustification'});}}return warnings;}
function customGrade(f,answers,options){if(f.method!=='custom')throw Error('Licensed vendor implementation required');if(f.factors.reduce((n,x)=>n+Number(x.weight),0)!==100)throw Error('Weights must total 100');if(options?.evidence)validateEvaluation(f,answers,options.evidence,options);let score=0;const breakdown=f.factors.map(x=>{const l=x.levels.find(y=>y.id===String(answers[x.id]));if(!l)throw Error('Answer every factor');const points=Number(l.points)*Number(x.weight)/10;score+=points;return {factor:x.id,points};});const points=Math.round(score+1e-9),band=f.bands.find(b=>b.min<=points&&points<=b.max);if(!band)throw Error('Points outside configured bands');const committee=(options?.evidence?.committee||[]).map(x=>({evaluatorId:x.evaluatorId,answers:x.answers,points:customGrade(f,x.answers).points}));return {points,band,breakdown,warnings:evaluationWarnings(answers),committee:committee.length?{verified:false,members:committee,pointsDifference:Math.max(...committee.map(x=>x.points))-Math.min(...committee.map(x=>x.points)),factorDifferences:f.factors.map(x=>({factor:x.id,difference:Math.max(...committee.map(m=>Number(m.answers[x.id])))-Math.min(...committee.map(m=>Number(m.answers[x.id])))}))}:null,illustrative:f.illustrative,method:'custom'};}
function gradeComparisons(result,position,positions=[]){const rank=gradeRank(result.band?.id),content=position?.content||{},warnings=[];if(rank===null)return warnings;const parent=positions.find(p=>p.id===content.parentPositionId),parentRank=gradeRank(parent?.content?.salaryGrade||parent?.content?.evaluatedGrade);if(parent&&parentRank!==null&&rank>=parentRank)warnings.push({code:'grade_inversion',parentPositionId:parent.id,parentGrade:parent.content.salaryGrade||parent.content.evaluatedGrade});const family=content.jobFamily||content.field,peers=positions.filter(p=>p.id!==position.id&&(p.content?.jobFamily||p.content?.field)===family&&family).map(p=>({id:p.id,grade:p.content.salaryGrade||p.content.evaluatedGrade})).filter(p=>gradeRank(p.grade)!==null);if(peers.length){const sorted=peers.map(p=>gradeRank(p.grade)).sort((a,b)=>a-b),median=(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.ceil((sorted.length-1)/2)])/2;if(Math.abs(rank-median)>=3)warnings.push({code:'horizontal_grade_review',family,medianGrade:median,peers});}return warnings;}
const required=['title','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors'];
const KEY='miyar-enterprise-local-v1';
function read(storage){const value=JSON.parse(storage.getItem(KEY)||'[]');if(!Array.isArray(value)||value.length>100)throw Error('Invalid local workspace');return value;}
function save(storage,content,existing){
 validatePosition(content);const rows=read(storage);if(rows.length>=100&&!existing)throw Error('100 local drafts maximum');const prior=existing?rows.find(x=>x.id===existing.id):null;
 if(existing&&(!prior||prior.revision!==existing.revision))throw Error('A newer local revision exists; reload first');
 const annotations=['salaryGrade','evaluationSummary','evaluatedPositionId','evaluatedPositionRevision','evaluationCommitteeJSON'];
 let verifiedAnnotation=false;if(prior&&content.evaluatedPositionId===prior.id&&content.evaluatedPositionRevision===prior.revision){try{const entries=JSON.parse(storage.getItem('miyar-position-evaluations-v1')||'[]');verifiedAnnotation=entries.some(e=>e.positionId===prior.id&&e.revision===prior.revision&&annotations.every(key=>content[key]===e.linked?.[key]));}catch{}}
 const comparable=c=>JSON.stringify(Object.fromEntries(Object.entries(c).filter(([key])=>!verifiedAnnotation||!annotations.includes(key)).sort(([a],[b])=>a.localeCompare(b))));
 if(prior&&comparable(content)===comparable(prior.content))return {...prior,content:structuredClone(content)};
 const id=prior?.id||'LOCAL-'+root.crypto.randomUUID(),revision=(prior?.revision||0)+1,at=new Date().toISOString(),clean=structuredClone(content);
 if(prior&&clean.evaluatedPositionId){for(const key of annotations)delete clean[key];delete clean.annualCostMin;delete clean.annualCostMax;}
 const row={id,internalCode:id,title:clean.title,revision,content:clean,state:'draft',updatedAt:at,createdAt:prior?.createdAt||at,versions:[...(prior?.versions||[]),{revision,content:structuredClone(clean),createdAt:at,reason:'Local draft save'}]};
 const next=[row,...rows.filter(x=>x.id!==id)],text=JSON.stringify(next);if(text.length>4000000)throw Error('Local workspace exceeds 4 MB');storage.setItem(KEY,text);return row;
}
function importDraft(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid position package');
 const source=payload.content;
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Package must contain position content');
 const fields=new Set([...required,'field','seniority','requestType','department','manager','effectiveDate','certifications','occupationCode','occupationRelease','educationLevel','educationFieldCode','constraints','saudization','saudizationSource','saudizationDate','license','licenseSource','licenseDate','headcount','annualCost','directReports','raci','skillRequirements','mappingJustification','provisional','provisionalParent','sourceDecisionId','sourceDecisionInput','importNotes','kpis','performanceBasis','raciBasis','salaryMin','salaryMax','salaryCurrency','salaryPeriod','salarySource','salaryGrade','evaluationSummary','jobFamily','experienceYears','experienceType','employmentType','location','workMode','parentPositionId','costBasis','costExceptionReason','annualCostMin','annualCostMax','evaluatedPositionId','evaluatedPositionRevision','evaluationCommitteeJSON','strategyObjective','marketTitle','careerPath','recommendedLevel','gradeRecommendationBasis','odGenerationBasis']);
 const content={};
 for(const [key,value] of Object.entries(source)){
  if(!fields.has(key))continue;
  if(['raci','skillRequirements','kpis'].includes(key)){
   const allowed=key==='raci'?['responsibility','R','A','C','I']:key==='kpis'?['outcome','metric','baseline','target','duration','frequency','deliverable']:['name','type','level','evidence'];
   if(!Array.isArray(value)||value.length>100||value.some(r=>!r||typeof r!=='object'||Array.isArray(r)||Object.entries(r).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>4000)))throw Error('Invalid matrix entries');
  }else if(['headcount','annualCost','directReports','salaryMin','salaryMax','experienceYears','annualCostMin','annualCostMax','evaluatedPositionRevision'].includes(key)){
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
 validatePosition(content);
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
 if(hasMin!==hasMax||(hasMin&&(!Number.isFinite(c.salaryMin)||!Number.isFinite(c.salaryMax)||c.salaryMin<=0||c.salaryMax<c.salaryMin||c.salaryMax>1e12)))throw Error('Enter a valid minimum and maximum salary');
 if(c.salaryPeriod&&!['monthly','annual'].includes(c.salaryPeriod))throw Error('Choose monthly or annual salary');
 if(c.salaryCurrency&&!(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):['SAR','AED','BHD','KWD','OMR','QAR','USD','EUR','GBP','EGP']).includes(c.salaryCurrency))throw Error('Use a recognized currency code');
}
function positionError(message,fields){const error=Error(message);error.fields=fields;throw error;}
function guidedPositionSuggestions(content,recommender,nodes,education,locale='ar'){
 const ar=locale==='ar',input={objective:content.businessNeed||'',responsibilities:content.responsibilities||'',domain:content.field||content.department||'',title:content.title||'',directReports:content.directReports,constraints:content.constraints||'',locale};
 if(!input.objective.trim()&&!input.responsibilities.trim())return {status:'waiting',values:{},provenance:[],message:ar?'اكتب الهدف والمهام، وسأقترح ما يمكن معرفته منهما.':'Describe the goal and duties; I will suggest what can be established from them.'};
 let result;try{result=recommender?.recommend(input,nodes,education);}catch(error){return {status:'review-required',values:{},provenance:[],message:error.message};}
 if(!result||result.status!=='proposed-for-review'||!result.candidate||!result.source)return {status:result?.status||'review-required',values:{},provenance:[],message:(ar?result?.messageAr:result?.messageEn)||(ar?result?.message:undefined)||(ar?'المهام لا تكفي لاختيار دور موثوق. أضف ما سينفذه صاحب المنصب ومن يملك القرار.':'The duties do not yet establish a reliable role. Add what the position will deliver and who owns decisions.'),candidates:result?.candidates||[]};
 const role=result.candidate,family=recommender.catalog.families.find(f=>f.id===role.family),values={title:ar?role.titleAr:role.titleEn,field:ar?family.ar:family.en,jobFamily:ar?family.ar:family.en,occupationCode:String(result.source.code)};
 const levelNames={assistant:['مساعد','Assistant'],technician:['فني','Technician'],specialist:['أخصائي','Specialist'],supervisor:['مشرف','Supervisor'],manager:['مدير','Manager'],director:['مدير إدارة','Director'],executive:['تنفيذي','Executive']};
 if(levelNames[role.level])values.seniority=levelNames[role.level][ar?0:1];
 if(role.educationLevel!==undefined)values.educationLevel=String(role.educationLevel);
 if(role.educationCodes?.length)values.educationFieldCode=role.educationCodes[0];
 if(ar?role.educationDefaultAr:role.educationDefaultEn)values.qualifications=ar?role.educationDefaultAr:role.educationDefaultEn;
 if((ar?role.skillsAr:role.skillsEn)?.length)values.skills=(ar?role.skillsAr:role.skillsEn).join('\n');
 if(content.businessNeed?.trim())values.purpose=content.businessNeed.trim();
 const provenance=Object.keys(values).map(field=>({field,source:field==='purpose'?'user-description':'catalog-and-supplied-reference',referenceCode:result.source.code,sourcePage:result.source.sourcePage,reviewRequired:true}));
 const performance=String(content.successMeasures||''),duration=performance.match(/(?:within|over|خلال)\s+[0-9٠-٩۰-۹]+\s*(?:days?|weeks?|months?|years?|يوم|أيام|ايام|أسابيع|اسابيع|أشهر|اشهر|شهور|سنوات|سنة)/i),baseline=performance.match(/(?:baseline|خط\s*الأساس|خط\s*الاساس)\s*[:=]?\s*([0-9٠-٩۰-۹]+(?:[.,][0-9٠-٩۰-۹]+)?\s*(?:%|days?|يوم|أيام|ايام)?)/i);
 const kpiProposal={outcome:performance||content.businessNeed||'',metric:ar?role.metricAr:role.metricEn,baseline:baseline?.[1]||'',target:performance,duration:duration?.[0]||'',frequency:'',deliverable:''};
 return {status:'proposed-for-review',values,provenance,kpiProposal,anchors:result.anchors||[],message:ar?'مقترحات قابلة للتعديل من مهامك ودليل المهن. التكلفة والصلاحيات والأهداف الفعلية تحتاج تأكيدك.':'Editable proposals from your duties and the occupation directory. Costs, authority and actual performance targets need your confirmation.'};
}
function annualBand(c){
 if(!c.salaryGrade||!Number.isFinite(c.salaryMin)||!Number.isFinite(c.salaryMax)||(c.salaryCurrency||'SAR')!=='SAR')return null;
 const months=c.salaryPeriod==='annual'?1:12;
 return {min:c.salaryMin*months,max:c.salaryMax*months,mid:(c.salaryMin+c.salaryMax)*months/2,currency:'SAR',source:c.salarySource||''};
}
function positionCost(c){const band=annualBand(c),headcount=c.headcount??1;return band?{annualCost:Math.round(band.mid*headcount*100)/100,annualCostMin:band.min,annualCostMax:band.max,costBasis:'grade-band'}:null;}
function validateKpis(rows){
 const required=['outcome','metric','baseline','target','duration'];
 if(!Array.isArray(rows)||!rows.length)positionError('Complete at least one KPI before opening the request',['kpis']);
 const invalid=rows.flatMap((row,index)=>required.filter(key=>!String(row[key]??'').trim()).map(key=>({key,index})));
 if(invalid.length){const error=Object.assign(Error('Complete the KPI baseline, target and duration before opening the request'),{fields:invalid.map(x=>x.key),kpiErrors:invalid});throw error;}
 return true;
}
function validatePosition(c,options={}){
 const warnings=[],reports=c.directReports??0,headcount=c.headcount??1,scope=normalize([c.seniority,c.team].join(' ')),exception=c.costBasis==='manual-exception'&&String(c.costExceptionReason||'').trim().length>=30;
 for(const key of ['headcount','directReports','experienceYears'])if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]<0||!Number.isInteger(c[key])||(key==='headcount'&&c[key]<1)))positionError('Use valid whole numbers for headcount, reports and experience',[key]);
 if(reports>0&&/\bindividual contributor\b|\bindependent contributor\b|\bic\b|no direct reports|مساهم فردي|ممارس مستقل|لا يوجد مرؤوسون|دون مرؤوسين|بدون مرؤوسين|لا يشرف/.test(scope))positionError('Individual contributors must have zero direct reports',['directReports','team','seniority']);
 if(reports>15)warnings.push({id:'wide-span',ar:'نطاق الإشراف يتجاوز 15 مرؤوسًا؛ وثّق قدرة المدير وتوزيع الإشراف قبل الاعتماد.',en:'Span exceeds 15 direct reports; document manager capacity and supervision arrangements before approval.'});
 for(const [key,choices] of Object.entries({employmentType:['permanent','contract','temporary'],workMode:['onsite','hybrid','remote'],costBasis:['grade-band','manual-exception']}))if(c[key]&&!choices.includes(c[key]))positionError('Choose a valid employment, work mode or cost basis',[key]);
 if(c.annualCost!==undefined){
  if(!Number.isFinite(c.annualCost)||c.annualCost<0)positionError('Enter a valid annual position cost',['annualCost']);
  const perPerson=c.annualCost/headcount,minimum=options.minimumAnnualPerPerson??12000;
  if(perPerson<1000)positionError('Annual employer cost below 1,000 per person is blocked even with a manual exception' ,['annualCost','headcount']);
  if(perPerson<minimum&&!exception)positionError('Annual cost is implausibly low for the requested headcount; use the evaluated grade band or document a manual exception',['annualCost','headcount','costExceptionReason']);
  const band=annualBand(c);if(band&&(c.annualCost<band.min*headcount||c.annualCost>band.max*headcount)&&!exception)positionError('Annual cost must follow the grade band times headcount; explain a manual exception',['annualCost','headcount','costExceptionReason']);
 }
 if(c.costBasis==='manual-exception'&&!exception)positionError('A manual cost exception needs a reason of at least 30 characters',['costExceptionReason']);
 if(exception)warnings.push({id:'manual-cost',ar:'التكلفة استثناء يدوي موثق؛ يتطلب اعتماد المالية. حد المعقولية توضيحي وليس حدًا نظاميًا للأجور.',en:'Cost is a documented manual exception requiring Finance approval. The plausibility threshold is illustrative, not a statutory wage floor.'});
 if(options.submit){
  if(!(c.kpis||[]).some(k=>['outcome','metric','baseline','target','duration'].every(key=>String(k[key]??'').trim())))positionError('Submission needs at least one KPI with baseline, target and duration',['kpis']);
  if(!c.salaryGrade||!c.jobFamily||!annualBand(c))positionError('Provide a proposed grade, job family and salary band before submission',['jobFamily','salaryGrade','salaryMin']);
  if(c.annualCost===undefined||!c.costBasis)positionError('Calculate annual cost from the evaluated band before submission',['annualCost','costBasis']);
  if(options.positionId&&(c.evaluatedPositionId!==undefined||c.evaluatedPositionRevision!==undefined)&&(c.evaluatedPositionId!==options.positionId||c.evaluatedPositionRevision!==options.revision))positionError('The evaluation must belong to this position and revision',['evaluatedPositionId']);
 }
 return {warnings,band:annualBand(c),cost:positionCost(c)};
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
 engineering:{authorityAr:'الهيئة السعودية للمهندسين',authorityEn:'Saudi Council of Engineers',source:'https://www.uqn.gov.sa/details?p=24294',sourceLabelAr:'اللائحة التنفيذية للمهن الهندسية — أم القرى',sourceLabelEn:'Engineering practice regulations — Umm Al-Qura',checkedOn:'2026-10-04'},
 accounting:{authorityAr:'الهيئة السعودية للمراجعين والمحاسبين',authorityEn:'Saudi Organization for Chartered and Professional Accountants',source:'https://socpa.org.sa/Sites/E-Services/M/11.aspx?t=content',sourceLabelAr:'عضوية الانتساب والتسجيل المهني — الهيئة',sourceLabelEn:'Associate membership and professional registration — SOCPA',checkedOn:'2026-10-04'},
 health:{authorityAr:'الهيئة السعودية للتخصصات الصحية',authorityEn:'Saudi Commission for Health Specialties',source:'https://scfhs.org.sa/en/requirements'}
 };
 return group?{checkedOn:'2026-09-13',...data[group],group,code,title:r.titleAr}:null;
}
root.MiyarEnterpriseCore={normalize,search,skills,csv,diagnose,customGrade,validateEvaluation,evaluationWarnings,gradeComparisons,gradeRank,kpis,raci,raciKey,licenseNotice,validateSalary,validatePosition,validateKpis,guidedPositionSuggestions,annualBand,positionCost,sentences,required,read,save,importDraft,importDecision,validateReferences,parseMatrix,KEY};
if(typeof module!=='undefined')module.exports=root.MiyarEnterpriseCore;
})(typeof window!=='undefined'?window:globalThis);
