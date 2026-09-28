const {test,expect}=require('@playwright/test');

const BASE='http://127.0.0.1:4173/';

async function prepare(page,lang='ar'){
  await page.addInitScript(value=>localStorage.setItem('miyar-language',value),lang);
  await page.route('https://miyar-enterprise-api.onrender.com/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/health')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ok',version:'audit',taxonomy:'ssco-2019-supplied',occupations:5041,semanticModelReady:false,storage:'postgresql',services:{approvals:true,exports:[{format:'PDF',available:true}],signingConfigured:true,semanticEnabled:false}})});
    if(url.pathname==='/config.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.MIYAR_CONFIG={apiBase:"https://miyar-enterprise-api.onrender.com"};'});
    return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Sign in to use the organization workspace'})});
  });
}

async function goto(page,hash,lang='ar'){
  await prepare(page,lang);
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.goto(BASE+hash);
  await page.waitForTimeout(180);
  await expect(page.locator('body')).toBeVisible();
  expect(pageErrors,'Uncaught browser errors on '+hash).toEqual([]);
}

test('360 public copy is internally consistent and no obsolete five-engineering-role claim survives',async({page})=>{
  await goto(page,'#home','ar');
  let text=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  expect(text).not.toMatch(/خمس مهن هندسية|5 مهن هندسية|عينة من 5 مهن/i);
  expect(text).not.toMatch(/five[- ]engineering[- ]role|five engineering occupations|5-record sample/i);
  await expect(page.locator('#lp-guided-form')).toBeVisible();
  await expect(page.locator('a[href*="pitch.html"]:visible').first()).toBeVisible();
  const personal=page.locator('a[href="https://adeebnoor.github.io/"]:visible').first();
  await expect(personal).toBeVisible();
  await page.goto(BASE+'#demo');await page.waitForTimeout(180);
  text=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  expect(text).not.toMatch(/خمس مهن هندسية|5 مهن هندسية|عينة من 5 مهن/i);
  expect(text).not.toMatch(/five[- ]engineering[- ]role|five engineering occupations|5-record sample/i);
});

test('360 all primary public and workspace routes render with no horizontal overflow on desktop',async({page})=>{
  const routes=['#home','#home/capabilities','#home/governance','#demo','#enterprise/overview','#enterprise/create','#enterprise/reference','#enterprise/manpower','#enterprise/compensation','#enterprise/connection'];
  for(const route of routes){
    await page.goto(BASE+route);
    await page.waitForTimeout(160);
    await expect(page.locator('body')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow '+route).toBeLessThanOrEqual(2);
    const visible=await page.locator('body').innerText();
    expect(visible.trim().length,'empty route '+route).toBeGreaterThan(80);
  }
});

test('360 every enterprise route renders meaningful content in Arabic and English',async({page})=>{
  const tabs=['overview','tour','reference','create','workspace','intelligence','bulk','grading','readiness','evidence','market','connection'];
  for(const lang of ['ar','en']){
    await page.addInitScript(value=>localStorage.setItem('miyar-language',value),lang);
    for(const tab of tabs){
      await page.goto(BASE+'#enterprise/'+tab);
      await page.waitForTimeout(180);
      const content=page.locator('#ent-content');
      await expect(content,'Missing enterprise content for '+tab+' in '+lang).toBeVisible();
      const tabText=(await content.innerText()).trim();
      expect(tabText.length,'Empty route '+tab+' in '+lang).toBeGreaterThan(40);
      await expect(page.locator('#enterprise-heading')).toBeVisible();
      if(tab==='market')expect(tabText).not.toMatch(/Tafany|تفاني/i);
    }
  }
});

test('360 Arabic-English switch changes direction and preserves typed demo inputs',async({page})=>{
  await goto(page,'#demo','ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.fill('#objective','إدارة الرواتب والتقارير الشهرية للموظفين');
  await page.fill('#domain','الموارد البشرية');
  await page.fill('#seniority','مدير');
  await page.locator('#language-btn').click();
  await page.waitForTimeout(120);
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('#objective')).toHaveValue('إدارة الرواتب والتقارير الشهرية للموظفين');
  await expect(page.locator('#domain')).toHaveValue('الموارد البشرية');
  await expect(page.locator('#seniority')).toHaveValue('مدير');
});

test('360 title and code lookup work in both Arabic and English without fabricated evidence',async({page})=>{
  await goto(page,'#demo','ar');
  for(const query of ['مهندس مدني','214201']){
    await page.fill('#objective',query);
    await page.locator('#role-form button[type="submit"]').click();
    await expect(page.locator('#result-content')).toContainText('214201');
  }
  await page.locator('#language-btn').click();await page.waitForTimeout(100);
  await page.fill('#objective','Civil Engineer');
  await page.locator('#role-form button[type="submit"]').click();
  await expect(page.locator('#result-content')).toContainText('214201');
});

test('360 OD example generates, applies and saves an editable position draft',async({page})=>{
  await goto(page,'#enterprise/create','en');
  const od=page.locator('#miyar-od-workbench');await expect(od).toBeVisible();
  await od.locator('[data-od-example]').click();
  await od.locator('[data-od-generate]').click();
  await expect(od.locator('[data-od-result]')).toContainText(/Human Capital Projects & Operations Manager/i);
  await expect(od.locator('[data-od-result]')).toContainText(/review|proposal|market/i);
  const apply=od.locator('[data-od-apply]');await expect(apply).toBeVisible();await apply.click();
  await expect(page.locator('[data-field="title"]')).toHaveValue(/Human Capital Projects & Operations Manager/i);
  await expect(page.locator('[data-field="responsibilities"]')).not.toHaveValue('');
  await page.locator('#ent-save').click();await page.waitForTimeout(120);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('miyar-enterprise-drafts-v1')||localStorage.getItem('miyar-enterprise-positions-v1')||'[]'));
  expect(Array.isArray(saved)).toBeTruthy();
});

