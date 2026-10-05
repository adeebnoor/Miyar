'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const actionIds=['ent-save','ent-save-open','ent-local-json','ent-preview-draft','ent-html-draft','ent-pdf-draft'];
const tick=()=>new Promise(r=>setTimeout(r,10));
async function app(locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#enterprise/create',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;require('./local-workspace.cjs')(w);
 const effects={downloads:0,pdfRequests:0};
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 w.URL.createObjectURL=()=>{effects.downloads++;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.includes('/position-pdf'))effects.pdfRequests++;if(value.startsWith('./'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,value.split('?')[0]),'utf8'))};return {ok:false,status:401,json:async()=>({detail:'Local test'})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 for(let i=0;i<100&&!w.document.querySelector('[data-od-generate]');i++)await tick();
 assert.ok(w.document.querySelector('[data-od-generate]'));
 return {w,dom,errors,effects,$:id=>w.document.getElementById(id),panel:()=>w.document.getElementById('miyar-od-workbench')};
}
function set(a,selector,value){const el=a.w.document.querySelector(selector);el.value=value;el.dispatchEvent(new a.w.Event('input',{bubbles:true}));}
async function generate(a,duties){
 set(a,'[data-od-strategy]','Improve accounting accuracy and close controls');set(a,'[data-od-department]','Finance');set(a,'[data-od-responsibilities]',duties);
 await runGenerate(a);
}
async function runGenerate(a){
 const button=a.panel().querySelector('[data-od-generate]');button.click();
 for(let i=0;i<100&&button.disabled;i++)await tick();assert.equal(button.disabled,false,'generation must finish');
}
const leadership='Lead a team of 25 accountants; approve consolidated financial statements; present the budget to the board.';
const conflicting='Administer medication; monitor vital signs; document nursing care plans.';

for(const locale of ['en','ar'])test(`rejected OD regeneration preserves fields but stops every old-draft output until corrected ${locale}`,async()=>{
 const a=await app(locale);try{
  await generate(a,leadership);const oldTitle=a.w.document.querySelector('[data-field=title]').value;
  assert.equal(a.w.document.querySelector('[data-number=directReports]').value,'25');
  await generate(a,conflicting);
  assert.equal(a.w.document.querySelector('[data-field=title]').value,oldTitle,'previous fields remain available for review');
  assert.equal(a.w.document.querySelector('[data-number=directReports]').value,'25');
  assert.equal(a.panel().querySelector('[data-od-result]').textContent,'');
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,false);
  assert.match(a.panel().querySelector('[data-od-blocked]').textContent,/regenerate|أعد التوليد/);
  for(const id of actionIds){
   const control=a.$(id);assert.equal(control.disabled,true,id+' is disabled after the failed update');
   control.disabled=false;control.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,cancelable:true}));
   assert.equal(control.disabled,true,id+' remains blocked even if another handler enables it');
  }
  await tick();assert.equal(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY),null);assert.equal(a.effects.downloads,0);assert.equal(a.effects.pdfRequests,0);assert.equal(a.w.document.querySelectorAll('.ent-report-dialog').length,0);
  await generate(a,'Lead a team of 6 accountants; approve accounting entries; review the financial close.');
  assert.equal(a.w.document.querySelector('[data-number=directReports]').value,'6');
  assert.notEqual(a.w.document.querySelector('[data-field=title]').value,oldTitle);
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,true);
  for(const id of actionIds)assert.equal(a.$(id).disabled,false,id+' resumes after successful correction');
  a.$('ent-save').click();await tick();
  const saved=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY));assert.equal(saved.length,1);assert.equal(saved[0].content.directReports,6);
  set(a,'[data-od-department]','Human Resources');set(a,'[data-od-strategy]','Improve employee payroll accuracy');set(a,'[data-od-responsibilities]','Prepare monthly payroll; reconcile social insurance contributions; calculate end of service benefits.');await runGenerate(a);
  assert.match(a.w.document.querySelector('[data-field=title]').value,/Payroll Specialist|أخصائي.*رواتب/);
  assert.equal(a.w.document.querySelector('[data-number=directReports]').value,'','an individual role clears the previous team count instead of retaining it or asserting zero');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('first OD failure does not block saving an independently authored draft',async()=>{
 const a=await app();try{
  set(a,'[data-field=title]','Independently authored draft');
  await generate(a,conflicting);
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,true);
  for(const id of actionIds)assert.equal(a.$(id).disabled,false);
  a.$('ent-save').click();await tick();
  const saved=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY));assert.equal(saved[0].content.title,'Independently authored draft');assert.equal(saved[0].content.jobFamily,undefined);
  for(const [key,value]of Object.entries({occupationCode:'241101',educationFieldCode:'041101',mappingJustification:'Previous reference'}))set(a,'[data-field='+key+']',value);
  a.w.fetch=async()=>{throw Error('Reference connection unavailable');};
  await generate(a,leadership);
  for(const key of ['occupationCode','educationFieldCode','mappingJustification'])assert.equal(a.w.document.querySelector('[data-field='+key+']').value,'','unverified references must not inherit the previous draft linkage');
  assert.match(a.panel().querySelector('[data-od-result]').textContent,/references could not be loaded/i);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('an OD input example keeps the old draft blocked until generated, while a new draft clears the old provenance',async()=>{
 const a=await app();try{
  await generate(a,leadership);await generate(a,conflicting);
  a.panel().querySelector('[data-od-example]').click();
  for(const id of actionIds)assert.equal(a.$(id).disabled,true);
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,false);
  assert.equal(a.panel().querySelector('[data-od-result]').textContent,'');
  assert.equal(a.w.MiyarEnterpriseCore.importDraft({content:{title:'Independent',jobFamily:'Own family'}}).jobFamily,'Own family');
  await runGenerate(a);
  for(const id of actionIds)assert.equal(a.$(id).disabled,false);
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,true);
  assert.match(a.w.document.querySelector('[data-field=title]').value,/Human Capital/);
  await generate(a,leadership);await generate(a,conflicting);
  a.$('ent-blank').click();await tick();
  assert.equal(a.w.document.querySelector('[data-field=title]').value,'');
  for(const id of actionIds)assert.equal(a.$(id).disabled,false);
  assert.equal(a.panel().querySelector('[data-od-blocked]').hidden,true);
  set(a,'[data-field=title]','Fresh independent draft');a.$('ent-save').click();await tick();
  const saved=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY));assert.equal(saved[0].content.title,'Fresh independent draft');assert.equal(saved[0].content.jobFamily,undefined);assert.equal(saved[0].content.recommendedLevel,undefined);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

