const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const M=require('../dist/manpower-engine.js'),settle=()=>new Promise(r=>setImmediate(r));

test('manpower engine exposes demand, supply and gap under three explicit scenarios',()=>{
 const p=M.plan(M.example);assert.equal(p.status,'scenario-estimate-not-approved');assert.equal(Object.keys(p.scenarios).length,3);
 assert.equal(p.scenarios.base.years.length,3);assert.equal(p.scenarios.base.final.requiredFte,2.5);assert.equal(p.scenarios.base.final.forecastSupplyFte,1.7);assert.equal(p.scenarios.base.final.gapFte,0.8);assert.equal(p.scenarios.base.final.recommendedHeadcount,3);
 assert.ok(p.scenarios.low.final.gapFte<p.scenarios.base.final.gapFte);assert.ok(p.scenarios.high.final.gapFte>p.scenarios.base.final.gapFte);assert.equal(p.actions[0].type,'hire');assert.equal(p.actions[0].quantity,1);
 assert.match(p.uncertainty.notice,/not workforce commitments/i);
});

test('manpower engine keeps unavailable cost visibly unknown and does not fabricate a zero',()=>{
 const p=M.plan({...M.example,annualCostPerFte:''});assert.equal(p.input.annualCostPerFte,null);assert.equal(p.scenarios.base.final.annualGapCost,null);
 assert.throws(()=>M.plan({...M.example,capacityPerFte:0}),/Capacity per FTE/);assert.throws(()=>M.plan({...M.example,horizonYears:11}),/Horizon/);
});

async function app(locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#enterprise/manpower',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const p=path.join(dir,value);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),blob:async()=>new w.Blob(['pdf'])};}return {ok:true,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await settle();await settle();await new Promise(r=>setTimeout(r,5));return {w,dom,errors,$:id=>w.document.getElementById(id)};
}

test('Phase 2 workspace calculates HC gap, saves the plan and hands a positive gap to OD',async()=>{
 const a=await app('en');try{
  const nav=a.w.document.querySelector('[data-manpower-nav]');assert.ok(nav);assert.match(nav.textContent,/Manpower planning/i);assert.ok(nav.classList.contains('active'));
  const page=a.w.document.querySelector('.mp-page');assert.ok(page);page.querySelector('[data-mp-example]').click();page.querySelector('[data-mp-run]').click();await settle();
  assert.equal(page.querySelectorAll('.mp-scenario').length,3);assert.match(page.querySelector('.mp-results').textContent,/Human Capital Projects & Operations Manager/);assert.match(page.querySelector('.mp-results').textContent,/0\.8/);assert.equal(page.querySelectorAll('.mp-table-wrap tbody tr').length,3);
  page.querySelector('[data-mp-save]').click();const plans=JSON.parse(a.w.localStorage.getItem(a.w.MiyarManpowerWorkbench.KEY));assert.equal(plans.length,1);assert.equal(plans[0].input.department,'Human Capital');
  const handoff=page.querySelector('[data-mp-od]');assert.ok(handoff);handoff.click();await settle();await new Promise(r=>setTimeout(r,10));
  assert.equal(a.w.location.hash,'#enterprise/create');const od=a.$('miyar-od-workbench');assert.ok(od);assert.match(od.querySelector('[data-od-strategy]').value,/Human Capital transformation/);assert.equal(od.querySelector('[data-od-department]').value,'Human Capital');assert.equal(a.w.document.querySelector('[data-number=headcount]').value,'1');assert.match(od.querySelector('[data-od-status]').textContent,/Workforce gap imported/i);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
