const {test,expect}=require('@playwright/test');
const {spawn}=require('node:child_process');
const path=require('node:path');
const BASE='http://127.0.0.1:4173/',API='http://127.0.0.1:8192';
let server,logs='';
test.beforeAll(async()=>{
 server=spawn(process.env.MIYAR_TEST_PYTHON||'python3',['-m','uvicorn','e2e.fixtures.api_seed:app','--host','127.0.0.1','--port','8192'],{cwd:path.join(__dirname,'..'),env:{...process.env,MIYAR_ENV:'test'}});
 server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 for(let i=0;i<100;i++){try{if((await fetch(API+'/health')).ok)return;}catch{}if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}throw Error('Isolated API did not start: '+logs);
});
test.afterAll(()=>server?.kill());
// Assertions await mutations; teardown cancels any abandoned navigation reads.
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'ignoreErrors'});});
async function setup(page){await page.addInitScript(()=>localStorage.setItem('miyar-language','en'));await page.route('https://miyar-enterprise-api.onrender.com/**',async r=>{
 // Retry one connection reset for idempotent reads from the disposable API.
 // Writes remain single-attempt so this harness cannot duplicate mutations.
 const response=await r.fetch({url:r.request().url().replace('https://miyar-enterprise-api.onrender.com',API),maxRetries:r.request().method()==='GET'?1:0});
 // Playwright can finish a canceled read during navigation or route teardown.
 // Ignore only that handled-read error; writes and all other failures remain fatal.
 try{await r.fulfill({response});}catch(error){if(!(r.request().method()==='GET'&&error.message.includes('Route is already handled')))throw error;}
});await page.goto(BASE+'#enterprise/connection');}
async function login(page,email){await page.locator('#ent-email').fill(email);await page.locator('#ent-password').fill('isolated-test-password-928');await page.locator('#ent-login button[type=submit]').click();await page.waitForURL(/#enterprise\/overview$/);}
async function openAdvancedOD(page){await expect(page.locator('#miyar-od-advanced > summary')).toBeVisible();if(!await page.locator('[data-od-example]').isVisible())await page.locator('#miyar-od-advanced > summary').click();}

test('authenticated manager reads institution profile before designing a position',async({page})=>{
 await setup(page);await login(page,'a-line_manager@audit.test');await page.goto(BASE+'#enterprise/create');await expect(page.locator('[data-institution-context]')).toContainText('Configured · 2 units · 2 grades');await expect(page.locator('[data-inst-open]')).toHaveCount(0);
 await openAdvancedOD(page);await page.locator('[data-od-example]').click();await page.locator('[data-od-responsibilities]').fill((await page.locator('[data-od-responsibilities]').inputValue())+'; lead six employees; approve work plans');await page.locator('[data-od-generate]').click();await expect(page.locator('[data-inst-match]')).toContainText('G11-A');
});

test('organization switch replaces institution profile and isolates locally saved scenarios',async({page})=>{
 await setup(page);await login(page,'a-admin@audit.test');await page.goto(BASE+'#enterprise/connection');await expect(page.locator('[data-inst-org]')).toHaveValue('Audit Organization A');
 await page.goto(BASE+'#enterprise/compensation');await page.locator('[data-cp-example]').click();await page.locator('#cp-role').fill('A private scenario');await page.locator('[data-cp-run]').click();await page.locator('[data-cp-save]').click();
 await page.goto(BASE+'#enterprise/connection');await page.locator('#ent-logout').click();await login(page,'b-admin@audit.test');await page.goto(BASE+'#enterprise/connection');await expect(page.locator('[data-inst-org]')).toHaveValue('Audit Organization B');await expect(page.locator('[data-inst-grades]')).toContainText('G19-B');
 await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('[data-cp-open]')).toHaveCount(0);await expect(page.locator('#cp-role')).toHaveValue('');
});

test('session expiry clears the server institution profile and authenticated scenario state',async({page})=>{
 await setup(page);await login(page,'a-admin@audit.test');await page.goto(BASE+'#enterprise/connection');await expect(page.locator('[data-inst-org]')).toHaveValue('Audit Organization A');
 await page.route('**/api/v1/positions**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"detail":"Expired session"}'}));
 await page.goto(BASE+'#enterprise/workspace');await expect(page.locator('.ent-session')).toContainText('This device');
 await page.goto(BASE+'#enterprise/create');await expect(page.locator('[data-institution-context]')).toContainText('Not configured');
 expect(await page.evaluate(()=>Object.values(localStorage).some(x=>x.includes('G11-A')))).toBeFalsy();
});

function totp(secret,offset=0){const crypto=require('node:crypto'),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replace(/\s|=/g,'').toUpperCase())bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const step=Math.floor(Date.now()/30000)+offset,counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=crypto.createHmac('sha1',key).update(counter).digest(),o=h[h.length-1]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1e6).padStart(6,'0');}

test('two-step sign-in is enrolled from account settings and then required at sign-in',async({page})=>{
 await setup(page);await login(page,'b-line_manager@audit.test');await page.goto(BASE+'#enterprise/connection');
 await page.locator('#ent-mfa summary').click();await page.locator('#ent-mfa-password').fill('isolated-test-password-928');await page.locator('#ent-mfa-setup').click();
 await expect(page.locator('#ent-mfa-secret')).not.toBeEmpty();const secret=(await page.locator('#ent-mfa-secret').textContent()).trim();await expect(page.locator('#ent-mfa-link')).toHaveAttribute('href',/^otpauth:\/\/totp\//);
 await page.locator('#ent-mfa-code').fill(totp(secret));await page.locator('#ent-mfa-confirm').click();await expect(page.locator('#ent-mfa summary')).toContainText('On');
 await page.locator('#ent-logout').click();await page.goto(BASE+'#enterprise/connection');
 await page.locator('#ent-email').fill('b-line_manager@audit.test');await page.locator('#ent-password').fill('isolated-test-password-928');await page.locator('#ent-login button[type=submit]').click();
 await expect(page.locator('#ent-otp-field')).toBeVisible();await page.locator('#ent-otp').fill(totp(secret,1));await page.locator('#ent-login button[type=submit]').click();await page.waitForURL(/#enterprise\/overview$/);
});
