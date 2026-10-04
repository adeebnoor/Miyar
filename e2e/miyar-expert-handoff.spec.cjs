const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const BASE='http://127.0.0.1:4173/';
async function start(page,route='#demo'){
 await page.addInitScript(()=>localStorage.setItem('miyar-language','en'));
 await page.route('https://miyar-enterprise-api.onrender.com/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"detail":"Sign in required"}'}));
 await page.goto(BASE+route);
}
test('expert payroll recipient case validates specialist, then transfers all inputs to OD',async({page})=>{
 await start(page);await page.locator('#objective').fill('اعداد ومعالجة الرواتب شهريا وارفع تقارير للمدير المالي');await page.locator('#domain').fill('الموارد البشرية');await page.locator('#seniority').fill('أخصائي');await page.locator('#role-form button[type=submit]').click();
 await expect(page.locator('.demo-v5-directory')).toHaveCount(1);await expect(page.locator('.demo-final-title')).toContainText('Payroll Specialist');await expect(page.locator('.demo-validation li')).toHaveCount(5);await page.locator('[data-demo-primary-hr]').click();await expect(page.locator('[data-field=occupationCode]')).toHaveValue('242322');await expect(page.locator('[data-field=title]')).toHaveValue('Payroll Specialist');await expect(page.locator('[data-od-level]')).toHaveValue('أخصائي');
});
test('expert finance conflict switches domain through the visible control',async({page})=>{
 await start(page);await page.locator('#objective').fill('تحليل تكلفة الرواتب ضمن الميزانية');await page.locator('#domain').fill('المالية');await page.locator('#seniority').fill('أخصائي');await page.locator('#role-form button[type=submit]').click();await expect(page.locator('.demo-final-title')).toContainText('Cost Accountant');await expect(page.locator('.demo-domain-conflict')).toBeVisible();await page.locator('[data-demo-switch]').click();await expect(page.locator('.demo-final-title')).toContainText('Payroll Specialist');
});
test('expert compensation above-midpoint case holds salary instead of proposing a cut',async({page})=>{
 await start(page,'#enterprise/compensation');await page.locator('[data-cp-example]').click();await page.locator('#cp-current').fill('33000');await page.locator('[data-cp-run]').click();await expect(page.locator('.cp-policy')).toContainText('Hold salary');await expect(page.locator('.cp-result-head')).toContainText('33,000');await expect(page.locator('.cp-adjust')).toContainText('0 SAR');
});
test('expert validation card fits a mobile viewport without horizontal scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page);await page.locator('#objective').fill('إدارة حملات التسويق الرقمي وقياس العائد');await page.locator('#domain').fill('التسويق');await page.locator('#seniority').fill('أخصائي');await page.locator('#role-form button[type=submit]').click();await expect(page.locator('.demo-final-title')).toContainText('Digital Marketing Specialist');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
test('original embedding pipeline is discoverable and fails explicitly if its API is not deployed',async({page})=>{
 await start(page);await page.route('**/api/v1/analyze/strategic/status',route=>route.fulfill({status:404,contentType:'application/json',body:'{"detail":"Not Found"}'}));await page.locator('#demo-engine-mode').selectOption('ai');await expect(page.locator('#demo-ai-consent')).toBeVisible();await page.locator('#objective').fill('Improve operational workforce planning');await page.locator('#domain').fill('HR');await page.locator('#seniority').fill('Specialist');await page.locator('#role-form button[type=submit]').click();await expect(page.locator('#result-content')).toContainText('The original pipeline is not deployed');await expect(page.locator('.demo-v5-directory')).toHaveCount(0);
});
const expertState={enabled:true,configured:true,expiresAt:'2099-10-06T20:59:59Z',dailyLimit:60,remainingToday:58,corpusRecords:5};
async function fullSiteAI(page,result){
 await start(page,'#home');
 await page.route('**/api/v1/analyze/strategic/status',r=>r.fulfill({json:{configured:true}}));
 await page.route('**/api/v1/review/strategic/status',r=>r.fulfill({json:expertState}));
 const requests=[];
 await page.route('**/api/v1/review/strategic',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:result});});
 await page.locator('[data-full-site-ai]').click();
 await expect(page.locator('#demo-engine-mode')).toHaveValue('ai');
 await page.locator('[data-ai-example]').click();
 return requests;
}
test('full website launches expert AI without login, requires consent and transfers mapped result to OD',async({page})=>{
 const requests=await fullSiteAI(page,{mode:'expert-review',route:'matched-objective',finalTitle:'Civil Engineer',occupationCode:'214201',educationCode:'073201',cosineSimilarity:.9,validation:{rationale:'Source match'},finalRationale:'Source-linked proposal'});
 await page.locator('#objective').fill('Ensure successful civil engineering project delivery and review site conditions, designs and construction quality.');await page.locator('#domain').fill('Engineering');await page.locator('#seniority').fill('Professional');
 await page.locator('#role-form button[type=submit]').click();
 await expect(page.locator('#result-content [role=alert]')).toContainText('accept the AI data-processing notice');
 expect(requests).toHaveLength(0);
 await page.locator('#demo-ai-consent').check();await page.locator('#role-form button[type=submit]').click();
 await expect(page.locator('.demo-final-title')).toContainText('Civil Engineer');
 expect(requests).toHaveLength(1);expect(requests[0].consentExternalProcessing).toBe(true);expect(requests[0]).not.toHaveProperty('organizationId');
 await page.locator('[data-ai-use]').click();
 await expect(page.locator('[data-field=title]')).toHaveValue('Civil Engineer');
 await expect(page.locator('[data-field=occupationCode]')).toHaveValue('214201');
 await expect(page.locator('[data-field=educationFieldCode]')).toHaveValue('073201');
});
test('full website keeps generated roles unmapped and downloads expert feedback on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await fullSiteAI(page,{mode:'expert-review',route:'generated-proposal',finalTitle:'Payroll Innovation Specialist',occupationCode:null,educationCode:null,cosineSimilarity:.4,validation:{rationale:'Review needed'},finalRationale:'Proposal'});
 await page.locator('#demo-ai-consent').check();await page.locator('#role-form button[type=submit]').click();
 await expect(page.locator('#result-content')).toContainText('Unmapped');
 await page.locator('.demo-expert-feedback summary').click();await page.locator('#demo-expert-comment').fill('Synthetic UI test feedback');
 const download=page.waitForEvent('download');await page.locator('[data-ai-download]').click();const exported=await download;expect(exported.suggestedFilename()).toMatch(/^Miyar-full-site-review-.*\.json$/);
 const result=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));expect(result.application).toBe('Miyar');expect(result.feedback).toBe('Synthetic UI test feedback');expect(result.result.finalTitle).toBe('Payroll Innovation Specialist');expect(result.result.occupationCode).toBeNull();expect(result.input.objective).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.locator('[data-ai-use]').click();await expect(page.locator('[data-field=title]')).toHaveValue('Payroll Innovation Specialist');await expect(page.locator('[data-field=occupationCode]')).toHaveValue('');
});
test('expired expert access blocks the AI request while keeping full website navigation available',async({page})=>{
 const requests=await fullSiteAI(page,{});await page.route('**/api/v1/review/strategic/status',r=>r.fulfill({json:{...expertState,enabled:false}}));
 await page.locator('#demo-ai-consent').check();await page.locator('#role-form button[type=submit]').click();
 await expect(page.locator('#result-content [role=alert]')).toContainText('expired or is disabled');expect(requests).toHaveLength(0);
 await expect(page.locator('.demo-v5-directory')).toHaveCount(0);
 await page.goto(BASE+'#enterprise/manpower');await expect(page.locator('[data-mp-run]')).toBeVisible();
});
