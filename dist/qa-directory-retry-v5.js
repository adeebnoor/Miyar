/* Ensures the full-directory fallback attaches after the strategic review output is rendered. */
(function(){
'use strict';
function schedule(){
  if(location.hash!=='#demo') return;
  for(const delay of [30,80,150,260,420]) setTimeout(()=>window.MiyarQAReview?.addDirectoryFallback?.(),delay);
}
window.addEventListener('submit',event=>{if(event.target?.id==='role-form')schedule();},true);
window.addEventListener('hashchange',()=>setTimeout(schedule,60));
window.addEventListener('miyar:navigate',()=>setTimeout(schedule,60));
})();
