const {test,expect}=require('@playwright/test');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os'),https=require('node:https');
const BASE='http://127.0.0.1:4173/',API='https://127.0.0.1:8193';
let server,certificateDirectory,logs='';
function fixtureHealthy(){return new Promise(resolve=>{const request=https.get(API+'/health',{rejectUnauthorized:false},response=>{response.resume();resolve(response.statusCode===200);});request.setTimeout(1500,()=>request.destroy());request.on('error',()=>resolve(false));});}
test.beforeAll(async()=>{
 certificateDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'miyar-acceptance-tls-'));const key=path.join(certificateDirectory,'localhost.key'),certificate=path.join(certificateDirectory,'localhost.crt');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',certificate,'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{stdio:'ignore'});
 server=spawn(process.env.MIYAR_TEST_PYTHON||'python3',['-m','uvicorn','e2e.fixtures.api_seed:app','--host','127.0.0.1','--port','8193','--ssl-keyfile',key,'--ssl-certfile',certificate],{cwd:path.join(__dirname,'..'),env:{...process.env,MIYAR_ENV:'test',MIYAR_CORS_ORIGINS:BASE.replace(/\/$/,''),MIYAR_SIGNING_KEY:Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')}});
 server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 for(let i=0;i<100;i++){if(await fixtureHealthy())return;if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}throw Error(logs);
});
// This disposable localhost fixture uses a one-day self-signed certificate.
test.use({screenshot:'only-on-failure',ignoreHTTPSErrors:true});
test.afterAll(async()=>{if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});if(certificateDirectory)fs.rmSync(certificateDirectory,{recursive:true,force:true});});
async function setup(page,lang='en'){
 // Use the real browser network path, including CORS and native multipart uploads.
 await page.addInitScript(({language,api})=>{localStorage.setItem('miyar-language',language);window.MIYAR_CONFIG={apiBase:api};},{language:lang,api:API});
 // Permit the disposable API only in this served test document; production CSP is unchanged.
 await page.route(BASE,async route=>{const response=await route.fetch();const original=await response.text();const body=original.replace("connect-src 'self' https://miyar-enterprise-api.onrender.com","connect-src 'self' https://miyar-enterprise-api.onrender.com "+API);expect(body).not.toBe(original);await route.fulfill({response,body,headers:{...response.headers(),'content-length':String(Buffer.byteLength(body))}});});
 page.on('dialog',d=>d.accept());await page.goto(BASE+'#enterprise/connection');
}
async function login(page,role='line_manager',org='a'){
 await page.locator('#ent-email').fill(org+'-'+role+'@audit.test');await page.locator('#ent-password').fill('isolated-test-password-928');await page.locator('#ent-login button[type=submit]').click();await page.waitForURL(/#enterprise\/overview$/);
}
async function switchRole(page,role,org='a'){
 await page.goto(BASE+'#enterprise/connection');await page.locator('#ent-logout').click();await login(page,role,org);
}
async function open(page,title){await page.goto(BASE+'#enterprise/workspace');await page.locator('[data-position]').filter({hasText:title}).click();await expect(page.locator('#ent-position-detail h3')).toContainText(title);}
async function create(page,title){
 await page.goto(BASE+'#enterprise/create');await page.locator('#ent-sample').click();await page.locator('[data-field="title"]').fill(title);await page.locator('#ent-save-open').click();await expect(page).toHaveURL(/#enterprise\/workspace$/);await expect(page.locator('#ent-position-detail h3')).toHaveText(title);
}
async function download(page,selector){const promise=page.waitForEvent('download');await page.locator(selector).click();const d=await promise;const file=await d.path();expect(file).toBeTruthy();return {filename:d.suggestedFilename(),file,bytes:fs.readFileSync(file)};}
function json(d){return JSON.parse(d.bytes.toString('utf8'));}
async function odApproval(page){
 for(const k of ['scopeReviewed','mappingReviewed','businessValidated','roleNotPerson'])await page.locator('[data-evidence="'+k+'"]').check();
 await page.locator('#ent-business-reviewer').fill('Synthetic department reviewer');await page.locator('#ent-business-date').fill('2026-09-01');await page.locator('#ent-review-comment').fill('Scope and business need verified in the isolated acceptance test.');await page.locator('#ent-approve').click();await expect(page.locator('#ent-approval-form')).toBeEmpty();
}

for(const lang of ['en','ar'])test('complete real organization workflow, four distinct reviewers and inspectable exports: '+lang,async({page})=>{
 test.setTimeout(150000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));await setup(page,lang);await login(page);
 const title=lang==='en'?'Acceptance Software Engineer':'مهندس برمجيات — اختبار القبول';await create(page,title);
 const draft=json(await download(page,'#ent-export-json'));expect(draft.content.title).toBe(title);expect(draft.content.headcount).toBe(1);expect(draft.content.annualCost).toBe(240000);expect(draft.content.raci).toHaveLength(1);
 await page.locator('#ent-submit-position').click();await expect(page.locator('#ent-withdraw-position')).toBeVisible();await expect(page.locator('#ent-approve')).toHaveCount(0);
 await switchRole(page,'od_specialist');await open(page,title);
 await page.locator('#ent-approve').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-approve')).toBeVisible();await odApproval(page);
 await switchRole(page,'total_rewards');await open(page,title);
 await page.locator('[data-evidence="payFrameworkReviewed"]').check();await page.locator('#ent-review-comment').fill('Reviewed framework and scope.');await page.locator('#ent-approve').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);
 for(const id of ['knowledge','complexity','impact']){await page.locator('[data-factor="'+id+'"]').selectOption('2');await page.locator('[data-factor-evidence="'+id+'"]').fill('Independent scope evidence for '+id);}
 await page.locator('#ent-record-grade').click();await expect(page.locator('#ent-grade-result')).toContainText('500');await expect(page.locator('#ent-message')).not.toHaveClass(/error/);await page.locator('#ent-approve').click();await expect(page.locator('#ent-approval-form')).toBeEmpty();
 await switchRole(page,'finance');await open(page,title);await page.locator('[data-evidence="vacancyConfirmed"]').check();await page.locator('[data-evidence="budgetConfirmed"]').check();await page.locator('#ent-review-comment').fill('Explicit finance input validation.');await page.locator('#ent-approve').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await page.locator('#ent-approved-count').fill('1');await page.locator('#ent-approved-budget').fill('239999');await page.locator('#ent-review-comment').fill('Budget check with explicit cost and requested headcount.');await page.locator('#ent-approve').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-approve')).toBeVisible();
 await page.locator('#ent-approved-budget').fill('240000');await page.locator('#ent-approve').click();await expect(page.locator('#ent-approval-form')).toBeEmpty();
 await switchRole(page,'chro');await open(page,title);await page.locator('#ent-review-comment').fill('Final acceptance approval after all three recorded reviews.');await page.locator('#ent-approve').click();await expect(page.locator('#ent-export-receipt')).toBeVisible();
 const approved=json(await download(page,'#ent-export-json'));expect(approved.content.title).toBe(title);expect(approved.approved).toBe(true);expect(approved.revision).toBe(1);expect(approved.approvals).toHaveLength(4);
 const pdf=await download(page,'#ent-export-pdf');expect(pdf.bytes.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.bytes.length).toBeGreaterThan(15000);
 const docx=await download(page,'#ent-export-docx'),xlsx=await download(page,'#ent-export-xlsx');expect(docx.bytes.subarray(0,2).toString()).toBe('PK');expect(xlsx.bytes.subarray(0,2).toString()).toBe('PK');
 execFileSync(process.env.MIYAR_TEST_PYTHON||'python3',['-c',`import sys,io\nfrom docx import Document\nfrom openpyxl import load_workbook\nd=Document(sys.argv[1]);text='\\n'.join(p.text for p in d.paragraphs);assert sys.argv[3] in text,text\nassert len(d.tables[-1].rows)==5\nassert all(r.cells[1].text.strip() for r in d.tables[-1].rows[1:])\nw=load_workbook(io.BytesIO(open(sys.argv[2],'rb').read()));assert set(w.sheetnames)=={'Position','RACI','Skills','KPIs'}\nassert w['RACI'].max_row>=2\n`,docx.file,xlsx.file,title]);
 const receipt=json(await download(page,'#ent-export-receipt'));const canonical=v=>{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);};
 const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(receipt.publicKey,'base64')]),format:'der',type:'spki'});expect(crypto.verify(null,Buffer.from(canonical(receipt.manifest)),key,Buffer.from(receipt.signature,'base64'))).toBeTruthy();expect(crypto.verify(null,Buffer.from(canonical({...receipt.manifest,positionId:'TAMPERED'})),key,Buffer.from(receipt.signature,'base64'))).toBeFalsy();
 await page.locator('#ent-audit').click();await expect(page.locator('#ent-audit-output')).toContainText(/approve|decision/);
 await switchRole(page,'line_manager');await open(page,title);await page.locator('#ent-edit-position').click();await page.locator('[data-field="title"]').fill(title+' v2');await page.locator('#ent-save-open').click();await expect(page.locator('#ent-position-detail h3')).toHaveText(title+' v2');
 const stillApproved=json(await download(page,'#ent-export-json'));expect(stillApproved.content.title).toBe(title);expect(stillApproved.approved).toBe(true);expect(stillApproved.revision).toBe(1);
 await page.locator('[data-restore="1"]').click();await expect(page.locator('#ent-position-detail h3')).toHaveText(title);await expect(page.locator('.ent-version-list')).toContainText('v3');expect(errors).toEqual([]);
});

