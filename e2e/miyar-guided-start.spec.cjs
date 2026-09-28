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
