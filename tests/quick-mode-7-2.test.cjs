// 7.2: deeper proxy fill tagged for review, a why line on all fifteen core fields, and Quick mode in three screens.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setTimeout(r,25));
const read=f=>fs.readFileSync(path.join(dir,f),'utf8');

async function app(route,locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;require('./local-workspace.cjs')(w);
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./'))return {ok:true,json:async()=>JSON.parse(read(value.split('?')[0]))};return {ok:false,status:404,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(read(s.getAttribute('src').split('?')[0]));
 await settle();await settle();return {w,dom,errors,d:w.document};
}
const NEED='Improve financial reporting accuracy and shorten the monthly close across all departments';
const DUTIES='Prepare monthly financial statements and reconciliations\nReview journal entries and resolve discrepancies with departments\nMaintain the chart of accounts and reporting calendar\nSupport external audit requests';

test('the suggestion engine infers alternatives, supervision scope, budget scope, authority, experience and two KPIs, all tagged for review',async()=>{
 const a=await app('#enterprise/create');try{
  for(let i=0;i<40&&!a.w.MiyarEnterprise?.guidedSuggest;i++)await settle();
  const s=a.w.MiyarEnterprise.guidedSuggest({businessNeed:NEED,responsibilities:DUTIES});
  assert.equal(s.status,'proposed-for-review',s.message);
  for(const key of ['alternatives','team','budget','authority','experience','successMeasures'])assert.ok(String(s.values[key]||'').length>20,key+' inferred: '+s.values[key]);
  assert.ok(s.values.alternatives.includes('Prepare monthly financial statements'),'alternatives cite the first duty');
  assert.ok(s.kpiProposals.length>=2,'two KPI proposals');assert.notEqual(s.kpiProposals[0].metric,s.kpiProposals[1].metric);
  assert.equal(s.kpiProposals[1].baseline,'','baseline is never invented');
  const inferred=s.provenance.filter(p=>p.source==='inferred-from-need').map(p=>p.field);
  for(const key of ['alternatives','team','budget','authority','experience'])assert.ok(inferred.includes(key),key+' carries inferred provenance');
  // a field the user already wrote is never overwritten by inference
  const kept=a.w.MiyarEnterprise.guidedSuggest({businessNeed:NEED,responsibilities:DUTIES,budget:'Owns a SAR 2m budget'});
  assert.equal(kept.values.budget,undefined);
 }finally{a.dom.window.close();}
});

test('every one of the fifteen core fields explains why it is asked',async()=>{
 const a=await app('#enterprise/create');try{
  for(let i=0;i<40&&!a.d.querySelector('#ent-apply-guided');i++)await settle();
  const core=a.w.MiyarEnterprise.coreFields();assert.equal(core.length,15);
  const missing=core.filter(k=>!a.d.querySelector('#ent-help-'+k)?.textContent.trim());
  assert.equal(missing.length,0,'missing why: '+missing.join(','));
  assert.ok(a.d.querySelector('.ent-quick-link[href="#enterprise/quick"]'),'the form points to Quick mode');
 }finally{a.dom.window.close();}
});

test('applied suggestions show a "Proposed — review it" tag that disappears when the user edits the field',async()=>{
 const a=await app('#enterprise/create');try{
  for(let i=0;i<40&&!a.d.querySelector('#ent-apply-guided');i++)await settle();
  const set=(k,v)=>{const f=a.d.querySelector('[data-field="'+k+'"]');f.value=v;f.dispatchEvent(new a.w.Event('input',{bubbles:true}));};
  set('businessNeed',NEED);set('responsibilities',DUTIES);
  for(let i=0;i<40&&a.d.querySelector('#ent-apply-guided').disabled;i++)await settle();
  a.d.querySelector('#ent-apply-guided').click();await settle();await settle();
  const budget=a.d.querySelector('[data-field="budget"]');assert.ok(budget.value.length>20);
  assert.ok(budget.closest('label').classList.contains('ent-suggested'));
  assert.equal(budget.closest('label').querySelector('.ent-suggested-tag').textContent,'Proposed — review it');
  assert.ok(a.d.querySelector('#ent-guided-proposals').textContent.includes('Inferred from the need'));
  const draft=a.w.MiyarEnterprise.draftContent();assert.ok(draft.kpis.length>=2,'two KPI rows applied');
  budget.value='Owns the finance operating budget';budget.dispatchEvent(new a.w.Event('input',{bubbles:true}));
  assert.ok(!budget.closest('label').classList.contains('ent-suggested'));assert.equal(budget.closest('label').querySelector('.ent-suggested-tag'),null);
  assert.ok(a.d.querySelector('#ent-readiness').textContent.includes('/ 15'));
 }finally{a.dom.window.close();}
});

