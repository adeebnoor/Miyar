const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/role-recommender'),E=require('../dist/od-engine');
const taxonomy=require('../dist/classifications/ssco-2019.json'),education=require('../dist/classifications/education-2020.json');
const benchmark=require('./fixtures/goal-benchmark-100-6-3-3.json');
const nodes=taxonomy.nodes;

test('fixed authored 100 bilingual goals reach at least 85% first-reference accuracy with source provenance',()=>{
 assert.equal(benchmark.cases.length,100);assert.equal(benchmark.sourceSha256,taxonomy.sha256);
 assert.match(benchmark.provenance,/not independently/);
 let correct=0;const misses=[];
 for(const x of benchmark.cases){
  const source=nodes.find(r=>r.level==='occupation'&&r.code===x.expectedCode);
  assert.equal(source?.titleAr,x.sourceTitleAr,x.id+' expected reference must match supplied source');assert.equal(source?.sourcePage,x.sourcePage,x.id+' source page');
  const r=R.recommend({objective:x.goal,locale:x.locale},nodes,education.fields);
  if(r?.status==='proposed-for-review'&&r.candidate.ssco===x.expectedCode)correct++;
  else misses.push({id:x.id,expected:x.expectedCode,actual:r?.candidate?.ssco,status:r?.status});
 }
 assert.ok(correct/100>=benchmark.minimumFirstReferenceAccuracy,JSON.stringify({correct,total:100,misses}));
});

test('Arabic task nouns and actor forms map cleaning, driving and teaching to precise references',()=>{
 const cases=[['تنظيف المكاتب يومياً','911201'],['ينظف المكاتب يومياً','911201'],['قيادة سيارة الرئيس التنفيذي','832201'],['يقود سيارة الرئيس التنفيذي','832201'],['تعليم الرياضيات لطلاب الثانوي','233010'],['يعلم الرياضيات لطلاب الثانوي','233010'],['تدريس الرياضيات للمرحلة الابتدائية','234107']];
 for(const [goal,code] of cases){const r=R.recommend({objective:goal},nodes);assert.equal(r?.candidate?.ssco,code,goal);assert.equal(r?.status,'proposed-for-review',goal);}
});

test('directory and structural title-code matching share English translations and distinguish wrong codes',()=>{
 assert.equal(R.matchTitleCode('Software Engineer','251204',nodes).status,'matched');
 assert.equal(R.matchTitleCode('مهندسة برمجيات','251204',nodes).status,'matched');
 const wrong=R.matchTitleCode('Accountant','251204',nodes);assert.equal(wrong.status,'inconsistent');assert.deepEqual(wrong.expectedCodes,['241101']);
 assert.equal(R.matchTitleCode('Unrecognized synthetic role','251204',nodes).status,'unknown');
 assert.equal(R.directorySearch(nodes,'Software Engineer')[0].code,'251204');
 for(const role of R.catalog.roles){const a=R.matchTitleCode(role.titleEn,role.ssco,nodes);assert.equal(a.status,'matched',role.titleEn+' must share the catalog translation');}
});

test('BI, data and cybersecurity use relevant supplied references and an emerging-mapping warning',()=>{
 for(const [goal,code] of [['Build a data warehouse and dashboards','242102'],['Data Analyst','212002'],['Protect the network against cyber attacks','252904']]){const r=R.recommend({objective:goal},nodes);assert.equal(r?.candidate?.ssco,code);assert.ok(r.source);if(code==='252904'){assert.equal(r.candidate.mappingStatus,'emerging-occupation-nearest-reference');assert.ok(r.checks.some(c=>c.id==='mapping-scope'&&c.status==='warn'));}}
});

test('retention and patient-safety outcomes ask whether a position is needed instead of passing Nurse',()=>{
 for(const [goal,locale] of [['Reduce nurse turnover in ICU and improve patient safety','en'],['خفض دوران الممرضين وتحسين سلامة المرضى','ar']]){
  const input={objective:goal,locale},r=R.recommend(input,nodes);
  assert.equal(r.status,'needs-confirmation');assert.equal(r.clarificationKind,'work-design');assert.equal(r.candidate,null);assert.equal(r.finalTitle,null);assert.ok(r.alternatives.length>=2);assert.ok(!r.checks.some(c=>c.status==='pass'));
  const p=E.generate({strategyObjective:goal},locale);assert.equal(p.clarificationKind,'work-design');assert.equal(p.content,undefined);
 }
});

