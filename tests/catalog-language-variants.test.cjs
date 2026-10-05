const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/role-recommender'),E=require('../dist/od-engine');

// Additional phrasing regressions are developer checks, not the independent
// employer-written gold set required for commercial readiness.
const cases=[
 ['Finance','Record cash received from customers; follow up unpaid sales invoices; reconcile balances owed by clients','AR Accountant','specialist'],
 ['المالية','إعداد المطالبات المستحقة على العملاء؛ متابعة المتأخرات؛ تسوية حسابات العملاء','AR Accountant','specialist'],
 ['Finance','Prepare cash flow forecasts; monitor liquidity; arrange banking transactions','Treasury Analyst','specialist'],
 ['Finance','Calculate depreciation expense; update the register of fixed assets; reconcile the asset ledger','Fixed Assets Accountant','specialist'],
 ['المالية','حساب إهلاك الموجودات؛ تحديث دفتر الأصول الثابتة؛ مطابقة الأرصدة','Fixed Assets Accountant','specialist'],
 ['Finance','Prepare value added tax declarations; compute zakat; submit returns to the tax authority','Tax & Zakat Accountant','specialist'],
 ['Finance','Keep a petty cash book; issue receipts for payments; file vouchers','Accounts Clerk','assistant'],
 ['Human Resources','Screen job applicants; interview shortlisted people; issue offer letters','Recruitment Specialist','specialist'],
 ['الموارد البشرية','استقبال طلبات التوظيف؛ دراسة السير الذاتية؛ إجراء مقابلات المرشحين؛ إعداد عروض العمل','Recruitment Specialist','specialist'],
 ['Human Resources','Handle employee grievances; investigate disciplinary complaints; advise managers on labour disputes','Employee Relations Specialist','specialist'],
 ['Human Resources','Conduct annual appraisals; set employee objectives; consolidate performance ratings','Performance Management Specialist','specialist'],
 ['Administration','Coordinate the CEO diary; book accommodation and flights; take minutes at executive meetings','Executive Assistant','assistant'],
 ['الشؤون الإدارية','تنظيم مفكرة المدير؛ حجز الفنادق والطيران؛ كتابة محاضر الاجتماعات','Executive Assistant','assistant'],
 ['Administration','Receive letters; register outward mail; index electronic documents','Records & Correspondence Clerk','assistant'],
 ['الشؤون الإدارية','تسجيل المراسلات الواردة؛ تسجيل الكتب الصادرة؛ تصنيف الملفات الورقية','Records & Correspondence Clerk','assistant'],
 ['Administration','Handle office supply orders; monitor cleaning contractors; manage catering bookings','Office Services Coordinator','specialist'],
 ['Administration','Renew employees residency permits; handle visa applications; update company registrations','Government Relations Officer','specialist'],
 ['Information Technology','Implement web services; develop server-side applications; review source code','Software Engineer','specialist'],
 ['Information Technology','Create business intelligence reports; query relational databases; build dashboards','BI / Data Analyst','specialist'],
 ['Information Technology','Maintain firewall rules; investigate SOC alerts; assess vulnerabilities','Information Security Specialist','specialist'],
 ['Information Technology','Administer access control on databases; monitor security events; respond to incidents','Information Security Specialist','specialist'],
 ['Security','Conduct site rounds; check CCTV footage; log security incidents','Security Guard','assistant'],
 ['الأمن والسلامة','يشرف على أربعة حراس؛ ينظم الورديات؛ يراجع تقارير الوقائع الأمنية','Security & Safety Supervisor','supervisor']
];
for(const [department,responsibilities,title,level]of cases)test('ordinary wording: '+department+' / '+title+' / '+responsibilities,()=>{
 const input={department,responsibilities,strategyObjective:'Improve department service delivery'},r=R.recommend(input);
 assert.equal(r?.status,'proposed-for-review');assert.equal(r.candidate.titleEn,title);assert.equal(r.candidate.level,level);
 for(const locale of ['ar','en']){const p=E.generate(input,locale);assert.equal(p.family.id,r.candidate.family);assert.equal(p.gradeRecommendation.level,level);assert.equal(p.content.title,locale==='ar'?r.candidate.titleAr:title);}
});
for(const [department,responsibilities,title]of [
 ['Finance','Review cash forecasts','Treasury Analyst'],
 ['Administration','Arrange travel','Executive Assistant'],
 ['Information Technology','Build a travel mobile application; implement booking screens; validate app behaviour','Software Engineer']
])test('brief evidence preserves the relevant confirmation choice: '+title,()=>{
 const input={department,responsibilities,strategyObjective:'Improve department service delivery'},r=R.recommend(input);
 assert.equal(r.status,'needs-confirmation');assert.equal(r.candidates.length,3);assert.ok(r.candidates.some(x=>x.titleEn===title));
 for(const locale of ['ar','en']){const p=E.generate(input,locale);assert.equal(p.status,r.status);assert.deepEqual(p.candidates,r.candidates);assert.equal(E.generate({...input,confirmedRole:title},locale).content.title,locale==='ar'?r.candidates.find(x=>x.titleEn===title).titleAr:title);}
});

for(const [department,responsibilities]of [
 ['الشؤون الإدارية','مراجعة الأهداف؛ توثيق النتائج'],
 ['Finance','Review team objectives; document meetings; prepare management reports']
])test('a generic stakeholder/activity word cannot establish a department conflict: '+department,()=>{
 const input={department,responsibilities,strategyObjective:'Improve department service delivery'},r=R.recommend(input);
 assert.equal(r?.status,'needs-confirmation');assert.equal(r.detection.severeConflict,false);
 for(const locale of ['ar','en'])assert.equal(E.generate(input,locale).status,'needs-confirmation');
});
