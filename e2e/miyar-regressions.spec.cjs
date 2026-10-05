const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
async function setup(page,hash,lang='en'){
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{"detail":"Sign in"}'}));
 await page.addInitScript(lang=>{if(!localStorage.getItem('miyar-language'))localStorage.setItem('miyar-language',lang);},lang);
 await page.goto(BASE+hash);
}
for(const lang of ['ar','en'])for(const [kind,prefix,result,invalid,value] of [['manpower','mp','results','capacity','0'],['compensation','cp','result','max','100']]){
 test(`${kind} ${lang}: edits, invalidation, language, save/reload, update and JSON round trip`,async({page})=>{
  if(lang==='ar')await page.setViewportSize({width:390,height:844});
  await setup(page,'#enterprise/'+kind,lang);
  await page.locator(`[data-${prefix}-example]`).click();await page.locator(`[data-${prefix}-run]`).click();
  await expect(page.locator(`.${prefix}-${result}`)).toBeVisible();const original=await page.locator(`#${prefix}-role`).inputValue();
  await page.locator('#language-btn').click();await expect(page.locator(`#${prefix}-role`)).toHaveValue(original);await expect(page.locator(`.${prefix}-${result}`)).toBeVisible();
  await page.locator('#language-btn').click();await expect(page.locator(`.${prefix}-${result}`)).toBeVisible();
  await page.locator(`#${prefix}-${invalid}`).fill(value);await expect(page.locator(`[data-${prefix}-save]`)).toHaveCount(0);await expect(page.locator(`[data-${prefix}-export]`)).toHaveCount(0);
  await page.locator(`[data-${prefix}-run]`).click();await expect(page.locator(`.${prefix}-${result}`)).toHaveCount(0);
  if(prefix==='mp'){
   await expect(page.locator('[data-mp-message]')).toContainText(lang==='ar'?'قدرة FTE واحدة حاليًا':'Capacity per FTE');
   await expect(page.locator('#mp-capacity')).toHaveAttribute('aria-invalid','true');
   await expect(page.locator('#mp-capacity')).toHaveAttribute('aria-describedby',/mp-input-error/);
   await expect(page.locator('#mp-capacity')).toBeFocused();
  }else await expect(page.locator('[data-cp-message]')).toContainText(lang==='ar'?'يجب':'Salary band');
  await page.locator(`[data-${prefix}-example]`).click();if(prefix==='mp')await page.locator('[data-mp-context-options] > summary').click();await page.locator(`#${prefix}-role`).fill('Review scenario 928');await page.locator(`[data-${prefix}-run]`).click();await page.locator(`[data-${prefix}-save]`).click();
  await expect(page.locator(`[data-${prefix}-open]`)).toHaveCount(1);await page.reload();await page.locator(`[data-${prefix}-open]`).click();await expect(page.locator(`#${prefix}-role`)).toHaveValue('Review scenario 928');await expect(page.locator(`.${prefix}-${result}`)).toBeVisible();
  if(prefix==='mp')await page.locator('[data-mp-context-options] > summary').click();await page.locator(`#${prefix}-role`).fill('Updated scenario 928');await page.locator(`[data-${prefix}-run]`).click();await page.locator(`[data-${prefix}-save]`).click();await expect(page.locator(`[data-${prefix}-open]`)).toHaveCount(1);
  const downloadPromise=page.waitForEvent('download');await page.locator(`[data-${prefix}-export]`).click();const download=await downloadPromise;const file=await download.path();await page.locator(`[data-${prefix}-example]`).click();await page.locator(`[data-${prefix}-import]`).setInputFiles(file);await expect(page.locator(`#${prefix}-role`)).toHaveValue('Updated scenario 928');await expect(page.locator(`.${prefix}-${result}`)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
 });
}

test('exact manpower gap reaches both compensation and OD without rounding away headcount',async({page})=>{
 await setup(page,'#enterprise/manpower');await page.locator('[data-mp-example]').click();await page.locator('[data-mp-planning-options] > summary').click();
 for(const [key,value] of Object.entries({target:152,current:2,horizon:1,attrition:0,productivity:0}))await page.locator('#mp-'+key).fill(String(value));
 await page.locator('[data-mp-run]').click();await expect(page.locator('[data-mp-option="buy"]')).toContainText('Up to 2 position');await page.locator('[data-cp-from-mp]').click();await expect(page.locator('#cp-headcount')).toHaveValue('2');
 await page.goto(BASE+'#enterprise/manpower');await page.locator('[data-mp-od]').click();await expect(page.locator('[data-number="headcount"]')).toHaveValue('2');await expect(page.locator('[data-od-strategy]')).toHaveValue(/Human Capital transformation/);await expect(page.locator('[data-od-department]')).toHaveValue('Human Capital');
 await page.goto(BASE+'#enterprise/manpower');await page.locator('#mp-current').fill('10');await page.locator('[data-mp-run]').click();await expect(page.locator('[data-cp-from-mp]')).toHaveCount(0);await expect(page.locator('[data-mp-od]')).toHaveCount(0);await expect(page.locator('.mp-hold')).toContainText('Redeploy before hiring');
});

test('financial reporting recommendations exclude unrelated labor inspection',async({page})=>{
 await setup(page,'#demo','ar');await page.locator('#objective').fill('رفع دقة التقارير المالية وتسريع الإقفال الشهري');await page.locator('#role-form button[type=submit]').click();await expect(page.locator('[data-demo-ref]').first()).toBeVisible();await expect(page.locator('#result-content')).not.toContainText('111219');await expect(page.locator('#result-content')).toContainText('مالي');
});

test('local institution editor rejects a reporting cycle before saving',async({page})=>{
 await setup(page,'#enterprise/create');await page.locator('[data-inst-open]').click();await page.locator('[data-inst-example]').click();await page.locator('[data-inst-units]').fill('A | أ | A | B\nB | ب | B | A');await page.locator('[data-inst-save]').click();await expect(page.locator('[data-inst-message]')).toContainText('reporting cycle');await expect(page.locator('.institution-dialog .institution-status')).toContainText('Not configured');
});
