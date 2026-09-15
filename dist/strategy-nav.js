(function(){
'use strict';
const targetIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>';
const odIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16v-5m5 5V5m5 11V8"/><path d="M5 4h4M15 4h4"/></svg>';
function sync(){
 const nav=document.querySelector('.sidebar nav.nav-list');
 if(!nav)return;
 const en=document.documentElement.lang==='en';
 let strategy=nav.querySelector('[data-strategy-nav]');
 if(!strategy){strategy=document.createElement('a');strategy.href='#demo';strategy.className='nav-link strategic-engine-link';strategy.dataset.view='demo';strategy.dataset.strategyNav='true';nav.prepend(strategy);}
 const strategyLabel=en?'Strategic workforce engine':'المحرك الاستراتيجي للقوى العاملة';
 if(strategy.querySelector('span')?.textContent!==strategyLabel)strategy.innerHTML=targetIcon+'<span>'+strategyLabel+'</span>';
 let od=nav.querySelector('[data-od-nav]');
 if(!od){od=document.createElement('a');od.href='#enterprise/create';od.className='nav-link od-engine-sidebar-link';od.dataset.odNav='true';strategy.insertAdjacentElement('afterend',od);}
 const odLabel=en?'OD engine':'محرك التطوير التنظيمي',odSub=en?'Phase 1 · JD & evaluation':'المرحلة 1 · الوصف والتقييم';
 od.innerHTML=odIcon+'<span>'+odLabel+'<small>'+odSub+'</small></span>';
 const demo=document.getElementById('view-demo'),strategyActive=Boolean(demo&&!demo.hidden),odActive=location.hash==='#enterprise/create';
 strategy.classList.toggle('active',strategyActive);if(strategyActive)strategy.setAttribute('aria-current','page');else strategy.removeAttribute('aria-current');
 od.classList.toggle('active',odActive);if(odActive)od.setAttribute('aria-current','page');else od.removeAttribute('aria-current');
}
document.addEventListener('click',event=>{
 const strategicEntry=event.target.closest('[data-lp-strategy]');
 if(strategicEntry){event.preventDefault();const changed=window.location.hash!=='#demo';window.location.hash='demo';if(changed)window.dispatchEvent(new Event('hashchange'));return;}
 if(event.target.closest('#language-btn,#lp-language,#presentation-language'))setTimeout(sync,0);
});
window.addEventListener('hashchange',sync);window.addEventListener('miyar:navigate',sync);sync();
})();
