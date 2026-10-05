const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const BASE='http://127.0.0.1:4173/';
async function open(page,tab,lang){
 await page.addInitScript(lang=>localStorage.setItem('miyar-language',lang),lang);
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Guest acceptance'}}));
 await page.goto(BASE+'#'+tab);
}
for(const lang of ['ar','en']){
 test('6.3.3 '+lang+': impossible position cost and individual-contributor reports cannot be saved',async({page})=>{
  await open(page,'enterprise/create',lang);await page.locator('#ent-sample').click();
  await expect(page.locator('[data-od-strategy]')).not.toHaveValue('');
  await page.locator('[data-number="headcount"]').fill('25');await expect(page.locator('[data-number="annualCost"]')).toHaveValue('6000000');
  await page.locator('[data-field="costBasis"]').selectOption('manual-exception');
  await page.locator('[data-field="costExceptionReason"]').fill('Documented manual exception to test the implausible annual cost guard.');
  await page.locator('[data-number="annualCost"]').fill('1000');
  await page.locator('#ent-save').click();await expect(page.locator('[data-number="annualCost"]')).toBeFocused();
  await expect(page.locator('[data-number="annualCost"]')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('.ent-form-actions + [data-action-feedback]')).toHaveAttribute('role','alert');
  await page.locator('#ent-sample').click();await page.locator('[data-number="directReports"]').fill('40');
  await page.locator('#ent-save').click();await expect(page.locator('[data-number="directReports"]')).toBeFocused();
  await expect(page.locator('[data-number="directReports"]')).toHaveAttribute('aria-invalid','true');
  await page.goto(BASE+'#enterprise/workspace');await expect(page.locator('[data-position]')).toHaveCount(0);
 });
 test('6.3.3 '+lang+': evaluation needs a named revision and inconsistent factors need a rationale',async({page})=>{
  await open(page,'enterprise/grading',lang);await page.locator('#ent-calculate').click();
  await expect(page.locator('#ent-grade-position')).toBeFocused();await expect(page.locator('#ent-grade-position')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#ent-grade-feedback')).toHaveAttribute('role','alert');
  await page.goto(BASE+'#enterprise/create');await page.locator('#ent-sample').click();await page.locator('#ent-save-open').click();
  await expect(page.locator('#ent-position-detail h3')).toBeVisible();await page.goto(BASE+'#enterprise/grading');
  await page.locator('#ent-grade-position').selectOption('0');await expect(page.locator('#ent-grade-position-context')).toContainText(/v1/);
  for(const id of ['knowledge','complexity','impact','autonomy','people','communication','financial','conditions']){
   await page.locator('[data-factor="'+id+'"]').selectOption(id==='people'?'6':'1');
   await page.locator('[data-factor-evidence="'+id+'"]').fill('Documented responsibilities and explicitly delegated decision authority support the '+id+' factor.');
  }
  await page.locator('#ent-calculate').click();await expect(page.locator('[data-grade-justification]')).toBeFocused();
  await expect(page.locator('[data-grade-justification]')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#ent-grade-result')).toBeEmpty();
  await page.locator('[data-grade-justification]').fill('A documented temporary matrix assignment explains the inconsistent factors; the committee must review this exception.');
  await page.locator('#ent-calculate').click();await expect(page.locator('#ent-grade-result')).toContainText('G03');
  await expect(page.locator('#ent-grade-result')).toContainText('v1');await expect(page.locator('#ent-grade-to-compensation')).toHaveCount(0);
 });
 test('6.3.3 '+lang+': one language switch is exposed and short requirement actions never wrap',async({page})=>{
  await open(page,'home',lang);await expect(page.getByRole('button',{name:lang==='ar'?'Switch to English':'Switch to Arabic',exact:true})).toHaveCount(1);
  await page.goto(BASE+'#enterprise/review');await expect(page.getByRole('button',{name:lang==='ar'?'Switch to English':'Switch to Arabic',exact:true})).toHaveCount(1);
  const actions=page.locator('[data-review-tab]');await expect(actions).toHaveCount(7);
  for(const action of await actions.all())expect(await action.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
  await page.setViewportSize({width:390,height:844});
  expect(await actions.first().evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(35);
 });
}
test('6.3.3: structure finds English mismatch, hierarchy inversion and partial row errors',async({page})=>{
 await open(page,'enterprise/bulk','en');
 const csv='positionId,parentPositionId,grade,title,department,occupationCode,directReports,budgetAmount,authority\nP1,,G12,Chief Executive,Executive,112002,2,100000,Approves\nP2,P1,G07,Software Engineer,IT,251204,0,50000,Recommends\nP3,P2,G08,Accountant,Finance,251204,0,25000,Recommends\nP4,P1,G01,عامل نظافة,Services,911201,−3,10000,Recommends\nP5,P1,G02,,Services,911201,0,10000,Recommends\nP6,P1,G04,Nurse,Health,222101,0,90000000,All\n';
 await page.locator('#ent-bulk-file').setInputFiles({name:'expert-structure.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.locator('#ent-bulk-run').click();
 await expect(page.locator('#ent-bulk-result')).not.toBeEmpty();const pending=page.waitForEvent('download');await page.locator('#ent-bulk-export').click();const download=await pending,result=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 expect(result.totalRows).toBe(6);expect(result.validRows).toBe(5);expect(result.rowErrors).toHaveLength(1);expect(result.rowErrors[0].row).toBe(6);
 expect(result.rows[1].titleCodeStatus).toBe('matched');expect(result.rows[2].titleCodeStatus).toBe('inconsistent');expect(result.rows[3].flags).toContain('invalid_direct_reports');
 expect(result.hierarchy.layers).toBe(3);expect(result.hierarchy.gradeInversions).toContainEqual(expect.objectContaining({positionId:'P3',parentPositionId:'P2'}));
 expect(result.rows[5].flags).toContain('absolute_authority');expect(result.rows[5].flags).toContain('budget_outlier');
});
