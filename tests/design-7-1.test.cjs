// 7.1 enterprise design layer: tokens, global search, five-step stepper and AA contrast on the new chips.
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
const lum=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b;};
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);

test('the design layer ships with the release and is wired into the page',()=>{
 const page=read('index.html');
 assert.match(page,/design-7-1\.css|miyar-[0-9a-f]{16}\.css/);
 const css=read('design-7-1.css');
 for(const token of ['--ds-accent:#0b5cd5','--green:var(--ds-accent)','.ds-stepper','.ds-search','.svc-metrics button::before'])assert.ok(css.includes(token),token);
 assert.equal(fs.readFileSync(path.join(__dirname,'../VERSION'),'utf8').trim(),'7.1.0');
 assert.match(read('trust.js'),/v7\.1\.0 · 2026-10-06/);
});

test('accent, chip and stepper colours meet AA on their backgrounds',()=>{
 const pairs=[['#0b5cd5','#ffffff'],['#0a4db3','#e8f0fe'],['#0f7b4f','#e3f5ec'],['#8a5a0b','#fff4df'],['#3d4a5c','#eef1f5'],['#5b6778','#ffffff'],['#5b6778','#f4f6f9'],['#1f2a37','#ffffff'],['#9cc4ff','#0f2a47']];
 for(const [fg,bg] of pairs)assert.ok(ratio(fg,bg)>=4.5,fg+' on '+bg+' = '+ratio(fg,bg).toFixed(2));
});

test('the top bar gains a global search that opens the directory with the query',async()=>{
 const a=await app('#enterprise/overview');try{
  for(let i=0;i<40&&!a.d.querySelector('.topbar .ds-search input');i++)await settle();
  const input=a.d.querySelector('.topbar .ds-search input');assert.ok(input);
  assert.equal(input.getAttribute('aria-label'),'Search occupations, codes or saved positions');
  assert.equal(a.d.documentElement.dataset.design,'7.1');
  input.value='civil engineer';a.d.querySelector('.topbar .ds-search').dispatchEvent(new a.w.Event('submit',{cancelable:true}));
  for(let i=0;i<60&&a.w.location.hash!=='#enterprise/reference';i++)await settle();
  assert.equal(a.w.location.hash,'#enterprise/reference');
  for(let i=0;i<60;i++){await settle();const f=a.d.querySelector('#ent-content input');if(f&&f.value==='civil engineer')break;}
  assert.equal(a.d.querySelector('#ent-content input').value,'civil engineer');
  a.w.location.hash='#enterprise/overview';a.w.dispatchEvent(new a.w.Event('hashchange'));await settle();await settle();
  assert.equal(a.d.querySelectorAll('.topbar .ds-search').length,1,'one search box after navigation');
 }finally{a.dom.window.close();}
});

test('working screens show the five-step stepper with the current step and links to each stage',async()=>{
 const a=await app('#enterprise/create');try{
  for(let i=0;i<40&&!a.d.querySelector('.ds-stepper');i++)await settle();
  const steps=[...a.d.querySelectorAll('.ds-stepper li')];assert.equal(steps.length,5);
  assert.deepEqual(steps.map(s=>s.textContent.trim()),['Design','Evaluate','Compensation','Plan','Approve']);
  assert.equal(steps[0].getAttribute('aria-current'),'step');
  assert.equal(steps[1].querySelector('a').getAttribute('href'),'#enterprise/grading');
  assert.equal(a.d.querySelectorAll('.ds-stepper').length,1);
  a.w.location.hash='#enterprise/grading';a.w.dispatchEvent(new a.w.Event('hashchange'));
  for(let i=0;i<60;i++){await settle();if(a.d.querySelector('.ds-stepper[data-step="2"]'))break;}
  const grading=[...a.d.querySelectorAll('.ds-stepper li')];assert.equal(grading.length,5);
  assert.equal(grading[1].getAttribute('aria-current'),'step');assert.ok(grading[0].classList.contains('done'));
  assert.ok(a.d.querySelector('.ds-context').textContent.includes('Grade'));
 }finally{a.dom.window.close();}
});

test('the stepper and context read in Arabic after a language switch',async()=>{
 const a=await app('#enterprise/compensation','ar');try{
  for(let i=0;i<40&&!a.d.querySelector('.ds-stepper[data-step="3"]');i++)await settle();
  const steps=[...a.d.querySelectorAll('.ds-stepper li')].map(s=>s.textContent.trim());
  assert.equal(steps[2],'التعويضات');assert.equal(a.d.querySelector('.ds-stepper li[aria-current=step]').textContent.trim(),'التعويضات');
  assert.equal(a.d.querySelector('.topbar .ds-search input').getAttribute('aria-label'),'ابحث عن مهنة أو رمز أو منصب محفوظ');
 }finally{a.dom.window.close();}
});
