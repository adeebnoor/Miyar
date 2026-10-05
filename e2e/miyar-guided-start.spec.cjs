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


async function runGuided(page,objective){
  await page.goto('http://127.0.0.1:4173/#home');
  await page.fill('#lp-guided-objective',objective);
  await page.locator('#lp-guided-form button[type="submit"]').click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(page.locator('#result-content')).toContainText(/OUTPUT GENERATED|تم إنشاء مخرج/);
  return page.locator('#result-content');
}

test('long HR objective returns reviewable occupation references instead of an empty result',async({page})=>{
  const result=await runGuided(page,'Improve employee retention, workforce planning and talent development across human resources.');
  await expect(result.locator('.demo-v5-directory')).toBeVisible();
  await expect(result.locator('.demo-v5-directory')).toContainText(/Human Capital|رأس المال البشري/);
  await expect(result.locator('[data-demo-ref]').first()).toBeVisible();
});

test('finance, technology and operations objectives always produce a visible actionable result',async({page})=>{
  const objectives=[
    'Improve financial reporting accuracy, accounting close, budgeting and cost control.',
    'Improve software platform quality, digital service reliability and automation.',
    'Improve operating efficiency, service delivery quality and process performance.'
  ];
  for(const objective of objectives){
    const result=await runGuided(page,objective);
    await expect(result.locator('.demo-v5-output')).toBeVisible();
    const text=await result.innerText();
    expect(text.trim().length).toBeGreaterThan(80);
  }
});

test('major Miyar surfaces render without uncaught browser errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const routes=['#home','#demo','#enterprise/overview','#enterprise/create','#enterprise/reference','#enterprise/manpower','#enterprise/compensation','#enterprise/connection'];
  for(const route of routes){
    await page.goto('http://127.0.0.1:4173/'+route);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(120);
  }
  expect(errors).toEqual([]);
});


async function runDemoCase(page,{objective,domain='',seniority=''}) {
  await page.goto('http://127.0.0.1:4173/#demo');
  await page.fill('#objective',objective);
  if(domain)await page.fill('#domain',domain);
  if(seniority)await page.fill('#seniority',seniority);
  await page.locator('#role-form button[type="submit"]').click();
  await expect(page.locator('#result-content .demo-v5-output')).toBeVisible();
  return page.locator('#result-content');
}

test('HR payroll case from reviewer screenshot returns payroll and HR references',async({page})=>{
  const result=await runDemoCase(page,{objective:'اصدار مسير الرواتب للموظفين و رفع تقارير الى الادارة العليا',domain:'ادارة عامة',seniority:'اخصائي'});
  await expect(result.locator('.demo-v5-directory')).toBeVisible();
  await expect(result.locator('.demo-v5-directory')).toContainText(/اخصائي رواتب وبدلات|اختصاصي رواتب وأجور عمالة/);
  await expect(result.locator('.demo-v5-hr-all')).toBeVisible();
  await expect(result.locator('.demo-v5-hr-all')).toContainText(/أخصائي موارد بشرية/);
});

test('HR recruitment case from reviewer screenshot returns recruitment roles',async({page})=>{
  const result=await runDemoCase(page,{objective:'توظيف المرشحين',domain:'الموارد البشرية',seniority:'اخصائي'});
  await expect(result.locator('.demo-v5-directory')).toContainText(/أخصائي توظيف/);
  await expect(result.locator('.demo-v5-directory')).toContainText(/مدير توظيف/);
});

test('governance and compliance case returns reviewable source roles instead of no output',async({page})=>{
  const result=await runDemoCase(page,{objective:'إعداد دليل الحوكمة والالتزام للشركة و مصفوفة الصلاحيات',domain:'الحوكمة',seniority:'مدير'});
  await expect(result).toContainText(/أعلى|يتعارض/);await expect(result.locator('[data-demo-primary-hr]')).toHaveCount(0);
});

test('HR expanded directory exposes the curated source roles present in the supplied classification',async({page})=>{
  const result=await runDemoCase(page,{objective:'إدارة عمليات الموارد البشرية والتوظيف والرواتب وعلاقات الموظفين والتدريب',domain:'الموارد البشرية'});
  const details=result.locator('.demo-v5-hr-all');
  await expect(details).toBeVisible();
  await details.locator('summary').click();
  await expect(details).toContainText(/121202/);
  await expect(details).toContainText(/242303/);
  await expect(details).toContainText(/242305/);
  await expect(details).toContainText(/242322/);
  await expect(details).toContainText(/242402/);
  expect(await details.locator('[data-demo-hr-ref]').count()).toBeGreaterThanOrEqual(50);
});


