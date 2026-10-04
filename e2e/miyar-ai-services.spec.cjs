const {test,expect}=require('@playwright/test');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https');
const BASE='http://127.0.0.1:4173/',API='https://127.0.0.1:8194',LOCAL_API='https://127.0.0.1:8195';
let server,localServer,certificateDirectory,logs='';
function healthy(api){return new Promise(resolve=>{const request=https.get(api+'/health',{rejectUnauthorized:false},r=>{r.resume();resolve(r.statusCode===200);});request.setTimeout(1500,()=>request.destroy());request.on('error',()=>resolve(false));});}
test.beforeAll(async()=>{
 certificateDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'miyar-ai-tls-'));const key=path.join(certificateDirectory,'localhost.key'),certificate=path.join(certificateDirectory,'localhost.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',certificate,'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
 server=spawn(process.env.MIYAR_TEST_PYTHON||'python3',['-m','uvicorn','e2e.fixtures.ai_services:app','--host','127.0.0.1','--port','8194','--ssl-keyfile',key,'--ssl-certfile',certificate],{cwd:path.join(__dirname,'..'),env:{...process.env,MIYAR_ENV:'test',MIYAR_CORS_ORIGINS:BASE.replace(/\/$/,''),MIYAR_SIGNING_KEY:Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}});
 localServer=spawn(process.env.MIYAR_TEST_PYTHON||'python3',['-m','uvicorn','e2e.fixtures.ai_services:app','--host','127.0.0.1','--port','8195','--ssl-keyfile',key,'--ssl-certfile',certificate],{cwd:path.join(__dirname,'..'),env:{...process.env,MIYAR_ENV:'test',MIYAR_AI_TEST_LOCAL:'true',MIYAR_CORS_ORIGINS:BASE.replace(/\/$/,''),MIYAR_SIGNING_KEY:Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}});
 for(const process of [server,localServer]){process.stdout.on('data',x=>logs+=x);process.stderr.on('data',x=>logs+=x);}
 for(let i=0;i<100;i++){if((await Promise.all([healthy(API),healthy(LOCAL_API)])).every(Boolean))return;if([server,localServer].some(p=>p.exitCode!==null))throw Error(logs);await new Promise(r=>setTimeout(r,200));}throw Error(logs);
});
// Native HTTPS browser requests target a real disposable API, not intercepted responses.
// Only provider boundaries are deterministic; this suite makes no live-accuracy claim.
test.use({screenshot:'only-on-failure',ignoreHTTPSErrors:true});
test.afterAll(async()=>{for(const process of [server,localServer])if(process&&process.exitCode===null)await new Promise(resolve=>{process.once('exit',resolve);process.kill();});if(certificateDirectory)fs.rmSync(certificateDirectory,{recursive:true,force:true});});
async function setup(page,lang,route='intelligence',consent=true,api=API){
 const dialogs=[];
 await page.addInitScript(({language,api})=>{localStorage.setItem('miyar-language',language);window.MIYAR_CONFIG={apiBase:api};},{language:lang,api});
 // Permit localhost exclusively in the served test document. Production CSP is untouched.
 await page.route(BASE,async route=>{const response=await route.fetch();const original=await response.text();const body=original.replace("connect-src 'self' https://miyar-enterprise-api.onrender.com","connect-src 'self' https://miyar-enterprise-api.onrender.com "+api);expect(body).not.toBe(original);await route.fulfill({response,body,headers:{...response.headers(),'content-length':String(Buffer.byteLength(body))}});});
 page.on('dialog',dialog=>{dialogs.push(dialog.message());return consent?dialog.accept():dialog.dismiss();});
 await page.goto(BASE+'#enterprise/'+route);await expect(page.locator('html')).toHaveAttribute('lang',lang);
 return dialogs;
}
const isPost=(request,feature,api=API)=>request.method()==='POST'&&request.url()===api+'/api/v1/review/'+feature;
const responseFor=(page,feature,api=API)=>page.waitForResponse(r=>isPost(r.request(),feature,api));
async function enterRole(page,lang,measures){
 await page.locator('[data-field="title"]').fill(lang==='ar'?'منصب تجريبي':'Synthetic role');
 await page.locator('[data-field="successMeasures"]').fill(measures);
}
async function exportedDraft(page){const event=page.waitForEvent('download');await page.locator('#ent-local-json').click();const downloaded=await event;return JSON.parse(fs.readFileSync(await downloaded.path(),'utf8')).content;}

