(function(){
'use strict';
const targetIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>';
function sync(){
 const nav=document.querySelector('.sidebar nav.nav-list');
 if(!nav)return;
 const en=document.documentElement.lang==='en';
 let link=nav.querySelector('[data-strategy-nav]');
 if(!link){
  link=document.createElement('a');
  link.href='#demo';
  link.className='nav-link strategic-engine-link';
  link.dataset.view='demo';
  link.dataset.strategyNav='true';
  nav.prepend(link);
 }
 const label=en?'Strategic workforce engine':'المحرك الاستراتيجي للقوى العاملة';
 if(link.querySelector('span')?.textContent!==label)link.innerHTML=targetIcon+'<span>'+label+'</span>';
 const demo=document.getElementById('view-demo');
 const active=Boolean(demo&&!demo.hidden);
 link.classList.toggle('active',active);
 if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
}
document.addEventListener('click',event=>{
 const strategicEntry=event.target.closest('[data-lp-strategy]');
 if(strategicEntry){event.preventDefault();window.location.hash='demo';return;}
 if(event.target.closest('#language-btn,#lp-language,#presentation-language'))sync();
});
window.addEventListener('hashchange',sync);
window.addEventListener('miyar:navigate',sync);
sync();
})();
