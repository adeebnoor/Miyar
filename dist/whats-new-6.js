/* 6.0 visible-change layer for returning users: a dismissible "What's new" panel, "New" badges
   on changed sections, a version badge and a guided 10-minute tour that loads demo data.
   Everything is in normal page flow except the tour bar, which appears only while a tour runs. */
(function(){
'use strict';
const t=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const RELEASE_MINOR=(window.MIYAR_RELEASE?.version||'6.2.0').split('.').slice(0,2).join('.');
const SEEN='miyar-whats-new-'+RELEASE_MINOR,VISITED='miyar-new-badges-6',TOUR='miyar-tour-6';
const store={get(k,s=localStorage){try{return s.getItem(k);}catch{return null;}},set(k,v,s=localStorage){try{s.setItem(k,v);}catch{}},del(k,s=localStorage){try{s.removeItem(k);}catch{}}};
const version=()=>window.MIYAR_RELEASE?.version||'6.0';
const ITEMS=[
 ['#home','واجهة جديدة بهوية موحدة، وبداية موجهة وتنقل مرتب حسب رحلة القرار.','A unified visual identity, guided start and navigation organized around the decision journey.'],
 ['#enterprise/intelligence','ترشيح دلالي للمهن والمهارات على خادم معيار، مع المرجع وحدود التغطية.','Locally hosted semantic occupation and skill proposals with traceable references and coverage limits.'],
 ['#enterprise/create','مؤشرات AI قابلة للتعديل مع فحص الصيغ وموافقة المعالجة الخارجية؛ المخرجات تحتاج مراجعة.','Editable AI KPI proposals with formula checks and external-processing consent; outputs require review.'],
 ['#enterprise/manpower','نماذج أوضح ونتائج منظمة للتخطيط والتعويضات والتقييم، مع أمثلة وأدلة وافتراضات.','Clearer forms and structured planning, compensation and evaluation results, with examples, evidence and assumptions.'],
 ['tour','بيانات عرض بنقرة واحدة وجولة موجهة في 10 دقائق.','Demo data in one click and a guided 10-minute tour.']
];
const BADGES={manpower:'[data-manpower-nav]',compensation:'[data-comp-nav]',grading:'.nav-link[data-enterprise-open="grading"]',connection:'.nav-link[data-enterprise-open="connection"]',tour:'.nav-link[data-enterprise-open="tour"]'};
const STEPS=[
 ['#demo','المحرك الاستراتيجي','Strategic engine','اختر سيناريو مثل «كفاءة التشغيل» ثم اضغط «ابحث / حلّل الاحتياج». يظهر ترشيح بمرجع مهني وسبب واضح.','Pick a scenario such as “Operational efficiency”, then press “Search / analyze the need”. You get a recommended role with its occupation reference and rationale.'],
 ['#enterprise/create','تصميم المنصب','Position design','اضغط «تحميل مثال HC» ثم «توليد حزمة OD»: وصف وظيفي وجدارات ومؤشرات أداء ومسار مهني.','Press “Load HC example”, then “Generate OD package”: job description, competencies, KPIs and a career path.'],
 ['#enterprise/grading','التقييم الوظيفي','Job evaluation','اختر مستوى لكل عامل واكتب دليلًا ثم احسب. النقاط تتحول إلى درجة الهيكل المعتمد، ثم «استخدام الدرجة في التعويضات».','Choose a level and evidence for each factor, then calculate. Points become your approved grade; then use “Use grade in compensation”.'],
 ['#enterprise/manpower','تخطيط القوى العاملة','Manpower planning','افتح الخطة المحفوظة من «المحفوظات على هذا الجهاز»: الجسر يفصل الإحلال عن النمو، ثم البدائل الخمسة والحساسية والتوطين.','Open the saved plan under “Saved on this device”: the bridge separates backfill from growth, then the five options, sensitivity and localization.'],
 ['#enterprise/compensation','التعويضات','Compensation','افتح السيناريو المحفوظ: موضع الراتب، فحص تصميم النطاق وتكلفة الحزمة السنوية.','Open the saved scenario: pay position, band design check and annual package cost.']
];
function visited(){try{return JSON.parse(store.get(VISITED)||'[]');}catch{return [];}}
function markVisited(){for(const [key] of Object.entries(BADGES))if(location.hash==='#enterprise/'+key&&!visited().includes(key))store.set(VISITED,JSON.stringify([...visited(),key]));}
function badges(){const seen=visited();for(const [key,selector] of Object.entries(BADGES)){const link=document.querySelector('.sidebar '+selector);if(!link)continue;const badge=link.querySelector('.new-badge');if(seen.includes(key)){badge?.remove();continue;}if(!badge){const b=document.createElement('span');b.className='new-badge';b.textContent=t('جديد','New');link.append(b);}else if(badge.textContent!==t('جديد','New'))badge.textContent=t('جديد','New');}}
function versionBadge(){for(const host of [document.querySelector('.topbar .top-actions'),document.querySelector('.lp-header-inner')?.lastElementChild]){if(!host)continue;let b=host.querySelector('.version-badge');if(!b){b=document.createElement('a');b.className='version-badge';b.href='./trust.html#changes';host.prepend(b);}const label='v'+version().split('.').slice(0,2).join('.');if(b.textContent!==label){b.textContent=label;b.setAttribute('aria-label',t('ما الجديد في الإصدار ','What is new in version ')+version());}}}
function panel(){
 if(store.get(SEEN))return document.querySelectorAll('.whats-new').forEach(x=>x.remove());
 const home=location.hash===''||location.hash.startsWith('#home'),host=home?document.querySelector('#view-home .lp-hero'):document.getElementById('main');if(!host)return;
 const existing=document.querySelector('.whats-new');if(existing&&existing.dataset.lang===document.documentElement.lang&&(home?existing.previousElementSibling===host:existing.parentElement===host))return;existing?.remove();
 const box=document.createElement('section');box.className='whats-new';box.dataset.lang=document.documentElement.lang;box.setAttribute('aria-labelledby','whats-new-title');
 box.innerHTML='<div class="whats-new-inner"><div class="whats-new-head"><h2 id="whats-new-title">'+t('ما الجديد في معيار ','What’s new in Miyar ')+version().split('.').slice(0,2).join('.')+'</h2><p>'+t('استمعنا لتجاربكم السابقة. هذا ما تغيّر:','We listened to your earlier experience. Here is what changed:')+'</p></div><ul>'+ITEMS.map(([href,ar,en])=>'<li>'+(href==='tour'?'<button type="button" class="whats-new-link" data-tour-start>'+t(ar,en)+'</button>':'<a class="whats-new-link" href="'+href+'">'+t(ar,en)+'</a>')+'</li>').join('')+'</ul><div class="whats-new-actions"><button type="button" class="button button-primary" data-tour-start>'+t('ابدأ الجولة الموجهة — 10 دقائق','Start the guided tour — 10 minutes')+'</button><a class="button button-outline" href="./trust.html#changes">'+t('كل التغييرات','All changes')+'</a><button type="button" class="whats-new-dismiss" data-whats-new-dismiss aria-label="'+t('إخفاء ما الجديد','Dismiss what’s new')+'">'+t('إخفاء','Dismiss')+'</button></div></div>';
 if(home)host.insertAdjacentElement('afterend',box);else host.prepend(box);
}
function tourStep(){const raw=store.get(TOUR,sessionStorage);if(raw===null||raw==='')return null;const v=Number(raw);return Number.isInteger(v)&&v>=0&&v<STEPS.length?v:null;}
function go(step){store.set(TOUR,String(step),sessionStorage);const target=STEPS[step][0];if(location.hash!==target)location.hash=target;else schedule();}
function startTour(){
 store.set(SEEN,'1');
 try{if(window.MiyarDemoWorkspace&&!window.MiyarEnterprise?.session?.()&&!window.MiyarDemoWorkspace.loaded())window.MiyarDemoWorkspace.load();}catch{}
 go(0);
}
function endTour(){store.del(TOUR,sessionStorage);document.querySelector('.tour-bar')?.remove();}
function tourBar(){
 const step=tourStep();let bar=document.querySelector('.tour-bar');if(step===null){bar?.remove();return;}
 const [route,ar,en,textAr,textEn]=STEPS[step];
 if(bar&&bar.dataset.step===String(step)&&bar.dataset.lang===document.documentElement.lang)return;
 bar?.remove();bar=document.createElement('aside');bar.className='tour-bar';bar.dataset.step=String(step);bar.dataset.lang=document.documentElement.lang;bar.setAttribute('aria-label',t('الجولة الموجهة','Guided tour'));
 bar.innerHTML='<div><span class="tour-count">'+t('الخطوة ','Step ')+(step+1)+' / '+STEPS.length+'</span><strong>'+t(ar,en)+'</strong><p>'+t(textAr,textEn)+'</p>'+(location.hash!==route?'<a href="'+route+'">'+t('افتح هذه الشاشة','Open this screen')+'</a>':'')+'</div><div class="tour-actions"><button type="button" class="button button-outline" data-tour-prev '+(step===0?'disabled':'')+'>'+t('السابق','Back')+'</button>'+(step<STEPS.length-1?'<button type="button" class="button button-primary" data-tour-next>'+t('التالي','Next')+'</button>':'<button type="button" class="button button-primary" data-tour-end>'+t('إنهاء الجولة','Finish tour')+'</button>')+'<button type="button" class="tour-close" data-tour-end aria-label="'+t('إغلاق الجولة','Close tour')+'">×</button></div>';
 document.body.append(bar);
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-tour-start]')){e.preventDefault();startTour();return;}
 if(e.target.closest('[data-tour-next]')){const s=tourStep();if(s!==null&&s<STEPS.length-1)go(s+1);return;}
 if(e.target.closest('[data-tour-prev]')){const s=tourStep();if(s)go(s-1);return;}
 if(e.target.closest('[data-tour-end]')){endTour();return;}
 if(e.target.closest('[data-whats-new-dismiss]')||e.target.closest('.whats-new a')){store.set(SEEN,'1');document.querySelectorAll('.whats-new').forEach(x=>x.remove());}
});
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;markVisited();badges();versionBadge();panel();tourBar();},0);}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['lang']});window.addEventListener('hashchange',schedule);schedule();
window.MiyarWhatsNew={startTour,endTour,steps:STEPS.length};
})();
