const {test,expect}=require('@playwright/test');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https');
const BASE='http://127.0.0.1:4173/',API='https://127.0.0.1:8194';
let server,certificateDirectory,logs='';
function healthy(){return new Promise(resolve=>{const request=https.get(API+'/health',{rejectUnauthorized:false},r=>{r.resume();resolve(r.statusCode===200);});request.setTimeout(1500,()=>request.destroy());request.on('error',()=>resolve(false));});}
test.beforeAll(async()=>{
 certificateDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'miyar-ai-tls-'));const key=path.join(certificateDirectory,'localhost.key'),certificate=path.join(certificateDirectory,'localhost.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',certificate,'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
 server=spawn(process.env.MIYAR_TEST_PYTHON||'python3',['-m','uvicorn','e2e.fixtures.ai_services:app','--host','127.0.0.1','--port','8194','--ssl-keyfile',key,'--ssl-certfile',certificate],{cwd:path.join(__dirname,'..'),env:{...process.env,MIYAR_ENV:'test',MIYAR_CORS_ORIGINS:BASE.replace(/\/$/,''),MIYAR_SIGNING_KEY:Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}});
 server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 for(let i=0;i<100;i++){if(await healthy())return;if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}throw Error(logs);
});
// Native HTTPS browser requests target a real disposable API, not intercepted responses.
// Only provider boundaries are deterministic; this suite makes no live-accuracy claim.
test.use({screenshot:'only-on-failure',ignoreHTTPSErrors:true});
test.afterAll(async()=>{if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});if(certificateDirectory)fs.rmSync(certificateDirectory,{recursive:true,force:true});});
async function setup(page,lang,route='intelligence',consent=true){
 const dialogs=[];
 await page.addInitScript(({language,api})=>{localStorage.setItem('miyar-language',language);window.MIYAR_CONFIG={apiBase:api};},{language:lang,api:API});
 // Permit localhost exclusively in the served test document. Production CSP is untouched.
 await page.route(BASE,async route=>{const response=await route.fetch();const original=await response.text();const body=original.replace("connect-src 'self' https://miyar-enterprise-api.onrender.com","connect-src 'self' https://miyar-enterprise-api.onrender.com "+API);expect(body).not.toBe(original);await route.fulfill({response,body,headers:{...response.headers(),'content-length':String(Buffer.byteLength(body))}});});
 page.on('dialog',dialog=>{dialogs.push(dialog.message());return consent?dialog.accept():dialog.dismiss();});
 await page.goto(BASE+'#enterprise/'+route);await expect(page.locator('html')).toHaveAttribute('lang',lang);
 return dialogs;
}
const isPost=(request,feature)=>request.method()==='POST'&&request.url()===API+'/api/v1/review/'+feature;
const responseFor=(page,feature)=>page.waitForResponse(r=>isPost(r.request(),feature));
async function enterRole(page,lang,measures){
 await page.locator('[data-field="title"]').fill(lang==='ar'?'منصب تجريبي':'Synthetic role');
 await page.locator('[data-field="successMeasures"]').fill(measures);
}
async function exportedDraft(page){const event=page.waitForEvent('download');await page.locator('#ent-local-json').click();const downloaded=await event;return JSON.parse(fs.readFileSync(await downloaded.path(),'utf8')).content;}

for(const lang of ['ar','en']){
 test('public semantic skill matching renders real source references and nullable overlap: '+lang,async({page})=>{
  await setup(page,lang);await page.locator('#ent-analysis-text').fill(lang==='ar'?'البرمجة وتحليل الاحتياجات واختبار الحلول البرمجية':'Programming, analyze requirements and test software solutions');
  await page.locator('#ent-analysis-constraints').fill('Synthetic constraint requiring human review');
  const done=responseFor(page,'semantic');await page.locator('#ent-semantic').click();const response=await done;expect(response.status()).toBe(200);const body=await response.json();
  expect(response.request().postDataJSON().consentExternalProcessing).toBe(true);expect(body.mode).toBe('expert-review');expect(body.organizationAccess).toBe(false);expect(body.inputStored).toBe(false);expect(body.constraintsReviewRequired).toBe(true);
  expect(body.candidates.map(x=>x.code)).toEqual(['251204','241308','251104']);expect(body.candidates[0].skillOverlapPercent).toBe(100);expect(body.candidates[1].skillOverlapPercent).toBeNull();
  expect(body.candidates.every(x=>x.sourcePage>0&&x.taskOverlapPercent===null)).toBe(true);expect(body.semanticSkills).toHaveLength(1);expect(body.semanticSkills[0]).toMatchObject({id:'onet:2.B.3.e',source:'O*NET',method:'multilingual-embedding-cosine',humanReviewRequired:true});
  await expect(page.locator('#ent-candidates [data-candidate-code]')).toHaveCount(3);await expect(page.locator('#ent-candidates')).toContainText('251204');await expect(page.locator('#ent-candidates')).toContainText('—');
  await expect(page.locator('#ent-skills')).toContainText(lang==='ar'?'مهارات مقترحة بالمعنى':'Skills suggested by meaning');await expect(page.locator('#ent-skills')).toContainText('O*NET');await expect(page.locator('#ent-skills')).toContainText('0.96');await expect(page.locator('#ent-message')).not.toHaveClass(/error/);
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

 test('provider 503 failures surface errors without fabricated semantic or KPI success: '+lang,async({page})=>{
  await setup(page,lang);await page.locator('#ent-analysis-text').fill('AI_TEST_FAIL Programming and software analysis');const done=responseFor(page,'semantic');await page.locator('#ent-semantic').click();const failed=await done;expect(failed.status()).toBe(503);expect(await failed.json()).toHaveProperty('detail');
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-candidates')).toBeEmpty();await expect(page.locator('#ent-skills')).toBeEmpty();await expect(page.locator('#ent-semantic')).toBeEnabled();
  await page.goto(BASE+'#enterprise/create');await enterRole(page,lang,'AI_TEST_FAIL Complete 95% of requests monthly');const kpiDone=responseFor(page,'kpis');await page.locator('#ent-ai-kpis').click();expect((await kpiDone).status()).toBe(503);
  await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('[data-matrix-key="kpis"]')).toHaveCount(0);await expect(page.locator('#ent-ai-kpis')).toBeEnabled();
 });
}
