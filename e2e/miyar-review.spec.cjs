const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/review.html';
const API='https://miyar-enterprise-api.onrender.com/api/v1/review/strategic';
const STATUS={enabled:true,configured:true,expiresAt:'2099-10-06T20:59:59Z',remainingToday:60,dailyLimit:60,corpusRecords:5};
const RESULT={route:'matched-objective',finalTitle:'Civil Engineer',occupationCode:'214201',educationCode:'073201',cosineSimilarity:.893775,threshold:.85,status:'human-review-required',finalRationale:'Matches civil project delivery.',matchedCandidate:'Civil Engineer',validation:{rationale:'Scope checked.'},embeddingModel:'gemini-embedding-001',generationModel:'gemini-3.1-flash-lite'};
test('review page requires consent, submits scope and exports the expert evaluation',async({page})=>{
 let calls=0;
 await page.route(API+'/status',route=>route.fulfill({json:STATUS}));
 await page.route(API,route=>{calls++;const body=route.request().postDataJSON();expect(body.consentExternalProcessing).toBe(true);expect(body.field).toBe('Engineering');expect(body.constraints).toContain('no management');return route.fulfill({json:RESULT});});
 await page.goto(BASE);await expect(page.locator('#analyze')).toBeEnabled();
 await page.locator('[data-example="civil"]').click();await page.locator('#analyze').click();expect(calls).toBe(0);
 await page.locator('#consent').check();await page.locator('#analyze').click();
 await expect(page.locator('#result')).toContainText('Civil Engineer');await expect(page.locator('#result')).toContainText('214201');expect(calls).toBe(1);
 await page.locator('#assessment').selectOption('suitable');await page.locator('#comments').fill('The title fits the objective and requested scope.');
 const download=page.waitForEvent('download');await page.locator('.download').click();expect((await download).suggestedFilename()).toMatch(/^Miyar-expert-review-\d+\.json$/);
 await page.locator('#objective').fill('Changed objective requiring a new independent analysis.');await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#feedback-form')).toBeHidden();
});
test('review generation shows an unmapped proposal without invented codes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route(API+'/status',route=>route.fulfill({json:STATUS}));
 await page.route(API,route=>route.fulfill({json:{...RESULT,route:'generated-proposal',finalTitle:'أخصائي رواتب',occupationCode:null,educationCode:null,cosineSimilarity:.64}}));
 await page.goto(BASE);await page.locator('[data-example="payroll"]').click();await page.locator('#consent').check();await page.locator('#analyze').click();
 await expect(page.locator('#result')).toContainText('أخصائي رواتب');await expect(page.locator('#result')).toContainText('غير مسند');await expect(page.locator('#result')).not.toContainText('214201');
 const size=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));expect(size.document).toBeLessThanOrEqual(size.viewport);
});
test('expired review is unavailable and never silently uses rules',async({page})=>{
 await page.route(API+'/status',route=>route.fulfill({json:{...STATUS,enabled:false}}));
 await page.goto(BASE);await expect(page.locator('#service-state')).toHaveText('التجربة غير متاحة حاليًا');await expect(page.locator('#analyze')).toBeDisabled();await expect(page.locator('#result')).toBeHidden();
});
