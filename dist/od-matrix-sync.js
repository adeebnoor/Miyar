(function(){
'use strict';
const Engine=window.MiyarODEngine;if(!Engine)return;
let pending=false;
function ar(){return document.documentElement.lang!=='en';}
function read(panel){return {strategyObjective:panel.querySelector('[data-od-strategy]')?.value.trim()||'',responsibilities:panel.querySelector('[data-od-responsibilities]')?.value.trim()||'',department:panel.querySelector('[data-od-department]')?.value.trim()||'',requestedLevel:panel.querySelector('[data-od-level]')?.value.trim()||'',constraints:panel.querySelector('[data-od-constraints]')?.value.trim()||'',saudizationNote:panel.querySelector('[data-od-saudization]')?.value.trim()||''};}
function wrapperFor(key){return document.querySelector('[data-matrix-add="'+key+'"]').closest('.ent-matrix-block');}
function clearMatrix(key){let wrapper=wrapperFor(key);if(!wrapper)return false;let guard=0;while(wrapper.querySelector('[data-matrix-remove]')&&guard++<110){wrapper.querySelector('[data-matrix-remove]').click();wrapper=wrapperFor(key);if(!wrapper)break;}return true;}
function setMatrix(key,rows,fields){
 if(!clearMatrix(key))return false;
 for(let i=0;i<rows.length;i++){
  let wrapper=wrapperFor(key),add=wrapper?.querySelector('[data-matrix-add="'+key+'"]');if(!add)break;add.click();wrapper=wrapperFor(key);
  for(const field of fields){const input=wrapper?.querySelector('[data-matrix-key="'+key+'"][data-matrix-row="'+i+'"][data-matrix-field="'+field+'"]');if(!input)continue;input.value=String(rows[i]?.[field]??'');input.dispatchEvent(new Event('input',{bubbles:true}));}
 }
 return true;
}
function sync(){
 if(!pending)return;const panel=document.getElementById('miyar-od-workbench'),result=panel?.querySelector('[data-od-result]');if(!panel||!result?.textContent.trim())return;
 try{const proposal=Engine.generate(read(panel),ar()?'ar':'en');setMatrix('kpis',proposal.content.kpis,['outcome','metric','target','frequency','deliverable']);setMatrix('skillRequirements',proposal.content.skillRequirements,['name','type','level','evidence']);pending=false;const status=panel.querySelector('[data-od-status]');if(status)status.textContent=ar()?'تم توليد الحزمة وتطبيق الوصف ومؤشرات الأداء والجدارات على المسودة. راجعها قبل الحفظ والتقييم.':'Package generated; the JD, KPIs and competencies are applied to the draft. Review them before saving and evaluation.';}catch{}
}
document.addEventListener('click',event=>{if(event.target.closest('[data-od-generate]')){pending=true;setTimeout(sync,0);setTimeout(sync,50);setTimeout(sync,200);}});
const observer=new MutationObserver(()=>sync());const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true,characterData:true});
})();