for(const lang of ['ar','en']){
 test('local semantic processing omits external consent and leaves unsupported occupation scope empty: '+lang,async({page})=>{
  const dialogs=await setup(page,lang,'intelligence',true,LOCAL_API);
  await page.locator('#ent-analysis-field').fill('Nebulous aurora atelier');await page.locator('#ent-analysis-seniority').fill('Individual contributor');await page.locator('#ent-analysis-text').fill('Explain a synthetic unfamiliar aurora weaving example');
  const done=responseFor(page,'semantic',LOCAL_API);await page.locator('#ent-semantic').click();const response=await done;expect(response.status()).toBe(200);const body=await response.json();
  expect(response.request().postDataJSON().consentExternalProcessing).toBe(false);expect(dialogs).toHaveLength(1);expect(dialogs[0]).toContain(lang==='ar'?'دون إرسالها إلى Google Gemini':'without being sent to Google Gemini');expect(body.provider).toBe('local-e5-small');expect(body.organizationAccess).toBe(false);
  expect(body.occupationScope).toMatchObject({status:'insufficient-evidence',families:[],matchedTerms:[],coverage:'authored-limited',candidateCount:0});expect(body.candidates).toEqual([]);expect(body.semanticSkills.length).toBeGreaterThan(0);
  await expect(page.locator('#ent-candidates [data-candidate-code]')).toHaveCount(0);await expect(page.locator('#ent-candidates')).toContainText(lang==='ar'?'المراجع المهنية المقترحة':'Proposed occupation references');await expect(page.locator('#ent-candidates')).toContainText(lang==='ar'?'المجال':/field/i);await expect(page.locator('#ent-candidates')).toContainText(lang==='ar'?/راجع|مراجعة/:/review/i);
  await expect(page.locator('#ent-skills')).toContainText(lang==='ar'?'مهارات مقترحة بالمعنى':'Skills suggested by meaning');await expect(page.locator('#ent-skills')).toContainText('O*NET');await expect(page.locator('#ent-message')).not.toHaveClass(/error/);
 });

 test('local adjacent occupation reference is labelled a review proposal and needs explicit selection: '+lang,async({page})=>{
  await setup(page,lang,'intelligence',true,LOCAL_API);await page.locator('#ent-analysis-field').fill(lang==='ar'?'تطوير المشاريع العقارية':'Project Development');await page.locator('#ent-analysis-seniority').fill(lang==='ar'?'أخصائي فردي':'Specialist individual contributor');await page.locator('#ent-analysis-text').fill(lang==='ar'?'مراجعة جدوى مشروع افتراضي وتوثيق مخرجات مراحل التطوير':'Review feasibility of a synthetic project and document development stage outcomes');
  const done=responseFor(page,'semantic',LOCAL_API);await page.locator('#ent-semantic').click();const response=await done;expect(response.status()).toBe(200);const body=await response.json();expect(response.request().postDataJSON().consentExternalProcessing).toBe(false);
  expect(body.occupationScope.status).toBe('scope-constrained-proposals');expect(body.occupationScope.coverage).toBe('authored-limited');expect(body.occupationScope.families).toContain('projectDevelopment');expect(body.occupationScope.candidateCount).toBe(body.candidates.length);
  const proposed=body.candidates.find(candidate=>candidate.code==='242114');expect(proposed).toMatchObject({mappingStatus:'adjacent-reference-for-review',titleAr:'محلل أعمال'});
  await expect(page.locator('#ent-candidates')).toContainText(lang==='ar'?'المراجع المهنية المقترحة':'Proposed occupation references');const choice=page.locator('#ent-candidates article').filter({has:page.locator('[data-candidate-code="242114"]')});await expect(choice).toContainText(lang==='ar'?'مرجع مجاور مقترح؛ ليس تطابقًا رسميًا':'Proposed adjacent reference; not an official exact match');
  await expect(page).toHaveURL(BASE+'#enterprise/intelligence');await expect(page.locator('[data-field="occupationCode"]')).toHaveCount(0);await expect(page.locator('#ent-candidates [data-candidate-code]')).toHaveCount(body.candidates.length);
  await choice.locator('[data-candidate-code="242114"]').click();await expect(page).toHaveURL(BASE+'#enterprise/create');await expect(page.locator('[data-field="occupationCode"]')).toHaveValue('242114');const draft=await exportedDraft(page);expect(draft.occupationCode).toBe('242114');expect(draft.mappingJustification).toContain(lang==='ar'?'يحتاج مراجعة نطاق المهام من المختص':'specialist task-scope review required');expect(draft.evaluationSummary).toBeUndefined();
 });

 test('public semantic skill matching renders real source references and nullable overlap: '+lang,async({page})=>{
  await setup(page,lang,'create');await page.locator('[data-field="title"]').fill('Synthetic provisional title');
  // The provisional controls are inside a collapsed details section. Open its
  // visible summary and use the visible label, exactly as a person would.
  await page.locator('details:has(#ent-provisional)>summary').click();await page.locator('label:has(#ent-provisional)').click();await expect(page.locator('#ent-provisional')).toBeChecked();await page.locator('[data-field="provisionalParent"]').fill('2512');
  await page.goto(BASE+'#enterprise/intelligence');await page.locator('#ent-analysis-text').fill(lang==='ar'?'البرمجة وتحليل الاحتياجات واختبار الحلول البرمجية':'Programming, analyze requirements and test software solutions');
  await page.locator('#ent-analysis-constraints').fill('Synthetic constraint requiring human review');
  const done=responseFor(page,'semantic');await page.locator('#ent-semantic').click();const response=await done;expect(response.status()).toBe(200);const body=await response.json();
  expect(response.request().postDataJSON().consentExternalProcessing).toBe(true);expect(body.mode).toBe('expert-review');expect(body.organizationAccess).toBe(false);expect(body.inputStored).toBe(false);expect(body.constraintsReviewRequired).toBe(true);
  expect(body.candidates.map(x=>x.code)).toEqual(['251204','241308','251104']);expect(body.candidates[0].skillOverlapPercent).toBe(100);expect(body.candidates[1].skillOverlapPercent).toBeNull();
  expect(body.candidates.every(x=>x.sourcePage>0&&x.taskOverlapPercent===null)).toBe(true);expect(body.semanticSkills).toHaveLength(1);expect(body.semanticSkills[0]).toMatchObject({id:'onet:2.B.3.e',source:'O*NET',method:'multilingual-embedding-cosine',humanReviewRequired:true});
  await expect(page.locator('#ent-candidates [data-candidate-code]')).toHaveCount(3);await expect(page.locator('#ent-candidates')).toContainText('251204');await expect(page.locator('#ent-candidates')).toContainText('—');
  await expect(page.locator('#ent-skills')).toContainText(lang==='ar'?'مهارات مقترحة بالمعنى':'Skills suggested by meaning');await expect(page.locator('#ent-skills')).toContainText('O*NET');await expect(page.locator('#ent-skills')).toContainText('0.96');await expect(page.locator('#ent-message')).not.toHaveClass(/error/);
  await page.locator('[data-candidate-code="251204"]').click();await expect(page).toHaveURL(/#enterprise\/create$/);await expect(page.locator('#ent-provisional')).not.toBeChecked();await expect(page.locator('[data-field="occupationCode"]')).toHaveValue('251204');await expect(page.locator('[data-field="title"]')).toHaveValue('Synthetic provisional title');
  const draft=await exportedDraft(page);expect(draft.provisional).toBe(false);expect(draft.occupationCode).toBe('251204');expect(draft.provisionalParent).toBe('');
 });

 test('public AI KPI schema produces three editable rows and preserves authored edit in JSON: '+lang,async({page})=>{
  await setup(page,lang,'create');await enterRole(page,lang,lang==='ar'?'إنجاز 95% من الطلبات شهريًا وإثبات النتيجة في سجل مصدر':'Complete 95% of requests monthly with a source register');
  const done=responseFor(page,'kpis');await page.locator('#ent-ai-kpis').click();const response=await done;expect(response.status()).toBe(200);const body=await response.json();
  expect(response.request().postDataJSON()).toMatchObject({lang,consentExternalProcessing:true});expect(body.status).toBe('human-review-required');expect(body.organizationAccess).toBe(false);expect(body.inputStored).toBe(false);expect(body.kpis).toHaveLength(3);
  for(const row of body.kpis){expect(Object.keys(row).sort()).toEqual(['deliverable','frequency','metric','outcome','target']);expect(Object.values(row).every(x=>typeof x==='string'&&x.length>0)).toBe(true);}
  await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(15);await expect(page.locator('[data-matrix-key="kpis"][data-matrix-row="0"][data-matrix-field="outcome"]')).toHaveValue(lang==='ar'?'مخرج تجريبي 1':'Synthetic outcome 1');
  await page.locator('[data-matrix-key="kpis"][data-matrix-row="0"][data-matrix-field="target"]').fill('97% approved by test author');
  const draft=await exportedDraft(page);expect(draft.kpis).toHaveLength(3);expect(draft.kpis[0].target).toBe('97% approved by test author');
 });

 test('declining external processing sends neither semantic nor KPI POST: '+lang,async({page})=>{
  const posts=[];page.on('request',r=>{if(isPost(r,'semantic')||isPost(r,'kpis'))posts.push(r.url());});const dialogs=await setup(page,lang,'intelligence',false);
  await page.locator('#ent-analysis-text').fill('Programming and software analysis using synthetic data');await page.locator('#ent-semantic').click();await expect(page.locator('#ent-semantic')).toBeEnabled();await expect(page.locator('#ent-candidates')).toBeEmpty();
  await page.goto(BASE+'#enterprise/create');await enterRole(page,lang,'Complete 95% of requests monthly');await page.locator('#ent-ai-kpis').click();await expect(page.locator('#ent-ai-kpis')).toBeEnabled();await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(0);expect(posts).toEqual([]);expect(dialogs).toHaveLength(2);expect(dialogs.every(x=>x.includes('Google Gemini'))).toBe(true);
 });

 test('editing input during provider work rejects stale semantic and KPI responses: '+lang,async({page})=>{
  await setup(page,lang);await page.locator('#ent-analysis-text').fill('AI_TEST_DELAY Programming and software analysis');const requested=page.waitForRequest(r=>isPost(r,'semantic')),done=responseFor(page,'semantic');await page.locator('#ent-semantic').click();await requested;await page.locator('#ent-analysis-text').fill('Current text has changed to audit planning');expect((await done).status()).toBe(200);
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-message')).toContainText(lang==='ar'?'تغيّر وصف العمل':'Work description changed');await expect(page.locator('#ent-candidates')).toBeEmpty();await expect(page.locator('#ent-skills')).toBeEmpty();await expect(page.locator('#ent-semantic')).toBeEnabled();
  await page.goto(BASE+'#enterprise/create');await enterRole(page,lang,'AI_TEST_DELAY Complete 95% of requests monthly');const kpiRequested=page.waitForRequest(r=>isPost(r,'kpis')),kpiDone=responseFor(page,'kpis');await page.locator('#ent-ai-kpis').click();await kpiRequested;await page.locator('[data-field="successMeasures"]').fill('Current target is 90% with revised measurement');expect((await kpiDone).status()).toBe(200);
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-message')).toContainText(lang==='ar'?'تغيّرت المدخلات':'Input changed');await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(0);await expect(page.locator('#ent-ai-kpis')).toBeEnabled();
 });

 test('leaving an AI form during provider work preserves the destination calculator: '+lang,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));await setup(page,lang);
  await page.locator('#ent-analysis-text').fill('AI_TEST_DELAY Programming and software analysis');const semanticRequested=page.waitForRequest(r=>isPost(r,'semantic')),semanticDone=responseFor(page,'semantic');await page.locator('#ent-semantic').click();await semanticRequested;
  await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('[data-cp-run]')).toBeVisible();const semanticResponse=await semanticDone;expect(semanticResponse.status()).toBe(200);await semanticResponse.finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page).toHaveURL(BASE+'#enterprise/compensation');await expect(page.locator('[data-cp-run]')).toBeVisible();await expect(page.locator('#ent-candidates')).toHaveCount(0);await expect(page.locator('#ent-message')).not.toHaveClass(/error/);
  await page.goto(BASE+'#enterprise/create');await enterRole(page,lang,'AI_TEST_DELAY Complete 95% of requests monthly');const kpiRequested=page.waitForRequest(r=>isPost(r,'kpis')),kpiDone=responseFor(page,'kpis');await page.locator('#ent-ai-kpis').click();await kpiRequested;
  await page.goto(BASE+'#enterprise/manpower');await expect(page.locator('[data-mp-run]')).toBeVisible();const kpiResponse=await kpiDone;expect(kpiResponse.status()).toBe(200);await kpiResponse.finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page).toHaveURL(BASE+'#enterprise/manpower');await expect(page.locator('[data-mp-run]')).toBeVisible();await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(0);await expect(page.locator('#ent-ai-kpis')).toHaveCount(0);await expect(page.locator('#ent-message')).not.toHaveClass(/error/);expect(errors).toEqual([]);
 });

 test('provider 503 failures surface errors without fabricated semantic or KPI success: '+lang,async({page})=>{
  await setup(page,lang);await page.locator('#ent-analysis-text').fill('AI_TEST_FAIL Programming and software analysis');const done=responseFor(page,'semantic');await page.locator('#ent-semantic').click();const failed=await done;expect(failed.status()).toBe(503);expect(await failed.json()).toHaveProperty('detail');
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-candidates')).toBeEmpty();await expect(page.locator('#ent-skills')).toBeEmpty();await expect(page.locator('#ent-semantic')).toBeEnabled();
  await page.goto(BASE+'#enterprise/create');await enterRole(page,lang,'AI_TEST_FAIL Complete 95% of requests monthly');const kpiDone=responseFor(page,'kpis');await page.locator('#ent-ai-kpis').click();expect((await kpiDone).status()).toBe(503);
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(0);await expect(page.locator('#ent-ai-kpis')).toBeEnabled();
 });
}
