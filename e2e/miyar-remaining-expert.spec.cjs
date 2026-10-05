const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
async function open(page,route,lang='en'){
  await page.addInitScript(value=>localStorage.setItem('miyar-language',value),lang);
  await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local review only'}}));
  await page.goto(BASE+route);if(route==='#enterprise/create'){await page.locator('#miyar-od-advanced').waitFor();await page.locator('#miyar-od-advanced > summary').click();}
}
test('Arabic leadership count reaches the actual position form, and conflicting regeneration clears the previous package',async({page})=>{
  await open(page,'#enterprise/create','ar');
  await page.locator('[data-od-strategy]').fill('ضبط إقفال الحسابات المالية');
  await page.locator('[data-od-department]').fill('المالية');
  await page.locator('[data-od-responsibilities]').fill('قيادة فريق من ٢٥ محاسبًا، اعتماد القوائم الموحدة، عرض الميزانية على المجلس');
  await page.locator('[data-od-generate]').click();
  await expect(page.locator('[data-od-result]')).toContainText('مدير إدارة مالية');
  await expect(page.locator('[data-number="directReports"]')).toHaveValue('25');
  await expect(page.locator('[data-field="title"]')).toHaveValue('مدير إدارة مالية');
  await expect(page.locator('[data-field="seniority"]')).toHaveValue(/مدير إدارة/);
  await page.locator('[data-od-responsibilities]').fill('إعطاء الأدوية، مراقبة العلامات الحيوية، توثيق خطط الرعاية');
  await page.locator('[data-od-generate]').click();
  await expect(page.locator('[data-od-status]')).toContainText(/تعارض|تصحيح|صحح/);
  await expect(page.locator('[data-od-result]')).toBeEmpty();
  await expect(page.locator('[data-od-apply]')).toHaveCount(0);
  await expect(page.locator('[data-od-blocked]')).toBeVisible();
  await expect(page.locator('[data-field="title"]')).toHaveValue('مدير إدارة مالية');
  for(const id of ['ent-save','ent-save-open','ent-local-json','ent-preview-draft','ent-html-draft','ent-pdf-draft'])await expect(page.locator('#'+id)).toBeDisabled();
  await page.evaluate(()=>{const button=document.querySelector('#ent-local-json');button.disabled=false;button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));});
  await expect(page.locator('#ent-local-json')).toBeDisabled();
  await page.locator('[data-od-responsibilities]').fill('قيادة فريق من 6 محاسبين، اعتماد القيود المحاسبية، مراجعة إقفال الحسابات');
  await page.locator('[data-od-generate]').click();
  await expect(page.locator('[data-number="directReports"]')).toHaveValue('6');
  await expect(page.locator('[data-od-blocked]')).toBeHidden();
  for(const id of ['ent-save','ent-save-open','ent-local-json','ent-preview-draft','ent-html-draft','ent-pdf-draft'])await expect(page.locator('#'+id)).toBeEnabled();
  await page.locator('[data-od-department]').fill('الموارد البشرية');
  await page.locator('[data-od-strategy]').fill('رفع دقة مسيرات الرواتب');
  await page.locator('[data-od-responsibilities]').fill('إعداد الرواتب الشهرية، تسوية التأمينات، حساب نهاية الخدمة');
  await page.locator('[data-od-generate]').click();
  await expect(page.locator('[data-field="title"]')).toHaveValue('أخصائي رواتب');
  await expect(page.locator('[data-number="directReports"]')).toHaveValue('');
});
test('sensitive typed roster is rejected, cleared and never stored, while pseudonyms calculate',async({page})=>{
  await open(page,'#enterprise/compensation');
  await page.locator('[data-cp-example]').click();
  await page.locator('details').filter({has:page.locator('#cp-roster')}).locator('summary').click();
  await page.locator('#cp-roster').fill('id,currentSalary\n1012345678,25000');
  await page.locator('[data-cp-run]').click();
  await expect(page.locator('[data-cp-message]')).toContainText(/pseudonymous|pattern/i);
  await expect(page.locator('#cp-roster')).toHaveValue('');
  await expect(page.locator('[data-cp-result]')).toBeEmpty();
  await expect(page.locator('body')).not.toContainText('1012345678');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('1012345678');
  await page.locator('#cp-roster').fill('id,currentSalary\nEMP-0001,25000\nE17,23000');
  await page.locator('[data-cp-run]').click();
  await expect(page.locator('.cp-roster-results')).toContainText('EMP-0001');
  await expect(page.locator('.cp-roster-results')).toContainText('E17');
});
test('quick recommendation stops on a severe field conflict without showing a usable title',async({page})=>{
  await open(page,'#demo');
  await page.locator('#demo-context-fields > summary').click();
  await page.locator('#domain').fill('Finance');
  await page.locator('#objective').fill('Administer medication; monitor vital signs; document nursing care plans.');
  await page.locator('#role-form button[type=submit]').click();
  await expect(page.locator('#result-content')).toContainText(/conflict|correct/i);
  await expect(page.locator('[data-demo-primary-hr]')).toHaveCount(0);
  await expect(page.locator('.demo-final-title')).toHaveCount(0);
});