test('return, withdrawal and reject actions persist correctly and do not bypass revisions',async({page})=>{
 test.setTimeout(90000);await setup(page);await login(page);const title='Workflow negative decisions';await create(page,title);await page.locator('#ent-submit-position').click();await page.locator('#ent-withdraw-position').click();await expect(page.locator('#ent-edit-position')).toBeVisible();
 await expect(page.locator('#ent-submit-position')).toHaveCount(0);await page.locator('#ent-edit-position').click();await page.locator('[data-field="purpose"]').fill('Amended purpose with explicit workflow test evidence.');await page.locator('#ent-save-open').click();await page.locator('#ent-submit-position').click();
 await switchRole(page,'od_specialist');await open(page,title);await page.locator('#ent-review-comment').fill('Clarify outcomes before proceeding.');await page.locator('#ent-return').click();await expect(page.locator('#ent-position-detail')).toContainText('Returned');
 await switchRole(page,'line_manager');await open(page,title);await page.locator('#ent-edit-position').click();await page.locator('[data-field="successMeasures"]').fill('Measurable service time and error rate.');await page.locator('#ent-save-open').click();await page.locator('#ent-submit-position').click();
 await switchRole(page,'od_specialist');await open(page,title);await page.locator('#ent-review-comment').fill('Reject this synthetic scope due to insufficient need.');await page.locator('#ent-reject').click();await expect(page.locator('#ent-position-detail')).toContainText('Rejected');await expect(page.locator('#ent-export-receipt')).toHaveCount(0);
});

