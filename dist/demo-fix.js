(function(){
'use strict';
const engine=window.MiyarEngine;
if(!engine||engine.__miyarOutputFix)return;
engine.__miyarOutputFix=true;
const originalClassify=engine.classify.bind(engine);
engine.classify=function(input,roles){
 const result=originalClassify(input,roles);
 const objective=String(input?.objective||'').trim();
 if(result?.kind==='invalid'&&objective){
  return {
   kind:'ambiguous',
   reason:'استلم معيار الهدف كمدخل أولي، لكنه يحتاج وصفًا أوضح للعمل أو القدرة المطلوبة قبل ترشيح مهنة. أضف النتيجة التي تريد تحقيقها وما العمل الذي يجب أن يُنفذ لتحقيقها.',
   reasonEn:'Miyar received the objective as a valid starting point, but needs clearer work or capability detail before suggesting an occupation. Add the outcome you want and the work that must be performed to achieve it.',
   candidates:[]
  };
 }
 return result;
};
function isEnglish(){return document.documentElement.lang==='en';}
function label(ar,en){return isEnglish()?en:ar;}
function ensure(){
 const form=document.getElementById('role-form');
 if(!form||form.dataset.outputFeedbackBound==='true')return;
 form.dataset.outputFeedbackBound='true';
 const run=form.querySelector('.run-button');
 if(run&&!form.querySelector('.analysis-feedback')){
  const status=document.createElement('p');
  status.className='analysis-feedback';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.textContent=label('ستظهر نتيجة التحليل في بطاقة الترشيح بعد الضغط على الزر.','Your analysis result will appear in the suggestion card after you run it.');
  run.insertAdjacentElement('afterend',status);
 }
 const objective=document.getElementById('objective');
 if(objective&&!objective.dataset.submitShortcut){
  objective.dataset.submitShortcut='true';
  objective.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
    event.preventDefault();
    if(typeof form.requestSubmit==='function')form.requestSubmit();
    else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
   }
  });
 }
 form.addEventListener('submit',()=>{
  queueMicrotask(()=>{
   const status=form.querySelector('.analysis-feedback');
   const error=document.getElementById('form-error');
   if(error&&!error.hidden){
    if(status)status.textContent=label('أكمل المدخل المطلوب ثم أعد التحليل.','Complete the required input and run the analysis again.');
    return;
   }
   const panel=document.querySelector('.result-panel');
   const heading=document.getElementById('result-heading');
   if(!panel)return;
   panel.classList.remove('analysis-complete');
   void panel.offsetWidth;
   panel.classList.add('analysis-complete');
   if(status)status.textContent=label('اكتمل التحليل — تم تحديث بطاقة الترشيح أدناه.','Analysis complete — the suggestion card has been updated below.');
   if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
   const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
   if(window.innerWidth<1050)panel.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
  });
 });
}
const observer=new MutationObserver(()=>ensure());
const app=document.getElementById('app');
if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(ensure));
window.addEventListener('miyar:navigate',()=>requestAnimationFrame(ensure));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});
else ensure();
})();
