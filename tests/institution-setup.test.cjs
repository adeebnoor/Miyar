const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setImmediate(r));

function loadInstitution(locale='en'){
 const dom=new JSDOM('<!doctype html><html lang="'+locale+'"><body></body></html>',{url:'https://example.test/Miyar/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.structuredClone=structuredClone;w.Headers=Headers;w.Request=Request;w.AbortSignal=AbortSignal;w.fetch=async()=>({ok:true,json:async()=>({})});
 w.eval(fs.readFileSync(path.join(dir,'enterprise-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(dir,'institution-setup.js'),'utf8'));return {w,dom};
}

test('institution master normalizes structure and maps HC manager level to the approved grade',()=>{
 const a=loadInstitution('en');try{const I=a.w.MiyarInstitutionProfile,p=I.profileExample(),saved=I.saveLocal(p,true),unit=I.matchUnit(saved,'Human Capital'),grade=I.matchGrade(saved,'Manager level');
  assert.equal(saved.version,1);assert.equal(unit.code,'HC');assert.match(I.unitPath(saved,'HC'),/Corporate \/ Human Capital/);assert.equal(grade.id,'G11');assert.equal(grade.level,'manager');
 }finally{a.dom.window.close();}
});

async function app(locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#enterprise/create',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.Headers=Headers;w.Request=Request;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const p=path.join(dir,value);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),blob:async()=>new w.Blob(['pdf'])};}return {ok:true,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await settle();await settle();return {w,dom,errors,$:id=>w.document.getElementById(id)};
}

test('approved structure and grade architecture flow into the HC OD draft metadata',async()=>{
 const a=await app('en');try{const I=a.w.MiyarInstitutionProfile,p=I.profileExample();p.units.find(x=>x.code==='HC').leaderTitle='Chief Human Capital Officer';I.saveLocal(p,true);await settle();
  const panel=a.$('miyar-od-workbench');assert.ok(panel);assert.match(panel.querySelector('[data-institution-context]').textContent,/Configured/i);
  panel.querySelector('[data-od-example]').click();panel.querySelector('[data-od-generate]').click();await settle();await new Promise(r=>setTimeout(r,5));
  assert.match(panel.querySelector('[data-inst-match]').textContent,/G11/);assert.match(panel.querySelector('[data-inst-match]').textContent,/Human Capital/);
  panel.querySelector('[data-od-apply]').click();await new Promise(r=>setTimeout(r,5));
  assert.match(a.w.document.querySelector('[data-field=seniority]').value,/G11/);
  assert.equal(a.w.document.querySelector('[data-field=manager]').value,'Chief Human Capital Officer');
  a.$('ent-save').click();await settle();const saved=JSON.parse(a.w.localStorage.getItem(a.w.MiyarEnterpriseCore.KEY))[0].content;
  assert.equal(saved.orgUnitCode,'HC');assert.match(saved.orgUnitPath,/Corporate \/ Human Capital/);assert.match(saved.proposedGrade,/G11/);assert.equal(saved.gradeArchitectureName,'Organization Grade Architecture');assert.equal(saved.organizationProfileVersion,'1');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
