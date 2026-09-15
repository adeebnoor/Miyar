const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
require('../dist/od-engine.js');
require('../dist/od-engine-priority.js');
const engine=globalThis.MiyarODEngine;
const settle=()=>new Promise(r=>setImmediate(r));

test('HC expert case becomes a reviewable Manager-level OD package without pretending vendor grading',()=>{
 const p=engine.generate(engine.hcExample,'en');
 assert.equal(p.family.id,'hc');
 assert.equal(p.content.title,'Human Capital Projects & Operations Manager');
 assert.equal(p.gradeRecommendation.level,'Manager level');
 assert.match(p.content.responsibilities,/RFP/);assert.match(p.content.responsibilities,/OPEX/);assert.match(p.content.purpose,/strategic objective/i);
 assert.match(p.content.qualifications,/Human Resources Management/);assert.match(p.content.experience,/7–10/);
 assert.match(p.content.skills,/Procurement/);assert.match(p.content.skills,/OPEX/);assert.ok(p.content.kpis.length>=5);
 assert.match(p.content.saudization,/100% Saudi/);assert.match(p.notices.join(' '),/verify|current official source/i);
 assert.match(p.notices.join(' '),/does not calculate Korn Ferry, Mercer or WTW/i);
 assert.ok(p.referenceQueries.ssco.includes('مدير الموارد البشرية'));assert.ok(p.referenceQueries.education.includes('إدارة الموارد البشرية'));
});

test('OD engine keeps uncertainty visible instead of inventing management or regulatory facts',()=>{
 const p=engine.generate({strategyObjective:'Improve internal service delivery',responsibilities:'Coordinate service requests\nPrepare monthly performance reports\nDocument process issues'},'en');
 assert.notEqual(p.gradeRecommendation.status,'approved');
 assert.match(p.gradeRecommendation.rationale,/formal evaluation|approved job-evaluation framework/i);
 assert.equal(p.content.occupationCode,undefined);assert.equal(p.content.educationFieldCode,undefined);assert.equal(p.content.saudization,undefined);
 assert.match(p.content.odGenerationBasis,/not a live market survey or approved job evaluation/i);
});

async function app(locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#enterprise/create',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const p=path.join(dir,String(url));return {ok:true,json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),blob:async()=>new w.Blob(['pdf'])};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await settle();await settle();return {w,dom,errors,$:id=>w.document.getElementById(id)};
}

test('HC example can be generated inside Position Design, linked to references and saved with OD provenance',async()=>{
 const a=await app('en');try{
  const panel=a.$('miyar-od-workbench');assert.ok(panel);const nav=a.w.document.querySelector('[data-od-nav]');assert.ok(nav);assert.equal(nav.getAttribute('href'),'#enterprise/create');
  panel.querySelector('[data-od-example]').click();panel.querySelector('[data-od-generate]').click();
  await settle();await settle();
  assert.equal(a.w.document.querySelector('[data-field=title]').value,'Human Capital Projects & Operations Manager');
  assert.equal(a.w.document.querySelector('[data-field=seniority]').value,'Manager level');
  assert.match(a.w.document.querySelector('[data-field=responsibilities]').value,/vendor contracts/);
  assert.match(a.w.document.querySelector('[data-field=qualifications]').value,/Proposed career path/);
  assert.match(a.w.document.querySelector('[data-field=saudization]').value,/100% Saudi/);
  assert.equal(a.w.document.querySelector('[data-field=saudizationSource]').value,'');
  assert.equal(a.w.document.querySelector('[data-field=saudizationDate]').value,'');
  assert.equal(a.w.document.querySelector('[data-field=educationLevel]').value,'6');
  assert.ok(a.w.document.querySelector('[data-field=occupationCode]').value.length>0,'SSCO suggestion should be resolved from the supplied reference');
  assert.ok(a.w.document.querySelector('[data-field=educationFieldCode]').value.length>0,'education suggestion should be resolved from the supplied reference');
  assert.match(a.$('ent-kpi-matrix').value,/95%/);assert.match(a.$('ent-skill-matrix').value,/OPEX/);
  assert.match(panel.querySelector('[data-od-result]').textContent,/Human Capital Projects & Operations Manager/);assert.match(panel.querySelector('[data-od-result]').textContent,/not a live market-survey result/i);
  a.$('ent-save').click();await settle();
  const saved=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY));assert.equal(saved.length,1);assert.equal(saved[0].content.jobFamily,'Human Capital');assert.match(saved[0].content.careerPath,/CHRO/);assert.match(saved[0].content.odGenerationBasis,/rule-based proposal/i);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