test('Quick mode runs three screens and ends in a saved local draft opened in Position design with the core fields filled',async()=>{
 const a=await app('#enterprise/quick');try{
  for(let i=0;i<40&&!a.d.querySelector('.qm-page');i++)await settle();
  assert.equal(a.d.querySelectorAll('.qm-steps li').length,3);
  assert.equal(a.d.querySelector('.qm-steps li[aria-current=step] span').textContent,'Describe the need');
  // validation first
  a.d.querySelector('[data-qm-next]').click();await settle();
  assert.ok(!a.d.querySelector('[data-qm-status]').hidden);
  const fill=(k,v)=>{const f=a.d.querySelector('[data-qm="'+k+'"]');f.value=v;f.dispatchEvent(new a.w.Event('input',{bubbles:true}));};
  fill('businessNeed',NEED);fill('responsibilities',DUTIES);
  a.d.querySelector('[data-qm-next]').click();await settle();await settle();
  assert.equal(a.d.querySelector('.qm-steps li[aria-current=step] span').textContent,'Review proposals');
  const tags=a.d.querySelectorAll('.qm-page .ent-suggested-tag');assert.ok(tags.length>=6,'proposals are tagged: '+tags.length);
  assert.equal(a.d.querySelectorAll('[data-qm-kpi][data-k="metric"]').length,2);
  const team=a.d.querySelector('[data-qm-field="team"]');team.value='Individual contributor; coordinates with three accountants';team.dispatchEvent(new a.w.Event('input',{bubbles:true}));
  assert.equal(team.closest('label').querySelector('.ent-suggested-tag'),null);
  a.d.querySelector('[data-qm-next]').click();await settle();
  assert.equal(a.d.querySelector('.qm-steps li[aria-current=step] span').textContent,'Defensible draft');
  assert.ok(a.d.querySelector('.qm-summary').textContent.includes('Why a position rather than an alternative'));
  assert.match(a.d.querySelector('.qm-progress').textContent,/Core fields complete: 1[0-5] \/ 15/);
  a.d.querySelector('[data-qm-save]').click();for(let i=0;i<60&&a.w.location.hash!=='#enterprise/create';i++)await settle();
  assert.equal(a.w.location.hash,'#enterprise/create');
  const rows=JSON.parse(a.w.localStorage.getItem('miyar-enterprise-local-v1'));assert.equal(rows.length,1);assert.equal(rows[0].content.team,'Individual contributor; coordinates with three accountants');
  for(let i=0;i<40&&!a.d.querySelector('#ent-readiness');i++)await settle();
  assert.match(a.d.querySelector('#ent-readiness').textContent,/Core fields complete: 1[0-5] \/ 15/);
  assert.equal(a.d.querySelector('[data-field="alternatives"]').value,rows[0].content.alternatives);
 }finally{a.dom.window.close();}
});

test('Quick mode asks for clarification instead of inventing a role when the duties are not enough',async()=>{
 const a=await app('#enterprise/quick','ar');try{
  for(let i=0;i<40&&!a.d.querySelector('.qm-page');i++)await settle();
  const fill=(k,v)=>{const f=a.d.querySelector('[data-qm="'+k+'"]');f.value=v;f.dispatchEvent(new a.w.Event('input',{bubbles:true}));};
  fill('businessNeed','خفض دوران الممرضين وتحسين سلامة المرضى');fill('responsibilities','تحسين الاحتفاظ\nرفع الرضا\nمتابعة السلامة');
  a.d.querySelector('[data-qm-next]').click();await settle();await settle();
  assert.equal(a.d.querySelectorAll('.qm-page .ent-suggested-tag').length,0);
  assert.ok(a.d.querySelector('[data-qm-back]'),'the user is sent back to refine the input');
  assert.equal(a.d.querySelector('[data-qm-save]'),null);
 }finally{a.dom.window.close();}
});
