const {test,expect}=require('@playwright/test');
test('added functions accept detailed examples and retain the source into OD',async({page})=>{
 await page.goto('http://127.0.0.1:4173/#demo');
 await page.locator('[data-hr-coverage] summary').click();
 for(const id of ['projectDevelopment','investment','internalAudit','strategy','pmo']){
  await page.locator(`[data-hr-example=${id}]`).click();
  await expect(page.locator('.demo-v5-primary-recommendation')).toHaveAttribute('data-role-family',id);
  await expect(page.locator('.hr-context')).toBeVisible();
  await expect(page.locator('.demo-v5-directory')).toHaveCount(1);
 }
 await page.locator('[data-demo-primary-hr]').click();
 await expect(page).toHaveURL(/#enterprise\/create$/);
 await expect(page.locator('[data-field=occupationCode]')).toHaveValue('242114');
});
test('four HR tools have readable guides and a working skill example on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const id of ['manpower','compensation','intelligence','grading']){
  await page.goto('http://127.0.0.1:4173/#enterprise/'+id);
  const guide=page.locator(`[data-hr-guide=${id}]`);await expect(guide).toBeVisible();await guide.locator('summary').click();
  await expect(guide.locator('dd')).toHaveCount(5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  if(id==='intelligence'){await guide.locator('[data-hr-load-example]').click();await expect(page.locator('#ent-skills .ent-skill-grid > div')).toHaveCount(3);}
 }
});
