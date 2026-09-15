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
test('public entrance makes the strategic workforce engine the primary path and preserves the position example',async()=>{
 for(const lang of ['ar','en']){const a=await app(lang);try{
  assert.equal(a.$('view-home').hidden,false);assert.equal(a.w.document.querySelector('.app-shell').hidden,true);
  assert.equal(a.$('view-home').querySelectorAll('input[type=file]').length,0);
  const primary=a.$('view-home').querySelector('.lp-hero [data-lp-strategy]');assert.ok(primary);
  assert.match(primary.textContent,lang==='ar'?/الهدف الاستراتيجي/:/strategic objective/i);
  primary.click();await settle();
  assert.equal(a.w.location.hash,'#demo');assert.equal(a.$('view-home').hidden,true);assert.equal(a.$('view-demo').hidden,false);assert.ok(a.$('objective'));assert.ok(a.$('role-form'));
  const nav=a.w.document.querySelector('[data-strategy-nav]');assert.ok(nav);assert.equal(nav.getAttribute('href'),'#demo');assert.equal(nav.getAttribute('aria-current'),'page');
  assert.match(nav.textContent,lang==='ar'?/المحرك الاستراتيجي/:/Strategic workforce engine/);
  a.w.location.hash='home';await new Promise(r=>setTimeout(r,5));assert.equal(a.$('view-home').hidden,false);
  a.$('lp-language').click();await settle();
  const sample=a.$('view-home').querySelector('[data-lp-demo]');assert.ok(sample);sample.click();await settle();
  assert.equal(a.w.location.hash,'#enterprise/create');assert.equal(a.$('view-home').hidden,true);assert.equal(a.w.document.querySelector('.app-shell').hidden,false);
  assert.equal(a.w.document.querySelector('[data-field=occupationCode]').value,'251204');
  assert.equal(a.w.document.querySelectorAll('[data-matrix-key=kpis][data-matrix-field=target]').length,3);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('deep links enter the correct surface and the strategic engine stays discoverable from the workspace',async()=>{
 for(const route of ['#enterprise/overview','#enterprise/create','#enterprise/connection','#demo']){const a=await app('ar',route);try{
  assert.equal(a.$('view-home').hidden,true);assert.equal(a.w.document.querySelector('.app-shell').hidden,false);
  const strategy=a.w.document.querySelector('[data-strategy-nav]');assert.ok(strategy);assert.equal(strategy.getAttribute('href'),'#demo');
  if(route==='#demo'){assert.equal(a.$('view-demo').hidden,false);assert.equal(strategy.getAttribute('aria-current'),'page');}
  if(route.endsWith('overview')){assert.deepEqual([...a.w.document.querySelectorAll('.svc-metrics strong')].map(x=>x.textContent),['٠','٠','٠','٠']);assert.ok(a.$('svc-import-file').closest('.miyar-file-control'));assert.match(a.$('svc-file-name').textContent,/لم يُختر/);assert.equal(a.$('svc-account'),null);}
  a.w.location.hash='home';await new Promise(r=>setTimeout(r,5));assert.equal(a.$('view-home').hidden,false);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
