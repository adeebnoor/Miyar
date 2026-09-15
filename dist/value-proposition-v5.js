/* Makes Miyar's Saudi classification integrity explicit on the public landing page. */
(function(){
'use strict';
const ar=()=>document.documentElement.lang!=='en';
const t=(a,b)=>ar()?a:b;
function mount(){
  if(location.hash && location.hash!=='#home' && !location.hash.startsWith('#home/')) return;
  const proof=document.querySelector('.lp-proof');
  if(!proof||document.querySelector('.vp-ssco-callout')) return;
  const section=document.createElement('section');
  section.className='lp-section lp-wrap vp-ssco-callout';
  section.setAttribute('aria-label',t('سلامة التصنيف السعودي','Saudi classification integrity'));
  section.innerHTML=`<div class="lp-section-heading">
    <span class="lp-eyebrow">${t('مرتبط بالتصنيف السعودي — دون اختلاق رمز','SSCO-LINKED — WITHOUT FABRICATING A CODE')}</span>
    <h2>${t('الدور الموجود يُربط بمرجعه.<br>والدور الجديد لا يُجبر على رمز غير صحيح.','Existing roles link to their reference.<br>New roles are never forced into the wrong code.')}</h2>
    <p>${t('يبحث معيار في مرجع التصنيف السعودي الموحد للمهن. عند وجود تطابق موثوق، يحتفظ بالرمز والمرجع. عند الغموض، يعرض بدائل للمراجعة. وإذا كان الدور ناشئًا ولا يوجد له تطابق مناسب، يمكن إنشاء تعريف داخلي مؤقت للمنصب ومراجعته ضمن OD — من دون ادعاء أنه رمز SSCO رسمي.','Miyar searches the Saudi Standard Classification of Occupations. A reliable match retains its traceable reference; ambiguity is routed to candidate review. If an emerging role has no suitable match, Miyar can create a provisional internal role definition for OD review — without pretending it is an official SSCO code.')}</p>
  </div>`;
  proof.after(section);
}
window.addEventListener('hashchange',()=>setTimeout(mount,40));
window.addEventListener('miyar:navigate',()=>setTimeout(mount,40));
document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,40),{once:true});
setTimeout(mount,60);
})();
