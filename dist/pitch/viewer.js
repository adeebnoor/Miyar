(function(){
'use strict';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
let lang=params.get('lang')==='en'?'en':'ar',index=0,slides=[];
const T=x=>typeof x==='string'?x:(x?.[lang]||'');
const words={ar:{label:'العرض التعريفي',back:'العودة للمنصة',previous:'السابق',next:'التالي',choose:'اختر الشريحة',fullscreen:'ملء الشاشة',pdf:'تنزيل PDF',pptx:'تنزيل PowerPoint',transcript:'نص الشريحة',hint:'استخدم الأسهم للتنقل. يتوفر نص مقروء لكل شريحة أدناه.',footer:'حوكمة المناصب قبل التوظيف',error:'تعذر تحميل العرض. أعد تحميل الصفحة أو نزّل ملف PDF.'},en:{label:'Miyar pitch',back:'Back to the platform',previous:'Previous',next:'Next',choose:'Choose a slide',fullscreen:'Full screen',pdf:'Download PDF',pptx:'Download PowerPoint',transcript:'Slide text',hint:'Use the arrow keys to navigate. Readable slide text is available below.',footer:'Position governance before hiring',error:'The deck could not load. Reload this page or download the PDF.'}};
function node(tag,value,parent,cls){const el=document.createElement(tag);if(value)el.textContent=T(value);if(cls)el.className=cls;parent.append(el);return el;}
function items(arr,parent){const ul=node('ul','',parent);arr.forEach(v=>node('li',v,ul));}
function transcript(d){const a=$('transcript');a.replaceChildren();node('h1',d.title,a);for(const k of ['subtitle','statement','body','recordTitle'])if(d[k])node('p',d[k],a);
 if(d.items)items(d.items,a);
 for(const c of d.columns||[]){node('h2',c.title,a);items(c.items,a);}
 for(const c of d.steps||[]){node('h2',c.title,a);node('p',c.body,a);}
 for(const m of d.metrics||[])node('p',`${m.value} — ${T(m.label)}${m.detail?' · '+T(m.detail):''}`,a);
 for(const p of d.people||[]){node('h2',p.name,a);node('p',p.detail,a);}
 if(d.rows){const table=node('table','',a);d.rows.forEach(row=>{const tr=node('tr','',table);node('th',row[0],tr).scope='row';node('td',row[1],tr);});}
 if(d.note)node('p',d.note,a,'note');if(d.link){const l=node('a',d.link,a);l.href=d.link;l.dir='ltr';}
}
function hashIndex(){const n=Number(location.hash.slice(1));return Number.isInteger(n)&&n>=1&&n<=slides.length?n-1:0;}
function show(n,updateURL=true){index=Math.max(0,Math.min(slides.length-1,n));const d=slides[index];$('slide').src=`pitch/slides/${lang}-${String(index+1).padStart(2,'0')}.jpg`;$('slide').alt=T(d.title);$('choose').value=String(index);$('counter').textContent=`${index+1} / ${slides.length}`;$('previous').disabled=index===0;$('next').disabled=index===slides.length-1;transcript(d);document.title=lang==='ar'?'العرض التعريفي | معيار':'Pitch deck | Miyar';if(updateURL)history.replaceState(null,'',`?lang=${lang}#${index+1}`);$('language').href=`?lang=${lang==='ar'?'en':'ar'}#${index+1}`;
 if(index+1<slides.length){const preload=new Image();preload.src=`pitch/slides/${lang}-${String(index+2).padStart(2,'0')}.jpg`;}
}
function localize(){const w=words[lang];document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';$('deck-label').textContent=w.label;$('deck').setAttribute('aria-label',w.label);document.querySelector('header nav').setAttribute('aria-label',w.label);['back','previous','next','pdf','pptx','hint'].forEach(k=>$(k).textContent=w[k]);$('choose-label').textContent=w.choose;$('fullscreen').setAttribute('aria-label',w.fullscreen);$('transcript-label').textContent=w.transcript;$('footer-note').textContent=w.footer;$('language').textContent=lang==='ar'?'English':'العربية';$('language').lang=lang==='ar'?'en':'ar';$('pdf').href=`pitch/Miyar-Pitch-${lang.toUpperCase()}.pdf`;$('pptx').href=`pitch/Miyar-Pitch-${lang.toUpperCase()}.pptx`;$('choose').replaceChildren();slides.forEach((d,i)=>{const o=node('option',`${i+1}. ${T(d.title)}`,$('choose'));o.value=i;});}
async function start(){try{const r=await fetch('pitch/content.json');if(!r.ok)throw Error('load');const data=await r.json();if(!Array.isArray(data.slides)||!data.slides.length)throw Error('empty');slides=data.slides;index=hashIndex();localize();show(index);$('deck').hidden=false;$('status').hidden=true;
 $('previous').onclick=()=>show(index-1);$('next').onclick=()=>show(index+1);$('choose').onchange=()=>show(Number($('choose').value));
 $('language').onclick=e=>{e.preventDefault();lang=lang==='ar'?'en':'ar';localize();show(index);};
 window.addEventListener('hashchange',()=>show(hashIndex(),false));
 document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||/SELECT|INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;let n;if(e.key==='Home')n=0;else if(e.key==='End')n=slides.length-1;else if(e.key==='ArrowRight')n=index+(lang==='ar'?-1:1);else if(e.key==='ArrowLeft')n=index+(lang==='ar'?1:-1);else return;e.preventDefault();show(n);});
 const stage=document.querySelector('.stage');if(!stage.requestFullscreen)$('fullscreen').hidden=true;else $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{window.open($('slide').src,'_blank','noopener');}};
 }catch{$('status').textContent=words[lang].error;const link=node('a',' PDF',$('status'));link.href=`pitch/Miyar-Pitch-${lang.toUpperCase()}.pdf`;}}
start();
})();
