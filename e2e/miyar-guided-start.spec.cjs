const {test,expect}=require('@playwright/test');

test('a new user can go from one objective to a recommendation without retyping',async({page})=>{
  await page.goto('http://127.0.0.1:4173/#home');
  await expect(page.locator('#lp-guided-form')).toBeVisible();
  await page.fill('#lp-guided-objective','رفع اعتمادية الأنظمة الميكانيكية وتقليل توقف المعدات عبر الصيانة الوقائية وتحسين إجراءات التشغيل');
  await page.locator('#lp-guided-form button[type="submit"]').click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(page.locator('#objective')).toHaveValue(/اعتمادية الأنظمة الميكانيكية/);
  await expect(page.locator('#result-content')).toContainText(/مهندس ميكانيكي|Mechanical Engineer/);
  await expect(page.locator('#result-content')).toContainText(/214401/);
});

test('a user who already knows the role has a direct path to position design',async({page})=>{
  await page.goto('http://127.0.0.1:4173/#home');
  const direct=page.locator('.lp-guided-actions a[href="#enterprise/create"]');
  await expect(direct).toBeVisible();
  await direct.click();
  await expect(page).toHaveURL(/#enterprise\/create$/);
});

test('the simplified start remains usable on a phone viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/#home');
  await expect(page.locator('#lp-guided-objective')).toBeVisible();
  await expect(page.locator('#lp-guided-form button[type="submit"]')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
