const {test,expect}=require('@playwright/test');
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
