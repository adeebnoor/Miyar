const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const settle=()=>new Promise(r=>setTimeout(r,25));
const releaseVersion=fs.readFileSync(path.join(__dirname,'../VERSION'),'utf8').trim();
const releaseMinor=releaseVersion.split('.').slice(0,2).join('.');

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
 assert.equal(release.version,releaseVersion);assert.ok(html.includes('<title>معيار | Miyar '+releaseVersion));
 assert.match(html,/property="og:image" content="https:\/\/adeebnoor\.github\.io\/Miyar\/assets\/og-card\.jpg"/);assert.match(html,/name="twitter:card" content="summary_large_image"/);
 const card=fs.readFileSync(path.join(dir,'assets/og-card.jpg'));assert.equal(card[0],0xff);assert.equal(card[1],0xd8);assert.ok(card.length<150000);
 const headers=fs.readFileSync(path.join(dir,'_headers'),'utf8'),meta=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 assert.ok(headers.includes('Content-Security-Policy: '+meta+"; frame-ancestors 'none'"));
 for(const h of ['Strict-Transport-Security: max-age=31536000; includeSubDomains','X-Frame-Options: DENY','X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin','Permissions-Policy:'])assert.ok(headers.includes(h),h);
 const trust=fs.readFileSync(path.join(dir,'trust.js'),'utf8');assert.match(trust,/daysRemaining/);assert.match(trust,/TOTP/);assert.doesNotMatch(trust,/SSO and MFA are not implemented/);
});

test('returning users see what is new, New badges, a version badge and can dismiss the panel',async()=>{
 const a=await app('#home');try{
  for(let i=0;i<20&&!a.d.querySelector('.whats-new');i++)await settle();
  const panel=a.d.querySelector('.whats-new');assert.ok(panel);assert.ok(panel.textContent.includes('What’s new in Miyar '+releaseMinor));assert.equal(panel.querySelectorAll('li').length,5);
  assert.equal(a.d.querySelector('.lp-header-inner .version-badge').textContent,'v'+releaseMinor);
  panel.querySelector('[data-whats-new-dismiss]').click();await settle();assert.equal(a.d.querySelector('.whats-new'),null);assert.equal(a.w.localStorage.getItem('miyar-whats-new-'+releaseMinor),'1');
  a.w.location.hash='#enterprise/overview';for(let i=0;i<20&&!a.d.querySelector('.sidebar [data-manpower-nav] .new-badge');i++)await settle();
  assert.ok(a.d.querySelector('.sidebar [data-manpower-nav] .new-badge'));assert.equal(a.d.querySelector('.whats-new'),null);
  a.w.location.hash='#enterprise/manpower';for(let i=0;i<20&&a.d.querySelector('.sidebar [data-manpower-nav] .new-badge');i++)await settle();
  assert.equal(a.d.querySelector('.sidebar [data-manpower-nav] .new-badge'),null);assert.ok(a.d.querySelector('.sidebar [data-comp-nav] .new-badge'));
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('the guided tour loads demo data and walks five screens with back, next and finish',async()=>{
 const a=await app('#home');try{
  for(let i=0;i<20&&!a.d.querySelector('[data-tour-start]');i++)await settle();
  a.d.querySelector('.whats-new-actions [data-tour-start]').click();await settle();await settle();
  assert.ok(a.w.MiyarDemoWorkspace.loaded());assert.equal(a.w.location.hash,'#demo');
  for(let i=0;i<20&&!a.d.querySelector('.tour-bar');i++)await settle();
  assert.match(a.d.querySelector('.tour-bar').textContent,/Step 1 \/ 5/);
  for(const [step,route] of [[2,'#enterprise/create'],[3,'#enterprise/grading'],[4,'#enterprise/manpower'],[5,'#enterprise/compensation']]){a.d.querySelector('[data-tour-next]').click();await settle();await settle();assert.equal(a.w.location.hash,route);for(let i=0;i<20&&!new RegExp('Step '+step).test(a.d.querySelector('.tour-bar')?.textContent||'');i++)await settle();assert.match(a.d.querySelector('.tour-bar').textContent,new RegExp('Step '+step+' / 5'));}
  a.d.querySelector('[data-tour-prev]').click();await settle();assert.equal(a.w.location.hash,'#enterprise/manpower');
  a.d.querySelector('.tour-bar [data-tour-end]').click();await settle();assert.equal(a.d.querySelector('.tour-bar'),null);assert.equal(a.w.sessionStorage.getItem('miyar-tour-6'),null);
 }finally{a.dom.window.close();}
});

test('manpower and compensation results open with a plain decision summary',async()=>{
 const a=await app('#enterprise/manpower');try{
  const mp=a.d.querySelector('.mp-page');mp.querySelector('[data-mp-example]').click();mp.querySelector('[data-mp-run]').click();await settle();
  assert.match(mp.querySelector('.mp-results .decision-summary').textContent,/What this means for your decision.*Plan for 1 position\(s\).*backfills expected leavers.*growth that needs budget approval/);
  a.w.location.hash='#enterprise/compensation';for(let i=0;i<30&&!a.d.querySelector('.cp-page');i++)await settle();
  const cp=a.d.querySelector('.cp-page');cp.querySelector('[data-cp-example]').click();cp.querySelector('[data-cp-run]').click();await settle();
  assert.match(cp.querySelector('.cp-result .decision-summary').textContent,/New-position budget estimate.*Annual employer cost: 414,000 SAR/);
 }finally{a.dom.window.close();}
});
