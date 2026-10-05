const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom');
const dir=path.join(__dirname,'../dist'),R=require('../dist/role-recommender.js');
const nodes=JSON.parse(fs.readFileSync(path.join(dir,'classifications/ssco-2019.json'))).nodes;
const edu=JSON.parse(fs.readFileSync(path.join(dir,'classifications/education-2020.json'))).fields;
const cases=[
 ['projectDevelopment','تطوير المشاريع ودراسة الجدوى وتقييم المواقع ومراحل التطوير','Prepare project development feasibility studies, business cases and development stage gates','242114','121313'],
 ['investment','تحليل الفرص الاستثمارية وتقييم الأصول والفحص النافي للجهالة','Analyze investment opportunities, valuation and due diligence','241308','121110'],
 ['internalAudit','خطة المراجعة الداخلية واختبار الضوابط وتوثيق أدلة المراجعة','Prepare internal audit plans, test controls and document audit evidence','241321','121939'],
 ['strategy','صياغة الاستراتيجية والأهداف الاستراتيجية والمقارنات المعيارية','Develop corporate strategy, strategic objectives and benchmarking','242204','121317'],
 ['pmo','حوكمة المشاريع والجداول الزمنية من خلال مكتب إدارة المشاريع','Coordinate PMO project governance, milestones and schedule control','242114','121909']
];
for(const [family,ar,en,specialist,manager]of cases)for(const [locale,objective]of [['ar',ar],['en',en]])for(const [seniority,code]of [['specialist',specialist],['manager',manager]])test(`${family} ${locale} ${seniority} returns sourced role and tailored skills`,()=>{
 const r=R.recommend({objective:objective+(seniority==='manager'?'; lead five employees; approve work plans':''),seniority},nodes,edu);assert.equal(r.candidate.family,family);assert.equal(r.candidate.ssco,code);assert.ok(r.source);assert.equal(r.source.titleAr,r.candidate.referenceTitleAr);assert.equal(r.source.sourcePage,r.candidate.sourcePage);assert.ok(r.candidate.skillsEn.length>=5);assert.ok(r.finalTitle);assert.ok(r.candidate.educationCodes.length);
 if(['pmo','projectDevelopment'].includes(family))assert.equal(r.checks.find(x=>x.id==='mapping-scope').status,'warn');
});
test('report recipients and negative work do not determine function or seniority',()=>{
 for(const objective of ['Prepare internal audit plans, test controls and report findings to the Finance Director without owning payroll operations.','إعداد خطة المراجعة الداخلية واختبار الضوابط ورفع التقارير للمدير المالي، دون إدارة الرواتب.']){
  const r=R.recommend({objective},nodes);assert.equal(r.candidate.family,'internalAudit');assert.equal(r.candidate.level,'specialist');assert.equal(r.detection.interpretation.reporting.length,1);assert.equal(r.detection.interpretation.excluded.length,1);assert.doesNotMatch(r.detection.text,/Finance Director|المدير المالي|payroll|الرواتب/);
 }
});
test('explicit level overrides wording; explicit no-management scope constrains it',()=>{
 const r=R.recommend({objective:'Investment analysis without management duties',seniority:'Manager'},nodes);assert.equal(r.status,'blocked');assert.equal(r.finalTitle,null);
});
test('complex mixed descriptions retain separate reviewable functions',()=>{
 const r=R.recommend({objective:'Coordinate project governance through the PMO; evaluate investment opportunities and conduct due diligence; develop strategic objectives and benchmarking.'},nodes);
 assert.deepEqual(new Set(r.detection.workstreams.map(x=>x.family.id)),new Set(['pmo','investment','strategy']));assert.equal(r.checks.find(x=>x.id==='mixed-scope').status,'warn');assert.equal(r.score.calibratedConfidence,null);
});
test('tasks after a report recipient are retained; Arabic conjunctions match task terms',()=>{
 const r=R.recommend({objective:'Report to the Finance Director and conduct internal audit testing and prepare audit evidence.'},nodes);assert.equal(r.candidate.family,'internalAudit');assert.equal(r.candidate.level,'specialist');assert.ok(R.has('وتخطيط القوى العاملة','تخطيط القوى العاملة'));assert.equal(R.has('investment audit','it'),false);
});
async function app(route,locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html')),{url:'https://example.test/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;require('./local-workspace.cjs')(w);
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async url=>({ok:true,json:async()=>String(url).startsWith('./')?JSON.parse(fs.readFileSync(path.join(dir,String(url).split('?')[0]))):{}});
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 await new Promise(r=>setTimeout(r,80));return {w,d:w.document,dom,errors};
}
test('each added example produces a single card and the selected role carries into OD',async()=>{
 const a=await app('#demo');try{
  for(const [family]of cases){a.d.querySelector(`[data-hr-example=${family}]`).click();await new Promise(r=>setTimeout(r,40));assert.equal(a.d.querySelectorAll('.demo-v5-primary-recommendation').length,1);assert.equal(a.d.querySelector('[data-role-family]').dataset.roleFamily,family);assert.ok(a.d.querySelector('.hr-context'));}
  a.d.querySelector('[data-demo-primary-hr]').click();await new Promise(r=>setTimeout(r,80));assert.equal(a.w.location.hash,'#enterprise/create');assert.equal(a.d.querySelector('[data-field=occupationCode]').value,'242114');assert.match(a.d.querySelector('[data-field=title]').value,/PMO Specialist/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('all four service guides render in both languages and the skills example actually extracts three terms',async()=>{
 for(const locale of ['ar','en']){const a=await app('#enterprise/intelligence',locale);try{
  assert.ok(a.d.querySelector('[data-hr-guide=intelligence]'));a.d.querySelector('[data-hr-load-example]').click();assert.match(a.d.querySelector('#ent-skills').textContent,/Due diligence|الفحص النافي/);assert.equal(a.d.querySelectorAll('#ent-skills .ent-skill-grid > div').length,3);
  for(const id of ['manpower','compensation','grading']){a.w.location.hash='#enterprise/'+id;for(let tries=0;tries<30&&!a.d.querySelector(`[data-hr-guide=${id}]`);tries++)await new Promise(r=>setTimeout(r,20));assert.ok(a.d.querySelector(`[data-hr-guide=${id}]`),id);assert.equal(a.d.querySelectorAll('[data-hr-guide]').length,1);}
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('internal audit OD does not inherit authority to operate the processes it audits',async()=>{
 const a=await app('#enterprise/create');try{const p=a.w.MiyarODEngine.generate({strategyObjective:'Prepare internal audit plans',responsibilities:'Test controls\nDocument audit evidence\nReport findings',requestedLevel:'Specialist'},'en');assert.equal(p.family.id,'internalAudit');assert.match(p.content.authorities,/does not own operating controls/);assert.match(p.content.skills,/Risk-based audit/);assert.doesNotMatch(p.notices.join(' '),/Generic template within/);}finally{a.dom.window.close();}
});
