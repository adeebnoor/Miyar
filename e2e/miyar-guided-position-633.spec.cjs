const {test,expect}=require('@playwright/test');
for(const locale of ['ar','en'])test('guided position suggests source-linked fields, preserves edits and reveals validation / '+locale,async({page})=>{
 const ar=locale==='ar',manualTitle=ar?'مسماي المخصص للمراجعة':'My custom position title';
 await page.addInitScript(locale=>localStorage.setItem('miyar-language',locale),locale);
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local acceptance'}}));
 await page.goto('http://127.0.0.1:4173/#enterprise/create');
 for(const key of ['businessNeed','responsibilities','title','successMeasures'])await expect(page.locator('#ent-position-start [data-field='+key+']')).toBeVisible();
 await expect(page.locator('#ent-position-start .ent-form-grid > label')).toHaveCount(4);
 await expect(page.locator('[data-od-strategy]')).toHaveCount(1);await expect(page.locator('[data-od-responsibilities]')).toHaveCount(1);
 for(const id of ['identity','scope','budget'])await expect(page.locator('#ent-position-'+id)).not.toHaveAttribute('open','');
 await page.locator('[data-field=businessNeed]').fill(ar?'تطوير الخدمات البرمجية الداخلية':'Deliver internal software services');
 await page.locator('[data-field=responsibilities]').fill(ar?'تطوير خصائص برمجية؛ مراجعة الكود؛ تنفيذ اختبارات آلية':'Develop software features; perform code review; run automated tests');
 await expect(page.locator('[data-field=occupationCode]')).toHaveValue('251204');await expect(page.locator('[data-field=educationFieldCode]')).toHaveValue('061302');
 await expect(page.locator('[data-field=qualifications]')).toHaveValue(ar?/هندسة البرمجيات|البرمجة/:/IT|computer science/);
 await expect(page.locator('#ent-guided-status')).toContainText(ar?'قابلة للتعديل':'Editable');
 await page.locator('#ent-guided-proposals > details > summary').click();await expect(page.locator('#ent-guided-proposals')).toContainText('SSCO 2019');await expect(page.locator('#ent-guided-proposals')).toContainText('251204');await expect(page.locator('#ent-guided-proposals')).toContainText('63');
 for(const selector of ['[data-field=salaryGrade]','[data-number=annualCost]','[data-number=directReports]'])await expect(page.locator(selector)).toHaveValue('');
 // 7.2: authority, budget and alternatives are inferred from the need and the evidenced level, and stay tagged until edited.
 for(const key of ['authority','budget','alternatives']){await expect(page.locator('[data-field='+key+']')).not.toHaveValue('');await expect(page.locator('label.ent-suggested:has([data-field='+key+']) .ent-suggested-tag')).toHaveText(ar?'مقترح — راجعه':'Proposed — review it');}
 await expect(page.locator('#ent-guided-proposals')).toContainText(ar?'مستنتج من نص الحاجة':'Inferred from the need');
 for(const key of ['baseline','target','duration'])await expect(page.locator('[data-matrix-key=kpis][data-matrix-field='+key+']').first()).toHaveValue('');
 await expect(page.locator('[data-matrix-key=kpis][data-matrix-field=baseline]').nth(1)).toHaveValue('');
 await page.locator('[data-field=title]').fill(manualTitle);
 await page.locator('[data-field=businessNeed]').fill(ar?'ضبط إقفال الحسابات المالية':'Close financial accounts');
 await page.locator('[data-field=responsibilities]').fill(ar?'إعداد القيود المحاسبية؛ تسوية الحسابات البنكية؛ مراجعة القوائم المالية':'Prepare accounting entries; reconcile bank accounts; review financial statements');
 await expect(page.locator('[data-field=occupationCode]')).toHaveValue('241101');await expect(page.locator('[data-field=title]')).toHaveValue(manualTitle);
 await expect(page.locator('#ent-guided-proposals')).toContainText('241101');await expect(page.locator('#ent-guided-proposals')).not.toContainText('251204');
 await page.locator('[data-field=businessNeed]').fill('zxqv qqqz');await page.locator('[data-field=responsibilities]').fill('zxqv qqqz');
 await expect(page.locator('[data-field=occupationCode]')).toHaveValue('');await expect(page.locator('[data-field=educationFieldCode]')).toHaveValue('');await expect(page.locator('#ent-guided-proposals')).toBeEmpty();await expect(page.locator('[data-field=title]')).toHaveValue(manualTitle);
 await page.locator('#ent-show-position-fields').click();for(const id of ['identity','scope','budget'])await expect(page.locator('#ent-position-'+id)).toHaveAttribute('open','');
 await page.locator('[data-number=headcount]').fill('0');await page.locator('#ent-position-budget > summary').click();await page.locator('#ent-save').click();
 await expect(page.locator('#ent-position-budget')).toHaveAttribute('open','');await expect(page.locator('[data-number=headcount]')).toBeFocused();await expect(page.locator('[data-number=headcount]')).toHaveAttribute('aria-invalid','true');
});