test('360 institution setup clearly starts unconfigured, saves a local example, and feeds OD context',async({page})=>{
  await goto(page,'#enterprise/create','en');
  const ctx=page.locator('[data-institution-context]');await expect(ctx).toBeVisible();
  await expect(ctx).toContainText(/Not configured|manual review/i);
  await ctx.locator('[data-inst-open]').click();
  const dialog=page.locator('dialog.institution-dialog');await expect(dialog).toBeVisible();
  await dialog.locator('[data-inst-example]').click();
  await dialog.locator('[data-inst-save]').click();
  await expect(dialog.locator('[data-inst-message]')).toContainText(/saved/i);
  await dialog.locator('[data-inst-close]').click();
  await expect(page.locator('[data-institution-context]')).toContainText(/Configured/i);
  const od=page.locator('#miyar-od-workbench');await od.locator('[data-od-example]').click();await od.locator('[data-od-generate]').click();
  await expect(od.locator('[data-inst-match]')).toContainText(/G11|Human Capital/i);
});

test('360 manpower example calculates three scenarios, exposes uncertainty, saves, and hands gap to OD',async({page})=>{
  await goto(page,'#enterprise/manpower','en');
  const mp=page.locator('.mp-page');await expect(mp).toBeVisible();
  await mp.locator('[data-mp-example]').click();
  await mp.locator('[data-mp-run]').click();
  await expect(page.locator('.mp-scenario')).toHaveCount(3);
  await expect(page.locator('.mp-results')).toContainText(/0\.8/);
  await expect(page.locator('.mp-results')).toContainText(/scenario estimate|not an approved headcount/i);
  await page.locator('[data-mp-save]').click();
  await expect(page.locator('[data-mp-status]')).toContainText(/saved locally|Plan saved/i);
  const od=page.locator('[data-mp-od]');await expect(od).toBeVisible();await od.click();
  await expect(page).toHaveURL(/#enterprise\/create$/);
  await expect(page.locator('#miyar-od-workbench [data-od-status]')).toContainText(/Workforce gap imported/i);
});

test('360 compensation example calculates and saves without claiming a market benchmark',async({page})=>{
  await goto(page,'#enterprise/compensation','en');
  const cp=page.locator('.cp-page');await expect(cp).toBeVisible();
  await cp.locator('[data-cp-example]').click();
  await cp.locator('[data-cp-run]').click();
  const result=page.locator('.cp-result');await expect(result).toBeVisible();
  await expect(result).toContainText(/30,000/);
  await expect(result).toContainText(/Not a market benchmark/i);
  await result.locator('[data-cp-save]').click();
  await expect(result.locator('[data-cp-status]')).toContainText(/saved/i);
});

test('360 blank, malformed and non-HR inputs fail visibly instead of inventing a confident HR role',async({page})=>{
  await goto(page,'#demo','en');
  await page.fill('#objective','');
  await page.locator('#role-form button[type="submit"]').click();
  await expect(page.locator('#form-error')).toBeVisible();
  await page.fill('#objective','Improve quarterly financial reporting accuracy and close process');
  await page.locator('#role-form button[type="submit"]').click();
  const result=page.locator('#result-content');
  await expect(result).toBeVisible();
  await expect(result).not.toContainText(/Payroll Specialist|Recruitment Specialist|HR Operations Specialist/i);
});

test('360 local static release has no missing first-party script, stylesheet, favicon or pitch assets',async({page,request})=>{
  await goto(page,'#home','en');
  const assets=await page.evaluate(()=>[
    ...[...document.querySelectorAll('script[src]')].map(x=>x.src),
    ...[...document.querySelectorAll('link[rel="stylesheet"][href]')].map(x=>x.href),
    new URL('./assets/favicon.svg',location.href).href,
    new URL('./pitch.html?lang=en',location.href).href,
    new URL('./pitch/Miyar-Pitch-EN.pdf',location.href).href,
    new URL('./pitch/Miyar-Pitch-AR.pdf',location.href).href
  ]);
  for(const url of [...new Set(assets)]){
    const response=await request.get(url);
    expect(response.ok(),'missing asset '+url+' status '+response.status()).toBeTruthy();
  }
});

test('360 phone viewport has no horizontal overflow across critical user journeys',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const routes=['#home','#demo','#enterprise/create','#enterprise/manpower','#enterprise/compensation','#enterprise/connection'];
  for(const route of routes){
    await page.goto(BASE+route);await page.waitForTimeout(150);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'mobile overflow '+route).toBeLessThanOrEqual(2);
  }
});