for(const kind of ['mp','cp'])test(kind+' scenario save, update, reload, export and recomputed import',async({page})=>{
 await setup(page);const route=kind==='mp'?'manpower':'compensation';await page.goto(BASE+'#enterprise/'+route);await page.locator('[data-'+kind+'-example]').click();await page.locator('[data-'+kind+'-run]').click();await page.locator('[data-'+kind+'-save]').click();await expect(page.locator('[data-'+kind+'-open]')).toHaveCount(1);
 const first=json(await download(page,'[data-'+kind+'-export]'));expect(first.schema).toBe(kind==='mp'?'miyar-manpower-plan/1.0':'miyar-compensation-scenario/1.0');
 const field=kind==='mp'?'#mp-target':'#cp-current';await page.locator(field).fill(kind==='mp'?'150':'27000');await expect(page.locator('[data-'+kind+'-export]')).toHaveCount(0);await page.locator('[data-'+kind+'-run]').click();await page.locator('[data-'+kind+'-save]').click();await expect(page.locator('[data-'+kind+'-open]')).toHaveCount(1);
 await page.reload();await page.locator('[data-'+kind+'-open]').click();await expect(page.locator(field)).toHaveValue(kind==='mp'?'150':'27000');
 const updated=json(await download(page,'[data-'+kind+'-export]'));if(kind==='mp')expect(updated.scenarios.base.final.rawRequiredFte).toBeGreaterThan(first.scenarios.base.final.rawRequiredFte);else expect(updated.result.compaRatio).toBe(.9);
 const forged={...updated,...(kind==='mp'?{scenarios:{base:{final:{gapFte:99999}}}}:{result:{targetSalary:99999}})};await page.locator('[data-'+kind+'-import]').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
 const recomputed=json(await download(page,'[data-'+kind+'-export]'));if(kind==='mp')expect(recomputed.scenarios.base.final.gapFte).not.toBe(99999);else expect(recomputed.result.targetSalary).toBe(30000);
 await page.locator('[data-'+kind+'-import]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('[data-'+kind+'-message]')).toContainText(/not valid JSON/);await expect(page.locator('[data-'+kind+'-open]')).toHaveCount(1);await expect(page.locator('[data-'+kind+'-export]')).toHaveCount(0);
});

test('CSV health diagnosis, template and full export retain source flags and exact denominators',async({page})=>{
 await setup(page);await page.goto(BASE+'#enterprise/bulk');await page.locator('#ent-bulk-run').click();await expect(page.locator('#ent-message')).toContainText('Choose a file first');
 const template=await download(page,'#ent-bulk-template');expect(template.bytes.toString()).toContain('occupationCode');
 const csv='title,department,occupationCode,directReports,budgetAmount,authority\nمهندس برمجيات,IT,251204,0,0,Recommends\nمهندس برمجيات,IT,251204,0,0,Recommends\nUnknown role,IT,999999,1,0,Recommends\n';await page.locator('#ent-bulk-file').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.locator('#ent-bulk-run').click();await expect(page.locator('#ent-bulk-result')).toContainText('66.7%');const r=json(await download(page,'#ent-bulk-export'));expect(r.totalRows).toBe(3);expect(r.duplicateGroups).toHaveLength(1);expect(r.rows[2].flags).toContain('unknown_code');
 await page.locator('#ent-bulk-file').setInputFiles({name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from('title,title\nOne,Two\n')});await page.locator('#ent-bulk-run').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-bulk-export')).toHaveCount(0);
});

test('paired pilot evaluation computes agreement and time saving, exports and rejects duplicate cases',async({page})=>{
 await setup(page);await page.goto(BASE+'#enterprise/evidence');await page.locator('#ent-pilot-file').setInputFiles({name:'pilot.csv',mimeType:'text/csv',buffer:Buffer.from('caseId,expectedCode,miyarCode,baselineCode,humanMinutes,miyarMinutes\n1,251204,251204,999999,10,4\n2,214201,214201,214201,20,8\n')});await page.locator('#ent-pilot-run').click();const r=json(await download(page,'#ent-pilot-export'));expect(r.cases).toBe(2);expect(r.miyarAccuracy).toBe(100);expect(r.baselineAccuracy).toBe(50);expect(r.timeSavedPercent).toBe(60);
 await page.locator('#ent-pilot-file').setInputFiles({name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from('caseId,expectedCode,miyarCode,baselineCode\n1,a,a,a\n1,a,a,a\n')});await page.locator('#ent-pilot-run').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-pilot-export')).toHaveCount(0);
});

test('local package preview, editable fields, JSON, HTML and real PDF contain the authored role',async({page})=>{
 await setup(page);await page.goto(BASE+'#enterprise/create');await page.locator('#ent-sample').click();await page.locator('[data-field="title"]').fill('Synthetic local package');await page.locator('#ent-generate-kpis').click();await page.locator('#ent-generate-raci').click();
 const draft=json(await download(page,'#ent-local-json'));expect(draft.content?.title||draft.title).toBe('Synthetic local package');
 await page.locator('#ent-preview-draft').click();await expect(page.locator('.ent-report-dialog')).toContainText('Synthetic local package');await page.locator('#ent-close-report').click();
 const html=await download(page,'#ent-html-draft');expect(html.bytes.toString()).toContain('Synthetic local package');expect(html.bytes.toString()).toContain('RACI');
 const pdf=await download(page,'#ent-pdf-draft');expect(pdf.bytes.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.bytes.length).toBeGreaterThan(15000);
 await page.locator('#ent-save-open').click();await expect(page.locator('#ent-position-detail h3')).toHaveText('Synthetic local package');await page.locator('#ent-edit-position').click();await expect(page.locator('[data-field="title"]')).toHaveValue('Synthetic local package');
});

test('dictionary skills invalidate when the actual work changes, and unavailable semantic AI is disabled',async({page})=>{
 await setup(page);await login(page,'od_specialist');await page.goto(BASE+'#enterprise/intelligence');await page.locator('#ent-analysis-text').fill('Programming, SQL, prepare an internal audit plan and document audit evidence');await page.locator('#ent-extract').click();await expect(page.locator('#ent-skills')).toContainText('Programming');await expect(page.locator('#ent-skills')).toContainText('Risk-based audit planning');await expect(page.locator('#ent-skills')).toContainText('Audit evidence');
 await page.locator('#ent-analysis-text').fill('Unmatched arbitrary wording');await expect(page.locator('#ent-skills')).toBeEmpty();await page.locator('#ent-extract').click();await expect(page.locator('#ent-skills')).toContainText('No terms matched');await expect(page.locator('#ent-semantic')).toBeDisabled();
});

test('XLSX diagnosis goes through the real server, preserves zeros and rejects malformed archives',async({page},info)=>{
 await setup(page);await login(page,'od_specialist');await page.goto(BASE+'#enterprise/bulk');const file=info.outputPath('synthetic-input.xlsx');
 execFileSync(process.env.MIYAR_TEST_PYTHON||'python3',['-c',"import sys\nfrom openpyxl import Workbook\nw=Workbook();s=w.active;s.append(['title','department','occupationCode','directReports','budgetAmount','authority']);s.append(['مهندس برمجيات','IT','251204',0,0,'Recommends']);w.save(sys.argv[1])",file]);
 await page.locator('#ent-bulk-file').setInputFiles(file);await page.locator('#ent-bulk-run').click();await expect(page.locator('#ent-bulk-result')).toContainText('100%');const result=json(await download(page,'#ent-bulk-export'));expect(result.totalRows).toBe(1);expect(result.rows[0].flags).not.toContain('invalid_scope');
 await page.locator('#ent-bulk-file').setInputFiles({name:'broken.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not an XLSX archive')});await page.locator('#ent-bulk-run').click();await expect(page.locator('#ent-message')).toHaveClass(/error/);await expect(page.locator('#ent-bulk-export')).toHaveCount(0);
});