test('exact HR-manager payroll case recommends أخصائي رواتب and keeps SSCO source title separate',async({page})=>{
  const result=await runDemoCase(page,{
    objective:'مسؤول عن إعداد ومعالجة رواتب الموظفين بدقة بشكل شهري، واعداد التقارير لمسيرات الرواتب مع ضمان الالتزام بسياسات الشركة والأنظمة واللوائح المعمول بها'
  });
  const primary=result.locator('.demo-v5-primary-recommendation');
  await expect(primary).toBeVisible();
  await expect(primary.locator('h4')).toHaveText('أخصائي رواتب');
  await expect(primary).toContainText('242322');
  await expect(primary).toContainText('اخصائي رواتب وبدلات');
});


test('HR expected-output engine returns one primary role for common HR work families',async({page})=>{
 const cases=[
  ['استقطاب وفرز المرشحين وإجراء المقابلات والتنسيق لإتمام التوظيف','أخصائي توظيف','242305'],
  ['إدارة المكافآت والحوافز والمزايا ومراجعة سياسات التعويضات','أخصائي مكافآت وتعويضات','242306'],
  ['إدارة المواهب وخطط التعاقب الوظيفي وتحديد الموظفين ذوي الإمكانات العالية','أخصائي مواهب','242307'],
  ['معالجة شكاوى الموظفين ودعم علاقات الموظفين وتطبيق السياسات الداخلية','أخصائي علاقات الموظفين','242302'],
  ['إعداد خطط القوى العاملة وتحليل الاحتياج المستقبلي والفجوات','أخصائي تخطيط القوى العاملة','242319'],
  ['تصميم وتنفيذ البرامج التدريبية وخطط التعلم والتطوير','أخصائي تدريب وتطوير','242402'],
  ['تطوير سياسات وممارسات الموارد البشرية ورفع كفاءة وظائف الموارد البشرية','أخصائي تطوير موارد بشرية','242404'],
  ['تصميم الهياكل التنظيمية وتحسين الأدوار ونطاقات المسؤولية','أخصائي تطوير تنظيمي','242109'],
  ['تحليل الوظائف وتحديث الأوصاف وتصنيف الوظائف','محلل وظائف','242323'],
  ['إدارة ملفات الموظفين والإجازات والإجراءات المتعلقة بشؤون الموظفين','أخصائي شؤون موظفين','242310'],
  ['تشغيل خدمات الموارد البشرية اليومية وتحسين إجراءات الخدمة','أخصائي عمليات موارد بشرية','242303']
 ];
 for(const [objective,title,code] of cases){
  await test.step(title+' | '+code,async()=>{
   const result=await runDemoCase(page,{objective});
   const primary=result.locator('.demo-v5-primary-recommendation');
   await expect(primary,'Missing primary recommendation for: '+objective).toBeVisible();
   await expect(primary.locator('h4'),'Wrong primary title for: '+objective).toHaveText(title);
   await expect(primary,'Missing source code for: '+objective).toContainText(code);
  });
 }
});

test('entered manager level changes HR recommendation to the corresponding manager role',async({page})=>{
 const cases=[
  ['إدارة التوظيف والاستقطاب ومتابعة مؤشرات التعيين','مدير','مدير توظيف','121206'],
  ['إدارة الرواتب والبدلات واعتماد دورة المسير والتقارير','مدير','مدير الرواتب والبدلات','121210'],
  ['إدارة المواهب والتعاقب الوظيفي وتنمية القيادات','مدير','مدير مواهب','121208'],
  ['إدارة تخطيط القوى العاملة وربط الاحتياج بالخطة الاستراتيجية','مدير','مدير القوى العاملة','121203'],
  ['إدارة عمليات الموارد البشرية والخدمات اليومية للموظفين','مدير','مدير عمليات الموارد البشرية','121214']
 ];
 for(const [objective,seniority,title,code] of cases){
  await test.step(title+' | '+code,async()=>{
   const result=await runDemoCase(page,{objective:objective+'؛ يقود خمسة موظفين؛ يعتمد خطط العمل',seniority});
   const primary=result.locator('.demo-v5-primary-recommendation');
   await expect(primary,'Missing manager recommendation for: '+objective).toBeVisible();
   await expect(primary.locator('h4'),'Wrong manager title for: '+objective).toHaveText(title);
   await expect(primary,'Missing manager source code for: '+objective).toContainText(code);
  });
 }
});

test('HR recommendation replaces failure-like review heading with a clear preliminary recommendation',async({page})=>{
 const result=await runDemoCase(page,{objective:'مسؤول عن إعداد ومعالجة رواتب الموظفين بدقة بشكل شهري وإعداد تقارير مسير الرواتب'});
 await expect(result.locator('.demo-v5-output > h3')).toHaveText('الترشيح الأولي');
 await expect(result.locator('.demo-v5-output')).toHaveClass(/good/);
 await expect(result.locator('.demo-v5-output')).not.toContainText('تم إنشاء مخرج — يحتاج مراجعة');
});
