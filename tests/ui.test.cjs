const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'../dist');
function app({locale='ar',saved=null}={}){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Miyar/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
 const w=dom.window;w.localStorage.setItem('miyar-language',locale);if(saved)w.localStorage.setItem('miyar-position-workspace-v1',saved);
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 for(const file of ['data.js','engine.js','position.js','workspace.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const $=id=>w.document.getElementById(id);const fill=(id,value)=>{const el=$(id);assert.ok(el,id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const submit=value=>{fill('objective',value);$('role-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 const clickStep=n=>w.document.querySelector('[data-od-step="'+n+'"]').click();
 return {w,$,fill,submit,clickStep,errors,close:()=>dom.window.close()};
}

test('both interfaces distinguish direct lookup from task analysis and render ambiguity candidates',()=>{
 for(const locale of ['ar','en']){const a=app({locale});try{
  a.submit(locale==='ar'?'مهندس مدني':'Civil Engineer');assert.match(a.$('result-content').textContent,/214201/);assert.match(a.$('result-badge').textContent,/بحث مرجعي|Reference lookup/);assert.equal(a.$('form-error').hidden,true);
  a.submit('تحسين الأداء وتوزيع الموارد ومتابعة العمل في الإدارة المالية');assert.doesNotMatch(a.$('result-content').textContent,/214116/);
  a.submit('soil construction mechanical maintenance');assert.equal(a.w.document.querySelectorAll('[data-candidate]').length,2);
  a.fill('catalog-search','٢١٤٢٠١');assert.match(a.$('catalog-grid').textContent,/214201/);assert.doesNotMatch(a.$('catalog-grid').textContent,/214116/);
  assert.deepEqual(a.errors,[]);
 }finally{a.close();}}
});
test('create, save, reopen, revise and find a position across browser sessions',()=>{
 const a=app({locale:'en'});let saved;
 try{a.$('od-clear').click();a.fill('od-title','Workforce Analytics Specialist');a.fill('od-department','People Planning');a.fill('od-purpose','Create workforce demand forecasts');a.$('od-save').click();
  assert.match(a.$('od-save-status').textContent,/Saved on this device/);assert.match(a.$('saved-grid').textContent,/Workforce Analytics Specialist/);
  saved=a.w.localStorage.getItem(a.w.MiyarWorkspace.KEY);assert.equal(JSON.parse(saved).length,1);assert.deepEqual(a.errors,[]);
 }finally{a.close();}
 const next=app({locale:'en',saved});try{next.fill('catalog-search','Workforce Analytics');next.w.document.querySelector('[data-open-draft]').click();assert.equal(next.$('od-title').value,'Workforce Analytics Specialist');assert.equal(next.$('od-department').value,'People Planning');next.fill('od-purpose','Create demand forecasts and capacity scenarios');next.$('od-save').click();const record=JSON.parse(next.w.localStorage.getItem(next.w.MiyarWorkspace.KEY));assert.equal(record.length,1);assert.equal(record[0].revision,2);assert.match(record[0].input.purpose,/capacity/);assert.deepEqual(next.errors,[]);}finally{next.close();}
});
test('scope edits invalidate prior review; report preview escapes user text and retains language',()=>{
 const a=app({locale:'en'});try{
  a.clickStep(2);a.fill('od-businessReviewer','Example Reviewer');a.fill('od-businessReviewDate','2026-09-12');a.$('od-business-reviewed').checked=true;a.$('od-business-reviewed').dispatchEvent(new a.w.Event('change'));
  assert.match(a.$('od-summary').textContent,/Business review recorded/);
  a.clickStep(0);a.fill('od-title','<img src=x onerror=alert(1)> Analyst');assert.match(a.$('od-summary').textContent,/Scope changed/);
  a.$('package-preview').click();const dialog=a.w.document.querySelector('.report-dialog');assert.ok(dialog.open);assert.match(dialog.textContent,/<img src=x onerror=alert\(1\)> Analyst/);assert.equal(dialog.querySelector('img'),null);dialog.querySelector('[data-report-close]').click();
  a.$('language-btn').click();assert.equal(a.w.document.documentElement.dir,'rtl');assert.equal(a.$('od-title').value,'<img src=x onerror=alert(1)> Analyst');assert.deepEqual(a.errors,[]);
 }finally{a.close();}
});
test('replacing an unsaved draft needs an explicit choice and saving retains its fields',()=>{
 const a=app();try{a.fill('od-title','مسودة غير محفوظة');a.$('od-clear').click();assert.equal(a.$('od-title').value,'مسودة غير محفوظة');a.w.document.querySelector('[data-choice="cancel"]').click();assert.equal(a.$('od-title').value,'مسودة غير محفوظة');a.$('od-clear').click();a.w.document.querySelector('[data-choice="save"]').click();assert.equal(a.$('od-title').value,'');const records=JSON.parse(a.w.localStorage.getItem(a.w.MiyarWorkspace.KEY));assert.equal(records[0].input.title,'مسودة غير محفوظة');assert.deepEqual(a.errors,[]);}finally{a.close();}
});
test('reference-to-position continuation preserves constraints without inventing responsibilities',()=>{
 const a=app({locale:'en'});try{a.submit('214201');a.fill('constraints','Office work only');a.$('role-form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));a.$('draft-position').click();assert.equal(a.$('od-title').value,'Civil Engineer');assert.equal(a.$('od-constraints').value,'Office work only');assert.equal(a.$('od-purpose').value,'');assert.equal(a.$('od-requestType').value,'additional-headcount');assert.deepEqual(a.errors,[]);}finally{a.close();}
});

test('Field and Seniority accept arbitrary typed text, survive language changes and export without HTML execution',()=>{
 const a=app({locale:'en'});try{
  assert.equal(a.$('domain').tagName,'INPUT');assert.equal(a.$('seniority').tagName,'INPUT');
  a.fill('domain','Civil engineering');a.fill('seniority','Principal / 15+ years <img src=x onerror=alert(1)>');a.submit('Civil Engineer');
  assert.match(a.$('result-content').textContent,/Principal \/ 15\+ years/);assert.equal(a.$('result-content').querySelector('img'),null);
  a.$('language-btn').click();assert.equal(a.$('domain').value,'Civil engineering');assert.equal(a.$('seniority').value,'Principal / 15+ years <img src=x onerror=alert(1)>');
  const input={objective:'Civil Engineer',domain:a.$('domain').value,seniority:a.$('seniority').value};const result=a.w.MiyarEngine.classify(input,a.w.MIYAR_DATA.roles);assert.equal(a.w.MiyarEngine.decisionRecord(result,input,'test').input.seniority,input.seniority);
  a.fill('domain','Healthcare / AI governance');a.submit('مدير حوكمة الذكاء الاصطناعي');assert.deepEqual(a.errors,[]);
 }finally{a.close();}
});
