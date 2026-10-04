const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.join(__dirname,'../dist'),R=require('../dist/role-recommender.js');
const nodes=require('../dist/classifications/ssco-2019.json').nodes,education=require('../dist/classifications/education-2020.json').fields;
require('../dist/od-engine.js');require('../dist/od-engine-priority.js');require('../dist/qa-od-v5.js');
const E=globalThis.MiyarODEngine;

// Provenance matters: hcExample is the expert-provided English case retained in
// od-engine.js and documented in docs/phase1-od-engine.md. hcExampleAr is its
// repository-authored translation. The five service-guide examples and all
// boundary/overlap cases below are authored fixtures, not new expert quotes or
// an expert-calibrated accuracy dataset. No network or AI requests are made.
const guideSource=fs.readFileSync(path.join(dist,'hr-service-guide.js'),'utf8');
const guideExamples=vm.runInNewContext(guideSource.match(/const examples=(\[[\s\S]*?\n\]);/)[1]);
function recommend(input){return R.recommend(input,nodes,education);}
function proposal(input,locale='en'){
 const objective=input.objective||input.strategyObjective;
 return E.generate({strategyObjective:objective,responsibilities:input.responsibilities||objective+'\nDocument source evidence for review.',department:input.domain||input.department,requestedLevel:input.seniority||input.requestedLevel,constraints:input.constraints},locale);
}
function assertSameProposal(input,expected,locale='en'){
 const r=recommend(input);assert.ok(r,'supported tasks must yield a reviewable proposal');
 assert.equal(r.candidate.family,expected.family);assert.equal(r.candidate.level,expected.level||'specialist');
 assert.equal(r.status,'proposed-for-review');assert.equal(r.score.calibratedConfidence,null);
 const p=proposal(input,locale);assert.equal(p.family.id,r.candidate.family);assert.equal(p.content.title,locale==='ar'?r.candidate.titleAr:r.candidate.titleEn);
 assert.equal(p.gradeRecommendation.level,r.candidate.level);assert.equal(p.gradeRecommendation.status,'pre-evaluation');
 return {r,p};
}

test('expert-provided full English HC case retains its home family, owned support work and OD duties',()=>{
 const input=E.hcExample,r=recommend(input),p=E.generate(input,'en');
 assert.equal(r.candidate.family,'hc');assert.equal(r.candidate.intent,'portfolio');assert.equal(r.candidate.level,'manager');
 assert.equal(p.content.title,'Human Capital Projects & Operations Manager');assert.equal(p.family.id,'hc');
 assert.equal(p.content.responsibilities,input.responsibilities);assert.equal(p.content.saudization,input.saudizationNote);
 assert.ok(r.detection.workstreams.some(x=>x.family.id==='procurement'),'the expert really owns procurement work');
 assert.equal(r.checks.find(x=>x.id==='mixed-scope').status,'warn');assert.match(p.notices.join(' '),/current official source/);
});
test('authored Arabic translation of the expert HC case retains the same bounded portfolio proposal',()=>{
 const input=E.hcExampleAr,r=recommend(input),p=E.generate(input,'ar');
 assert.equal(r.candidate.family,'hc');assert.equal(r.candidate.intent,'portfolio');assert.equal(r.candidate.level,'manager');
 assert.equal(p.content.title,r.candidate.titleAr);assert.equal(p.content.responsibilities,input.responsibilities);
 assert.ok(r.detection.workstreams.some(x=>x.family.id==='procurement'));assert.match(p.notices.join(' '),/مصدر رسمي حالي/);
});
for(const row of guideExamples)for(const [locale,index]of [['ar',3],['en',4]])test(`authored full service example ${row[0]} ${locale} retains scoped tasks in recommender and OD`,()=>{
 const input={objective:row[index],domain:row[locale==='ar'?1:2],responsibilities:row[index].split(/[،,;؛]/).map(x=>x.trim()).filter(Boolean).join('\n')};
 const {r,p}=assertSameProposal(input,{family:row[0]},locale);
 assert.deepEqual(r.detection.workstreams.map(x=>x.family.id),[row[0]],'named collaborators are not independently owned functions');
 assert.equal(r.checks.some(x=>x.id==='mixed-scope'),false);assert.ok(p.content.responsibilities.includes(input.responsibilities.split('\n')[0]));
 if(row[0]==='projectDevelopment'){
  assert.ok(r.detection.interpretation.collaboration.length);assert.equal(r.checks.find(x=>x.id==='mapping-scope').status,'warn');
  if(locale==='en')assert.match(r.detection.text,/permits and development stage gates/,'development is a noun here, not an action boundary');
 }
 if(row[0]==='pmo'){
  assert.ok(r.detection.interpretation.reporting.length,'both languages preserve the reporting recipient as context');
  assert.doesNotMatch(r.detection.text,/Strategy Director|مدير الاستراتيجية/);
  assert.match(r.detection.text,locale==='ar'?/تقارير تقدم المشاريع/:/project status reports/,'the reporting activity remains usable task evidence');
 }
 if(row[0]==='internalAudit')assert.match(p.content.authorities,locale==='ar'?/لا يمتلك تشغيل الضوابط/:/does not own operating controls/);
});