for(const locale of ['ar','en'])for(const viewport of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:844}])test('guided position labels and purpose guidance remain uncovered / '+locale+' / '+viewport.name,async({page})=>{
 await page.setViewportSize({width:viewport.width,height:viewport.height});
 await page.addInitScript(locale=>localStorage.setItem('miyar-language',locale),locale);
 await page.route('https://miyar-enterprise-api.onrender.com/**',r=>r.fulfill({status:401,json:{detail:'Local visual acceptance'}}));
 await page.goto('http://127.0.0.1:4173/#enterprise/create');
 const keys=['businessNeed','responsibilities','title','successMeasures'];
 await expect(page.locator('#ent-position-start .ent-form-grid > label')).toHaveCount(4);
 const inspect=()=>page.evaluate(keys=>{
  const start=document.getElementById('ent-position-start'),actions=start.closest('.ent-card').querySelector(':scope > .ent-form-actions'),actionRect=actions.getBoundingClientRect();
  const overlaps=[],obscured=[],missingGuidance=[];
  const hit=(key,part,node,rect)=>{const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;if(x<0||x>=innerWidth||y<0||y>=innerHeight)return;const top=document.elementFromPoint(x,y);if(!top||!(top===node||node.contains(top)))obscured.push(key+':'+part);};
  for(const key of keys){const input=start.querySelector('[data-field="'+key+'"]'),label=input.closest('label'),rect=label.getBoundingClientRect(),why=label.querySelector('small');
   if(Math.min(rect.right,actionRect.right)>Math.max(rect.left,actionRect.left)&&Math.min(rect.bottom,actionRect.bottom)>Math.max(rect.top,actionRect.top))overlaps.push(key);
   if(!why||why.textContent.trim().length<20)missingGuidance.push(key);
   hit(key,'input',input,input.getBoundingClientRect());if(why)hit(key,'purpose',why,why.getBoundingClientRect());
   const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(text){const range=document.createRange();range.selectNodeContents(text);hit(key,'label',label,range.getBoundingClientRect());}
  }
  return {overlaps,obscured,missingGuidance,overflow:document.documentElement.scrollWidth>innerWidth};
 },keys);
 for(const state of ['initial','start-scrolled']){if(state==='start-scrolled')await page.locator('#ent-position-start').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));const layout=await inspect();expect(layout.overlaps,state+' action overlap').toEqual([]);expect(layout.obscured,state+' obscured input or guidance').toEqual([]);expect(layout.missingGuidance).toEqual([]);expect(layout.overflow).toBe(false);}
 for(const key of keys){await page.locator('#ent-position-start [data-field='+key+']').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const layout=await inspect();expect(layout.overlaps,key+' action overlap after scroll').toEqual([]);expect(layout.obscured,key+' obscured input or guidance after scroll').toEqual([]);}
});
