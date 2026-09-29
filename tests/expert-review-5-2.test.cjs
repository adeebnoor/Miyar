const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const M=require('../dist/manpower-engine.js'),C=require('../dist/compensation-engine.js');
const settle=()=>new Promise(r=>setTimeout(r,25));

async function app(route,locale='en',before){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const file=path.join(dir,value.split('?')[0]);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8')),blob:async()=>new w.Blob(['pdf'])};}return {ok:false,status:404,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(before)before(w);
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 await settle();await settle();return {w,dom,errors,d:w.document,$:id=>w.document.getElementById(id)};
}

test('workforce bridge reconciles the gap as growth plus replacement minus committed pipeline',()=>{
 for(const input of [M.example,{...M.example,retirementsFte:1,committedHires:1,internalSupply:.5},{...M.example,targetWorkload:80}]){
  const p=M.plan(input),b=p.bridge;
  assert.ok(Math.abs(b.gapFte-(b.growthFte+b.replacementFte-b.pipelineFte))<.02,'gap = growth + replacement - pipeline');
  assert.ok(Math.abs(b.forecastSupplyFte-(b.currentFte-b.attritionExitsFte-b.knownExitsFte+b.pipelineFte))<.02,'supply bridge closes');
 }
 const base=M.plan(M.example);assert.equal(base.bridge.knownExitsFte,0);assert.equal(base.scenarios.base.final.gapFte,0.8);
});

test('known retirements reduce supply and are validated against current FTE',()=>{
 const without=M.plan(M.example),withRetirements=M.plan({...M.example,retirementsFte:1});
 assert.ok(withRetirements.scenarios.base.final.rawForecastSupplyFte<without.scenarios.base.final.rawForecastSupplyFte);
 assert.equal(withRetirements.bridge.knownExitsFte,1);
 assert.throws(()=>M.plan({...M.example,retirementsFte:3}),/cannot exceed current FTE/);
 assert.throws(()=>M.plan({...M.example,retirementsFte:-1}),/Known retirements/);
});

test('gap options are Buy, Build, Borrow, Bind and Bot alternatives with computed levers',()=>{
 const p=M.plan(M.example);
 assert.deepEqual(p.options.map(o=>o.id),['buy','build','borrow','bind','bot']);
 assert.equal(p.options[0].headcount,p.scenarios.base.final.gapHeadcount);
 const borrow=p.options.find(o=>o.id==='borrow');assert.ok(borrow.coreFte<=p.scenarios.base.final.rawGapFte);assert.ok(borrow.flexFte>0);
 const by=d=>p.sensitivity.find(x=>x.driver===d).gapDeltaFte;
 assert.ok(by('demand')>0);assert.ok(by('productivity')<0);assert.ok(by('attrition')<0);assert.equal(by('pipeline'),-1);
 assert.deepEqual(M.plan({...M.example,targetWorkload:80}).options,[]);
 assert.equal(M.plan({...M.example,attritionPercent:0}).sensitivity.some(x=>x.driver==='attrition'),false);
 assert.equal(p.actions[0].type,'hire');
});

test('localization uses the organization target and needs both inputs together',()=>{
 assert.equal(M.plan(M.example).localization,null);
 assert.throws(()=>M.plan({...M.example,currentNationalFte:1}),/both current national FTE and the localization target/);
 assert.throws(()=>M.plan({...M.example,currentNationalFte:3,localizationTargetPercent:50}),/cannot exceed current FTE/);
 const l=M.plan({...M.example,currentNationalFte:1,localizationTargetPercent:60}).localization;
 assert.equal(l.currentRatePercent,50);assert.equal(l.targetPercent,60);assert.ok(l.requiredNationalFte>l.projectedNationalSupplyFte);assert.equal(l.minimumNationalHires,1);assert.match(l.notice,/Not a Nitaqat/);
 assert.equal(M.plan({...M.example,currentNationalFte:2,localizationTargetPercent:10}).localization.minimumNationalHires,0);
});