test('recruit/train/manage separate the actor from the affected occupational group',()=>{
 for(const goal of ['Recruit software engineers','توظيف مهندسي البرمجيات']){const r=R.recommend({objective:goal},nodes);assert.equal(r.status,'needs-confirmation');assert.equal(r.clarificationKind,'actor-object');assert.deepEqual(r.candidates.map(x=>x.ssco),['242305','251204']);}
 const arabicTraining=R.recommend({objective:'تدريب الممرضين'},nodes);assert.equal(arabicTraining.clarificationKind,'actor-object');assert.equal(arabicTraining.candidates[0].ssco,'242402');
 const training=R.recommend({objective:'Train nurses'},nodes);assert.equal(training.clarificationKind,'actor-object');assert.equal(training.candidates[0].ssco,'242402');assert.equal(training.candidates[1].ssco,'222101');
 const manage=R.recommend({objective:'Manage nurses'},nodes);assert.equal(manage.clarificationKind,'actor-object');assert.equal(manage.candidates[0].level,'supervisor');
 const chief=R.recommend({objective:'Hire a Chief Executive to lead the company'},nodes);assert.equal(chief.clarificationKind,'actor-object');assert.ok(chief.candidates.some(x=>x.ssco==='112002'));
});

test('nonsense produces neither an occupation nor an OD package even with an explicit department',()=>{
 assert.equal(R.recommend({title:'Software Engineer',domain:'Information Technology',responsibilities:'asdf qwer zxcv'},nodes),null);
 for(const goal of ['asdf qwer zxcv','asdf','سشسيب غثث'])for(const domain of ['', 'Finance']){assert.equal(R.recommend({objective:goal,domain},nodes),null);assert.throws(()=>E.generate({strategyObjective:goal,department:domain},'en'),/Unsupported family|No supported|insufficient/i);}
});

test('domain pass accurately labels terminology overlap and does not certify the need',()=>{
 const r=R.recommend({objective:'Administer medications and monitor vital signs'},nodes);
 assert.equal(r.candidate.ssco,'222101');const check=r.checks.find(x=>x.id==='domain');assert.match(check.en,/terminology match/);assert.doesNotMatch(check.en,/Field and title are consistent/);
});

test('each catalog role has a readable proposed education default and codes present in supplied education snapshot',()=>{
 const fields=new Set(education.fields.map(x=>x.code));
 for(const role of R.catalog.roles){assert.ok(role.educationCodes.length,role.titleEn);assert.ok(role.educationCodes.every(x=>fields.has(x)),role.titleEn);assert.ok(role.educationDefaultAr.length>20);assert.ok(role.educationDefaultEn.length>20);}
 const p=E.generate({strategyObjective:'تعليم الرياضيات لطلاب الثانوي'},'ar');assert.match(p.content.qualifications,/الرياضيات/);assert.equal(p.referenceQueries.educationLevelLabel,'بكالوريوس أو ما يعادلها');assert.notEqual(p.content.educationLevelLabel,'6');
});

test('shared translations refresh after the lazily loaded browser catalog arrives',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),context=vm.createContext({MiyarRoleCatalog:{families:[],roles:[]}});
 vm.runInContext(fs.readFileSync(require.resolve('../dist/role-recommender'),'utf8'),context);
 vm.runInContext(fs.readFileSync(require.resolve('../dist/role-catalog'),'utf8'),context);
 assert.equal(context.MiyarRoleRecommender.matchTitleCode('Software Engineer','251204',nodes).status,'matched');
 assert.equal(context.MiyarRoleRecommender.recommend({objective:'توظيف مهندسي البرمجيات'}).clarificationKind,'actor-object');
});

test('employee retention clarification uses HR ownership and never invents a medical context',()=>{
 const goals=[['Improve employee retention, workforce planning and talent development across human resources','en'],['تحسين الاحتفاظ بالموظفين وتخطيط القوى العاملة وتطوير المواهب','ar']];
 for(const [goal,locale] of goals){const input={objective:goal,locale},r=R.recommend(input,nodes);assert.equal(r.status,'needs-confirmation');assert.equal(r.clarificationContext,'people');assert.deepEqual(r.candidates.map(x=>x.ssco),['242302','242319','242307']);assert.ok(r.candidates.every(x=>x.family==='hc'));assert.doesNotMatch(r.message,/nurs|patient|تمريض|مرضي|مرضى/i);assert.equal(r.candidate,null);assert.equal(r.finalTitle,null);}
 const clinical=R.recommend({objective:'Reduce nurse turnover in ICU and improve patient safety',locale:'en'},nodes);assert.equal(clinical.clarificationContext,'health');assert.ok(clinical.candidates.some(x=>x.family==='health'));
 for(const goal of ['Improve customer retention and reduce churn','تحسين الاحتفاظ بالعملاء']){const r=R.recommend({objective:goal},nodes);assert.equal(r.clarificationContext,'customer');assert.ok(r.candidates.some(x=>x.family==='customerService'));assert.ok(r.candidates.every(x=>x.family!=='health'));assert.equal(r.candidate,null);}
});
