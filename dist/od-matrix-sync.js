(function(){
'use strict';
function wrapperFor(key){return document.querySelector('[data-matrix-add="'+key+'"]')?.closest('.ent-matrix-block');}
function clearMatrix(key){let wrapper=wrapperFor(key);if(!wrapper)return false;let guard=0;while(wrapper.querySelector('[data-matrix-remove]')&&guard++<110){wrapper.querySelector('[data-matrix-remove]').click();wrapper=wrapperFor(key);if(!wrapper)break;}return true;}
function setMatrix(key,rows,fields){
 if(!clearMatrix(key))return false;
 for(let i=0;i<rows.length;i++){
  let wrapper=wrapperFor(key),add=wrapper?.querySelector('[data-matrix-add="'+key+'"]');if(!add)break;add.click();wrapper=wrapperFor(key);
  for(const field of fields){const input=wrapper?.querySelector('[data-matrix-key="'+key+'"][data-matrix-row="'+i+'"][data-matrix-field="'+field+'"]');if(!input)continue;input.value=String(rows[i]?.[field]??'');input.dispatchEvent(new Event('input',{bubbles:true}));}
 }
 return true;
}
window.addEventListener('miyar:od-generated',event=>{
 const {proposal,panel}=event.detail||{};
 if(!proposal?.content||!panel?.isConnected||panel!==document.getElementById('miyar-od-workbench'))return;
 setMatrix('kpis',proposal.content.kpis,['outcome','metric','target','frequency','deliverable']);
 setMatrix('skillRequirements',proposal.content.skillRequirements,['name','type','level','evidence']);
});
})();
