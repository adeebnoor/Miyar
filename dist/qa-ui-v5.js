/* Miyar 5.0 QA hardening layer — 2026-09-15.
 * Additive by design: preserves the tested core and fixes cross-surface UX/state issues.
 */
(function(){
'use strict';
const HANDOFF='miyar-demo-od-handoff-v2';
const ar=()=>document.documentElement.lang!=='en';
const t=(a,b)=>ar()?a:b;
const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* 1) Directory search: accept common feminine morphology and a bounded English alias set
 * when the supplied occupation corpus contains Arabic titles only. */
function installSearchCompatibility(){
 const C=window.MiyarEnterpriseCore;if(!C?.search||C.__qaSearch)return;C.__qaSearch=true;
 const original=C.search.bind(C);
 const aliases={
  'accountant':'محاسب','accounting':'محاسب','nurse':'ممرض','registered nurse':'ممرض',
  'software engineer':'مهندس برمجيات','software developer':'مطور برامج','programmer':'مطور برامج',
  'sales manager':'مدير مبيعات','sales specialist':'اختصاصي مبيعات','human resources':'موارد بشرية',
  'hr specialist':'أخصائي موارد بشرية','mechanical engineer':'مهندس ميكانيكي','civil engineer':'مهندس مدني'
 };
 C.search=function(nodes,q,parent){
  const raw=norm(q),mapped=aliases[raw]||String(q??'');
  const softened=mapped.split(/\s+/).map(x=>x.length>3&&/[ةه]$/.test(x)?x.slice(0,-1):x).join(' ');
  let rows=original(nodes,softened,parent);
  if(!rows.length&&softened!==mapped)rows=original(nodes,mapped,parent);
  return rows;
 };
}

/* 2) Strategic engine → full directory fallback and governed OD handoff. */
let directoryPromise=null;
function directoryNodes(){
 if(!directoryPromise)directoryPromise=fetch('./classifications/ssco-2019.json').then(r=>r.ok?r.json():null).then(d=>d?.nodes||[]).catch(()=>[]);
 return directoryPromise;
}
function readDemoInput(){return {
 objective:document.getElementById('objective')?.value?.trim()||'',domain:document.getElementById('domain')?.value?.trim()||'',seniority:document.getElementById('seniority')?.value?.trim()||'',constraints:document.getElementById('constraints')?.value?.trim()||''
};}
function currentDemoRole(){
 const out=document.querySelector('.demo-v5-output.good');if(!out)return{};
 const codes=[...out.querySelectorAll('.demo-v5-codes strong')].map(x=>x.textContent.trim());
 return {title:out.querySelector('h3')?.textContent?.trim()||'',occupationCode:codes[0]||'',educationFieldCode:codes[1]||''};
}
function saveHandoff(input,role={}){
 const need=input.objective&&norm(input.objective)!==norm(role.title||'')?input.objective:'';
 sessionStorage.setItem(HANDOFF,JSON.stringify({input,role,need,at:Date.now()}));
 location.hash='#enterprise/create';
 window.dispatchEvent(new Event('hashchange'));
}
async function addDirectoryFallback(){
 if(location.hash!=='#demo')return;
 const host=document.querySelector('.demo-v5-output.review');if(!host||host.querySelector('.qa-directory'))return;
 const input=readDemoInput();if(!input.objective)return;
 const C=window.MiyarEnterpriseCore;if(!C?.search)return;
 const nodes=await directoryNodes();if(!host.isConnected)return;
 const occupations=nodes.filter(x=>x.level==='occupation');const rows=C.search(occupations,input.objective).slice(0,5);
 const box=document.createElement('div');box.className='qa-directory';
 if(rows.length){
  box.innerHTML='<h4>'+t('مطابقات من دليل المهن الكامل','Matches from the full occupation directory')+'</h4><p>'+t('لم يطابق المدخل عينة المحرك السريع، لكنه يطابق مسميات في دليل المهن. اختر مرجعًا لنقله إلى محرك OD.','The input did not match the quick-engine sample, but it matches occupation-directory titles. Choose a reference to carry it into OD.')+'</p><div class="qa-directory-list">'+rows.map((r,i)=>'<button type="button" class="button button-outline" data-qa-ref="'+i+'"><strong>'+esc(r.code)+'</strong> · '+esc(r.titleAr)+'</button>').join('')+'</div>';
  box.querySelectorAll('[data-qa-ref]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.qaRef)];saveHandoff(input,{title:r.titleAr,occupationCode:r.code,educationFieldCode:''});});
 }else{
  box.innerHTML='<p>'+t('لا يوجد تطابق موثوق في عينة المحرك أو الدليل بهذه الصياغة. استخدم رمز SSCO أو المسمى العربي، أو انقل الاحتياج إلى OD للمراجعة.','No reliable match was found with this wording. Use an SSCO code or Arabic title, or carry the need into OD for review.')+'</p>';
 }
 host.appendChild(box);
}
function fillField(selector,value){const el=document.querySelector(selector);if(!el||value===undefined||value===null||value==='')return false;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;}
function consumeHandoff(){
 if(location.hash!=='#enterprise/create')return;let h=null;try{h=JSON.parse(sessionStorage.getItem(HANDOFF)||'null');}catch{}if(!h||Date.now()-Number(h.at||0)>60000)return;
 const form=document.querySelector('#ent-content .ent-form-grid'),od=document.getElementById('miyar-od-workbench');if(!form&&!od){setTimeout(consumeHandoff,100);return;}
 const i=h.input||{},r=h.role||{},need=h.need||'';
 fillField('[data-field="title"]',r.title);fillField('[data-field="occupationCode"]',r.occupationCode);fillField('[data-field="educationFieldCode"]',r.educationFieldCode);
 fillField('[data-field="field"]',i.domain);fillField('[data-field="seniority"]',i.seniority);fillField('[data-field="constraints"]',i.constraints);fillField('[data-field="businessNeed"]',need);fillField('[data-field="purpose"]',need);
 fillField('#miyar-od-workbench [data-od-strategy]',need||i.objective);
 const status=document.querySelector('#miyar-od-workbench [data-od-status]');if(status)status.textContent=r.title?t('تم نقل الترشيح والمدخلات من المحرك الاستراتيجي. أكمل المسؤوليات ثم راجع الحزمة.','Recommendation and inputs carried from the strategic engine. Complete responsibilities, then review the package.'):t('تم نقل احتياج الأعمال من المحرك الاستراتيجي. أكمل المسؤوليات وحدد المرجع قبل الاعتماد.','Business need carried from the strategic engine. Complete responsibilities and select a reference before approval.');
 sessionStorage.removeItem(HANDOFF);
}

/* 3) Compensation/manpower errors: never leave a stale result beside a failed run. */
const CP_AR={
 'Salary band must satisfy minimum < midpoint < maximum':'أدخل نطاقًا صحيحًا: الحد الأدنى أقل من المنتصف، والمنتصف أقل من الحد الأعلى.',
 'Provide the organization salary-band source or rationale':'أدخل مصدر نطاق الراتب لدى الجهة أو مبرره.',
 'Band minimum must be a valid number':'أدخل قيمة صحيحة في حقل «الحد الأدنى».','Band midpoint must be a valid number':'أدخل قيمة صحيحة في حقل «المنتصف».','Band maximum must be a valid number':'أدخل قيمة صحيحة في حقل «الحد الأعلى».','Headcount must be a valid number':'أدخل عدد FTE صحيحًا.','Current / reference salary must be a valid number':'أدخل راتبًا حاليًا/مرجعيًا صحيحًا.'
};
const MP_AR={'Baseline workload':'عبء العمل الحالي','Target workload':'عبء العمل المستهدف','Capacity per FTE':'قدرة FTE الواحدة','Current FTE':'FTE الحالي','Attrition':'الاستنزاف السنوي','Committed hires':'التوظيفات المعتمدة','Internal moves / reskilling':'النقل/التطوير الداخلي','Productivity improvement':'تحسن الإنتاجية','Annual cost per FTE':'التكلفة السنوية لكل FTE'};
function localizeCompensation(){
 const msg=document.querySelector('[data-cp-message]'),out=document.querySelector('[data-cp-result]');if(!msg)return;const text=msg.textContent.trim();
 if(ar()&&CP_AR[text])msg.textContent=CP_AR[text];
 const failed=!!CP_AR[text]||/must be|provide the organization salary-band|valid number/i.test(text);
 if(failed){if(out)out.innerHTML='';msg.classList.add('qa-error');return;}msg.classList.remove('qa-error');
 const current=Number(document.getElementById('cp-current')?.value),min=Number(document.getElementById('cp-min')?.value),max=Number(document.getElementById('cp-max')?.value);
 const result=out?.querySelector('.cp-result');result?.querySelector('.qa-band-alert')?.remove();
 if(result&&Number.isFinite(current)&&current>0&&Number.isFinite(min)&&Number.isFinite(max)&&min<max&&(current<min||current>max)){
  const alert=document.createElement('div');alert.className='qa-band-alert';alert.setAttribute('role','alert');alert.innerHTML='<strong>'+t(current>max?'الراتب الحالي أعلى من الحد الأعلى للنطاق':'الراتب الحالي أقل من الحد الأدنى للنطاق',current>max?'Current salary is above the band maximum':'Current salary is below the band minimum')+'</strong><p>'+t('راجع الحالة مع إدارة التعويضات قبل اعتماد أي تعديل.','Review with Total Rewards before approving any adjustment.')+'</p>';result.querySelector('.cp-warning')?.before(alert);
 }
}
function localizeManpower(){
 const msg=document.querySelector('[data-mp-message]'),out=document.querySelector('[data-mp-results]');if(!msg)return;const text=msg.textContent.trim();
 if(ar()){
  if(/^Horizon must be an integer/.test(text))msg.textContent='أدخل الأفق بالسنوات عددًا صحيحًا من 1 إلى 10.';
  else{const key=text.replace(/ must be a valid number$/,'');if(MP_AR[key])msg.textContent='أدخل قيمة صحيحة في حقل «'+MP_AR[key]+'».';}
 }
 if(/must be|valid number/i.test(text)){if(out)out.innerHTML='';msg.classList.add('qa-error');}else msg.classList.remove('qa-error');
 if(ar())document.querySelectorAll('.mp-actions strong').forEach(el=>{const m=el.textContent.match(/^(HIRE|BUILD|MOVE|HOLD)(.*)$/);if(m){const names={HIRE:'توظيف',BUILD:'تطوير داخلي',MOVE:'إعادة توزيع',HOLD:'متابعة'};el.textContent=names[m[1]]+m[2].replace(/·\s*(\d+)/,'· $1 FTE');}});
 const th=[...document.querySelectorAll('.mp-table-wrap th')].find(x=>/عدد مقترح|Suggested headcount/.test(x.textContent));if(th)th.textContent=t('إجمالي العدد اللازم','Total headcount needed');
}
function localizeExamples(){
 if(!ar())return;
 if(location.hash==='#enterprise/manpower'){
  const E=window.MiyarManpower;if(E?.example){const map={strategy:'تنفيذ محفظة تحول رأس المال البشري في موعدها مع تحسين كفاءة العمليات والتقارير الإدارية',role:'مدير مشاريع وعمليات رأس المال البشري',department:'رأس المال البشري',family:'رأس المال البشري',unit:'مبادرات/وحدات خدمة موزونة'};for(const [id,v] of Object.entries(map)){const el=document.getElementById('mp-'+id);if(el)el.value=v;}}
 }
 if(location.hash==='#enterprise/compensation'){
  const vals={role:'مدير مشاريع وعمليات رأس المال البشري',grade:'G11 · مدير',source:'نطاق توضيحي للجهة — استبدله بمصدر إدارة التعويضات المعتمد'};for(const [id,v] of Object.entries(vals)){const el=document.getElementById('cp-'+id);if(el)el.value=v;}
 }
 if(location.hash==='#enterprise/create'&&window.MiyarODEngine?.hcExampleAr){const p=document.getElementById('miyar-od-workbench'),e=window.MiyarODEngine.hcExampleAr;if(p){p.querySelector('[data-od-strategy]').value=e.strategyObjective;p.querySelector('[data-od-responsibilities]').value=e.responsibilities;p.querySelector('[data-od-department]').value=e.department;p.querySelector('[data-od-saudization]').value=e.saudizationNote;}}
}

/* 4) Titles, deep links, unavailable controls and legacy copy. */
function presentationPolish(){
 const hash=location.hash;
 const title=hash==='#enterprise/manpower'?t('تخطيط القوى العاملة','Manpower planning'):hash==='#enterprise/compensation'?t('التعويضات','Compensation'):hash==='#demo'?t('المحرك الاستراتيجي','Strategic engine'):null;
 if(title){document.title=title+' | '+t('معيار','Miyar');const bc=document.getElementById('breadcrumb-title');if(bc)bc.textContent=title;}
 const deep=/^#home\/(capabilities|governance)$/.exec(hash);if(deep)setTimeout(()=>document.getElementById('lp-'+deep[1])?.scrollIntoView({behavior:'smooth',block:'start'}),60);
 document.querySelectorAll('.tafany-comparison,a[href*="tafany" i]').forEach(x=>x.remove());
 document.querySelectorAll('button').forEach(b=>{if(/الترشيح الدلالي|semantic recommendation/i.test(b.textContent))b.hidden=true;});
 document.querySelectorAll('p,.ent-note,small').forEach(x=>{if(/ChatGPT/i.test(x.textContent))x.remove();});
}
function markDemoSample(){
 if(location.hash!=='#demo')return;const heading=document.getElementById('demo-heading');if(heading){const parent=heading.closest('.page-heading');if(parent&&!parent.querySelector('.qa-demo-scope')){const n=document.createElement('p');n.className='qa-demo-scope';n.textContent=t('المحرك السريع يستخدم عينة من 5 مهن هندسية، ويبحث في دليل المهن الكامل عند عدم التطابق.','The quick engine uses a 5-engineering-role sample and falls back to the full occupation directory when needed.');parent.appendChild(n);}}
}

function afterRoute(){installSearchCompatibility();presentationPolish();markDemoSample();consumeHandoff();if(location.hash==='#demo')setTimeout(addDirectoryFallback,40);}
document.addEventListener('submit',e=>{if(e.target?.id==='role-form')setTimeout(addDirectoryFallback,70);},true);
document.addEventListener('click',e=>{
 const demoContinue=e.target.closest('.demo-v5-actions a[href="#enterprise/create"],.demo-v5-actions [data-demo-continue]');
 if(demoContinue){e.preventDefault();e.stopImmediatePropagation();saveHandoff(readDemoInput(),currentDemoRole());return;}
 if(e.target.closest('[data-cp-run]'))setTimeout(localizeCompensation,30);
 if(e.target.closest('[data-mp-run]'))setTimeout(localizeManpower,30);
 if(e.target.closest('[data-cp-example],[data-mp-example],[data-od-example]'))setTimeout(localizeExamples,30);
},true);
window.addEventListener('hashchange',()=>setTimeout(afterRoute,30));window.addEventListener('miyar:navigate',()=>setTimeout(afterRoute,30));
const observer=new MutationObserver(()=>{presentationPolish();if(location.hash==='#demo')setTimeout(addDirectoryFallback,30);if(location.hash==='#enterprise/create')consumeHandoff();});
observer.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(afterRoute,0);
window.MiyarQAReview={consumeHandoff,addDirectoryFallback,version:'2026-09-15'};
})();