test('compensation diagnostics check range spread, midpoint symmetry, compa-ratio zone and quartile',()=>{
 const base=C.evaluate(C.example);assert.equal(base.bandDiagnostics.rangeSpreadPercent,50);assert.equal(base.bandDiagnostics.spreadAssessment,'common');assert.equal(base.bandDiagnostics.midpointCentred,true);
 assert.equal(base.result.annualEmployerCost,414000);assert.equal(base.result.compaZone,null);
 assert.equal(C.evaluate({...C.example,bandMin:20000,bandMax:40000}).bandDiagnostics.spreadAssessment,'wide');
 assert.equal(C.evaluate({...C.example,bandMin:29000,bandMid:30000,bandMax:31000}).bandDiagnostics.spreadAssessment,'narrow');
 const skewed=C.evaluate({...C.example,bandMid:33000});assert.equal(skewed.bandDiagnostics.midpointCentred,false);assert.equal(skewed.bandDiagnostics.midpointOffsetPercent,10);
 const zones=[[21000,'well-below','below-minimum'],[27000,'below','Q2'],[30000,'at','Q3'],[34000,'above','Q4'],[39000,'well-above','above-maximum']];
 for(const [salary,zone,quartile] of zones){const r=C.evaluate({...C.example,currentSalary:salary}).result;assert.equal(r.compaZone,zone,String(salary));assert.equal(r.currentQuartile,quartile,String(salary));}
 assert.match(base.calculationNotice,/not market percentiles/);
});

test('below-minimum pay separates the bring-to-minimum cost and allowances follow basic pay',()=>{
 const r=C.evaluate({...C.example,currentSalary:21000,allowancesPercent:35}).result;
 assert.equal(r.payAction,'below-band');assert.equal(r.minimumAdjustmentPerFte,3000);assert.equal(r.annualMinimumAdjustmentCost,55890);
 assert.equal(r.annualGuaranteedCash,486000);assert.equal(r.annualEmployerCost,558900);assert.equal(r.adjustmentPercent,42.9);
 const total=C.evaluate({...C.example,payBasis:'total',allowancesPercent:35});assert.equal(total.input.allowancesApplied,false);assert.equal(total.result.annualEmployerCost,414000);
 assert.throws(()=>C.evaluate({...C.example,allowancesPercent:-5}),/Fixed allowances/);
 assert.equal(C.evaluate({...C.example,currentSalary:39000}).result.adjustmentPerFte,0);
});

