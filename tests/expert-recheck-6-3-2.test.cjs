const test=require('node:test'),assert=require('node:assert/strict'),R=require('../dist/role-recommender'),E=require('../dist/od-engine'),C=require('../dist/compensation-engine');
const inputs=[
 ['المالية','إدخال فواتير الموردين، مطابقتها، أرشفة المستندات','مدير إدارة','blocked'],
 ['Finance','Enter supplier invoices; match to POs; archive documents','manager','blocked'],
 ['المالية','إعداد القيود؛ تسوية الحسابات البنكية','مدير','blocked'],
 ['المالية','إعداد القيود؛ تسوية الحسابات؛ يشرف على محاسبين اثنين','مدير','manager',2,'warn'],
 ['المالية','يقود 25 محاسباً؛ يعتمد القوائم؛ يعرض على المجلس','مدير إدارة','director',25],
 ['المالية','يقود 25 محاسباً؛ يعتمد القوائم؛ يعرض على المجلس','أخصائي','blocked'],
 ['المالية','إعداد القيود؛ تسوية الحسابات؛ يعمل ضمن فريق من 25 محاسباً','','specialist',null],
 ['Finance','Prepare accounting entries; reconcile bank accounts; Work within a team of 25 accountants','','specialist',null],
 ['Engineering','Part of a team of 10 engineers; design HVAC systems; review engineering calculations','','specialist',null],
 ['المالية','إعداد القيود؛ تسوية الحسابات؛ يرفع تقاريره إلى مدير الإدارة الذي يقود 30 موظفاً','','specialist',null],
 ['المالية','يدير عشرة محاسبين؛ يعتمد القيود','','manager',10],
 ['المالية','يرأس قسم الخزينة ويشرف على خمسة موظفين؛ يراجع التدفقات النقدية','','manager',5],
 ['Finance','Line manager to four payroll accountants; approve journal entries','','manager',4],
 ['Human Resources','VP of Human Resources; leads HR teams across three subsidiaries','','director',null],
 ['Finance','Chief Financial Officer: lead the finance function of 60 staff; approve financial statements','','director',60],
 ['Human Resources','Prepare payroll for 400 employees; reconcile GOSI contributions','','specialist',null],
 ['Internal Audit','Lead 5 internal audits per year; test controls; document audit evidence','','specialist',null],
 ['Information Technology','Build dashboards in Power BI; write SQL queries; automate data pipelines','','specialist',null,null,'Business Intelligence Analyst'],
 ['Facilities','Repair HVAC units under the supervision of a licensed engineer; replace filters; log work orders','','technician',null,null,'HVAC Maintenance Technician'],
 ['Information Technology','Configure firewalls; monitor security alerts in the SIEM; run vulnerability scans','','specialist',null,null,'Information Security Specialist'],
 ['Human Resources','Manage the recruitment pipeline; screen candidates; schedule interviews with hiring managers','','specialist',null,null,'Recruitment Specialist'],
 ['Information Technology','Develop web applications in React; build REST APIs; write automated tests','','specialist',null,null,'Software Engineer'],
 ['Human Resources','Develop backend APIs in Python; write unit tests; deploy to Kubernetes','','conflict'],
 ['Security','Patrol the premises; monitor CCTV cameras; control visitor access','','assistant',null,null,'Security Guard'],
 ['الأمن والسلامة','الإشراف على حراس الأمن؛ مراقبة الكاميرات؛ إعداد تقارير الحوادث','','supervisor',null],
 ['Human Resources','Prepare payroll; reconcile GOSI contributions','manager','blocked']
];
for(const [department,responsibilities,requestedLevel,want,count,warning,title]of inputs)test('report acceptance: '+responsibilities,()=>{const input={department,responsibilities,requestedLevel,strategyObjective:'Deliver department objectives'};if(want==='conflict'){assert.throws(()=>R.recommend(input),e=>e.code==='MIYAR_DOMAIN_CONFLICT');assert.throws(()=>E.generate(input),e=>e.code==='MIYAR_DOMAIN_CONFLICT');return;}const r=R.recommend(input);if(want==='blocked'){assert.equal(r.status,'blocked');assert.equal(r.finalTitle,null);assert.throws(()=>E.generate(input));if(requestedLevel){const titled={...input,requestedLevel:'',title:requestedLevel};assert.equal(R.recommend(titled).status,'blocked');}return;}assert.equal(r.candidate?.level,want);assert.equal(r.directReports,count);if(title)assert.equal(r.candidate.titleEn,title);if(warning)assert.equal(r.checks.find(x=>x.id==='leadership').status,warning);const p=E.generate(input);assert.equal(p.content.title,r.candidate.titleEn);assert.equal(p.gradeRecommendation.level,want);});
for(const department of ['','Nursing','التمريض'])for(const locale of ['ar','en'])test('nursing exact parity '+department+locale,()=>{const input={department,responsibilities:'Administer medications; monitor vital signs; document nursing care plans',strategyObjective:'Deliver department objectives'};const r=R.recommend(input),p=E.generate(input,locale);assert.equal(p.content.title,locale==='ar'?r.candidate.titleAr:r.candidate.titleEn);});
test('privacy and CSV acceptance',()=>{for(const id of ['501234567','A12345678','PASSPORT-A12345678'])assert.throws(()=>C.parseRoster('id,currentSalary\n'+id+',25000'),e=>e.code==='ROSTER_PRIVACY');for(const id of ['Pos-Senior-Accountant','EMP-0001','E17'])assert.equal(C.parseRoster('ID;CurrentSalary\n'+id+';٢٥٠٠٠')[0].currentSalary,'25000');assert.equal(C.parseRoster('id,currentSalary\nE17,"25,000"')[0].currentSalary,'25000');});
test('Saudi salary coercion happens before arithmetic',()=>{const raw={asOf:'2026-10-05',regime:'saudi-existing',applicabilityConfirmed:true,sanedEligible:true,housingMonthly:'2500',otherMonthly:0,contributoryExtraMonthly:0,medicalAnnual:0,serviceYears:0};assert.deepEqual(C.saudiCost('10000','monthly',raw),C.saudiCost(10000,'monthly',raw));for(const salary of [-1,NaN,Infinity])assert.throws(()=>C.saudiCost(salary,'monthly',raw),/positive finite/);});
test('brief supported scope asks for confirmation without fabricating duties',()=>{const input={department:'Finance',responsibilities:'Review receivables',strategyObjective:'Deliver department objectives'};const r=R.recommend(input);assert.equal(r.status,'needs-confirmation');assert.equal(r.candidates.length,3);assert.ok(r.candidates.some(x=>x.titleEn==='AR Accountant'));assert.equal(E.generate(input).status,'needs-confirmation');const confirmed=E.generate({...input,confirmedRole:'AR Accountant'});assert.equal(confirmed.content.title,'AR Accountant');});

