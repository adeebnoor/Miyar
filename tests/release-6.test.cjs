const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setTimeout(r,25));

async function app(route,locale='en'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://example.test/Miyar/'+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.localStorage.setItem('miyar-language',locale);w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 w.fetch=async url=>{const value=String(url);if(value.startsWith('./'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,value.split('?')[0]),'utf8'))};return {ok:false,status:404,json:async()=>({})};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const s of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(dir,s.getAttribute('src').split('?')[0]),'utf8'));
 await settle();await settle();return {w,dom,errors,d:w.document};
}

test('demonstration workspace loads labelled synthetic data into this browser and removes it again',async()=>{
 const a=await app('#enterprise/tour');try{
  for(let i=0;i<20&&!a.d.querySelector('[data-demo-workspace]');i++)await settle();
  const panel=a.d.querySelector('[data-demo-workspace]');assert.ok(panel);assert.match(panel.textContent,/synthetic/i);
  panel.querySelector('[data-demo-load]').click();
  assert.equal(a.w.MiyarInstitutionProfile.read().gradeStructure.grades.length,5);
  const bands=JSON.parse(a.w.localStorage.getItem('miyar-salary-bands-v1:local'));assert.equal(bands.length,5);assert.ok(bands.every(b=>/Synthetic/.test(b.source)));
  assert.equal(a.w.MiyarSalaryBands.select('G11 · Manager',bands).mid,30000);
  const plans=JSON.parse(a.w.localStorage.getItem('miyar-manpower-plans-v1'));assert.equal(plans[0].id,'MP-DEMO-6');assert.ok(plans[0].localization);
  assert.equal(JSON.parse(a.w.localStorage.getItem('miyar-compensation-scenarios-v1'))[0].id,'CP-DEMO-6');
  assert.match(panel.querySelector('[data-demo-status]').textContent,/is loaded/);
  a.w.localStorage.setItem('miyar-manpower-plans-v1',JSON.stringify([{id:'MP-OWN'},...plans]));
  panel.querySelector('[data-demo-reset]').click();
  assert.deepEqual(JSON.parse(a.w.localStorage.getItem('miyar-manpower-plans-v1')).map(x=>x.id),['MP-OWN']);
  assert.equal(a.w.localStorage.getItem('miyar-salary-bands-v1:local'),null);assert.equal(a.w.MiyarInstitutionProfile.read().gradeStructure.grades.length,0);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('share card, CDN security headers and release 6 identity are published with the build',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),release=JSON.parse(fs.readFileSync(path.join(dir,'release.json'),'utf8'));
 assert.equal(release.version,'6.0.0');assert.match(html,/<title>معيار \| Miyar 6\.0\.0/);
 assert.match(html,/property="og:image" content="https:\/\/adeebnoor\.github\.io\/Miyar\/assets\/og-card\.jpg"/);assert.match(html,/name="twitter:card" content="summary_large_image"/);
 const card=fs.readFileSync(path.join(dir,'assets/og-card.jpg'));assert.equal(card[0],0xff);assert.equal(card[1],0xd8);assert.ok(card.length<150000);
 const headers=fs.readFileSync(path.join(dir,'_headers'),'utf8'),meta=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 assert.ok(headers.includes('Content-Security-Policy: '+meta+"; frame-ancestors 'none'"));
 for(const h of ['Strict-Transport-Security: max-age=31536000; includeSubDomains','X-Frame-Options: DENY','X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin','Permissions-Policy:'])assert.ok(headers.includes(h),h);
 const trust=fs.readFileSync(path.join(dir,'trust.js'),'utf8');assert.match(trust,/daysRemaining/);assert.match(trust,/TOTP/);assert.doesNotMatch(trust,/SSO and MFA are not implemented/);
});
