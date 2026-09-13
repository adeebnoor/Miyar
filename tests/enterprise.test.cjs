const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../dist/enterprise-core.js'),{JSDOM,VirtualConsole}=require('jsdom'),dir=path.join(__dirname,'../dist');
const ref=JSON.parse(fs.readFileSync(path.join(dir,'classifications/ssco-2019.json'))),edu=JSON.parse(fs.readFileSync(path.join(dir,'classifications/education-2020.json'))),skills=JSON.parse(fs.readFileSync(path.join(dir,'classifications/skills.json')));
test('complete supplied occupation tree preserves source conflicts and education leading zeros',()=>{assert.equal(ref.nodes.length,5656);assert.equal(ref.nodes.filter(x=>x.level==='occupation').length,5041);assert.equal(new Set(ref.nodes.map(x=>x.code)).size,5656);assert.equal(C.search(ref.nodes,'٢١٤١٠١')[0].titleAr,'مهندس تخطيط مصانع');assert.equal(C.search(ref.nodes,'۲۱۴۱۱۶')[0].titleAr,'مهندس صناعي عام');assert.equal(ref.validation.missingParents.length,4);assert.equal(edu.fields.length,599);assert.ok(edu.fields.find(x=>x.code==='071903'));});
test('bulk parser preserves quoted newlines, zero scope and duplicate roles',()=>{const rows=C.csv('title,department,occupationCode,directReports,budgetAmount,authority\r\n"مدير, نظام",IT,999999,0,0,يوصي\r\nمهندس برمجيات,IT,251204,0,0,يوصي\r\nمهندس برمجيات,IT,251204,0,0,يوصي\r\n');const r=C.diagnose(rows,ref.nodes,ref.validation.missingParents);assert.equal(r.titleCodeAlignmentPercent,66.7);assert.equal(r.duplicateGroups.length,1);assert.equal(r.scopeAssessableRows,3);assert.equal(r.titleScopeReviewRows,1);assert.throws(()=>C.csv('title,title\na,b'));assert.throws(()=>C.csv('title\n"unclosed'));});
test('skill decomposition catches Arabic conjunctions without pretending model inference',()=>{const r=C.skills('البرمجة وتحليل النظم والتفكير النقدي وSQL',skills);assert.ok(r.some(x=>x.id==='onet:2.B.3.e'));assert.ok(r.some(x=>x.id==='onet:2.B.4.g'));assert.ok(r.some(x=>x.id==='onet:2.A.2.a'));assert.ok(r.some(x=>x.id==='miyar:sql'));});
async function ui(locale='ar',options={}){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM('<main id="enterprise"></main>',{url:'https://example.test/Miyar/'+(options.review?'?review=od':''),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;w.structuredClone=structuredClone;w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.eval(fs.readFileSync(path.join(dir,'enterprise-document.js'),'utf8'));w.AbortSignal=AbortSignal;w.MIYAR_CONFIG={apiBase:options.apiBase||''};w.fetch=options.fetch|| (async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,String(url))))}));w.eval(fs.readFileSync(path.join(dir,'enterprise-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(dir,'enterprise-product.js'),'utf8'));w.eval(fs.readFileSync(path.join(dir,'enterprise.js'),'utf8'));await w.MiyarEnterprise.mount(w.document.getElementById('enterprise'),{lang:locale});const $=id=>w.document.getElementById('ent-'+id),tab=id=>w.document.querySelector('[data-ent-tab="'+id+'"]').click();return {w,$,tab,errors,dom};}
test('all enterprise sections render in Arabic and English without duplicate IDs',async()=>{for(const lang of ['ar','en']){const a=await ui(lang);try{for(const tab of ['overview','review','tour','business','reference','create','workspace','intelligence','bulk','grading','readiness','evidence','market','connection']){a.tab(tab);const ids=[...a.w.document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,tab);assert.ok(a.$('content').textContent.trim());}assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}}});
test('reference search flows into a local draft and restores history without granting approval',async()=>{const a=await ui();try{a.tab('reference');a.$('query').value='٢٥١٢٠٤';a.$('search').click();a.w.document.querySelector('[data-code="251204"]').click();a.$('use-reference').click();assert.equal(a.w.document.querySelector('[data-field="occupationCode"]').value,'251204');a.$('sample').click();a.$('save').click();await new Promise(r=>setImmediate(r));let rows=JSON.parse(a.w.localStorage.getItem(C.KEY));assert.equal(rows.length,1);assert.equal(rows[0].state,'draft');a.tab('workspace');await new Promise(r=>setImmediate(r));a.w.document.querySelector('[data-position]').click();await new Promise(r=>setImmediate(r));assert.equal(a.$('approve'),null);assert.equal(a.$('submit-position'),null);a.$('edit-position').click();let x=a.w.document.querySelector('[data-field="title"]');x.value='<img src=x onerror=alert(1)> Updated';x.dispatchEvent(new a.w.Event('input'));a.$('save').click();await new Promise(r=>setImmediate(r));rows=JSON.parse(a.w.localStorage.getItem(C.KEY));assert.equal(rows[0].revision,2);assert.equal(rows[0].versions.length,2);a.tab('workspace');await new Promise(r=>setImmediate(r));assert.equal(a.w.document.querySelector('img'),null);assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}});
test('pilot comparison uses paired denominators and distinguishes missing timing',async()=>{const a=await ui('en');try{const r=a.w.MiyarEnterprise.pilotMetrics([{caseId:'1',expectedCode:'251204',miyarCode:'251204',baselineCode:'251104',humanMinutes:'10',miyarMinutes:'4'},{caseId:'2',expectedCode:'251104',miyarCode:'251204',baselineCode:'251104',humanMinutes:'',miyarMinutes:''}]);assert.equal(r.miyarAccuracy,50);assert.equal(r.baselineAccuracy,50);assert.equal(r.timedCases,1);assert.equal(r.timeSavedPercent,60);assert.throws(()=>a.w.MiyarEnterprise.pilotMetrics([{caseId:'1',expectedCode:'a',miyarCode:'a',baselineCode:'a',humanMinutes:'0',miyarMinutes:'1'}]));}finally{a.dom.window.close();}});

test('enterprise free text and complete review package survive save, export and safe draft import',async()=>{
 const a=await ui('en');try{
  a.tab('create');a.$('sample').click();for(const [key,value] of [['field','Health informatics / Digital twins'],['seniority','Principal - 12+ years']]){const x=a.w.document.querySelector('[data-field="'+key+'"]');assert.equal(x.tagName,'INPUT');x.value=value;x.dispatchEvent(new a.w.Event('input'));}
  a.$('save').click();await new Promise(r=>setImmediate(r));const row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];assert.equal(row.content.field,'Health informatics / Digital twins');assert.equal(row.content.seniority,'Principal - 12+ years');
  a.$('preview-draft').click();const dialog=a.w.document.querySelector('dialog');assert.ok(dialog.open);assert.match(dialog.textContent,/Principal - 12\+ years/);assert.match(dialog.textContent,/Release testing/);a.$('close-report').click();
  const imported=C.importDraft({...row,state:'active',approvals:[{role:'chro'}]});assert.equal(imported.seniority,row.content.seniority);assert.equal(imported.state,undefined);assert.equal(imported.approvals,undefined);
  const doc=require('../dist/enterprise-document.js').html({...imported,title:'<script>alert(1)</script>'},'en');assert.doesNotMatch(doc,/<script>/);assert.match(doc,/&lt;script&gt;/);assert.match(doc,/Draft|draft/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
test('unsaved enterprise content cannot be overwritten when the user cancels',async()=>{
 const a=await ui();try{a.tab('create');a.$('sample').click();a.w.confirm=()=>false;a.$('blank').click();assert.equal(a.w.document.querySelector('[data-field="title"]').value,'مهندس برمجيات');a.w.confirm=()=>true;a.$('blank').click();assert.equal(a.w.document.querySelector('[data-field="title"]').value,'');assert.deepEqual(a.errors,[]);}finally{a.dom.window.close();}
});
test('bulk headers and imported matrices reject data loss and invalid content',()=>{
 assert.throws(()=>C.csv('title,المسمى\na,b'));assert.throws(()=>C.csv('title\na,b'));
 for(const content of [{title:'Test',raci:[1]},{title:'Test',headcount:1.5},{title:'Test',directReports:0.5},{title:'Test',provisional:true,occupationCode:'251204'}])assert.throws(()=>C.importDraft({content}));
});

test('complete deployed script bundle opens the enterprise workspace and all local assets exist',async()=>{
 const markup=fs.readFileSync(path.join(dir,'index.html'),'utf8'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(markup,{url:'https://example.test/Miyar/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 try{
  w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.scrollTo=()=>{};w.confirm=()=>false;w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,String(url))))});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  for(const x of w.document.querySelectorAll('link[href],script[src]')){const target=x.getAttribute('src')||x.getAttribute('href');assert.ok(fs.existsSync(path.join(dir,target)),target);if(x.tagName==='SCRIPT')w.eval(fs.readFileSync(path.join(dir,target),'utf8'));}
  await new Promise(r=>setImmediate(r));assert.equal(w.document.getElementById('view-enterprise').hidden,false);assert.ok(w.document.getElementById('enterprise-heading'));
  w.document.querySelector('[data-ent-tab="readiness"]').click();assert.match(w.document.getElementById('ent-content').textContent,/متاحة محليًا/);
  w.document.getElementById('language-btn').click();await new Promise(r=>setImmediate(r));assert.match(w.document.getElementById('ent-content').textContent,/Available locally/);
  w.document.getElementById('present-btn').click();assert.ok(w.document.getElementById('presentation').open);for(let i=0;i<6;i++)w.document.getElementById('next-slide').click();assert.match(w.document.getElementById('presentation-content').textContent,/partner/i);
  assert.ok(fs.statSync(path.join(dir,'assets/arabic.ttf')).size>200000);assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
});

test('hosted login uses its configured address and password change keeps only the replacement token',async()=>{
 const requests=[],base='https://miyar.example.test';
 const response=(value,status=200)=>({ok:status<400,status,json:async()=>value});
 const fetch=async(url,options={})=>{
  if(!String(url).startsWith(base))return response(JSON.parse(fs.readFileSync(path.join(dir,String(url)))));
  const route=String(url).slice(base.length);requests.push({route,...options});
  if(route.endsWith('/auth/login'))return response({accessToken:'initial-test-token'});
  if(route.endsWith('/me'))return response({name:'Test manager',role:'line_manager',organization:{name:'Test organization'}});
  if(route.endsWith('/departments'))return response([{id:'test-dept',name:'Test department'}]);
  if(route.endsWith('/settings'))return response({});
  if(route.endsWith('/organization/taxonomy/export'))return response(ref);
  if(route.endsWith('/integrations/status'))return response({connectors:[],outboundWebhookConfigured:false});
  if(route.endsWith('/auth/password'))return response({accessToken:'replacement-test-token'});
  if(route.endsWith('/auth/logout-all'))return response({revoked:true});
  throw Error('Unexpected request '+route);
 };
 const a=await ui('en',{apiBase:base,fetch});const settle=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
 try{
  a.tab('connection');assert.equal(a.$('api-url').value,base);assert.equal(a.$('api-url').closest('details').open,false);
  a.$('email').value='manager@example.test';a.$('password').value='test-only-password';a.$('login').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  assert.ok(a.$('logout'));assert.ok(a.$('password-form'));
  a.$('current-password').value='test-only-password';a.$('new-password').value='new-test-only-password';a.$('confirm-password').value='different-password';
  a.$('password-form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();assert.equal(requests.filter(r=>r.route.endsWith('/auth/password')).length,0);
  a.$('confirm-password').value='new-test-only-password';a.$('password-form').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  assert.equal(a.$('current-password').value,'');assert.match(a.$('message').textContent,/Other sessions were revoked/);
  a.$('logout').click();await settle();const logout=requests.find(r=>r.route.endsWith('/auth/logout-all'));assert.equal(logout.headers.Authorization,'Bearer replacement-test-token');assert.ok(a.$('login'));assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('guided tour creates no approval or saved data and hands an editable example to the real form',async()=>{
 for(const locale of ['ar','en']){
  const a=await ui(locale);try{
   a.tab('tour');
   for(let i=0;i<3;i++)a.w.document.getElementById('mx-next').click();
   assert.equal(a.w.document.querySelector('[data-mx-step="3"]').getAttribute('aria-current'),'step');
   assert.equal(a.w.localStorage.getItem(C.KEY),null);assert.equal(a.$('approve'),null);
   a.w.document.getElementById('mx-next').click();
   assert.equal(a.w.document.querySelector('[data-field="occupationCode"]').value,'251204');
   assert.equal(a.$('save').textContent,locale==='ar'?'حفظ المسودة محليًا':'Save local draft');
   assert.equal(a.w.localStorage.getItem(C.KEY),null);
   a.w.confirm=()=>false;a.tab('tour');a.w.document.getElementById('mx-example').click();
   assert.ok(a.w.document.getElementById('mx-example'));assert.deepEqual(a.errors,[]);
  }finally{a.dom.window.close();}
 }
});

test('editable matrices preserve free text through language changes, preview and local save',async()=>{
 const a=await ui('en');try{
  a.tab('create');a.$('sample').click();
  const cell=a.w.document.querySelector('[data-matrix-key="raci"][data-matrix-field="R"]');
  cell.value='Developer | vendor <script> & فريق';cell.dispatchEvent(new a.w.Event('input'));
  a.w.document.querySelector('[data-matrix-add="skillRequirements"]').click();
  const skill=a.w.document.querySelector('[data-matrix-key="skillRequirements"][data-matrix-row="1"][data-matrix-field="name"]');
  skill.value='Digital twins';skill.dispatchEvent(new a.w.Event('input'));
  await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'ar'});
  assert.equal(a.w.document.querySelector('[data-matrix-key="raci"][data-matrix-field="R"]').value,'Developer | vendor <script> & فريق');
  a.$('preview-draft').click();await new Promise(r=>setImmediate(r));
  assert.match(a.w.document.querySelector('dialog').textContent,/Developer \| vendor <script> & فريق/);
  assert.equal(a.w.document.querySelector('dialog script'),null);a.$('close-report').click();
  a.$('save').click();await new Promise(r=>setImmediate(r));
  const row=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];
  assert.equal(row.content.raci[0].R,'Developer | vendor <script> & فريق');
  assert.equal(row.content.skillRequirements[1].name,'Digital twins');assert.equal(row.state,'draft');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('local register pages and filters the full saved collection',async()=>{
 const a=await ui('en'),settle=()=>new Promise(r=>setImmediate(r));
 try{
  const rows=Array.from({length:45},(_,i)=>({id:'LOCAL-'+i,title:'Position '+String(i).padStart(2,'0'),state:'draft',revision:1,content:{title:'Position '+i}}));
  a.w.localStorage.setItem(C.KEY,JSON.stringify(rows));a.tab('workspace');await settle();
  assert.equal(a.w.document.querySelectorAll('[data-position]').length,20);
  a.$('positions-next').click();await settle();assert.equal(a.w.document.querySelector('[data-position]').dataset.position,'LOCAL-20');
  a.$('positions-next').click();await settle();assert.equal(a.w.document.querySelectorAll('[data-position]').length,5);assert.ok(a.$('positions-next').disabled);
  a.$('register-query').value='Position 44';a.$('register-search').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  assert.equal(a.w.document.querySelectorAll('[data-position]').length,1);assert.ok(a.$('positions-prev').disabled);
  await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'ar'});await settle();
  assert.equal(a.w.document.querySelectorAll('[data-position]').length,1,'Changing language reloads the selected register page');
  await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'en'});await settle();
  a.$('register-state').value='active';a.$('register-search').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  assert.equal(a.w.document.querySelectorAll('[data-position]').length,0);assert.match(a.$('position-list').textContent,/No matching/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('department selection survives navigation and language changes and server search uses offsets',async()=>{
 const base='https://miyar.example.test',requests=[],response=value=>({ok:true,status:200,json:async()=>value});
 const fetch=async(url,options={})=>{
  if(!String(url).startsWith(base))return response(JSON.parse(fs.readFileSync(path.join(dir,String(url)))));
  const u=new URL(url),route=u.pathname;requests.push({route,query:u.search,...options});
  if(route.endsWith('/auth/login'))return response({accessToken:'test-token'});
  if(route.endsWith('/me'))return response({id:'test-od',name:'Test OD',role:'od_specialist',organization:{name:'Test org'}});
  if(route.endsWith('/departments'))return response([{id:'one',name:'Department one'},{id:'two',name:'Department two'}]);
  if(route.endsWith('/settings'))return response({});
  if(route.endsWith('/organization/taxonomy/export'))return response(ref);
  if(route.endsWith('/integrations/status'))return response({connectors:[],outboundWebhookConfigured:false});
  if(route.endsWith('/analytics'))return response({positions:105,activeHeadcount:0,annualPositionCost:0,states:{in_review:0}});
  if(route.endsWith('/positions')&&options.method==='POST')return response({id:'created',internalCode:'MJR-TEST',revision:1,departmentId:JSON.parse(options.body).departmentId});
  if(route.endsWith('/positions'))return response({total:105,items:[{id:'page-'+u.searchParams.get('offset'),title:'Example',state:'draft',revision:1}]});
  throw Error('Unexpected route '+route);
 };
 const a=await ui('en',{apiBase:base,fetch}),settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
 try{
  a.tab('connection');a.$('email').value='test@example.test';a.$('password').value='test-only-password';a.$('login').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  a.tab('create');a.$('sample').click();a.$('department').value='two';a.$('department').dispatchEvent(new a.w.Event('change'));
  a.tab('overview');a.tab('create');await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'ar'});
  assert.equal(a.$('department').value,'two');
  a.$('save').click();await settle();const sent=JSON.parse(requests.find(r=>r.route.endsWith('/positions')&&r.method==='POST').body);
  assert.equal(sent.departmentId,'two');assert.equal(sent.content.department,'Department two');
  a.tab('workspace');await settle();a.$('positions-next').click();await settle();
  assert.ok(requests.some(r=>r.query.includes('offset=20')));
  a.$('register-query').value='مهندس برمجيات';a.$('register-search').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  const last=requests.filter(r=>r.route.endsWith('/positions')).at(-1);assert.equal(new URLSearchParams(last.query).get('offset'),'0');assert.equal(new URLSearchParams(last.query).get('q'),'مهندس برمجيات');assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('public readiness distinguishes configured services from sign-in and clears a failed status check',async()=>{
 const base='https://miyar.example.test';let healthy=true;
 const fetch=async url=>{
  if(!String(url).startsWith(base))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(dir,String(url))))};
  return {ok:healthy,status:healthy?200:503,json:async()=>({status:'ok',version:'4.2.0',services:{approvals:true,exports:[{format:'PDF',available:true}],signingConfigured:true,semanticEnabled:false}})};
 };
 const a=await ui('en',{apiBase:base,fetch}),settle=async()=>{for(let i=0;i<3;i++)await new Promise(r=>setImmediate(r));};
 try{
  a.tab('readiness');assert.match(a.$('content').textContent,/Not checked in this session/);
  a.$('check-service').click();await settle();
  assert.match(a.$('content').textContent,/Server configured · sign in to use/);assert.match(a.$('content').textContent,/Not enabled on the server/);
  const exportRow=[...a.$('content').querySelectorAll('tr')].find(row=>row.textContent.includes('Organization exports'));
  assert.match(exportRow.textContent,/Not enabled on the server/,'One available format must not mark the entire export suite ready');
  healthy=false;a.$('check-service').click();await settle();
  assert.match(a.$('health-status').textContent,/did not succeed/);assert.doesNotMatch(a.$('content').textContent,/Server configured · sign in to use/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('legacy title decisions preserve input provenance and restore uniquely matching education zeros without inventing job analysis',()=>{
 const payload={schema:'miyar-demo-decision/2.1',id:'synthetic-reference-214401',locale:'en',outcome:'match',basis:'title',input:{objective:'Mechanical Engineer',domain:'all',seniority:'professional',constraints:''},role:{title:'مهندس ميكانيكي',titleEn:'Mechanical Engineer',saudiCode:'214401',educationCode:'71501'},reviewStatus:'approved',approvals:[{role:'chro'}]};
 const result=C.importDecision(payload,ref,edu);
 assert.equal(result.content.occupationCode,'214401');assert.equal(result.content.educationFieldCode,'071501');assert.equal(result.content.field,'');assert.equal(result.content.seniority,'professional');assert.equal(result.content.responsibilities,undefined);assert.equal(result.content.approvals,undefined);assert.equal(result.content.state,undefined);
 assert.equal(JSON.parse(result.content.sourceDecisionInput).domain,'all');assert.match(result.content.importNotes,/71501.*071501/);
 const ambiguous=C.importDecision(payload,ref,{fields:[{code:'071501'},{code:'0071501'}]});assert.equal(ambiguous.content.educationFieldCode,undefined);
 assert.throws(()=>C.importDecision({...payload,input:'invalid'},ref,edu));assert.throws(()=>C.importDecision({...payload,outcome:'unmatched'},ref,edu));
});

test('regulatory draft validation rejects unsafe source schemes and invalid dates while retaining a future effective date',()=>{
 for(const extra of [{licenseSource:'javascript:alert(1)'},{saudizationSource:'https://name:password@example.test'},{licenseDate:'2026-02-30'},{saudizationDate:'2999-01-01'}])assert.throws(()=>C.importDraft({content:{title:'Test',...extra}}));
 const c=C.importDraft({content:{title:'Test',licenseSource:'https://example.test/policy',licenseDate:'2026-09-01',effectiveDate:'2027-01-01',directReports:0}});
 const html=require('../dist/enterprise-document.js').html(c,'en');assert.match(html,/2027-01-01/);assert.match(html,/https:\/\/example.test\/policy/);assert.match(html,/Direct reports/);
});

test('decision import control opens an unapproved draft and new requirements survive save, language switch and package preview',async()=>{
 const a=await ui('en');try{
  const input={schema:'miyar-demo-decision/2.1',id:'synthetic-decision',locale:'en',outcome:'match',basis:'title',input:{objective:'Mechanical Engineer',domain:'all',seniority:'Principal / 12+ years'},role:{titleEn:'Mechanical Engineer',saudiCode:'214401',educationCode:'71501'}};
  a.tab('workspace');Object.defineProperty(a.$('draft-import'),'files',{value:[{size:700,text:async()=>JSON.stringify(input)}]});a.$('import-draft').click();await new Promise(r=>setImmediate(r));
  assert.equal(a.w.document.querySelector('[data-field="educationFieldCode"]').value,'071501');assert.match(a.$('content').textContent,/Imported draft provenance/);
  for(const [key,value] of Object.entries({certifications:'Recorded test certificate',saudization:'Review under source policy',saudizationSource:'https://example.test/policy',saudizationDate:'2026-09-01',license:'Recorded test requirement',licenseSource:'https://example.test/license',licenseDate:'2026-09-01',effectiveDate:'2027-01-01'})){const x=a.w.document.querySelector('[data-field="'+key+'"]');assert.ok(x,key);x.value=value;x.dispatchEvent(new a.w.Event('input'));}
  a.$('save').click();await new Promise(r=>setImmediate(r));const saved=JSON.parse(a.w.localStorage.getItem(C.KEY))[0];assert.equal(saved.state,'draft');assert.equal(saved.content.educationFieldCode,'071501');assert.equal(saved.content.seniority,'Principal / 12+ years');assert.equal(saved.content.licenseDate,'2026-09-01');
  await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'ar'});assert.equal(a.w.document.querySelector('[data-field="certifications"]').value,'Recorded test certificate');a.$('preview-draft').click();assert.match(a.w.document.querySelector('dialog').textContent,/Recorded test certificate/);assert.match(a.w.document.querySelector('dialog').textContent,/071501/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('innovation-center deep link renders requirements and its actions enter real product sections',async()=>{
 const a=await ui('en',{review:true});try{
  assert.match(a.$('content').textContent,/INNOVATION CENTER REVIEW/);assert.match(a.$('content').textContent,/071501/);
  assert.ok(a.w.document.querySelector('a[href="https://adeebnoor.github.io/"]'));
  a.w.document.getElementById('mx-review-import').click();assert.ok(a.$('draft-import'));a.tab('review');a.w.document.getElementById('mx-review-create').click();assert.ok(a.w.document.querySelector('[data-field="certifications"]'));
  await a.w.MiyarEnterprise.mount(a.w.document.getElementById('enterprise'),{lang:'ar'});a.tab('review');assert.match(a.$('content').textContent,/مركز الابتكار/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});

test('authorized external report configuration renders a usable specialist form and submits supplied results without client grading',async()=>{
 const base='https://miyar.example.test',requests=[],response=value=>({ok:true,status:200,json:async()=>value});
 const f={id:'org-external',name:'Authorized test report',method:'external-korn-ferry-record',version:1};
 const p={id:'test-position',title:'Test position',content:{title:'Test position'},state:'in_review',revision:1,createdBy:'another-user',approvalStage:0,workflow:[{role:'total_rewards'}],internalCode:'MJR-TEST'};
 const fetch=async(url,options={})=>{
  if(!String(url).startsWith(base))return response(JSON.parse(fs.readFileSync(path.join(dir,String(url)))));
  const route=new URL(url).pathname;requests.push({route,...options});
  if(route.endsWith('/auth/login'))return response({accessToken:'test-token'});
  if(route.endsWith('/me'))return response({id:'reviewer',name:'Test reviewer',role:'total_rewards',organization:{name:'Test org'}});
  if(route.endsWith('/departments'))return response([]);
  if(route.endsWith('/settings'))return response({framework:f});
  if(route.endsWith('/organization/taxonomy/export'))return response(ref);
  if(route.endsWith('/integrations/status'))return response({connectors:[]});
  if(route.endsWith('/analytics'))return response({positions:1,activeHeadcount:0,annualPositionCost:0,states:{in_review:1}});
  if(route.endsWith('/positions'))return response({items:[p],total:1});
  if(route.endsWith('/versions')||route.endsWith('/approvals')||route.endsWith('/evaluations'))return response([]);
  if(route.endsWith('/evaluation'))return response({result:{points:412,band:{id:'Grade from test report'}}});
  if(route.endsWith('/test-position'))return response(p);
  throw Error('Unexpected '+route);
 };
 const a=await ui('en',{apiBase:base,fetch}),settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
 try{
  a.tab('connection');a.$('email').value='test@example.test';a.$('password').value='test-only-password';a.$('login').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();
  a.tab('grading');assert.ok(a.$('external-workspace'));a.$('external-workspace').click();await settle();a.w.document.querySelector('[data-position]').click();await settle();
  assert.ok(a.$('external-grade'));assert.equal(a.w.document.querySelector('[data-factor]'),null);
  a.$('external-score').value='412';a.$('external-band').value='Grade from test report';a.$('report-confirmed').checked=true;
  for(const field of a.w.document.querySelectorAll('[data-report]'))field.value=field.dataset.report==='evaluationDate'?'2026-09-01':'Evidence from synthetic report';
  a.$('external-grade').dispatchEvent(new a.w.Event('submit',{cancelable:true}));await settle();const sent=JSON.parse(requests.find(x=>x.route.endsWith('/evaluation')).body);assert.equal(sent.answers.score,412);assert.equal(sent.evidence.reportConfirmed,true);assert.match(a.$('grade-result').textContent,/Specialist result recorded/);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