for(const [department,responsibilities,title,level]of [
 ['Administration','Maintain the executive calendar; arrange meetings; coordinate travel','Executive Assistant','assistant'],
 ['الشؤون الإدارية','متابعة البريد الوارد؛ تسجيل الصادر؛ ترتيب الأرشيف','Records & Correspondence Clerk','assistant'],
 ['Administration','Review facilities contracts; order office supplies; arrange catering','Office Services Coordinator','specialist'],
 ['Administration','Update commercial registration; process visas through Absher and Muqeem','Government Relations Officer','specialist'],
 ['Finance','Reconcile petty cash; record receipts','Accounts Clerk','assistant'],
 ['Finance','Review receivables; collect overdue invoices; reconcile customer collections','AR Accountant','specialist'],
 ['Finance','Prepare VAT tax return; reconcile ZATCA and zakat records','Tax & Zakat Accountant','specialist'],
 ['Finance','Review the cash position; prepare the cash forecast; maintain banking relationships','Treasury Analyst','specialist'],
 ['Finance','Maintain the fixed asset register; calculate depreciation','Fixed Assets Accountant','specialist'],
 ['Finance','Prepare management accounts; update the rolling forecast','Management Accountant','specialist'],
 ['Human Resources','Coordinate performance review; check objective setting; consolidate ratings','Performance Management Specialist','specialist']
])test('expanded role coverage: '+title,()=>{const input={department,responsibilities,strategyObjective:'Deliver department objectives'},r=R.recommend(input);assert.equal(r.candidate?.titleEn,title);assert.equal(r.candidate.level,level);assert.equal(E.generate(input).content.title,title);});

for(const department of ['Human Resources','Administration','الموارد البشرية','الشؤون الإدارية'])test('government-relations shared scope without brand names: '+department,()=>{const ar=/[\u0600-\u06ff]/.test(department),input={department,responsibilities:ar?'معالجة التأشيرات؛ تحديث السجل التجاري':'Process visas; renew commercial registration',strategyObjective:'Deliver department objectives'},r=R.recommend(input);assert.equal(r.status,'proposed-for-review');assert.equal(r.detection.severeConflict,false);assert.match(r.candidate.intent,/government/i);assert.equal(E.generate(input).content.title,r.candidate.titleEn);});
test('inflected Arabic number words preserve owned people counts',()=>assert.equal(R.analyzeLevel({responsibilities:'يدير واحدا وعشرين موظفا؛ يعتمد القوائم المالية'}).directReports,21));
