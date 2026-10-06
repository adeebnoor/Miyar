// 7.0.1 pre-handoff fixes: one position label on every screen, a tour that follows the visible path, AA step numbers.
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

test('release identity is current everywhere the build reads it',()=>{
 const version=fs.readFileSync(path.join(__dirname,'../VERSION'),'utf8').trim();
 assert.match(version,/^7\./);
 assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,version);
 assert.equal(JSON.parse(read('release.json')).version,version);
 assert.match(read('trust.js'),/v7\.0\.1 · 2026-10-05/);
});

test('one saved draft carries the same label in evaluation, compensation and manpower, and is listed once',async()=>{
 const a=await app('#enterprise/create');try{
  for(let i=0;i<20&&!a.d.querySelector('#ent-content');i++)await settle();
  const label=a.w.MiyarEnterprise.positionLabel({id:'LOCAL-e025cba9-a571-45e0-9ca3-274e6edffeaa',title:'Software engineer',revision:1});
  assert.equal(label,'Software engineer · v1 · e025cba9');
  assert.equal(a.w.MiyarEnterprise.positionLabel({id:'LOCAL-e025cba9-a571-45e0-9ca3-274e6edffeaa',content:{title:'مهندس برمجيات'},revision:2}),'مهندس برمجيات · v2 · e025cba9');
  a.w.localStorage.setItem('miyar-enterprise-local-v1',JSON.stringify([{id:'LOCAL-e025cba9-a571-45e0-9ca3-274e6edffeaa',revision:1,state:'draft',content:{title:'Software engineer',jobFamily:'Software development'},updatedAt:'2026-10-05T00:00:00Z'}]));
  const rows=await a.w.MiyarEnterprise.positionRegistry();
  assert.ok(rows.some(p=>p.id==='LOCAL-e025cba9-a571-45e0-9ca3-274e6edffeaa'),'registry reads the local draft');
  a.w.location.hash='#enterprise/grading';a.w.dispatchEvent(new a.w.Event('hashchange'));for(let i=0;i<40&&!a.d.querySelector('#ent-grade-position option[value^="LOCAL-"]');i++)await settle();
  const grading=[...a.d.querySelectorAll('#ent-grade-position option')].map(o=>o.textContent);
  assert.ok(grading.includes('Software engineer · v1 · e025cba9'),grading.join('|'));
  a.w.location.hash='#enterprise/compensation';a.w.dispatchEvent(new a.w.Event('hashchange'));for(let i=0;i<40&&!a.d.querySelector('#cp-position option[value^="LOCAL-"]');i++)await settle();
  const compensation=[...a.d.querySelectorAll('#cp-position option')].map(o=>o.textContent);
  assert.ok(compensation.includes('Software engineer · v1 · e025cba9'),compensation.join('|'));
  a.w.location.hash='#enterprise/manpower';a.w.dispatchEvent(new a.w.Event('hashchange'));for(let i=0;i<40&&!a.d.querySelector('#mp-position option[value^="LOCAL-"]');i++)await settle();
  const manpower=[...a.d.querySelectorAll('#mp-position option')].map(o=>o.textContent);
  assert.equal(manpower.filter(x=>x.startsWith('Software engineer')).length,1,manpower.join('|'));
  assert.ok(manpower.includes('Software engineer · v1 · e025cba9'),manpower.join('|'));
 }finally{a.dom.window.close();}
});

test('manpower keeps one entry when a saved plan names the position before the registry answers',async()=>{
 const a=await app('#enterprise/manpower');try{
  for(let i=0;i<40&&!a.d.querySelector('#mp-position');i++)await settle();
  const select=a.d.querySelector('#mp-position');
  const option=a.d.createElement('option');option.value='LOCAL-abcdef12-0000-0000-0000-000000000000';option.textContent='Analyst · v1';select.append(option);
  a.w.localStorage.setItem('miyar-enterprise-local-v1',JSON.stringify([{id:'LOCAL-abcdef12-0000-0000-0000-000000000000',revision:1,state:'draft',content:{title:'Analyst'},updatedAt:'2026-10-05T00:00:00Z'}]));
  a.w.location.hash='#home';a.w.dispatchEvent(new a.w.Event('hashchange'));await settle();await settle();
  a.w.location.hash='#enterprise/manpower';a.w.dispatchEvent(new a.w.Event('hashchange'));for(let i=0;i<40&&!a.d.querySelector('#mp-position option[value^="LOCAL-"]');i++)await settle();await settle();
  const labels=[...a.d.querySelectorAll('#mp-position option')].map(o=>o.textContent);
  assert.equal(labels.filter(x=>x.startsWith('Analyst')).length,1,labels.join('|'));
 }finally{a.dom.window.close();}
});

test('the guided tour step for position design names the visible buttons, not the collapsed package',()=>{
 const source=read('whats-new-6.js');
 assert.doesNotMatch(source,/Press “Load HC example”/);
 assert.match(source,/Load example/);assert.match(source,/Apply suggestions to available fields/);assert.match(source,/Save local draft/);
 assert.match(source,/«مثال توضيحي»/);assert.match(source,/«حفظ المسودة محليًا»/);
 const page=read('index.html');
 for(const label of ['Load example','Apply suggestions to available fields','Save local draft'])assert.ok(read('enterprise.js').includes(label)||page.includes(label),label+' exists on the position screen');
});

test('home step numbers meet AA contrast on their tinted chips',()=>{
 const css=read('expert-landing.css');
 const lum=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b;};
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);
 const phase=css.match(/\.expert-landing \.release-phase-number\{color:(#[0-9a-f]{6});background:(#[0-9a-f]{6})/);assert.ok(phase);assert.ok(ratio(phase[1],phase[2])>=4.5,phase[0]);
 const start=css.match(/\.expert-landing \.lp-start-label>span\{[^}]*color:(#[0-9a-f]{6});background:(#[0-9a-f]{6})/);assert.ok(start);assert.ok(ratio(start[1],start[2])>=4.5,start[0]);
});
