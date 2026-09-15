const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const dir=path.join(__dirname,'../dist');

test('QA OD layer keeps specialist occupations out of manager SSCO queries and gives distinct KPIs',()=>{
 const context={console,structuredClone,module:{exports:{}},exports:{}};context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(dir,'od-engine.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(dir,'od-engine-priority.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(dir,'qa-od-v5.js'),'utf8'),context);
 const E=context.MiyarODEngine;
 const nurse=E.generate({strategyObjective:'تحسين تجربة المرضى وتقليل أوقات الانتظار في قسم الطوارئ',responsibilities:'تقديم الرعاية التمريضية للمرضى\nتقييم الحالات وفرزها\nإعطاء الأدوية حسب الوصفات\nتوثيق السجلات الطبية'},'ar');
 assert.equal(nurse.family.id,'health');assert.equal(nurse.referenceQueries.ssco[0],'ممرض');assert.ok(nurse.referenceQueries.ssco.every(x=>!/^(مدير|رئيس)/.test(x)));
 const accountant=E.generate({strategyObjective:'رفع دقة التقارير المالية وتسريع الإقفال الشهري',responsibilities:'إعداد القيود المحاسبية\nمطابقة الحسابات البنكية\nإعداد التقارير المالية الشهرية\nمتابعة الذمم الدائنة والمدينة'},'ar');
 assert.equal(accountant.family.id,'finance');assert.equal(accountant.referenceQueries.ssco[0],'محاسب');assert.ok(accountant.referenceQueries.ssco.every(x=>!/^(مدير|رئيس)/.test(x)));
 const software=E.generate({strategyObjective:'تحسين جودة منصة الخدمات الرقمية',responsibilities:'تطوير مكونات البرمجيات\nكتابة اختبارات آلية\nمراجعة الكود\nتوثيق الإصدارات'},'ar');
 assert.equal(software.family.id,'it');assert.ok(software.referenceQueries.ssco.includes('مهندس برمجيات'));assert.ok(software.referenceQueries.ssco.every(x=>!/^(مدير|رئيس)/.test(x)));
 const sales=E.generate({strategyObjective:'Increase regional sales revenue by 20%',responsibilities:'Manage key accounts\nBuild sales pipeline\nNegotiate contracts\nReport monthly forecasts'},'en');
 assert.equal(sales.family.id,'sales');assert.ok(sales.referenceQueries.ssco.includes('اختصاصي مبيعات'));assert.ok(!sales.referenceQueries.ssco.includes('مدير مبيعات'));
 for(const p of [nurse,accountant,software,sales]){assert.ok(p.content.kpis.length>=3);assert.equal(new Set(p.content.kpis.map(k=>k.metric)).size,p.content.kpis.length);for(const k of p.content.kpis)assert.notEqual(k.target,k.outcome);}
});

async function app(route='#demo'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language','ar');w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.matchMedia=()=>({matches:false});
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./')){const file=path.join(dir,value.replace(/^\.\//,''));return {ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8')),blob:async()=>new w.Blob(['x'])};}return {ok:true,json:async()=>({})};};
 if(w.HTMLDialogElement){w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};}
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src')),'utf8'));
 await new Promise(r=>setTimeout(r,80));return {w,dom,errors};
}

test('strategic demo falls back to the full directory and carries the selected code into OD',async()=>{
 const a=await app();try{
  const input=a.w.document.getElementById('objective');input.value='محاسب';input.dispatchEvent(new a.w.Event('input',{bubbles:true}));
  a.w.document.getElementById('role-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,180));
  const directory=a.w.document.querySelector('.qa-directory');assert.ok(directory);assert.match(directory.textContent,/241101|محاسب/);
  const ref=directory.querySelector('[data-qa-ref]');assert.ok(ref);ref.click();await new Promise(r=>setTimeout(r,450));
  assert.equal(a.w.location.hash,'#enterprise/create');
  const code=a.w.document.querySelector('[data-field="occupationCode"]');assert.ok(code);assert.equal(code.value,'241101');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('occupation search accepts feminine Arabic and bounded English aliases',async()=>{
 const a=await app('#enterprise/reference');try{
  const C=a.w.MiyarEnterpriseCore,nodes=JSON.parse(fs.readFileSync(path.join(dir,'classifications/ssco-2019.json'),'utf8')).nodes.filter(x=>x.level==='occupation');
  const feminine=C.search(nodes,'مهندسة برمجيات');assert.ok(feminine.some(x=>x.code==='251204'));
  const english=C.search(nodes,'accountant');assert.ok(english.some(x=>x.code==='241101'));
 }finally{a.dom.window.close();}
});
