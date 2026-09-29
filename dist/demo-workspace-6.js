/* 6.0 demonstration workspace: one click fills this browser with synthetic, clearly labelled data
   (institution structure and grades, salary bands, a saved manpower plan and compensation scenario),
   and one click removes it. Nothing is sent to a server; signed-in organization data is never touched. */
(function(){
'use strict';
const t=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const KEYS={bands:'miyar-salary-bands-v1:local',plans:'miyar-manpower-plans-v1',scenarios:'miyar-compensation-scenarios-v1'};
const MARK='DEMO-6';
const BANDS=[['G7',14000,17500,21000],['G9',18000,22500,27000],['G11',24000,30000,36000],['G13',32000,40000,48000],['G15',42000,52500,63000]].map(([grade,min,mid,max])=>({grade,min,mid,max,currency:'SAR',period:'monthly',source:'Synthetic demonstration band — not market data',effectiveDate:'2026-01-01'}));
function read(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
function write(key,rows){localStorage.setItem(key,JSON.stringify(rows));}
function signedIn(){return !!window.MiyarEnterprise?.session?.();}
function load(){
 if(signedIn())throw Error(t('سجّل الخروج أولًا؛ بيانات العرض تُحمّل في مساحة هذا الجهاز فقط.','Sign out first; demo data loads only into this device workspace.'));
 const I=window.MiyarInstitutionProfile,M=window.MiyarManpower,C=window.MiyarCompensation;if(!I||!M||!C)throw Error(t('لم تكتمل تهيئة الصفحة. أعد التحميل.','The page has not finished loading. Reload and retry.'));
 I.saveLocal(I.profileExample(),true);
 write(KEYS.bands,BANDS);
 const plan={...M.plan({...M.example,retirementsFte:.5,currentNationalFte:1,localizationTargetPercent:60}),id:'MP-'+MARK};
 const scenario={...C.evaluate({...C.example,currentSalary:27000,allowancesPercent:35}),id:'CP-'+MARK};
 write(KEYS.plans,[plan,...read(KEYS.plans).filter(x=>x.id!==plan.id)]);
 write(KEYS.scenarios,[scenario,...read(KEYS.scenarios).filter(x=>x.id!==scenario.id)]);
 window.dispatchEvent(new Event('miyar:institution-profile'));
}
function reset(){
 if(signedIn())throw Error(t('سجّل الخروج أولًا؛ الإزالة تخص مساحة هذا الجهاز فقط.','Sign out first; removal applies only to this device workspace.'));
 localStorage.removeItem('miyar-institution-profile-local-v2');localStorage.removeItem(KEYS.bands);
 write(KEYS.plans,read(KEYS.plans).filter(x=>!String(x.id).endsWith(MARK)));
 write(KEYS.scenarios,read(KEYS.scenarios).filter(x=>!String(x.id).endsWith(MARK)));
 window.dispatchEvent(new Event('miyar:institution-profile'));
}
function loaded(){return read(KEYS.plans).some(x=>String(x.id).endsWith(MARK));}
function panel(){
 if(location.hash!=='#enterprise/tour')return;const content=document.getElementById('ent-content');if(!content||content.querySelector('[data-demo-workspace]'))return;
 const box=document.createElement('section');box.className='ent-card demo-workspace';box.dataset.demoWorkspace='';
 box.innerHTML='<h2>'+t('بيئة العرض','Demonstration workspace')+'</h2><p>'+t('تملأ هذه الأداة المتصفح ببيانات اصطناعية موسومة: هيكل تنظيمي ودرجات، نطاقات رواتب، خطة قوى عاملة وسيناريو تعويضات. لا تُرسل أي بيانات، ولا تمس بيانات حساب المؤسسة.','This fills the browser with labelled synthetic data: structure and grades, salary bands, a manpower plan and a compensation scenario. Nothing is sent, and organization-account data is not touched.')+'</p><div class="action-row"><button type="button" class="button button-primary" data-demo-load>'+t('تحميل بيانات العرض','Load demo data')+'</button><button type="button" class="button button-outline" data-demo-reset>'+t('إزالة بيانات العرض','Remove demo data')+'</button></div><p data-demo-status role="status" aria-live="polite"></p><details><summary>'+t('مسار عرض من 10 دقائق','10-minute demonstration path')+'</summary><ol><li><a href="#demo">'+t('المحرك الاستراتيجي: هدف ← ترشيح','Strategic engine: objective → recommendation')+'</a></li><li><a href="#enterprise/create">'+t('تصميم المنصب: مثال HC ← توليد الحزمة','Position design: HC example → generate package')+'</a></li><li><a href="#enterprise/grading">'+t('التقييم الوظيفي: النقاط ← درجة الهيكل المعتمد','Job evaluation: points → approved grade')+'</a></li><li><a href="#enterprise/manpower">'+t('تخطيط القوى العاملة: افتح الخطة المحفوظة','Manpower: open the saved plan')+'</a></li><li><a href="#enterprise/compensation">'+t('التعويضات: افتح السيناريو المحفوظ','Compensation: open the saved scenario')+'</a></li></ol><p>'+t('سير الاعتماد متعدد الأدوار يعرض من مستأجر العرض على الخادم بحسابات يزودك بها مشغّل النظام.','The multi-role approval workflow is shown from the server demo tenant using accounts supplied by the system operator.')+'</p></details>';
 content.prepend(box);
 const status=box.querySelector('[data-demo-status]'),show=()=>{status.textContent=loaded()?t('بيانات العرض محمّلة على هذا الجهاز.','Demo data is loaded on this device.'):t('بيانات العرض غير محمّلة.','Demo data is not loaded.');};
 box.querySelector('[data-demo-load]').onclick=()=>{try{load();show();}catch(e){status.textContent=e.message;}};
 box.querySelector('[data-demo-reset]').onclick=()=>{try{reset();show();}catch(e){status.textContent=e.message;}};
 show();
}
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;panel();},0);}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',schedule);schedule();
window.MiyarDemoWorkspace={load,reset,loaded,bands:BANDS};
})();
