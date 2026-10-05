const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setTimeout(r,15));
async function app(tab){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#enterprise/'+tab,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.localStorage.setItem('miyar-language','en');w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,value.split('?')[0]),'utf8'))};return {ok:false,status:401,json:async()=>({detail:'Sign in required'})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 for(let i=0;i<60&&!w.document.querySelector('#ent-content')?.textContent.trim();i++)await settle();
 return {w,dom,errors,d:w.document};
}
test('a corrected job evaluation clears the prior error and recalculation hint',async()=>{
 const a=await app('grading');try{
  a.d.getElementById('ent-calculate').click();await settle();assert.equal(a.d.getElementById('ent-message').getAttribute('role'),'alert');
  for(const x of a.d.querySelectorAll('[data-factor]')){x.value='2';x.dispatchEvent(new a.w.Event('input',{bubbles:true}));}
  for(const x of a.d.querySelectorAll('[data-factor-evidence]')){x.value='Independent responsibilities and authority evidence';x.dispatchEvent(new a.w.Event('input',{bubbles:true}));}
  a.d.getElementById('ent-calculate').click();await settle();assert.match(a.d.getElementById('ent-grade-result').textContent,/200/);assert.equal(a.d.getElementById('ent-grade-hint').textContent,'');assert.equal(a.d.getElementById('ent-message').getAttribute('role'),'status');assert.match(a.d.getElementById('ent-message').textContent,/calculated/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('editing the source description or context invalidates extracted skill evidence',async()=>{
 const a=await app('intelligence');try{
  const input=a.d.getElementById('ent-analysis-text');input.value='Programming and SQL';input.dispatchEvent(new a.w.Event('input',{bubbles:true}));a.d.getElementById('ent-extract').click();assert.match(a.d.getElementById('ent-skills').textContent,/Programming|SQL/);
  input.value='Entirely different responsibilities';input.dispatchEvent(new a.w.Event('input',{bubbles:true}));assert.equal(a.d.getElementById('ent-skills').textContent,'');assert.equal(a.d.getElementById('ent-candidates').textContent,'');
  a.d.getElementById('ent-extract').click();assert.match(a.d.getElementById('ent-skills').textContent,/No terms matched/);a.d.getElementById('ent-analysis-field').dispatchEvent(new a.w.Event('input',{bubbles:true}));assert.equal(a.d.getElementById('ent-skills').textContent,'');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
for(const tab of ['bulk','evidence'])test(tab+' invalid replacement file removes previous results instead of retaining stale export',async()=>{
 const a=await app(tab);try{
  const pilot=tab==='evidence',input=a.d.getElementById(pilot?'ent-pilot-file':'ent-bulk-file'),run=a.d.getElementById(pilot?'ent-pilot-run':'ent-bulk-run'),output=a.d.getElementById(pilot?'ent-pilot-result':'ent-bulk-result');
  const value=pilot?'caseId,expectedCode,miyarCode,baselineCode\n1,251204,251204,251204\n':'title,occupationCode\nمهندس برمجيات,251204\n';
  Object.defineProperty(input,'files',{configurable:true,value:[{size:value.length,text:async()=>value,name:'valid.csv'}]});run.click();await settle();assert.ok(output.textContent.trim());
  Object.defineProperty(input,'files',{configurable:true,value:[{size:10,text:async()=> 'title,title\na,b\n',name:'invalid.csv'}]});input.dispatchEvent(new a.w.Event('change',{bubbles:true}));assert.equal(output.textContent,'');run.click();await settle();assert.equal(output.textContent,'');assert.equal(a.d.getElementById('ent-message').getAttribute('role'),'alert');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
for(const tab of ['manpower','compensation'])test(tab+' invalid imported JSON removes the current computed export without changing saved records',async()=>{
 const a=await app(tab),p=tab==='manpower'?'mp':'cp';try{
  a.d.querySelector('[data-'+p+'-example]').click();a.d.querySelector('[data-'+p+'-run]').click();a.d.querySelector('[data-'+p+'-save]').click();assert.ok(a.d.querySelector('[data-'+p+'-export]'));
  const input=a.d.querySelector('[data-'+p+'-import]');Object.defineProperty(input,'files',{configurable:true,value:[{size:4,text:async()=>'{bad'}]});await input.onchange();assert.match(a.d.querySelector('[data-'+p+'-message]').textContent,/not valid JSON/);assert.equal(a.d.querySelector('[data-'+p+'-export]'),null);assert.equal(a.d.querySelectorAll('[data-'+p+'-open]').length,1);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('independent compensation examples cover monthly/annual cost, allowances and explicit zero',()=>{
 const C=require('../dist/compensation-engine.js');
 for(const period of ['monthly','annual'])for(const headcount of [1,3])for(const target of [80,100,120]){
  const v=C.evaluate({...C.example,period,headcount,targetCompaPercent:target,unitsConfirmed:true,progressionEnabled:true,progressionApproved:true,progressionPolicy:"Approved TR policy",progressionEvidence:"Individual performance evidence",bandMin:12000,bandMid:18000,bandMax:24000,currentSalary:15000,oncostPercent:10,allowancesPercent:20});
  const salary=18000*target/100,multiplier=period==='monthly'?12:1;assert.equal(v.result.targetSalary,salary);assert.equal(v.result.compaRatio,Math.round(15000/18000*1000)/1000);
  assert.equal(v.result.annualEmployerCost,Math.round(Math.max(salary,15000)*multiplier*headcount*1.2*1.1));
 }
});
