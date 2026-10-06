/* Miyar 7.1 shell additions: a global search in the top bar and a five-step process stepper that
   replaces the one-line position context. Pure presentation; routes, engines and data are untouched. */
(function(){
'use strict';
const t=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const STEPS=[['create','تصميم المنصب','Design'],['grading','التقييم الوظيفي','Evaluate'],['compensation','التعويضات','Compensation'],['manpower','تخطيط القوى العاملة','Plan'],['workspace','الاعتماد والمتابعة','Approve']];
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
function search(){
 const bar=document.querySelector('.app-shell .topbar');if(!bar)return;
 let box=bar.querySelector('.ds-search');
 if(!box){box=document.createElement('form');box.className='ds-search';box.setAttribute('role','search');box.innerHTML=ICON+'<input type="search" autocomplete="off" aria-label=""><kbd>/</kbd>';
  const actions=bar.querySelector('.top-actions');bar.insertBefore(box,actions||null);
  box.addEventListener('submit',e=>{e.preventDefault();const q=box.querySelector('input').value.trim();if(!q)return;go(q);});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')&&!document.body.classList.contains('is-landing')){e.preventDefault();box.querySelector('input').focus();}});}
 const input=box.querySelector('input'),label=t('ابحث عن مهنة أو رمز أو منصب محفوظ','Search occupations, codes or saved positions');
 if(input.placeholder!==label){input.placeholder=label;input.setAttribute('aria-label',label);}
}
function go(q){
 const open=()=>{const field=document.querySelector('#ent-content input[type=search], #ent-content .ent-directory input, #ent-content input');if(!field)return false;field.value=q;field.dispatchEvent(new Event('input',{bubbles:true}));field.form?field.requestSubmit?.():field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;};
 if(location.hash==='#enterprise/reference'){open();return;}
 location.hash='#enterprise/reference';let tries=0;const timer=setInterval(()=>{if(open()||++tries>40)clearInterval(timer);},50);
}
function stepper(){
 const strip=[...document.querySelectorAll('#view-enterprise p, #view-enterprise div')].find(el=>el.children.length===0&&/(الخطوة|Step) \d (من|of) 5/.test(el.textContent));
 const old=document.querySelector('.ds-stepper');
 if(!strip){old?.remove();document.querySelector('.ds-context')?.remove();return;}
 const text=strip.textContent,current=Number((text.match(/(?:الخطوة|Step) (\d)/)||[])[1])||1;
 const parts=text.split(' · ').filter(x=>!/(الخطوة|Step) \d/.test(x));
 if(old&&old.dataset.step===String(current)&&old.dataset.lang===document.documentElement.lang&&old.dataset.text===text)return;
 old?.remove();document.querySelector('.ds-context')?.remove();
 const ol=document.createElement('ol');ol.className='ds-stepper';ol.dataset.step=String(current);ol.dataset.lang=document.documentElement.lang;ol.dataset.text=text;ol.setAttribute('aria-label',t('مسار قرار المنصب','Position decision path'));
 ol.innerHTML=STEPS.map(([tab,ar,en],i)=>'<li'+(i+1===current?' aria-current="step"':i+1<current?' class="done"':'')+'><a href="#enterprise/'+tab+'"><i></i><span>'+t(ar,en)+'</span></a></li>').join('');
 const ctx=document.createElement('p');ctx.className='ds-context';ctx.innerHTML=parts.map(p=>{const [k,...v]=p.split(': ');return v.length?'<span>'+esc(k)+': <b>'+esc(v.join(': '))+'</b></span>':'<span>'+esc(p)+'</span>';}).join('');
 strip.hidden=true;strip.insertAdjacentElement('beforebegin',ol);ol.insertAdjacentElement('afterend',ctx);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let queued=false;function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;document.documentElement.dataset.design='7.1';search();stepper();},0);}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['lang']});window.addEventListener('hashchange',schedule);schedule();
window.MiyarDesign={version:'7.1',steps:STEPS.length,search:go};
})();
