(function(){
'use strict';
const t=(a,b)=>document.documentElement.lang==='en'?b:a;
function mount(){
 const version=window.MIYAR_RELEASE?.version||'';
 const proof=document.querySelector('.lp-proof');
 if(proof&&!document.getElementById('expert-review-entry')){const section=document.createElement('section');section.id='expert-review-entry';section.className='lp-section lp-wrap';section.innerHTML='<div class="decision-summary"><strong>'+t('نسخة مراجعة الخبير','Expert review release')+'</strong><p>'+t('دعم قرار للموارد البشرية والمالية والإدارة، بقواعد واضحة وذكاء اصطناعي اختياري. راجع معالجة الملاحظات وما بقي للاعتماد قبل التوسع.','Decision support for HR, Finance and Administration, with transparent rules and optional AI. Review the fixes and the outstanding acceptance requirements before expanding the pilot.')+'</p><a href="./expert-review.html">'+t('الملاحظات المتبقية ونتيجة معالجتها','Remaining findings and their treatment')+'</a></div>';proof.after(section);}
 const badge=document.querySelector('#expert-review-entry strong');if(badge)badge.textContent=t('نسخة مراجعة الخبير','Expert review release')+(version?' · '+version:'');
 if(location.hash==='#enterprise/reference'){const content=document.getElementById('ent-content');if(content&&!content.querySelector('[data-reference-maintenance]')){const note=document.createElement('aside');note.dataset.referenceMaintenance='true';note.className='ent-note';note.textContent=t('مراجعة المصادر: 5 أكتوبر 2026. النسخ الحالية: المهن 2019 والتعليم 2020؛ لا ندّعي أنها أحدث إصدار متحقق. مالك المراجعة: مختص OD، كل ثلاثة أشهر أو عند صدور تحديث رسمي. يُراجع المصدر والبصمة والفروق والأثر قبل تفعيل أي إصدار.','Sources reviewed 5 October 2026. Current snapshots: occupations 2019, education 2020; not certified as the latest editions. OD reviews quarterly or on an official release, checking source, checksum, differences and impact before activation.');content.prepend(note);}}
}
window.addEventListener('miyar:navigate',mount);window.addEventListener('hashchange',()=>setTimeout(mount,0));new MutationObserver(()=>setTimeout(mount,0)).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});setTimeout(mount,0);
})();
