const {test,expect}=require('@playwright/test');
test('switching Arabic-English-Arabic keeps both planning tools in the sidebar and opens their calculators',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('miyar-language','ar'));
 await page.route('https://miyar-enterprise-api.onrender.com/**',route=>route.fulfill({status:401,json:{detail:'Synthetic anonymous acceptance'}}));
 await page.goto('http://127.0.0.1:4173/#demo');
 const mp=page.locator('.sidebar nav.nav-list [data-manpower-nav]'),cp=page.locator('.sidebar nav.nav-list [data-comp-nav]');
 for(const [lang,mpLabel,cpLabel] of [['ar','تخطيط القوى العاملة','التعويضات'],['en','Manpower planning','Compensation'],['ar','تخطيط القوى العاملة','التعويضات']]){
  if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#language-btn').click();
  await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page).toHaveURL(/#demo$/);
  await expect(mp).toHaveCount(1);await expect(cp).toHaveCount(1);await expect(mp).toBeVisible();await expect(cp).toBeVisible();await expect(mp).toContainText(mpLabel);await expect(cp).toContainText(cpLabel);
 }
 await mp.click();await expect(page).toHaveURL(/#enterprise\/manpower$/);await expect(page.locator('[data-mp-run]')).toBeVisible();
 await cp.click();await expect(page).toHaveURL(/#enterprise\/compensation$/);await expect(page.locator('[data-cp-run]')).toBeVisible();
});
