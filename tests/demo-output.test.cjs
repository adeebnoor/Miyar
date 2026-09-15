const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
function app(locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const html='<!doctype html><html><body><div id="app"></div></body></html>';
 const dom=new JSDOM(html,{url:'https://example.test/Miyar/#demo',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.localStorage.setItem('miyar-language',locale);w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});let scrollCalls=0;w.HTMLElement.prototype.scrollIntoView=()=>{scrollCalls++;};Object.defineProperty(w,'innerWidth',{value:390,configurable:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const file of ['data.js','engine.js','position.js','workspace.js','app.js','demo-fix.js'])w.eval(fs.readFileSync(path.join(dir,file),'utf8'));
 const $=id=>w.document.getElementById(id);const fill=value=>{const el=$('objective');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};const submit=()=>$('role-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return {w,dom,$,fill,submit,errors,getScrollCalls:()=>scrollCalls};
}
test('short strategic objectives produce a visible guidance result instead of a silent form state',async()=>{
 for(const locale of ['ar','en']){const a=app(locale);try{
  a.fill(locale==='ar'?'التحول الرقمي':'Digital transformation');a.submit();await Promise.resolve();
  assert.equal(a.$('form-error').hidden,true);
  assert.match(a.$('result-content').textContent,locale==='ar'?/يحتاج وصفًا أوضح/:/needs clearer work or capability detail/i);
  const feedback=a.w.document.querySelector('.analysis-feedback');assert.ok(feedback);assert.match(feedback.textContent,locale==='ar'?/اكتمل التحليل/:/Analysis complete/i);
  assert.ok(a.w.document.querySelector('.result-panel').classList.contains('analysis-complete'));
  assert.ok(a.getScrollCalls()>0);
  a.fill(locale==='ar'?'مهندس مدني':'Civil Engineer');a.submit();await Promise.resolve();assert.match(a.$('result-content').textContent,/214201/);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}}
});
test('blank input still asks for required information rather than fabricating a result',async()=>{
 const a=app('en');try{a.fill('');a.submit();await Promise.resolve();assert.equal(a.$('form-error').hidden,false);assert.match(a.w.document.querySelector('.analysis-feedback').textContent,/Complete the required input/i);assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}
});
