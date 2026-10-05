const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
// Synthetic organization-band inputs reproduce the expert's public calculation;
// no employee identity, account or live salary data is used.
async function open(page,locale){await page.addInitScript(locale=>localStorage.setItem('miyar-language',locale),locale);await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local acceptance'}}));await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('[data-cp-run]')).toBeVisible();}
async function example(page){await page.locator('[data-cp-example]').click();await page.locator('#cp-current').fill('30000');}
async function calculate(page){await page.locator('[data-cp-run]').click();}
for(const locale of ['en','ar']){
 test('compensation: Saudi optional contributory blank calculates exact expert cost and explains rates '+locale,async({page})=>{
  await open(page,locale);await example(page);
  for(const [id,value]of Object.entries({min:'8000',mid:'10000',max:'12000',current:'10000',oncost:'0',source:'Synthetic approved band for acceptance test only'}))await page.locator('#cp-'+id).fill(value);
  await page.locator('details').filter({has:page.locator('#cp-saudi')}).locator('summary').click();
  await page.locator('#cp-saudi').check();await page.locator('#cp-applicability').check();await page.locator('#cp-saned').check();await page.locator('#cp-regime').selectOption('saudi-new');
  for(const [id,value]of Object.entries({housing:'2500',othercash:'500',contributory:'',medical:'6000',service:'7',asof:'2026-10-05'}))await page.locator('#cp-'+id).fill(value);
  await calculate(page);await expect(page.locator('.cp-result')).toBeVisible();await expect(page.locator('.cp-result')).toContainText(locale==='ar'?'١٩٤٬١٢٥':'194,125');
  const rates=page.locator('.cp-gosi-components tbody tr');await expect(rates).toHaveCount(3);await expect(rates.nth(0)).toContainText('10%');await expect(rates.nth(0)).toContainText('2026-07-01');await expect(rates.nth(1)).toContainText('0.75%');await expect(rates.nth(2)).toContainText('2%');await expect(rates.nth(0).locator('a')).toHaveAttribute('href','https://awareness.gosi.gov.sa/businessJourney.html');await expect(page.locator('#cp-contributory')).toHaveValue('');
 });
 test('compensation: midpoint is Q2 with two decimal compa-ratio '+locale,async({page})=>{
  await open(page,locale);await example(page);await calculate(page);await expect(page.locator('.cp-result')).toContainText(locale==='ar'?'الربع الثاني من النطاق':'Second range quartile');await expect(page.locator('.cp-result')).toContainText(locale==='ar'?'١٫٠٠':'1.00');
  if(locale==='ar')await expect(page.locator('#cp-role')).toHaveValue('مدير مشاريع وعمليات رأس المال البشري');
 });
 test('compensation: blank currency focuses invalid field and spaces are trimmed '+locale,async({page})=>{
  await open(page,locale);await example(page);await page.locator('#cp-currency').fill('');await calculate(page);await expect(page.locator('#cp-currency')).toBeFocused();await expect(page.locator('#cp-currency')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#cp-currency')).toHaveAttribute('aria-errormessage','cp-message');await expect(page.locator('[data-cp-message]')).toContainText(locale==='ar'?'حقل العملة مطلوب':'Currency is required');await expect(page.locator('.cp-result')).toHaveCount(0);
  await page.locator('#cp-currency').fill(' sar ');await calculate(page);await expect(page.locator('.cp-result')).toBeVisible();await expect(page.locator('#cp-currency')).not.toHaveAttribute('aria-invalid','true');
 });
 test('compensation: numeric zero has positive-value error and missing approved band names grade '+locale,async({page})=>{
  await open(page,locale);await example(page);await page.locator('#cp-min').fill('0');await calculate(page);await expect(page.locator('#cp-min')).toBeFocused();await expect(page.locator('#cp-min')).toHaveAttribute('aria-invalid','true');await expect(page.locator('[data-cp-message]')).toContainText(locale==='ar'?'أكبر من صفر':'greater than zero');
  await page.locator('#cp-grade').fill('G01');await page.locator('[data-audit-bands] summary').click();await page.locator('[data-band-apply]').click();await expect(page.locator('#audit-band-status')).toContainText(locale==='ar'?'لا يوجد نطاق معتمد للدرجة G01':'No approved band for grade G01');await expect(page.locator('[data-cp-message]')).toContainText(locale==='ar'?'استورد ملف النطاقات':'Import the salary-band file');
 });
}

for(const locale of ['en','ar'])test('compensation: progressive fields explain their purpose and expand only when needed '+locale,async({page})=>{
 await open(page,locale);
 await expect(page.locator('[data-cp-essentials] input,[data-cp-essentials] select')).toHaveCount(7);await expect(page.locator('#cp-role')).not.toBeVisible();await expect(page.locator('#cp-source')).not.toBeVisible();for(const [id,value]of Object.entries({min:'8000',mid:'10000',max:'12000'}))await page.locator('#cp-'+id).fill(value);await calculate(page);await expect(page.locator('#cp-source')).toBeFocused();await expect(page.locator('#cp-source')).toHaveAttribute('aria-invalid','true');await expect(page.locator('[data-cp-message]')).toContainText(locale==='ar'?'مصدر نطاق الراتب':'salary-band source');await page.locator('[data-cp-position-panel]>summary').click();
 await expect(page.locator('#cp-current')).toBeVisible();await expect(page.locator('#cp-min')).toBeVisible();await expect(page.locator('#cp-mid')).toBeVisible();await expect(page.locator('#cp-max')).toBeVisible();
 await expect(page.locator('#cp-period-hint')).toContainText(locale==='ar'?'الشهري × 12':'monthly × 12');await expect(page.locator('#cp-source-hint')).toContainText(locale==='ar'?'مراجعة النطاق وإصداره':'review the range and its version');await expect(page.locator('#cp-current-hint')).toContainText(locale==='ar'?'الراتب الفعلي':'actual pay');
 await expect(page.locator('#cp-oncost')).not.toBeVisible();await expect(page.locator('#cp-target')).not.toBeVisible();await expect(page.locator('#cp-saudi')).not.toBeVisible();
 await page.locator('[data-cp-cost-panel]>summary').click();await expect(page.locator('#cp-oncost')).toBeVisible();await page.locator('#cp-oncost').fill('10');await page.locator('[data-cp-example]').click();await expect(page.locator('#cp-oncost')).toBeVisible();await expect(page.locator('#cp-oncost')).toHaveValue('15');
 await page.locator('[data-cp-progression-panel]>summary').click();await expect(page.locator('#cp-target')).toBeVisible();await expect(page.locator('#cp-policy-hint')).toContainText(locale==='ar'?'سياسة الجهة':'organization policy');
});

for(const locale of ['en','ar'])test('compensation: unsaved inputs survive navigation and language rebuilds '+locale,async({page})=>{
 await open(page,locale);await example(page);await page.locator('#cp-min').fill('23500');await page.locator('#cp-current').fill('28500');await page.locator('#cp-source').fill('Manual committee band revision 17');
 await page.goto(BASE+'#enterprise/manpower');await expect(page.locator('[data-mp-run]')).toBeVisible();await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('#cp-min')).toHaveValue('23500');await expect(page.locator('#cp-current')).toHaveValue('28500');await expect(page.locator('#cp-source')).toHaveValue('Manual committee band revision 17');
 await page.locator('#language-btn').click();await expect(page.locator('#cp-min')).toHaveValue('23500');await expect(page.locator('#cp-current')).toHaveValue('28500');await expect(page.locator('#cp-source')).toHaveValue('Manual committee band revision 17');await expect(page.locator('[data-cp-position-panel]')).toHaveAttribute('open','');
 await calculate(page);await expect(page.locator('.cp-result')).toBeVisible();await expect(page.locator('.cp-result')).toContainText(locale==='en'?'٢٨٬٥٠٠':'28,500');
});