function matrixValues(a,key,field){return [...a.w.document.querySelectorAll('[data-matrix-key="'+key+'"][data-matrix-field="'+field+'"]')].map(el=>el.value);}
test('matrices use the accepted package once; edits during a pending update cannot create new matrices or a success',async()=>{
 const a=await app();try{
  const original=a.w.MiyarODEngine.generate;let calls=0,accepted=0,last;
  a.w.MiyarODEngine.generate=(...args)=>{calls++;return original(...args);};
  a.w.addEventListener('miyar:od-generated',event=>{accepted++;last=event.detail.proposal;});
  await generate(a,leadership);
  assert.equal(calls,1,'matrix synchronization does not rerun the engine');assert.equal(accepted,1);
  assert.deepEqual(matrixValues(a,'kpis','metric'),Array.from(last.content.kpis,row=>row.metric));
  assert.deepEqual(matrixValues(a,'skillRequirements','name'),Array.from(last.content.skillRequirements,row=>row.name));
  const previousMetrics=matrixValues(a,'kpis','metric'),previousSkills=matrixValues(a,'skillRequirements','name');
  const pending=generate(a,'Lead a team of 6 accountants; approve accounting entries; review the financial close.');
  set(a,'[data-od-responsibilities]',conflicting);
  await pending;await new Promise(r=>setTimeout(r,250));
  assert.equal(calls,2,'the submitted attempt is the only further engine call');assert.equal(accepted,1,'changed inputs cannot emit an accepted-package event');
  assert.match(a.panel().querySelector('[data-od-status]').textContent,/Inputs changed/);
  assert.equal(a.panel().querySelector('[data-od-result]').textContent,'');
  assert.equal(a.$('ent-save').disabled,true);
  assert.deepEqual(matrixValues(a,'kpis','metric'),previousMetrics);assert.deepEqual(matrixValues(a,'skillRequirements','name'),previousSkills);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('a package waiting on references cannot populate a newly created draft after model replacement',async()=>{
 const a=await app();let release;try{
  const fetch=a.w.fetch,gate=new Promise(resolve=>{release=resolve;});
  a.w.fetch=async url=>{if(String(url).includes('classifications/'))await gate;return fetch(url);};
  let accepted=0;a.w.addEventListener('miyar:od-generated',()=>accepted++);
  set(a,'[data-od-strategy]','Improve accounting accuracy');set(a,'[data-od-department]','Finance');set(a,'[data-od-responsibilities]',leadership);
  const previousPanel=a.panel(),pending=previousPanel.querySelector('[data-od-generate]').onclick();
  await tick();a.$('ent-blank').click();await tick();
  assert.notEqual(a.panel(),previousPanel);
  release();await pending;await new Promise(r=>setTimeout(r,250));
  assert.equal(accepted,0);assert.equal(a.w.document.querySelector('[data-field=title]').value,'');
  assert.deepEqual(matrixValues(a,'kpis','metric'),[]);assert.deepEqual(matrixValues(a,'skillRequirements','name'),[]);
  assert.equal(a.panel().querySelector('[data-od-result]').textContent,'');
  assert.doesNotMatch(a.panel().querySelector('[data-od-status]').textContent,/Package generated/);
  assert.deepEqual(a.errors,[]);
 }finally{release?.();a.dom.window.close();}
});
