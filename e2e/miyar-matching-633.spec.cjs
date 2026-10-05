const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
async function trial(page,locale,goal){
 await page.addInitScript(locale=>localStorage.setItem('miyar-language',locale),locale);
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local acceptance'}}));
 await page.goto(BASE+'#demo');
 await page.locator('#demo-engine-mode').selectOption('rules');
 await page.locator('#objective').fill(goal);
 await page.locator('#role-form button[type=submit]').click();
}
for(const [ar,en,code] of [
 ['تنظيف المكاتب يومياً','Clean the offices every day','911201'],
 ['قيادة سيارة الرئيس التنفيذي','Drive the chief executive in a car','832201'],
 ['تعليم الرياضيات لطلاب الثانوي','Teach mathematics to secondary students','233010'],
 ['تطوير تطبيقات الويب وكتابة الكود','Develop web applications and write source code','251204'],
 ['بناء مستودع بيانات ولوحات المعلومات','Build a data warehouse and dashboards','242102']
])for(const locale of ['ar','en'])test('visible rules recommendation '+code+' / '+locale,async({page})=>{
 await trial(page,locale,locale==='ar'?ar:en);
 const primary=page.locator('.demo-v5-primary-recommendation');await expect(primary).toBeVisible();await expect(primary.locator('.demo-v5-primary-source')).toContainText(code);
 await expect(primary.locator('[data-education-default]')).not.toBeEmpty();await expect(primary).not.toContainText('To be specified');
});
for(const locale of ['ar','en'])test('nurse retention remains a work-design question / '+locale,async({page})=>{
 await trial(page,locale,locale==='ar'?'خفض دوران الممرضين وتحسين سلامة المرضى':'Reduce nurse turnover in ICU and improve patient safety');
 const output=page.locator('#result-content');await expect(output).toContainText(locale==='ar'?'ليس دليلاً على الحاجة إلى وظيفة':'not evidence that a new position');
 await expect(output.locator('[data-check=domain][data-status=pass]')).toHaveCount(0);await expect(output.locator('.demo-final-title')).toHaveCount(0);await expect(output.locator('[data-demo-primary-hr]')).toHaveCount(0);
});
for(const locale of ['ar','en'])test('recruit software engineers separates actor from object / '+locale,async({page})=>{
 await trial(page,locale,locale==='ar'?'توظيف مهندسي البرمجيات':'Recruit software engineers');
 const options=page.locator('#result-content [data-confirm-role]');await expect(options).toHaveCount(2);await expect(options.nth(0)).toContainText('242305');await expect(options.nth(1)).toContainText('251204');
 await expect(page.locator('#result-content .demo-final-title')).toHaveCount(0);
});
for(const locale of ['ar','en'])test('random text rejects without output-generated label / '+locale,async({page})=>{
 await trial(page,locale,'asdf qwer zxcv');const output=page.locator('#result-content');await expect(output).toContainText(locale==='ar'?'لم يُنشأ أي مخرج':'no job output was generated');
 await expect(output).not.toContainText(/OUTPUT GENERATED|Output generated — review required|تم إنشاء مخرج/);await expect(output.locator('.demo-final-title')).toHaveCount(0);
});