test('manpower workspace shows the bridge, alternatives, sensitivity and optional localization',async()=>{
 const a=await app('#enterprise/manpower');try{
  const page=a.d.querySelector('.mp-page');page.querySelector('[data-mp-example]').click();
  a.$('mp-national').value='1';a.$('mp-localization').value='60';a.$('mp-retirements').value='0.5';a.$('mp-retirements').dispatchEvent(new a.w.Event('input',{bubbles:true}));
  page.querySelector('[data-mp-run]').click();await settle();
  const out=page.querySelector('.mp-results');assert.ok(out);
  assert.equal(out.querySelectorAll('.mp-bridge li').length,7);assert.match(out.querySelector('.mp-bridge').textContent,/Known retirements/);assert.match(out.querySelector('.mp-bridge > p').textContent,/backfill of already-budgeted positions/);
  assert.equal(out.querySelectorAll('[data-mp-option]').length,5);assert.match(out.querySelector('.mp-options').textContent,/not quantities to add up/);
  assert.equal(out.querySelectorAll('.mp-sens-wrap tbody tr').length,4);assert.equal(out.querySelectorAll('.mp-table-wrap tbody tr').length,3);
  assert.match(out.querySelector('.mp-localization').textContent,/At least 1 of the hires/);assert.equal(out.querySelector('.mp-actions'),null);
  a.$('mp-retirements').value='0';a.$('mp-target').value='50';a.$('mp-target').dispatchEvent(new a.w.Event('input',{bubbles:true}));page.querySelector('[data-mp-run]').click();await settle();
  assert.equal(page.querySelectorAll('[data-mp-option]').length,0);assert.match(page.querySelector('.mp-hold').textContent,/Redeploy before hiring/);assert.match(page.querySelector('.mp-bridge > p').textContent,/not a redundancy decision/);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('manpower validation errors are translated and styled as errors in Arabic',async()=>{
 const a=await app('#enterprise/manpower','ar');try{
  const page=a.d.querySelector('.mp-page');page.querySelector('[data-mp-example]').click();a.$('mp-retirements').value='5';a.$('mp-retirements').dispatchEvent(new a.w.Event('input',{bubbles:true}));page.querySelector('[data-mp-run]').click();await new Promise(r=>setTimeout(r,80));
  const msg=page.querySelector('[data-mp-message]');assert.match(msg.textContent,/لا يمكن أن يتجاوز التقاعد/);assert.equal(msg.dataset.state,'error');assert.ok(msg.classList.contains('qa-error'));assert.equal(page.querySelector('.mp-results'),null);
  assert.match(page.querySelector('.mp-heading span').textContent,/المرحلة 2/);
 }finally{a.dom.window.close();}
});

test('compensation workspace explains band position, bring-to-minimum and package cost',async()=>{
 const a=await app('#enterprise/compensation');try{
  const page=a.d.querySelector('.cp-page');page.querySelector('[data-cp-example]').click();a.$('cp-current').value='21000';a.$('cp-allowances').value='35';a.$('cp-allowances').dispatchEvent(new a.w.Event('input',{bubbles:true}));page.querySelector('[data-cp-run]').click();await settle();
  const r=page.querySelector('.cp-result');assert.ok(r);
  assert.equal(r.querySelector('.cp-range').getAttribute('dir'),'ltr');assert.match(r.querySelector('.cp-scale').textContent,/MinQ1MidQ3Max/);assert.ok(r.querySelector('.cp-line .cp-current'));
  assert.match(r.querySelector('.cp-policy').textContent,/Below band — review required/);assert.match(r.querySelector('.cp-policy').textContent,/bring pay to at least the band minimum \(3,000 SAR per FTE; annual impact 55,890 SAR\)/);
  assert.match(r.querySelector('.cp-cost').textContent,/Guaranteed cash486,000 SAR/);assert.match(r.querySelector('.cp-diagnostics').textContent,/Range spread 50%/);
  assert.match(r.querySelector('.cp-metrics').textContent,/Well below midpoint · Below minimum/);assert.equal(r.querySelector('.qa-band-alert'),null);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('compensation does not invent an institution grade when no role is known',async()=>{
 const a=await app('#enterprise/compensation');try{
  const I=a.w.MiyarInstitutionProfile;I.saveLocal(I.profileExample(),true);a.w.MiyarCompensationWorkbench.render();await settle();
  assert.equal(a.$('cp-grade').value,'');
 }finally{a.dom.window.close();}
});

test('job evaluation resolves points to the approved institution grade and shows the factor breakdown',async()=>{
 const a=await app('#enterprise/grading');try{
  const I=a.w.MiyarInstitutionProfile;I.saveLocal(I.profileExample(),true);
  const events=[];a.w.addEventListener('miyar:grade-calculated',e=>events.push(e.detail.grade));
  for(const s of a.d.querySelectorAll('[data-factor]'))s.value='3';for(const e of a.d.querySelectorAll('[data-factor-evidence]'))e.value='Leads a programme with cross-functional decisions';
  a.$('ent-calculate').click();await settle();
  const out=a.$('ent-grade-result');assert.match(out.textContent,/750/);assert.equal(out.querySelectorAll('.ent-grade-breakdown tbody tr').length,3);
  assert.match(out.querySelector('.ent-institution-grade').textContent,/Approved structure grade: G13 · Director/);assert.deepEqual(events,['G13 · Director']);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('job evaluation keeps the illustrative band when no institution grade structure exists',async()=>{
 const a=await app('#enterprise/grading');try{
  const events=[];a.w.addEventListener('miyar:grade-calculated',e=>events.push(e.detail.grade));
  for(const s of a.d.querySelectorAll('[data-factor]'))s.value='2';for(const e of a.d.querySelectorAll('[data-factor-evidence]'))e.value='Evidence';
  a.$('ent-calculate').click();await settle();
  assert.match(a.$('ent-grade-result').querySelector('.ent-institution-grade').textContent,/No institution grade structure/);assert.deepEqual(events,['B2']);
 }finally{a.dom.window.close();}
});

test('OD package shows level and validation status in the interface language',async()=>{
 const a=await app('#enterprise/create','ar');try{
  const panel=a.$('miyar-od-workbench');panel.querySelector('[data-od-example]').click();await settle();panel.querySelector('[data-od-generate]').click();await settle();
  const result=panel.querySelector('[data-od-result]');assert.ok(result.textContent.length>100);
  assert.equal(result.querySelector('.od-level').textContent,'مدير');assert.doesNotMatch(result.querySelector('.od-grade-note strong').textContent,/manager/);
  for(const li of result.querySelectorAll('.demo-validation li'))assert.doesNotMatch(li.textContent,/^(pass|warn|fail) ·/);
  assert.deepEqual([...panel.querySelectorAll('.od-roadmap a')].map(x=>x.getAttribute('href')),['#enterprise/manpower','#enterprise/compensation']);
 }finally{a.dom.window.close();}
});

test('out-of-sample strategic review replaces the in-progress message once the directory check finishes',async()=>{
 const a=await app('#demo');try{
  const objective=a.$('objective');objective.value='تصميم حلول الذكاء الاصطناعي التوليدي، وبناء تطبيقات النماذج اللغوية وحوكمتها وتقييم مخرجاتها.';objective.dispatchEvent(new a.w.Event('input',{bubbles:true}));
  a.$('role-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<40&&!a.d.querySelector('.demo-v5-directory');i++)await settle();
  const reason=a.d.querySelector('.demo-v5-output > p');assert.ok(reason);assert.doesNotMatch(reason.textContent,/^Checking the field/);assert.match(reason.textContent,/Checked the quick sample|Related references were found/);
 }finally{a.dom.window.close();}
});

test('homepage approval stages describe distinct reviewer evidence and one primary hero action',async()=>{
 const a=await app('#home');try{
  const stages=[...a.d.querySelectorAll('.lp-workflow li p')].map(x=>x.textContent);assert.equal(stages.length,4);assert.equal(new Set(stages).size,4);assert.match(stages[3],/delegation of authority/);
  assert.equal(a.d.querySelectorAll('.lp-hero .lp-guided-actions .lp-primary').length,1);
 }finally{a.dom.window.close();}
});

test('production bundle keeps Arabic as UTF-8 text and loads the 5.2 accessibility styles last',()=>{
 const release=JSON.parse(fs.readFileSync(path.join(dir,'release.json'),'utf8'));
 const js=fs.readFileSync(path.join(dir,'miyar-'+release.buildId+'.js'),'utf8');assert.ok(js.includes('تخطيط القوى العاملة'));assert.ok((js.match(/\\u06[0-9a-f]{2}/gi)||[]).length<100,'only regex ranges stay escaped');assert.ok(!js.includes('\\u062A\\u062E\\u0637\\u064A\\u0637'));
 const styles=release.assets.styles;assert.equal(styles.at(-1),'audit-improvements.css');assert.ok(styles.indexOf('expert-review-5-2.css')>styles.indexOf('accessibility-perf-v5.css'));
 const css=fs.readFileSync(path.join(dir,'expert-review-5-2.css'),'utf8');assert.match(css,/--muted:#5a6e71/);assert.match(css,/\.lp-guided-start \.lp-secondary\{color:#146954/);
 assert.doesNotMatch(fs.readFileSync(path.join(dir,'enterprise.js'),'utf8'),/ChatGPT/);
});

test('bulk structure check summarizes spans of control from direct reports',()=>{
 const Core=require('../dist/enterprise-core.js'),nodes=JSON.parse(fs.readFileSync(path.join(dir,'classifications/ssco-2019.json'),'utf8')).nodes;
 const rows=[1,4,16,0].map((n,i)=>({title:'Role '+i,department:'D',occupationCode:'',directReports:String(n),budgetAmount:'0',authority:'Recommends'}));
 assert.deepEqual(Core.diagnose(rows,nodes).spanOfControl,{managers:3,averageSpan:7,medianSpan:4,singleReportManagers:1,narrowManagers:1,wideManagers:1});
 assert.equal(Core.diagnose([{title:'Title only'}],nodes).spanOfControl,null);
});
