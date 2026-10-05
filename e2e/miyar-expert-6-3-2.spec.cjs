const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
async function open(page,route,locale='en'){await page.addInitScript(locale=>localStorage.setItem('miyar-language',locale),locale);await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local acceptance'}}));await page.goto(BASE+route);if(route==='#enterprise/create'){await page.locator('#miyar-od-advanced').waitFor();await page.locator('#miyar-od-advanced > summary').click();}}
const cases=[['Enter supplier invoices; match to POs; archive documents','Director',true],['Prepare accounting entries; reconcile bank accounts','Manager',true],['Prepare accounting entries; reconcile bank accounts; supervise two accountants','Manager',false],['Lead 25 accountants; approve financial statements; present to the board','Director',false],['Lead 25 accountants; approve financial statements; present to the board','Specialist',true]];
for(const [duties,level,blocked]of cases)test('visible requested-level field: '+duties+' / '+level,async({page})=>{await open(page,'#enterprise/create');await page.locator('[data-od-strategy]').fill('Deliver finance objectives');await page.locator('[data-od-department]').fill('Finance');await page.locator('[data-od-responsibilities]').fill(duties);await page.locator('[data-od-level]').fill(level);await page.locator('[data-od-generate]').click();if(blocked){await expect(page.locator('[data-od-status]')).toContainText(/conflict|Correct/i);await expect(page.locator('[data-od-result]')).toBeEmpty();}else{await expect(page.locator('[data-od-result]')).toContainText(/Accountant|Finance/);await expect(page.locator('[data-field=title]')).not.toHaveValue('');}});
test('short input waits for visible role selection and never applies an unconfirmed package',async({page})=>{await open(page,'#enterprise/create');await page.locator('[data-od-strategy]').fill('Improve collections');await page.locator('[data-od-department]').fill('Finance');await page.locator('[data-od-responsibilities]').fill('Review receivables');await page.locator('[data-od-generate]').click();await expect(page.locator('[data-od-status]')).toContainText('Awaiting role confirmation');await expect(page.locator('[data-od-result] button')).toHaveCount(3);await page.locator('[data-od-result] button').filter({hasText:'AR Accountant'}).click();await expect(page.locator('[data-field=title]')).toHaveValue('AR Accountant');});
test('home defers the workspace download and navigation loads it once',async({page})=>{const urls=[];page.on('request',r=>urls.push(r.url()));await open(page,'#home');await expect(page.locator('#lp-guided-form')).toBeVisible();expect(urls.filter(x=>/miyar-workspace-/.test(x))).toHaveLength(0);await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('[data-cp-run]')).toBeVisible();expect(urls.filter(x=>/miyar-workspace-/.test(x))).toHaveLength(1);});

for(const [duties,level,blocked]of [
 ['إدخال فواتير الموردين، مطابقتها، أرشفة المستندات','مدير إدارة',true],
 ['إعداد القيود؛ تسوية الحسابات البنكية','مدير',true],
 ['إعداد القيود؛ تسوية الحسابات؛ يشرف على محاسبين اثنين','مدير',false],
 ['يقود 25 محاسباً؛ يعتمد القوائم؛ يعرض على المجلس','مدير إدارة',false],
 ['يقود 25 محاسباً؛ يعتمد القوائم؛ يعرض على المجلس','أخصائي',true]
])test('Arabic requested-level field: '+duties+' / '+level,async({page})=>{
 await open(page,'#enterprise/create','ar');
 await page.locator('[data-od-strategy]').fill('تحقيق أهداف الإدارة');
 await page.locator('[data-od-department]').fill('المالية');
 await page.locator('[data-od-responsibilities]').fill(duties);
 await page.locator('[data-od-level]').fill(level);
 await page.locator('[data-od-generate]').click();
 if(blocked){await expect(page.locator('[data-od-status]')).toContainText(/أعلى|تعارض|صحح|صحّح/);await expect(page.locator('[data-od-result]')).toBeEmpty();}
 else{await expect(page.locator('[data-od-result]')).not.toBeEmpty();await expect(page.locator('[data-field=title]')).not.toHaveValue('');}
});

test('reporting recipient cannot confer leadership through a relative clause',async({page})=>{
 await open(page,'#enterprise/create');
 await page.locator('[data-od-strategy]').fill('Deliver finance objectives');
 await page.locator('[data-od-department]').fill('Finance');
 await page.locator('[data-od-responsibilities]').fill('Prepare accounting entries; reconcile bank accounts; reports to a Finance Director, who leads forty accountants and approves consolidated statements');
 await page.locator('[data-od-generate]').click();
 await expect(page.locator('[data-od-result]')).not.toBeEmpty();
 await expect(page.locator('[data-field=title]')).not.toHaveValue(/Director|Manager/);
 await expect(page.locator('[data-number=directReports]')).toHaveValue('');
});