const boundaryCases=[
 ['ar','رفع التقارير للمدير المالي وإعداد خطة المراجعة الداخلية واختبار الضوابط وتوثيق أدلة المراجعة دون تولي عمليات الرواتب.',/اختبار الضوابط/,/توثيق أدلة المراجعة/],
 ['ar','يرفع التقارير للمدير المالي ويختبر الضوابط ويوثق أدلة المراجعة الداخلية، ويتابع معالجة الملاحظات دون تشغيل العمليات المالية.',/يختبر الضوابط/,/يوثق أدلة المراجعة/],
 ['ar','لا يتولى إدارة الرواتب لكنه يعد خطة المراجعة الداخلية ويختبر الضوابط ويوثق الأدلة ويرفع التقارير للجنة المراجعة.',/يعد خطة المراجعة الداخلية/,/يختبر الضوابط/],
 ['ar','إعداد خطة المراجعة الداخلية دون إدارة الرواتب ويختبر الضوابط ويوثق أدلة المراجعة ويتابع إغلاق الملاحظات.',/يختبر الضوابط/,/يوثق أدلة المراجعة/],
 ['en','Report to the Finance Director and test controls and document internal audit evidence without operating payroll.',/test controls/,/document internal audit evidence/],
 ['en','Does not own payroll operations but tests controls and documents audit evidence and prepares internal audit reports for the Audit Committee.',/tests controls/,/documents audit evidence/],
 ['en','Prepare investment committee memoranda without executing transactions or management duties and monitor portfolio risk and evaluate investment opportunities.',/monitor portfolio risk/,/evaluate investment opportunities/]
];
for(const [locale,objective,...retained]of boundaryCases)test(`synthetic independent duties after recipient or exclusion ${locale}: ${objective}`,()=>{
 const {r}=assertSameProposal({objective},{family:objective.includes('investment')?'investment':'internalAudit'},locale);
 for(const phrase of retained)assert.match(r.detection.text,phrase);
 assert.doesNotMatch(r.detection.text,/Finance Director|المدير المالي|payroll|الرواتب/);
 assert.ok(r.detection.interpretation.reporting.length||r.detection.interpretation.excluded.length);
});

const collaboratorCases=[
 ['en','Prepare internal audit plans; coordinate audit evidence with Procurement.'],
 ['ar','إعداد خطة المراجعة الداخلية؛ تنسيق أدلة المراجعة مع المشتريات.'],
 ['en','Prepare internal audit plans and test controls in coordination with the Finance Director.'],
 ['ar','إعداد خطة المراجعة الداخلية واختبار الضوابط بالتنسيق مع المدير المالي.']
];
for(const [locale,objective]of collaboratorCases)test(`synthetic collaborator does not determine ownership or seniority ${locale}: ${objective}`,()=>{
 const {r,p}=assertSameProposal({objective},{family:'internalAudit'},locale);
 assert.deepEqual(r.detection.workstreams.map(x=>x.family.id),['internalAudit']);assert.ok(r.detection.interpretation.collaboration.length);
 assert.doesNotMatch(r.detection.text,/Procurement|Finance Director|المشتريات|المدير المالي/);
 assert.equal(p.notices.some(x=>/Multi-function scope|نطاق متعدد الوظائف/.test(x)),false);
});
for(const [locale,index]of [['ar',3],['en',4]])test(`authored investment exclusion list constrains explicit manager request ${locale}`,()=>{
 const row=guideExamples.find(x=>x[0]==='investment'),{r}=assertSameProposal({objective:row[index],seniority:'manager'},{family:'investment'},locale);
 assert.equal(r.requestedLevel,'manager');assert.equal(r.checks.find(x=>x.id==='level').status,'warn');
});
for(const [locale,objective]of [
 ['en','Manage the internal audit team without managing payroll operations; prepare internal audit plans and document audit evidence.'],
 ['ar','إدارة فريق المراجعة الداخلية دون إدارة الرواتب؛ إعداد خطة المراجعة الداخلية واختبار الضوابط وتوثيق الأدلة.']
])test(`synthetic exclusion of an audited operation does not prohibit audit management ${locale}`,()=>{
 const {r}=assertSameProposal({objective,seniority:'manager'},{family:'internalAudit',level:'manager'},locale);
 assert.equal(r.checks.find(x=>x.id==='level').status,'pass');assert.doesNotMatch(r.detection.text,/payroll|الرواتب/);
});