test('administrator adds a scoped department and account, persists branding, previews a framework and deactivates the account',async({page})=>{
 test.setTimeout(90000);await setup(page);await login(page,'admin','b');await page.goto(BASE+'#enterprise/connection');await page.locator('#ent-dept-name').fill('Acceptance testing department');await page.locator('#ent-add-dept').click();await expect(page.locator('#ent-message')).toContainText('Department added');
 await page.locator('#ent-user-name').fill('Synthetic acceptance user');await page.locator('#ent-user-email').fill('disposable-acceptance@audit.test');await page.locator('#ent-user-password').fill('disposable-test-password-928');await page.locator('#ent-user-role').selectOption('line_manager');await page.locator('#ent-user-dept').selectOption({label:'Acceptance testing department'});await page.locator('#ent-add-user').click();await expect(page.locator('#ent-message')).toContainText('Account created');await expect(page.locator('#ent-user-password')).toHaveValue('');
 await page.locator('#ent-brand-en').fill('Acceptance Synthetic Brand');await page.locator('#ent-save-brand').click();await expect(page.locator('#ent-message')).toContainText('Branding saved');await page.reload();await login(page,'admin','b');await page.goto(BASE+'#enterprise/connection');await expect(page.locator('#ent-brand-en')).toHaveValue('Acceptance Synthetic Brand');
 const framework=json(await download(page,'#ent-framework-template'));await page.locator('#ent-framework-file').setInputFiles({name:'framework.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(framework))});await page.locator('#ent-import-framework').click();await expect(page.locator('#ent-framework-preview')).toContainText('Preview before activation');await page.locator('#ent-framework-activate').click();await expect(page.locator('#ent-message')).toContainText('at least 10 characters');await page.locator('#ent-framework-reason').fill('Isolated framework acceptance activation');await page.locator('#ent-framework-activate').click();await expect(page.locator('#ent-framework-status')).toContainText(/activated|saved/i);
 const row=page.locator('#ent-user-list tr').filter({hasText:'Synthetic acceptance user'});await expect(row).toHaveCount(1);await row.locator('[data-disable-user]').click();
 await expect(page.locator('#ent-message')).toContainText('Account deactivated');
});
