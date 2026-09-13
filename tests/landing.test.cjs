const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setImmediate(r));
async function app(locale='ar',route=''){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>false;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,String(url))))});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await settle();return {w,dom,errors,$:id=>w.document.getElementById(id)};
}
test('public entrance previews do not modify records; sample continues into editable KPIs and RACI in both languages',async()=>{
 for(const lang of ['ar','en']){const a=await app(lang);try{
  assert.equal(a.$('view-home').hidden,false);assert.equal(a.w.document.querySelector('.app-shell').hidden,true);
  assert.equal(a.$('view-home').querySelectorAll('input[type=file]').length,0);
  const previous=a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY);
  for(const id of ['kpi','raci','approval','role']){a.$('lp-tab-'+id).click();assert.equal(a.$('lp-panel-'+id).hidden,false);assert.equal(a.$('view-home').querySelectorAll('[role=tabpanel]:not([hidden])').length,1);}
  a.$('lp-tab-role').dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(a.w.document.activeElement.id,'lp-tab-approval');
  assert.equal(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY),previous);
  a.w.document.querySelector('[data-lp-demo]').click();await settle();
  assert.equal(a.w.location.hash,'#enterprise/create');assert.equal(a.$('view-home').hidden,true);assert.equal(a.w.document.querySelector('.app-shell').hidden,false);
  assert.equal(a.w.document.querySelector('[data-field=occupationCode]').value,'251204');
  assert.equal(a.w.document.querySelectorAll('[data-matrix-key=kpis][data-matrix-field=target]').length,3);
  const title=a.w.document.querySelector('[data-field=title]');title.value='My unsaved edited role';title.dispatchEvent(new a.w.Event('input'));
  a.w.location.hash='home';await new Promise(r=>setTimeout(r,5));a.$('lp-language').click();await settle();
  a.w.document.querySelector('[data-lp-demo]').click();await settle();assert.equal(a.$('view-home').hidden,false);
  a.w.MiyarEnterprise.open('create');assert.equal(a.w.document.querySelector('[data-field=title]').value,'My unsaved edited role');
  a.$('ent-save').click();await settle();const records=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY));assert.equal(records.length,1);assert.equal(records[0].state,'draft');assert.equal(records[0].content.kpis.length,3);assert.equal(records[0].content.raci.length,3);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('existing deep links enter workspace directly; public home keeps stored drafts and import control is localized',async()=>{
 for(const route of ['#enterprise/overview','#enterprise/create','#enterprise/connection']){const a=await app('ar',route);try{
  assert.equal(a.$('view-home').hidden,true);assert.equal(a.w.document.querySelector('.app-shell').hidden,false);
  if(route.endsWith('overview')){assert.deepEqual([...a.w.document.querySelectorAll('.svc-metrics strong')].map(x=>x.textContent),['٠','٠','٠','٠']);assert.ok(a.$('svc-import-file').closest('.miyar-file-control'));assert.match(a.$('svc-file-name').textContent,/لم يُختر/);assert.equal(a.$('svc-account'),null);}
  a.w.location.hash='home';await new Promise(r=>setTimeout(r,5));assert.equal(a.$('view-home').hidden,false);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
