const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../dist/enterprise-core.js'),D=require('../dist/enterprise-document.js'),{JSDOM,VirtualConsole}=require('jsdom');
const dir=path.join(__dirname,'../dist');
const band={title:'Software engineer',jobFamily:'Software Development',headcount:25,directReports:0,team:'Individual contributor',salaryGrade:'G07',salaryMin:10000,salaryMax:14000,salaryCurrency:'SAR',salaryPeriod:'monthly',salarySource:'Approved organization band',costBasis:'grade-band',annualCost:3600000,evaluatedPositionId:'LOCAL-SW',evaluatedPositionRevision:1};
const kpi={outcome:'Shorter service processing',metric:'Median processing days',baseline:'10 days',target:'8 days',duration:'6 months',frequency:'Monthly',deliverable:'Request log'};
const storage=()=>{let value;return {getItem:()=>value||null,setItem:(_,v)=>{value=v;}};};
test('expert 25 positions / SAR 1,000 is blocked on import and direct local save, even with manual reason',()=>{
 const bad={...band,annualCost:1000,costBasis:'manual-exception',costExceptionReason:'A reviewer entered this total in the demonstration form.'};
 for(const fn of [()=>C.importDraft({content:bad}),()=>C.save(storage(),bad)])assert.throws(fn,e=>e.fields.includes('annualCost')&&/below 1,000/.test(e.message));
});
test('position cost uses annual grade band midpoint times headcount with explicit per-person limits',()=>{
 assert.deepEqual(C.positionCost(band),{annualCost:3600000,annualCostMin:120000,annualCostMax:168000,costBasis:'grade-band'});
 assert.equal(C.positionCost({...band,salaryPeriod:'annual'}).annualCost,300000);
 assert.equal(C.positionCost({...band,salaryCurrency:'USD'}),null);
 assert.throws(()=>C.validatePosition({...band,annualCost:100000}),/grade band/);
 assert.equal(C.validatePosition({...band,annualCost:5000000,costBasis:'manual-exception',costExceptionReason:'Approved temporary overseas expertise cost above the usual grade band.'}).warnings[0].id,'manual-cost');
});
test('IC direct reports contradict the scope in both languages and wide manager spans remain review warnings',()=>{
 for(const team of ['Individual contributor','Independent contributor','مساهم فردي','ممارس مستقل','لا يوجد مرؤوسون مباشرون'])assert.throws(()=>C.validatePosition({...band,team,directReports:40}),e=>e.fields[0]==='directReports');
 assert.equal(C.validatePosition({...band,team:'Leads service operations',directReports:16}).warnings[0].id,'wide-span');
 assert.deepEqual(C.validatePosition({...band,team:'Leads service operations',directReports:15}).warnings,[]);
});
test('incomplete KPIs may remain honest drafts but baseline, target and duration are mandatory on submission',()=>{
 assert.doesNotThrow(()=>C.validatePosition({...band,kpis:[]}));
 for(const missing of ['baseline','target','duration']){const row={...kpi,[missing]:''};assert.throws(()=>C.validatePosition({...band,kpis:[row]},{submit:true,positionId:'LOCAL-SW',revision:1}),/KPI/);}
 assert.doesNotThrow(()=>C.validatePosition({...band,kpis:[kpi]},{submit:true,positionId:'LOCAL-SW',revision:1}));
 assert.throws(()=>C.validatePosition({...band,kpis:[kpi]},{submit:true,positionId:'OTHER',revision:1}),/position and revision/);
});
test('new position metadata and structured KPI baseline/duration survive JSON import',()=>{
 const c={...band,kpis:[kpi],experienceYears:3,experienceType:'functional',employmentType:'permanent',location:'Jeddah',workMode:'hybrid',parentPositionId:'LOCAL-MANAGER'};
 assert.deepEqual(C.importDraft({content:c}),c);
 assert.throws(()=>C.importDraft({content:{...c,experienceYears:-1}}));
});
test('Arabic and English position packages label education and expose grade, family, range and complete KPI evidence',()=>{
 for(const [locale,label] of [['ar','البكالوريوس'],['en','Bachelor or equivalent']]){
  const html=D.html({...band,educationLevel:'6',kpis:[kpi],experienceYears:3,employmentType:'permanent',location:'Jeddah',workMode:'hybrid',parentPositionId:'LOCAL-MANAGER'},locale,{internalCode:'LOCAL-SW',revision:1});
  assert.match(html,new RegExp(label));assert.doesNotMatch(html,/Education level<\/h2><p dir="auto">6|المستوى التعليمي<\/h2><p dir="auto">6/);
  for(const value of ['G07','Software Development','10000','14000','10 days','8 days','6 months','LOCAL-MANAGER'])assert.ok(html.includes(value));
  assert.equal((html.match(/class="signature-box"/g)||[]).length,5);
 }
});
async function ui(locale){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM('<main id="enterprise"></main>',{url:'https://example.test/Miyar/#enterprise/create',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.confirm=()=>true;w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,String(url))))});
 for(const file of ['enterprise-core.js','role-catalog.js','role-recommender.js','enterprise-document.js','enterprise-product.js','enterprise-service.js','enterprise.js'])w.eval(fs.readFileSync(path.join(dir,file),'utf8'));
 await w.MiyarEnterprise.mount(w.document.getElementById('enterprise'),{lang:locale});
 return {w,dom,errors,$:id=>w.document.getElementById('ent-'+id)};
}
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
test('position UI shows employment controls, blocks impossible saves next to the button and focuses the offending field',async()=>{
 for(const locale of ['ar','en']){const a=await ui(locale);try{
  a.$('sample').click();await settle();const basis=a.w.document.querySelector('[data-field="costBasis"]');basis.value='manual-exception';basis.dispatchEvent(new a.w.Event('input'));
  for(const key of ['employmentType','location','workMode','parentPositionId','experienceType'])assert.equal(a.w.document.querySelector('[data-field="'+key+'"]').tagName,'SELECT');
  const numeric=key=>a.w.document.querySelector('[data-number="'+key+'"]');
  numeric('headcount').value='25';numeric('headcount').dispatchEvent(new a.w.Event('input'));
  numeric('annualCost').value='1000';numeric('annualCost').dispatchEvent(new a.w.Event('input'));
  a.$('save').focus();a.$('save').click();await settle();
  assert.equal(a.w.localStorage.getItem(C.KEY),null);assert.equal(numeric('annualCost').getAttribute('aria-invalid'),'true');assert.equal(a.w.document.activeElement,numeric('annualCost'));
  assert.ok(a.w.document.querySelector('[data-action-feedback]').textContent.length>30);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('individual contributor with 40 reports cannot save and a valid sample can be saved with visible version identity',async()=>{
 const a=await ui('en');try{
  a.$('sample').click();const reports=a.w.document.querySelector('[data-number="directReports"]');reports.value='40';reports.dispatchEvent(new a.w.Event('input'));a.$('save').focus();a.$('save').click();await settle();
  assert.equal(a.w.localStorage.getItem(C.KEY),null);assert.equal(reports.getAttribute('aria-invalid'),'true');
  reports.value='0';reports.dispatchEvent(new a.w.Event('input'));a.$('save').focus();a.$('save').click();await settle();
  const row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];assert.equal(row.content.experienceYears,3);assert.equal(row.content.kpis[0].baseline,'10 days');assert.match(a.$('position-context').textContent,/v1/);
  assert.equal(a.w.MiyarPositionContext.positionId,row.id);assert.equal(a.w.MiyarPositionContext.grade,null);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('grade annotation stays tied to the selected revision; a changed source creates an unevaluated new revision',async()=>{
 const a=await ui('en');try{
  a.$('sample').click();a.$('save').focus();a.$('save').click();await settle();
  let row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];
  a.w.MiyarEnterprise.open('grading');await settle();a.$('grade-position').value='0';a.$('grade-position').dispatchEvent(new a.w.Event('change'));await settle();
  for(const input of a.w.document.querySelectorAll('[data-factor]'))input.value='2';
  for(const input of a.w.document.querySelectorAll('[data-factor-evidence]'))input.value='Develop and test software and analyze user requirements under documented department policies for '+input.dataset.factorEvidence;
  for(const input of a.w.document.querySelectorAll('[data-second-factor]'))input.value='2';
  for(const [key,value]of Object.entries({salaryMin:'10000',salaryMax:'14000',salarySource:'Documented internal software-development band'})){const input=a.w.document.querySelector('[data-pay="'+key+'"]');input.value=value;}
  a.$('calculate').focus();a.$('calculate').click();await settle();
  a.w.document.querySelector('[data-evaluator="0"]').value='Evaluator A';a.w.document.querySelector('[data-evaluator="1"]').value='Evaluator B';
  a.$('bind-grade').focus();a.$('bind-grade').click();await settle();
  const annotation=a.w.MiyarEnterpriseGrade.contextFor(row);assert.equal(annotation.evaluatedPositionId,row.id);assert.equal(annotation.evaluatedPositionRevision,1);assert.ok(annotation.salaryGrade);
  assert.equal(JSON.parse(a.w.localStorage.getItem(C.KEY))[0].content.evaluatedPositionId,undefined,'source snapshot does not acquire a claimed evaluation');assert.equal(JSON.parse(a.w.localStorage.getItem(C.KEY))[0].content.salaryMax,25000,'proposed source band is immutable');
  a.w.MiyarEnterprise.open('workspace');await settle();a.w.document.querySelector('[data-position="'+row.id+'"]').click();await settle();
  a.$('export-json').onclick;assert.match(a.$('position-detail').textContent,new RegExp(annotation.salaryGrade));
  a.$('edit-position').click();await settle();
  assert.equal(a.w.MiyarPositionContext.grade,annotation.salaryGrade);
  const duties=a.w.document.querySelector('[data-field="responsibilities"]');duties.value+='\nOwn production deployment decisions and monitor release health';duties.dispatchEvent(new a.w.Event('input'));
  a.$('save').focus();a.$('save').click();await settle();row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];
  assert.equal(row.revision,2);assert.equal(row.content.salaryGrade,undefined);assert.equal(row.content.evaluatedPositionRevision,undefined);assert.equal(row.content.evaluationCommitteeJSON,undefined);assert.equal(a.w.MiyarPositionContext.grade,null);assert.equal(a.w.MiyarEnterpriseGrade.contextFor(row),null);
  assert.ok(JSON.parse(a.w.localStorage.getItem('miyar-position-evaluations-v1')).some(e=>e.revision===1));assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('proven evaluation-only annotations do not create a new source revision, but financial changes do',()=>{
 const values=new Map(),s={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const source={title:'Software engineer',headcount:1,annualCost:144000,salaryMin:10000,salaryMax:14000,salaryCurrency:'SAR',salaryPeriod:'monthly'};
 const row=C.save(s,source),linked={salaryGrade:'G07',evaluationSummary:'Explicit source evaluation',evaluatedPositionId:row.id,evaluatedPositionRevision:1,evaluationCommitteeJSON:'[]'};
 s.setItem('miyar-position-evaluations-v1',JSON.stringify([{positionId:row.id,revision:1,linked}]));
 const same=C.save(s,{...source,...linked},row);assert.equal(same.revision,1);assert.equal(C.read(s)[0].content.salaryGrade,undefined);
 const next=C.save(s,{...source,...linked,annualCost:150000},same);assert.equal(next.revision,2);assert.equal(next.content.evaluatedPositionId,undefined);assert.equal(next.content.salaryGrade,undefined);
});
test('loaded example fills the upper strategic inputs and generated matrices reach the editable package',async()=>{
 const a=await ui('en');try{
  a.w.document.documentElement.lang='en';a.$('sample').click();a.w.MiyarODEngine={};a.w.eval(fs.readFileSync(path.join(dir,'od-workbench.js'),'utf8'));
  for(const key of ['strategy','responsibilities','department'])assert.ok(a.w.document.querySelector('[data-od-'+key+']').value.trim());
  a.w.MiyarEnterprise.applyPositionPackage({jobFamily:'Software Development',kpis:[{...kpi,target:'7 days'},{...kpi,metric:'Release quality'}],skillRequirements:[{name:'Testing',type:'Technical',level:'Independent',evidence:'Acceptance tests'}]});
  assert.equal(a.w.document.querySelectorAll('[data-matrix-key="kpis"]').length,14);assert.ok([...a.w.document.querySelectorAll('[data-matrix-key="kpis"][data-matrix-field="target"]')].some(e=>e.value==='7 days'));
  a.$('save').focus();a.$('save').click();await settle();assert.equal(JSON.parse(a.w.localStorage.getItem(C.KEY))[0].content.kpis[0].target,'7 days');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('OD ambiguity names the actor/need, shows codes, and candidate choice requests duties without regenerating the same objective',async()=>{
 const a=await ui('en');try{
  a.w.document.documentElement.lang='en';let calls=0;a.w.MiyarODEngine={generate:()=>{calls++;return {status:'needs-confirmation',clarificationKind:'actor-object',messageEn:'Do you mean recruiter or software engineer?',messageAr:'هل تقصد مسؤول توظيف أم مهندس برمجيات؟',candidates:[{titleAr:'مسؤول توظيف',titleEn:'Recruiter',ssco:'242308'},{titleAr:'مهندس برمجيات',titleEn:'Software engineer',ssco:'251204'}]};}};
  a.w.eval(fs.readFileSync(path.join(dir,'od-workbench.js'),'utf8'));const duties=a.w.document.querySelector('[data-od-responsibilities]');duties.value='Recruit software engineers';a.w.document.querySelector('[data-od-generate]').click();await settle();
  const result=a.w.document.querySelector('[data-od-result]');assert.match(result.textContent,/recruiter or software engineer/);assert.match(result.textContent,/251204/);result.querySelector('button').click();await settle();
  assert.equal(calls,1);assert.equal(a.w.document.activeElement,duties);assert.match(a.w.document.querySelector('[data-od-status]').textContent,/actual duties/);assert.equal(a.$('save').disabled,true);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('work-location dropdown saves a Saudi city and preserves an imported custom location on reopening',async()=>{
 for(const locale of ['ar','en']){const a=await ui(locale);try{
  a.$('sample').click();const select=a.w.document.querySelector('[data-field="location"]');assert.equal(select.tagName,'SELECT');assert.equal([...select.options].find(o=>o.value==='Tabuk').textContent,locale==='ar'?'تبوك':'Tabuk');
  select.value='Tabuk';select.dispatchEvent(new a.w.Event('input'));a.$('save').focus();a.$('save').click();await settle();let row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];assert.equal(row.content.location,'Tabuk');assert.equal(C.importDraft(row).location,'Tabuk');assert.equal(D.formatValue('location',row.content.location,locale),locale==='ar'?'تبوك':'Tabuk');
  row=C.save(a.w.localStorage,{...row.content,location:'KAUST — Thuwal'},row);a.w.MiyarEnterprise.open('workspace');await settle();a.w.document.querySelector('[data-position="'+row.id+'"]').click();await settle();a.$('edit-position').click();await settle();
  const restored=a.w.document.querySelector('[data-field="location"]');assert.equal(restored.tagName,'SELECT');assert.equal(restored.value,'KAUST — Thuwal');assert.equal(restored.selectedOptions[0].textContent,'KAUST — Thuwal');
  a.$('save').focus();a.$('save').click();await settle();assert.equal(JSON.parse(a.w.localStorage.getItem(C.KEY))[0].content.location,'KAUST — Thuwal');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('initial budget request has an explicit proposed band and can submit without claiming a completed evaluation',async()=>{
 for(const locale of ['ar','en']){const a=await ui(locale);try{
  a.$('sample').click();a.$('save').focus();a.$('save').click();await settle();const row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];
  assert.equal(row.content.salaryGrade,'G04');assert.equal(row.content.salaryMin,15000);assert.equal(row.content.salaryMax,25000);assert.equal(row.content.costBasis,'grade-band');assert.equal(row.content.annualCost,240000);assert.equal(row.content.annualCostMin,180000);assert.equal(row.content.annualCostMax,300000);
  for(const key of ['evaluatedPositionId','evaluatedPositionRevision','evaluationSummary','evaluationCommitteeJSON'])assert.equal(row.content[key],undefined,key);
  assert.doesNotThrow(()=>C.validatePosition(row.content,{submit:true,positionId:row.id,revision:1}));assert.equal(a.w.MiyarPositionContext.grade,null);assert.equal(a.w.MiyarPositionContext.proposedGrade,'G04');
  const html=D.html(row.content,locale,row);assert.match(html,new RegExp(locale==='ar'?'الدرجة والنطاق المدخلان مقترحان':'entered grade and range are proposals'));
  for(const key of ['salaryGrade','salarySource','salaryCurrency','salaryPeriod'])assert.ok(a.w.document.querySelector('[data-field="'+key+'"]'));
  const maximum=a.w.document.querySelector('[data-number="salaryMax"]');assert.ok(maximum);maximum.value='32000';maximum.dispatchEvent(new a.w.Event('input'));assert.equal(a.w.document.querySelector('[data-number="annualCost"]').value,'282000');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});

const guidedWait=()=>new Promise(r=>setTimeout(r,360));
test('guided positions start with four source inputs, explain why and safely update owned proposals in Arabic and English',async()=>{
 for(const locale of ['ar','en']){const a=await ui(locale);try{
  const fields=()=>[...a.w.document.querySelectorAll('#ent-content [data-field],#ent-content [data-number]')].filter(x=>!x.closest('details:not([open])'));
  assert.deepEqual(fields().map(x=>x.dataset.field),['businessNeed','responsibilities','title','successMeasures']);
  const write=(key,value)=>{const x=a.w.document.querySelector('[data-field="'+key+'"]');x.value=value;x.dispatchEvent(new a.w.Event('input'));};
  write('businessNeed','Deliver internal software services');write('responsibilities','Develop software features; perform code review; run automated tests');await guidedWait();
  let draft=a.w.MiyarEnterprise.draftContent();assert.equal(draft.occupationCode,'251204');assert.equal(draft.educationLevel,'6');assert.ok(draft.educationFieldCode);assert.ok(draft.jobFamily);
  assert.match(a.$('guided-proposals').textContent,/SSCO 2019/);assert.match(a.$('guided-proposals').textContent,/251204/);assert.match(a.$('guided-proposals').textContent,/63/);
  for(const key of ['salaryGrade','salaryMin','salaryMax','annualCost','evaluatedPositionId','evaluatedPositionRevision','evaluationCommitteeJSON','authority','budget'])assert.equal(draft[key],undefined);
  assert.equal(draft.kpis[0].baseline,'');assert.equal(draft.kpis[0].target,'');assert.equal(draft.kpis[0].duration,'');assert.throws(()=>C.validatePosition(draft,{submit:true}),/KPI/);
  const help=a.w.document.querySelector('[data-number="headcount"]');assert.ok(help.getAttribute('aria-describedby').includes('ent-help-headcount'));assert.ok(a.$('help-headcount').textContent.length>40);
  write('businessNeed','Close financial accounts');write('responsibilities','Prepare accounting entries; reconcile bank accounts; review financial statements');await guidedWait();
  draft=a.w.MiyarEnterprise.draftContent();assert.equal(draft.occupationCode,'241101');assert.equal(draft.educationFieldCode,'041101');assert.equal(draft.title,locale==='ar'?'محاسب':'Accountant');
  write('businessNeed','zxqv qqqz');write('responsibilities','zxqv qqqz');await guidedWait();draft=a.w.MiyarEnterprise.draftContent();for(const key of ['title','occupationCode','jobFamily','educationFieldCode'])assert.equal(draft[key],undefined);assert.equal(draft.kpis,undefined);
  write('businessNeed','Deliver internal software services');write('responsibilities','Develop software features; perform code review; run automated tests');await guidedWait();write('title','Service delivery specialist');write('occupationCode','251204');write('businessNeed','zxqv qqqz');write('responsibilities','zxqv qqqz');await guidedWait();draft=a.w.MiyarEnterprise.draftContent();assert.equal(draft.title,'Service delivery specialist');assert.equal(draft.occupationCode,'251204','explicitly re-entered same code becomes user owned');
  a.$('show-position-fields').click();assert.ok([...a.w.document.querySelectorAll('#ent-position-sections details')].every(x=>x.open));
  write('costBasis','manual-exception');const numeric=a.w.document.querySelector('[data-number="annualCost"]');numeric.value='1000';numeric.dispatchEvent(new a.w.Event('input'));for(const d of a.w.document.querySelectorAll('#ent-position-sections details'))d.open=false;a.$('save').click();await settle();assert.equal(a.$('position-budget').open,true);assert.equal(numeric.getAttribute('aria-invalid'),'true');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('guided metadata never becomes measured evidence; only explicit performance facts are copied',()=>{
 const R=require('../dist/role-recommender.js'),nodes=require('../dist/classifications/ssco-2019.json').nodes,education=require('../dist/classifications/education-2020.json').fields;
 const c={businessNeed:'Deliver internal software services',responsibilities:'Develop software features; perform code review; run automated tests',successMeasures:'Achieve 97% acceptance within 6 months; baseline 90%'};
 for(const lang of ['ar','en']){const result=C.guidedPositionSuggestions(c,R,nodes,education,lang);assert.equal(result.status,'proposed-for-review');assert.equal(result.kpiProposal.baseline,'90%');assert.equal(result.kpiProposal.duration,'within 6 months');assert.equal(result.kpiProposal.target,c.successMeasures);assert.equal(result.kpiProposal.frequency,'');assert.ok(result.provenance.every(x=>x.reviewRequired));}
 const unclear=C.guidedPositionSuggestions({businessNeed:'Improve retention'},R,nodes,education,'en');assert.equal(unclear.status,'needs-confirmation');assert.deepEqual(unclear.values,{});assert.match(unclear.message,/position|duties|work/i);
});

test('opening another saved record cancels prior suggestions and does not inherit automatic field ownership',async()=>{
 const a=await ui('en');try{
  const manual=C.save(a.w.localStorage,{title:'Software Engineer',field:'Information Technology',jobFamily:'Information Technology',occupationCode:'251204',educationLevel:'6',educationFieldCode:'061302',businessNeed:'Manually reviewed source need',responsibilities:'Manually reviewed source duties'});
  const write=(key,value)=>{const x=a.w.document.querySelector('[data-field="'+key+'"]');x.value=value;x.dispatchEvent(new a.w.Event('input'));};
  write('businessNeed','Deliver internal software services');write('responsibilities','Develop software features; perform code review; run automated tests');await guidedWait();assert.equal(a.w.MiyarEnterprise.draftContent().occupationCode,'251204');
  write('responsibilities','Prepare accounting entries; reconcile bank accounts');a.w.MiyarEnterprise.open('workspace');await settle();a.w.document.querySelector('[data-position="'+manual.id+'"]').click();await settle();a.$('edit-position').click();await settle();
  write('businessNeed','zxqv qqqz');write('responsibilities','zxqv qqqz');await guidedWait();const draft=a.w.MiyarEnterprise.draftContent();assert.equal(draft.title,'Software Engineer');assert.equal(draft.occupationCode,'251204');assert.equal(draft.educationFieldCode,'061302');assert.equal(draft.jobFamily,'Information Technology');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
