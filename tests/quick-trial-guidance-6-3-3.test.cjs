const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),dir=path.join(__dirname,'../dist'),taxonomy=require('../dist/classifications/ssco-2019.json');
function boot(locale){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/#demo',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 require('./local-workspace.cjs')(w);w.localStorage.setItem('miyar-language',locale);w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const file of ['data.js','engine.js','position.js','workspace.js','app.js','role-catalog.js','role-recommender.js'])w.eval(fs.readFileSync(path.join(dir,file),'utf8'));
 w.MiyarEnterpriseCore={normalize:w.MiyarRoleRecommender.normalize,search:(nodes,q)=>w.MiyarRoleRecommender.directorySearch(nodes,q)};
 w.fetch=async()=>({ok:true,json:async()=>taxonomy});w.eval(fs.readFileSync(path.join(dir,'demo-runtime-v5.js'),'utf8'));w.MiyarDemoRuntimeV5.prime();
 const $=id=>w.document.getElementById(id),fill=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));},submit=()=>$('role-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return {dom,w,$,fill,submit};
}
async function settle(){await new Promise(r=>setTimeout(r,20));}
for(const locale of ['ar','en']){
 test('Quick Trial starts with one required field and opens AI context / '+locale,async()=>{const a=boot(locale);try{
  a.fill('objective','');a.submit();assert.equal(a.w.document.activeElement.id,'objective');assert.equal(a.$('objective').getAttribute('aria-invalid'),'true');assert.match(a.$('objective').getAttribute('aria-describedby'),/form-error/);assert.equal(a.$('objective').nextElementSibling.id,'form-error');assert.equal(a.$('form-error').hidden,false);a.fill('objective','Software Engineer');assert.equal(a.$('objective').hasAttribute('aria-invalid'),false);assert.equal(a.$('form-error').hidden,true);
  assert.equal(a.$('demo-context-fields').open,false);assert.match(a.$('objective-purpose').textContent,/لماذا|Why/);for(const id of ['domain','seniority','constraints'])assert.ok(a.$(a.$(id).getAttribute('aria-describedby')).textContent.length>30);
  const mode=a.$('demo-engine-mode');mode.value='ai';mode.dispatchEvent(new a.w.Event('change',{bubbles:true}));assert.equal(a.$('demo-context-fields').open,true);assert.equal(a.$('seniority').getAttribute('aria-required'),'true');await settle();
 }finally{a.dom.window.close();}});
 test('source-checked task suggestion fills only empty field and remains editable / '+locale,async()=>{const a=boot(locale);try{
  const goal=locale==='ar'?'تطوير تطبيقات الويب وكتابة الكود':'Develop web applications and write source code';a.fill('objective',goal);a.submit();await settle();
  assert.equal(a.$('domain').value,locale==='ar'?'تقنية المعلومات':'Information Technology');assert.equal(a.$('seniority').value,'');assert.equal(a.$('constraints').value,'');assert.equal(a.$('demo-context-fields').open,false);assert.match(a.$('demo-suggested-context').textContent,/SSCO 2019.*251204/);
  a.fill('objective',locale==='ar'?'إعداد القوائم المالية وتسوية الحسابات':'Prepare financial statements and reconcile accounting balances');assert.equal(a.$('domain').value,'');a.submit();await settle();assert.equal(a.$('domain').value,locale==='ar'?'المالية':'Finance');
  a.fill('objective','asdf qwer zxcv');assert.equal(a.$('domain').value,'');a.submit();await settle();assert.equal(a.$('demo-suggested-context').hidden,true);assert.equal(a.w.document.querySelector('.demo-final-title'),null);a.fill('objective',goal);a.submit();await settle();
  a.w.document.querySelector('[data-demo-edit-context]').click();assert.equal(a.$('demo-context-fields').open,true);assert.equal(a.w.document.activeElement.id,'domain');
  a.fill('domain','Information Technology / product team');a.submit();await settle();assert.equal(a.$('domain').value,'Information Technology / product team');assert.equal(a.$('demo-suggested-context').hidden,true);
 }finally{a.dom.window.close();}});
 test('outcome and actor clarifications explain choices without inferred scope / '+locale,async()=>{const a=boot(locale);try{
  a.fill('objective',locale==='ar'?'توظيف مهندسي البرمجيات':'Recruit software engineers');a.submit();await settle();const choices=[...a.w.document.querySelectorAll('[data-confirm-role-purpose]')];assert.equal(choices.length,2);assert.ok(choices.every(x=>x.textContent.length>30));assert.equal(a.$('domain').value,'');assert.equal(a.$('seniority').value,'');
  a.fill('objective',locale==='ar'?'تحسين الاحتفاظ بالموظفين':'Improve employee retention');a.submit();await settle();assert.equal(a.$('domain').value,'');assert.equal(a.$('demo-suggested-context').hidden,true);assert.equal(a.w.document.querySelector('.demo-final-title'),null);
 }finally{a.dom.window.close();}});
}
