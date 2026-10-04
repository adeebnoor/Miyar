const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dist=path.join(__dirname,'../dist');
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(check,message){for(let i=0;i<60&&!check();i++)await tick();assert.ok(check(),message);}

test('manpower and compensation sidebar links survive Arabic-English-Arabic shell replacements and open their actual tools',async()=>{
 const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(fs.readFileSync(path.join(dist,'index.html'),'utf8'),{url:'https://example.test/Miyar/#demo',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console}),w=dom.window,d=w.document;
 try{
  w.localStorage.setItem('miyar-language','ar');w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async url=>{const value=String(url);return value.startsWith('./')?{ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dist,value.split('?')[0]),'utf8'))}:{ok:false,status:401,json:async()=>({detail:'Synthetic anonymous test'})};};
  for(const script of d.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dist,script.getAttribute('src').split('?')[0]),'utf8'));
  const selector='.sidebar nav.nav-list';
  const links=()=>d.querySelectorAll(selector+' [data-manpower-nav]').length===1&&d.querySelectorAll(selector+' [data-comp-nav]').length===1;
  await until(links,'Both tool links are initially available inside the sidebar');
  for(const [language,manpower,compensation] of [['en','Manpower planning','Compensation'],['ar','تخطيط القوى العاملة','التعويضات']]){
   const oldSidebar=d.querySelector('.sidebar');d.getElementById('language-btn').click();
   await until(()=>d.documentElement.lang===language&&links(),'Language replacement restores both sidebar tool links: '+language);
   assert.ok(!oldSidebar.isConnected,'The test exercised a replaced shell rather than reused links');
   assert.equal(w.location.hash,'#demo');
   const mp=d.querySelector(selector+' [data-manpower-nav]'),cp=d.querySelector(selector+' [data-comp-nav]');
   assert.equal(mp.querySelector('span').textContent,manpower);assert.equal(cp.querySelector('span').textContent,compensation);
   assert.equal(mp.getAttribute('href'),'#enterprise/manpower');assert.equal(cp.getAttribute('href'),'#enterprise/compensation');
  }
  d.querySelector(selector+' [data-manpower-nav]').click();
  await until(()=>w.location.hash==='#enterprise/manpower'&&d.querySelector('#ent-content .mp-page [data-mp-run]'),'The restored manpower link opens the actual calculator');
  assert.equal(d.getElementById('enterprise-heading').textContent,'تخطيط القوى العاملة');
  d.querySelector(selector+' [data-comp-nav]').click();
  await until(()=>w.location.hash==='#enterprise/compensation'&&d.querySelector('#ent-content .cp-page [data-cp-run]'),'The restored compensation link opens the actual calculator');
  assert.equal(d.getElementById('enterprise-heading').textContent,'التعويضات');
  assert.ok(links(),'Navigation must not duplicate or lose either restored tool link');assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});
