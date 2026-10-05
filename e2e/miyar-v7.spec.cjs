const {test,expect}=require('@playwright/test');
const BASE=process.env.MIYAR_E2E_BASE||'http://127.0.0.1:4173/';
const fs=require('fs');
async function open(page,route,lang='en'){
 await page.addInitScript(lang=>localStorage.setItem('miyar-language',lang),lang);
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Guest acceptance'}}));
 await page.goto(BASE+'#enterprise/'+route);
}
for(const lang of ['ar','en'])test('v7 '+lang+' KPI field errors block opening and keep draft saving',async({page})=>{
 await open(page,'create',lang);await page.locator('#ent-sample').click();
 for(const key of ['baseline','target','duration']){
  const cell=page.locator('#ent-kpi-matrix [data-matrix-field="'+key+'"]').first(),value=await cell.inputValue();await cell.fill('');await page.locator('#ent-save-open').click();
  await expect(cell).toHaveAttribute('aria-invalid','true');await expect(cell.locator('xpath=following-sibling::small[1]')).toBeVisible();await expect(page).toHaveURL(/#enterprise\/create$/);
  await page.locator('#ent-save').click();await expect(page.locator('[data-number="annualCost"]')).toHaveValue('240000');await cell.fill(value);
 }
 await page.locator('#ent-save-open').click();await expect(page.locator('#ent-position-detail h3')).toBeVisible();
});

for(const lang of ['ar','en'])test('v7 '+lang+' G06 stays linked through navigation, reload, compensation and planning',async({page})=>{
 await open(page,'create',lang);await page.locator('#ent-sample').click();await page.locator('#ent-save-open').click();await expect(page.locator('#ent-position-detail h3')).toBeVisible();
 await page.goto(BASE+'#enterprise/grading');await page.locator('#ent-grade-position').selectOption('0');
 const levels={knowledge:'3',complexity:'3',impact:'3',autonomy:'2',people:'2',communication:'2',financial:'2',conditions:'2'};
 for(const [id,level]of Object.entries(levels)){await page.locator('[data-factor="'+id+'"]').selectOption(level);await page.locator('[data-factor-evidence="'+id+'"]').fill('The documented role responsibility and delegated authority specifically support the '+id+' factor.');await page.locator('[data-second-factor="'+id+'"]').selectOption(level);}
 await page.locator('[data-evaluator="0"]').fill('Independent reviewer A');await page.locator('[data-evaluator="1"]').fill('Independent reviewer B');
  await page.goto(BASE+'#enterprise/reference');await page.goto(BASE+'#enterprise/grading');await expect(page.locator('[data-factor="knowledge"]')).toHaveValue('3');await expect(page.locator('[data-factor-evidence="impact"]')).toHaveValue(/impact factor/);
 await page.locator('#ent-bind-grade').click();await expect(page.locator('#ent-grade-result')).toContainText('G06');
 await page.goto(BASE+'#enterprise/compensation');await expect(page.locator('#cp-grade')).toHaveValue('G06');await expect(page.locator('#cp-position')).not.toHaveValue('');
 await page.locator('[data-cp-reviewed-band]').click();await expect(page.locator('#cp-mid')).toHaveValue('20000');await page.locator('[data-cp-cost-panel] > summary').click();await page.locator('#cp-oncost').fill('15');await page.locator('[data-cp-run]').click();
 await expect(page.locator('.cp-result')).toContainText(lang==='ar'?'٢٧٦':'276');
 await page.reload();await expect(page.locator('#cp-grade')).toHaveValue('G06');await expect(page.locator('#cp-oncost')).toHaveValue('15');await expect(page.locator('#cp-position')).not.toHaveValue('');await page.locator('[data-cp-run]').click();
 expect(await page.evaluate(()=>window.MiyarCompensationWorkbench.getCostContext().annualEmployerCost)).toBe(276000);
 await page.goto(BASE+'#enterprise/manpower');await expect(page.locator('#mp-grade')).toHaveValue('G06');await expect(page.locator('#mp-cost')).toHaveValue('276000');
 await page.goto(BASE+'#enterprise/workspace');await page.locator('[data-position]').first().click();await page.locator('#ent-edit-position').click();await expect(page.locator('[data-number="annualCost"]')).toHaveValue('276000');await expect(page.locator('#ent-position-cost-info')).toContainText(lang==='ar'?'أعباء صاحب العمل':'Employer charges');
 await page.screenshot({path:'test-results/v7-cost-linked-'+lang+'.png',fullPage:true});
});

test('v7 public changelog names all fifteen items and independent acceptance limits',async({page})=>{
 await page.goto(BASE+'trust.html#changes');for(let i=1;i<=15;i++)await expect(page.locator('#trust-main')).toContainText('V7-'+String(i).padStart(2,'0'));await expect(page.locator('#trust-main')).toContainText('500');
});
