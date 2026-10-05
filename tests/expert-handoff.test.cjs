const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../dist/role-recommender.js'),C=require('../dist/compensation-engine.js'),M=require('../dist/manpower-engine.js');
const nodes=require('../dist/classifications/ssco-2019.json').nodes,education=require('../dist/classifications/education-2020.json').fields;
const hrCases=[
 ['إعداد ومعالجة رواتب الموظفين شهريا ورفع التقارير للمدير المالي','payroll','242322','121210'],
 ['استقطاب وفرز المرشحين واجراء المقابلات والتوظيف','recruitment','242305','121206'],
 ['سياسة الاجور والحوافز والمزايا','rewards','242306','121207'],
 ['تخطيط القوى العاملة واعداد خطة التوظيف السنوية','workforce','242319','121203'],
 ['تصميم الهيكل التنظيمي وتوصيف الوظائف','od','242109','121205'],
 ['إدارة المواهب والتعاقب الوظيفي','talent','242307','121208'],
 ['معالجة علاقات الموظفين وتسوية النزاعات','employeeRelations','242302','121215'],
 ['تصميم خطط التعلم والتطوير والتدريب','learning','242402','121212'],
 ['تطوير الموارد البشرية وتحسين سياسات الموارد البشرية','hrDevelopment','242404','121213'],
 ['تحليل الوظائف وتصنيف الوظائف','jobAnalysis','242323','121204'],
 ['إدارة شؤون الموظفين وملفات الإجازات','personnel','242310','121215'],
 ['تشغيل خدمات الموارد البشرية اليومية','hrOperations','242303','121214'],
 ['متابعة الحضور والانصراف','attendance','441602','121215'],
 ['التوطين وتحقيق نسب السعودة','saudization','242303','121202'],
 ['اعداد التقارير والمؤشرات للموارد البشرية','analytics','242303','121202'],
 ['ادارة بوابة الموظفين والنظام الالكتروني للموارد البشرية','hris','242303','121214'],
 ['تهيئة الموظفين عند الانضمام وإخلاء طرف المغادرين','onboarding','242303','121215'],
 ['متابعة خدمات قوى والتأمينات الاجتماعية ومقيم','government','243202','121215'],
 ['إدارة التأمين الطبي للموظفين','insurance','242306','121207'],
 ['تحسين تجربة الموظفين والارتباط الوظيفي','engagement','242303','121215'],
 ['شريك أعمال الموارد البشرية ودعم قادة الأعمال','hrbp','242303','121202']
];
for(const [objective,intent,sc,mc] of hrCases)for(const [seniority,code] of [['أخصائي',sc],['مدير',mc]])test(`expert HR ${intent} / ${seniority}`,()=>{const r=R.recommend({objective,domain:'الموارد البشرية',seniority},nodes,education);assert.equal(r.candidate.intent,intent);assert.equal(r.candidate.ssco,code);assert.ok(r.finalTitle);assert.equal(r.checks.find(c=>c.id==='level').status,'pass');assert.equal(r.checks.find(c=>c.id==='ssco').status,'pass');});
for(const [objective,domain,family,code] of [
 ['إدارة حملات التسويق الرقمي وقياس العائد','التسويق','marketing','243103'],
 ['الاشراف على عمليات الصيانة الوقائية للمعدات','العمليات','maintenance','214907'],
 ['ضمان جودة المنتجات ومراجعة الامتثال للمواصفات','الجودة','quality','242198'],
 ['الرد على استفسارات العملاء ومعالجة الشكاوى','خدمة العملاء','customerService','332202'],
 ['تحليل تكلفة الرواتب ضمن الميزانية','المالية','finance','241104'],
 ['اعداد الميزانية السنوية وتحليل الانحرافات','المالية','finance','241314']
])test(`expert cross-domain ${family} / ${code}`,()=>{const r=R.recommend({objective,domain,seniority:'أخصائي'},nodes,education);assert.equal(r.candidate.family,family);assert.equal(r.candidate.ssco,code);if(code==='241104')assert.equal(r.detection.conflict,true);});
test('explicit specialist level wins over report recipient in Arabic and English',()=>{for(const objective of ['إعداد الرواتب ورفع التقارير للمدير المالي','Process payroll and report to the finance manager'])assert.equal(R.recommend({objective,seniority:'specialist'},nodes).candidate.ssco,'242322');});
test('HR executive and Arabic definite articles are recognized',()=>{const r=R.recommend({objective:'قيادة وظيفة الموارد البشرية بالكامل',domain:'الموارد البشرية',seniority:'رئيس تنفيذي'},nodes);assert.equal(r.candidate.ssco,'121201');});
test('constraints do not become positive role evidence and missing codes block the final title',()=>{assert.equal(R.recommend({objective:'quasar archaeology',constraints:'payroll'}),null);const r=R.recommend({objective:'payroll'},[]);assert.equal(r.finalTitle,null);assert.equal(r.checks.find(c=>c.id==='ssco').status,'fail');const limited=R.recommend({objective:'payroll',seniority:'manager',constraints:'no management duties'},nodes);assert.equal(limited.candidate.level,'specialist');assert.equal(limited.checks.find(c=>c.id==='level').status,'warn');});
test('education links are existing proposed codes, never official equivalence claims',()=>{const codes=new Set(education.map(r=>r.code));for(const r of R.catalog.roles){assert.ok(nodes.some(n=>n.code===r.ssco));for(const c of r.educationCodes)assert.ok(codes.has(c));}assert.equal(R.recommend({objective:'payroll'},nodes,education).score.calibratedConfidence,null);});
test('compensation holds above-target pay, flags band exceptions, includes on-cost in changes',()=>{for(const salary of [33000,45000]){const r=C.evaluate({...C.example,currentSalary:salary,headcount:2}).result;assert.equal(r.adjustmentPerFte,0);assert.equal(r.annualAdjustmentCost,0);assert.equal(r.recommendedSalary,salary);assert.equal(r.payAction,salary===45000?'red-circle':'hold');assert.equal(r.annualEmployerCost,Math.round(salary*24*1.15));}const r=C.evaluate({...C.example,currentSalary:15000}).result;assert.equal(r.bandStatus,'below-minimum');assert.equal(r.annualAdjustmentCost,124200);assert.equal(r.annualBaseAdjustmentCost,108000);});
test('fractional FTE gaps inside tolerance produce no contradictory headcount action',()=>{for(const targetWorkload of [120,80]){const p=M.plan({...M.example,targetWorkload,currentFte:2,horizonYears:1,attritionPercent:0,productivityGainPercent:0});assert.equal(p.scenarios.base.action,'balanced');assert.equal(p.scenarios.base.final.gapHeadcount,0);assert.equal(p.actions[0].type,'hold');}});
test('scenario demand, productivity and attrition can change independently',()=>{const p=M.plan({...M.example,scenarioOverrides:{high:{demandFactor:1,productivityDelta:.1,attritionDelta:0}}});assert.equal(p.scenarios.high.assumptions.targetWorkload,p.scenarios.base.assumptions.targetWorkload);assert.equal(p.scenarios.high.assumptions.annualAttritionPercent,p.scenarios.base.assumptions.annualAttritionPercent);assert.ok(p.scenarios.high.final.rawRequiredFte<p.scenarios.base.final.rawRequiredFte);});

test('Arabic attached prepositions and broad administration fields retain task-specific HR meaning',()=>{for(const [objective,domain,code] of [['إدارة ملفات الموظفين والإجازات والإجراءات المتعلقة بشؤون الموظفين','','242310'],['اصدار مسير الرواتب للموظفين و رفع تقارير الى الادارة العليا','ادارة عامة','242322']])assert.equal(R.recommend({objective,domain,seniority:'اخصائي'},nodes).candidate.ssco,code);});