for(const [locale,objective,domain]of [
 ['en','Analyze payroll cost against the annual budget; forecast monthly costs and explain variances; process employee payroll and reconcile payslips; report findings to the Finance Director without managing the payroll team.','Finance'],
 ['ar','تحليل تكلفة الرواتب ضمن الميزانية وإعداد توقعات المصروفات الشهرية؛ معالجة رواتب الموظفين ومراجعة صحة كشوف الأجور؛ رفع التقارير للمدير المالي دون إدارة فريق.','المالية']
])test(`synthetic mixedFinance actual payroll and finance ownership remains reviewable ${locale}`,()=>{
 const {r,p}=assertSameProposal({objective,domain,seniority:'specialist'},{family:'finance'},locale);
 assert.equal(r.candidate.ssco,'241104');assert.equal(r.detection.conflict,true);
 assert.deepEqual(new Set(r.detection.workstreams.map(x=>x.family.id)),new Set(['finance','hc']));
 assert.equal(r.checks.find(x=>x.id==='mixed-scope').status,'warn');assert.ok(p.notices.some(x=>/Multi-function scope|نطاق متعدد الوظائف/.test(x)));
});
for(const [locale,objective]of [
 ['en','Coordinate PMO project governance and evaluate investment opportunities and conduct due diligence and develop corporate strategy and strategic objectives and benchmarking.'],
 ['ar','تنسيق حوكمة المشاريع من خلال PMO وتقييم الفرص الاستثمارية والفحص النافي للجهالة وصياغة الاستراتيجية والأهداف الاستراتيجية والمقارنات المعيارية.']
])test(`synthetic genuine overlapping functions retain every scope without punctuation ${locale}`,()=>{
 const r=recommend({objective});assert.ok(r);
 assert.deepEqual(new Set(r.detection.workstreams.map(x=>x.family.id)),new Set(['pmo','investment','strategy']));
 assert.equal(r.checks.find(x=>x.id==='mixed-scope').status,'warn');
 const p=proposal({objective},locale);assert.equal(p.family.id,r.candidate.family);assert.ok(p.notices.some(x=>/Multi-function scope|نطاق متعدد الوظائف/.test(x)));
});
test('synthetic methodological phrase with financial modelling remains task evidence rather than a Finance stakeholder',()=>{
 const r=recommend({objective:'Analyze investment opportunities with financial modelling and due diligence; evaluate investment risks.'});
 assert.equal(r.candidate.family,'investment');assert.match(r.detection.text,/financial modelling/);assert.equal(r.detection.interpretation.collaboration.length,0);
});
for(const objective of ['تنسيق توزيع البضائع ومراقبة المخزون والجرد في المستودع.','متابعة توزيع المنتجات وتحديث حالة المخزون وخطط النقل.'])test(`synthetic goods distribution remains Supply Chain after removing generic resource-distribution overlap: ${objective}`,()=>{
 const {r}=assertSameProposal({objective},{family:'supplyChain'},'ar');
 assert.deepEqual(r.detection.workstreams.map(x=>x.family.id),['supplyChain']);
});
for(const objective of ['Report to the Finance Director without owning payroll operations.','رفع التقارير للمدير المالي دون تولي عمليات الرواتب.'])test(`synthetic recipient and excluded duties alone cannot establish a supported role: ${objective}`,()=>{
 assert.equal(recommend({objective}),null);
});
