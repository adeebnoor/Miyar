const {test,expect}=require('@playwright/test');
const BASE='http://127.0.0.1:4173/';
const TABS=['overview','create','workspace','reference','intelligence','bulk','grading','readiness','evidence','market','connection','tour','review','business','manpower','compensation'];

test('first-visit value, service links and scroll navigation work in both languages and viewport sizes',async({browser})=>{
 for(const lang of ['en','ar']){
  const page=await browser.newPage();try{
  await page.addInitScript(v=>localStorage.setItem('miyar-language',v),lang);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(BASE+'#home');
   await expect(page.locator('.lp-value-points li')).toHaveCount(3);await expect(page.locator('#lp-services .release-phase-card')).toHaveCount(6);
   const order=await page.evaluate(()=>document.querySelector('.lp-hero').compareDocumentPosition(document.querySelector('.whats-new'))&Node.DOCUMENT_POSITION_FOLLOWING);expect(order).toBeTruthy();
   const hero=await page.locator('.lp-hero').innerText();expect(hero).toMatch(lang==='ar'?/قرار قوى عاملة موثّق/:/documented workforce decision/);expect(hero).toMatch(lang==='ar'?/الدرجة والتكلفة/:/grade and cost/);
   const minContrast=await page.locator('.lp-value-points strong,.lp-value-points span,.release-ai-entry p').evaluateAll(nodes=>{const luminance=color=>{const c=color.match(/[\d.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};return Math.min(...nodes.map(n=>{const a=luminance(getComputedStyle(n).color),b=luminance(getComputedStyle(n.closest('.lp-hero')).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));});expect(minContrast).toBeGreaterThanOrEqual(4.5);
   const services=page.locator('#lp-services');await expect(services).toContainText(lang==='ar'?'اعتماد المؤسسة بعد الدخول':'ORGANIZATION APPROVAL AFTER SIGN-IN');
   if(width===1440){for(const id of ['services','capabilities','governance']){await page.locator('.lp-nav [data-lp-scroll="'+id+'"]').click();await expect(page.locator('#lp-'+id)).toBeInViewport();}}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
  }finally{await page.close();}
 }
});

test('every service and trust route renders and every linked first-party file returns a successful response',async({page,request})=>{
 test.setTimeout(90000);const files=new Set();
 for(const route of ['#home','#demo','#position','#value','#benchmarks','#journey','#catalog',...TABS.map(t=>'#enterprise/'+t)]){
  await page.goto(BASE+route);
  if(route.startsWith('#enterprise/'))await expect(page.locator('#ent-content')).not.toBeEmpty();
  await expect(page.locator('body')).toBeVisible();
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href));for(const href of links){const u=new URL(href);if(u.origin===new URL(BASE).origin){u.hash='';files.add(u.href);}}
 }
 for(const lang of ['en','ar'])for(const route of ['privacy','terms','dpa','retention','security','methodology','status','changes','recovery']){
  await page.goto(BASE+'trust.html#'+route);if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('#trust-language').click();await expect(page.locator('html')).toHaveAttribute('lang',lang);await expect(page.locator('#trust-main h1')).toBeVisible();expect((await page.locator('#trust-main').innerText()).length).toBeGreaterThan(100);
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href));for(const href of links){const u=new URL(href);if(u.origin===new URL(BASE).origin){u.hash='';files.add(u.href);}}
 }
 for(const url of files){const r=await request.get(url);expect(r.ok(),'Broken first-party link '+url+' status '+r.status()).toBeTruthy();}
 for(const lang of ['ar','en']){await page.goto(BASE+'pitch.html?lang='+lang);await expect(page.locator('body')).toContainText(/MI.Y.R|معيار/);}
});

test('zero salary minimum and an unrecognized three-letter currency block calculation',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('miyar-language','en'));await page.goto(BASE+'#enterprise/compensation');await page.locator('[data-cp-example]').click();await page.locator('#cp-min').fill('0');await page.locator('[data-cp-run]').click();await expect(page.locator('[data-cp-message]')).toContainText('Band minimum must be greater than zero');await expect(page.locator('.cp-result')).toHaveCount(0);await expect(page.locator('[data-cp-export]')).toHaveCount(0);
 await page.locator('#cp-min').fill('24000');await page.locator('#cp-currency').fill('ZZZ');await page.locator('[data-cp-run]').click();await expect(page.locator('[data-cp-message]')).toContainText('Currency must be a recognized currency code');await expect(page.locator('.cp-result')).toHaveCount(0);
 await page.goto(BASE+'#enterprise/create');await expect(page.locator('#ent-pdf-draft')).toHaveText('Download position PDF');
});
