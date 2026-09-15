const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const C=require('../dist/compensation-engine.js'),settle=()=>new Promise(r=>setImmediate(r));

test('compensation engine uses only a sourced organization band and keeps missing salary unknown',()=>{
 const v=C.evaluate(C.example);assert.equal(v.status,'organization-band-scenario-not-market-benchmark');assert.equal(v.result.targetSalary,30000);assert.equal(v.result.annualEmployerCost,414000);assert.equal(v.result.compaRatio,null);assert.equal(v.result.adjustmentPerFte,null);assert.match(v.notice,/not a live market benchmark/i);
 assert.throws(()=>C.evaluate({...C.example,bandSource:''}),/source or rationale/);assert.throws(()=>C.evaluate({...C.example,bandMid:45000}),/minimum < midpoint < maximum/);
});

test('current salary produces auditable compa-ratio and adjustment without changing the band',()=>{
 const v=C.evaluate({...C.example,currentSalary:27000,targetPenetration:60,headcount:2,oncostPercent:10});assert.equal(v.result.targetSalary,32000);assert.equal(v.result.compaRatio,.9);assert.equal(v.result.currentRangePenetrationPercent,35);assert.equal(v.result.adjustmentPerFte,5000);assert.equal(v.result.annualAdjustmentCost,120000);assert.equal(v.input.bandMin,20000);assert.equal(v.input.bandMax,40000);
});

async function app(route='#enterprise/compensation'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language','en');w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const p=path.join(dir,value);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),blob:async()=>new w.Blob(['pdf'])};}return {ok:true,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await settle();await settle();await new Promise(r=>setTimeout(r,10));return {w,dom,errors,$:id=>w.document.getElementById(id)};
}

test('Phase 3 workspace calculates and saves an illustrative organization-band scenario',async()=>{
 const a=await app();try{const nav=a.w.document.querySelector('[data-comp-nav]');assert.ok(nav);assert.ok(nav.classList.contains('active'));const page=a.w.document.querySelector('.cp-page');assert.ok(page);page.querySelector('[data-cp-example]').click();page.querySelector('[data-cp-run]').click();await settle();assert.match(page.querySelector('.cp-result').textContent,/30,000/);assert.match(page.querySelector('.cp-result').textContent,/Not a market benchmark/i);page.querySelector('[data-cp-save]').click();const rows=JSON.parse(a.w.localStorage.getItem(a.w.MiyarCompensationWorkbench.KEY));assert.equal(rows.length,1);assert.equal(rows[0].input.grade,'G11 · Manager');assert.equal(rows[0].result.annualEmployerCost,414000);assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}
});

test('manpower gap can hand headcount and institution grade into compensation without inventing a salary band',async()=>{
 const a=await app('#enterprise/manpower');try{const I=a.w.MiyarInstitutionProfile;I.saveLocal(I.profileExample(),true);const mp=a.w.document.querySelector('.mp-page');assert.ok(mp);mp.querySelector('[data-mp-example]').click();mp.querySelector('[data-mp-run]').click();await new Promise(r=>setTimeout(r,10));const button=a.w.document.querySelector('[data-cp-from-mp]');assert.ok(button);button.click();await settle();await new Promise(r=>setTimeout(r,10));assert.equal(a.w.location.hash,'#enterprise/compensation');assert.equal(a.$('cp-role').value,'Human Capital Projects & Operations Manager');assert.equal(a.$('cp-headcount').value,'1');assert.match(a.$('cp-grade').value,/G11/);assert.equal(a.$('cp-min').value,'');assert.equal(a.$('cp-mid').value,'');assert.equal(a.$('cp-max').value,'');assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}
});