test('360 critical screens expose accessible names for interactive controls and labels for form fields',async({page})=>{
  const routes=['#home','#demo','#enterprise/create','#enterprise/manpower','#enterprise/compensation','#enterprise/connection'];
  for(const route of routes){
    await page.goto(BASE+route);await page.waitForTimeout(180);
    const issues=await page.evaluate(()=>{
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
      const name=el=>(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').trim();
      const controls=[...document.querySelectorAll('button,a[href]')].filter(visible).filter(el=>!name(el)).map(el=>el.outerHTML.slice(0,180));
      const fields=[...document.querySelectorAll('input,textarea,select')].filter(visible).filter(el=>{
        if(el.type==='hidden')return false;
        const labelled=el.labels&&el.labels.length;
        return !labelled&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby');
      }).map(el=>el.outerHTML.slice(0,180));
      const images=[...document.querySelectorAll('img')].filter(el=>!el.hasAttribute('alt')).map(el=>el.outerHTML.slice(0,180));
      return {controls,fields,images};
    });
    expect(issues.controls,'unnamed controls '+route).toEqual([]);
    expect(issues.fields,'unlabelled fields '+route).toEqual([]);
    expect(issues.images,'images without alt '+route).toEqual([]);
  }
});

test('360 visible release labels do not regress to the old backend/frontend edition',async({page})=>{
  await page.goto(BASE+'#enterprise/create');await page.waitForTimeout(180);
  const text=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  expect(text).not.toMatch(/\bv4\.5\b|\b5\.0\.1\b/i);
  await expect(page.locator('.edition').first()).toContainText(require('../package.json').version);
});


test('360 homepage never presents the supplied 2019 occupation corpus as the current official SSCO',async({page})=>{
  await page.goto(BASE+'#home');
  // Lower sections use content-visibility:auto: scroll to the reference notice
  // to verify visibility. Read full copy with textContent because innerText
  // on an ancestor omits descendants skipped by content-visibility.
  await page.locator('.release-foundation').scrollIntoViewIfNeeded();
  await expect(page.locator('.release-foundation')).toBeVisible();
  await expect(page.locator('.release-foundation')).toContainText(/GASTAT|الهيئة العامة للإحصاء/i);
  const text=(await page.locator('#view-home').textContent()).replace(/\s+/g,' ');
  expect(text).toMatch(/2019|supplied January 2019/i);
  expect(text).toMatch(/GASTAT|الهيئة العامة للإحصاء/i);
  expect(text).not.toMatch(/5,041 (?:current|official) occupations/i);
});
