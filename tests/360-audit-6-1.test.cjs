const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const pause=()=>new Promise(r=>setTimeout(r,15));
async function ready(dom,check){for(let i=0;i<50&&!check();i++)await pause();assert.ok(check(),'Expected the route to finish rendering');}
async function app(route='#home',locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>false;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const file=path.join(dir,value.split('?')[0]);return {ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};}return {ok:false,status:401,json:async()=>({detail:'Organization sign-in required'})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 await ready(dom,()=>route.startsWith('#enterprise')?w.document.querySelector('#ent-content')?.textContent.trim():w.document.querySelector('.lp-hero'));
 return {w,dom,errors,d:w.document};
}
const publicViews=['home','demo','position','value','benchmarks','journey','catalog'];
const enterpriseTabs=['overview','create','workspace','reference','intelligence','bulk','grading','readiness','evidence','market','connection','tour','review','business','manpower','compensation'];
function checkLinks(d){
 const allowed=new Set([...publicViews,...enterpriseTabs.map(x=>'enterprise/'+x),'home/capabilities','home/governance','home/services','landing-main','main']);
 for(const a of d.querySelectorAll('a[href]')){
  const value=a.getAttribute('href');if(!value||value.startsWith('blob:')||value.startsWith('otpauth:'))continue;
  const url=new URL(value,d.URL);if(url.origin!=='https://example.test')continue;
  const file=url.pathname.replace(/^\/Miyar\//,'')||'index.html';
  if(file==='index.html'||file===''){
   if(url.hash)assert.ok(allowed.has(url.hash.slice(1)),`Unknown application link: ${value}`);
  }else assert.ok(fs.existsSync(path.join(dir,file)),`Missing first-party linked file: ${value}`);
 }
}
for(const lang of ['ar','en'])test('all public and enterprise navigation destinations have content and valid first-party file links in '+lang,async()=>{
 const a=await app('#home',lang);try{
  for(const view of publicViews){a.w.location.hash='#'+view;await ready(a.dom,()=>a.d.getElementById('view-'+view)?.hidden===false);checkLinks(a.d);}
  for(const tab of enterpriseTabs){a.w.location.hash='#enterprise/'+tab;await ready(a.dom,()=>a.w.MiyarEnterprise.getTab()===tab&&a.d.querySelector('#ent-content')?.textContent.trim());assert.ok(a.d.querySelector('#ent-content').textContent.trim().length>40,tab);checkLinks(a.d);}
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
for(const tab of ['review','business'])test('a direct '+tab+' link opens that enterprise service on first load',async()=>{const a=await app('#enterprise/'+tab);try{assert.equal(a.w.MiyarEnterprise.getTab(),tab);assert.equal(a.d.getElementById('enterprise-heading').textContent,tab==='review'?'Position requirements review':'Value & pilot');}finally{a.dom.window.close();}});
test('first-visit value precedes updates and the complete service directory distinguishes approval prerequisites',async()=>{
 for(const lang of ['ar','en']){const a=await app('#home',lang);try{
  await ready(a.dom,()=>a.d.getElementById('lp-services')&&a.d.querySelector('.whats-new'));
  const hero=a.d.querySelector('.lp-hero'),updates=a.d.querySelector('.whats-new');assert.equal(updates.previousElementSibling,hero);assert.equal(hero.querySelectorAll('.lp-value-points li').length,3);
  const services=a.d.getElementById('lp-services');assert.equal(services.querySelectorAll('.release-phase-card').length,6);
  assert.match(services.textContent,lang==='en'?/ORGANIZATION APPROVAL AFTER SIGN-IN/:/اعتماد المؤسسة بعد الدخول/);
  for(const tab of ['create','manpower','compensation','intelligence','grading','workspace','reference','bulk','tour'])assert.ok(services.querySelector('a[href="#enterprise/'+tab+'"]'),tab);
  assert.ok(a.d.querySelector('.lp-nav a[href="#home/services"]'));assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('zero-minimum salary band retains valid calculations but never serializes or displays infinite spread',async()=>{
 const C=require('../dist/compensation-engine.js'),v=C.evaluate({...C.example,bandMin:0,targetPenetration:0,oncostPercent:0});assert.equal(v.result.targetSalary,0);assert.equal(v.bandDiagnostics.rangeSpreadPercent,null);assert.equal(v.bandDiagnostics.spreadAssessment,'undefined');assert.deepEqual(JSON.parse(JSON.stringify(v)).bandDiagnostics,v.bandDiagnostics);
 const a=await app('#enterprise/compensation');try{const p=a.d.querySelector('.cp-page');p.querySelector('[data-cp-example]').click();a.d.getElementById('cp-min').value='0';p.querySelector('[data-cp-run]').click();assert.match(p.querySelector('.cp-diagnostics').textContent,/Not computable when the minimum is zero/);assert.doesNotMatch(p.querySelector('.cp-result').textContent,/Infinity|NaN/);assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}
});
test('salary currency is preserved and malformed codes are rejected rather than truncated',()=>{const C=require('../dist/compensation-engine.js');assert.equal(C.evaluate({...C.example,currency:' usd '}).input.currency,'USD');for(const currency of ['S','SA','SAR1','SAUDI','123','<x>'])assert.throws(()=>C.evaluate({...C.example,currency}),/three-letter/);});
