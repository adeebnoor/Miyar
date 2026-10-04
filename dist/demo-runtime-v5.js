(function(){
'use strict';
const RUN_KEY='miyar-demo-run-count-v5';
const GUIDE_KEY='miyar-guided-objective-v1';
function ar(){return document.documentElement.lang!=='en';}
function t(a,b){return ar()?a:b;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readInput(){return {objective:(document.getElementById('objective')?.value||'').trim(),domain:(document.getElementById('domain')?.value||'').trim(),seniority:(document.getElementById('seniority')?.value||'').trim(),constraints:(document.getElementById('constraints')?.value||'').trim()};}
function panel(){return document.getElementById('result-content');}
function badge(){return document.getElementById('result-badge');}
function runId(){let n=0;try{n=Number(sessionStorage.getItem(RUN_KEY)||0)+1;sessionStorage.setItem(RUN_KEY,String(n));}catch{n=Date.now()%1000;}return n;}
function stamp(){return new Date().toLocaleTimeString(ar()?'ar-SA':'en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function waiting(){outputGeneration++;const p=panel();if(!p||location.hash!=='#demo')return;p.innerHTML='<div class="demo-v5-wait"><span>INPUT → OUTPUT</span><h3>'+t('المدخلات جاهزة للتحليل','Input ready for analysis')+'</h3><p>'+t('اضغط «ابحث / حلّل الاحتياج». ستظهر نتيجة جديدة هنا مع رقم تشغيل ووقت واضحين.','Press “Find / analyze the need”. A fresh output will appear here with a visible run number and time.')+'</p></div>';if(badge())badge().textContent=t('بانتظار التشغيل','WAITING');}
const recordedRuns=new Set();
function recordRun(id,method,title){if(recordedRuns.has(id))return;recordedRuns.add(id);window.dispatchEvent(new CustomEvent('miyar:analysis-completed',{detail:{runId:id,method,title}}));}
function outputHeader(id,input){return '<div class="demo-v5-run"><span>'+t('OUTPUT GENERATED','OUTPUT GENERATED')+'</span><strong>Run #'+id+' · '+esc(stamp())+'</strong></div><div class="demo-v5-input"><b>INPUT</b><p>'+esc(input.objective)+'</p>'+(input.domain?'<small>'+t('المجال: ','Field: ')+esc(input.domain)+'</small>':'')+'</div>';}
function renderMatch(result,input,id){const r=result.role,p=panel();if(!p)return;recordRun(id,'rules',ar()?r.title:r.titleEn);const title=ar()?r.title:r.titleEn,reason=result.basis==='tasks'?(ar()?r.reason:r.reasonEn):t('تم العثور على سجل مطابق بالمسمى أو الرمز.','A matching title or occupation-code record was found.');p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output good"><div class="demo-v5-output-label">OUTPUT</div><h3>'+esc(title)+'</h3><div class="demo-v5-codes"><div><span>SSCO</span><strong>'+esc(r.code)+'</strong></div><div><span>'+t('رمز التعليم','Education code')+'</span><strong>'+esc(r.educationCode)+'</strong></div></div><p>'+esc(reason)+'</p><div class="demo-v5-actions"><button type="button" class="button button-primary" data-demo-continue>'+t('تابع إلى محرك OD الكامل','Continue to the full OD Engine')+'</button></div></div>';p.querySelector('[data-demo-continue]').onclick=()=>continueToOD(input,{title:r.title,occupationCode:r.code,educationFieldCode:r.educationCode});if(badge())badge().textContent=t('تم تحديث المخرج','OUTPUT UPDATED');}
function continueToOD(input,role={}){if(window.MiyarQAReview?.saveHandoff){window.MiyarQAReview.saveHandoff(input,role);return;}sessionStorage.setItem('miyar-demo-od-handoff-v2',JSON.stringify({input,role,need:input.objective,at:Date.now()}));location.hash='#enterprise/create';}
let directoryPromise=null,outputGeneration=0;
function directoryNodes(){
 if(!directoryPromise)directoryPromise=fetch('./classifications/ssco-2019.json').then(r=>{if(!r.ok)throw Error('directory-unavailable');return r.json();}).then(d=>{if(!Array.isArray(d.nodes)||!d.nodes.length)throw Error('directory-unavailable');return d.nodes;}).catch(e=>{directoryPromise=null;throw e;});
 return directoryPromise;
}
function validationMarkup(result){return '<section class="demo-validation"><h5>'+t('فحص الترشيح','Recommendation validation')+'</h5><ul>'+result.checks.map(c=>'<li data-check="'+esc(c.id)+'" data-status="'+c.status+'"><b>'+t(c.status==='pass'?'✓ اجتاز':c.status==='fail'?'✕ تعارض':'△ مراجعة',c.status==='pass'?'✓ Pass':c.status==='fail'?'✕ Conflict':'△ Review')+'</b> '+esc(ar()?c.ar:c.en)+'</li>').join('')+'</ul></section>';}
// Replaces the in-progress reason once the directory check has finished.
function settleReview(out,text){const reason=out.querySelector(':scope > p');if(reason)reason.textContent=text;}
function interpretationMarkup(recommendation){
 const d=recommendation?.detection,i=d?.interpretation;if(!i)return '';
 return '<details class="hr-context" open><summary>'+t('كيف قرأ معيار وصف العمل؟','How did Miyar read the work description?')+'</summary><p>'+t('فصل سياقي بقواعد محلية؛ راجع هذه القراءة، خصوصًا عند اجتماع أكثر من وظيفة.','Context separation using local rules; review this reading, especially for work spanning multiple functions.')+'</p><h5>'+t('المهام المستخدمة في الترشيح','Tasks used for recommendation')+'</h5><ul>'+i.clauses.map(x=>'<li dir="auto">'+esc(x)+'</li>').join('')+'</ul>'+(i.reporting.length?'<h5>'+t('جهات التقرير — لا تحدد وظيفة الدور أو مستواه','Reporting context — does not determine role function or level')+'</h5><ul>'+i.reporting.map(x=>'<li dir="auto">'+esc(x)+'</li>').join('')+'</ul>':'')+(i.collaboration?.length?'<h5>'+t('جهات التعاون — راجع دورها في نطاق العمل','Collaboration context — review its role in the work scope')+'</h5><ul>'+i.collaboration.map(x=>'<li dir="auto">'+esc(x)+'</li>').join('')+'</ul>':'')+(i.excluded.length?'<h5>'+t('قيود أو مهام مستبعدة من المطابقة','Constraints or tasks excluded from matching')+'</h5><ul>'+i.excluded.map(x=>'<li dir="auto">'+esc(x)+'</li>').join('')+'</ul>':'')+(d.workstreams.length>1?'<p>'+t('توجد إشارات لوظائف متعددة. اختر المجال الرئيسي لإعادة التحليل؛ هذه الخيارات لا تعني نسب تقسيم للعمل.','Signals span multiple functions. Choose the primary field to reanalyze; these options do not imply work-composition percentages.')+'</p><div class="action-row">'+d.workstreams.map(x=>'<button type="button" class="button button-outline" data-workstream-field="'+esc(ar()?x.family.ar:x.family.en)+'">'+esc(ar()?x.family.ar:x.family.en)+'</button>').join('')+'</div>':'')+'</details>';
}
async function directoryFallback(input,host){
 const generation=outputGeneration,C=window.MiyarEnterpriseCore,R=window.MiyarRoleRecommender;
 if(!C?.search||!host)return;
 const current=()=>generation===outputGeneration&&host.isConnected&&location.hash==='#demo';
 let occupations;
 try{occupations=(await directoryNodes()).filter(x=>x.level==='occupation');}
 catch(e){if(!current())return;const out=host.querySelector('.demo-v5-output');if(!out)return;out.insertAdjacentHTML('beforeend','<div class="demo-v5-directory" role="alert"><h4>'+t('تعذر تحميل دليل المهن','Occupation directory unavailable')+'</h4><p>'+t('تحقق من الاتصال ثم أعد المحاولة. لم يُستكمل التحقق من المرجع.','Check the connection and retry. Reference validation is incomplete.')+'</p><button class="button button-outline" type="button" data-demo-retry>'+t('إعادة المحاولة','Retry')+'</button></div>');out.querySelector('[data-demo-retry]').onclick=()=>{out.querySelector('.demo-v5-directory').remove();directoryFallback(input,host);};return;}
 if(!current())return;
 const out=host.querySelector('.demo-v5-output');if(!out)return;
 let recommendation=R?.recommend(input,occupations),rows=[];
 const query=C.normalize(input.objective),direct=occupations.find(r=>String(r.code)===R?.normalize(input.objective)||C.normalize(r.titleAr)===query);
 // An exact occupation lookup remains a lookup; an entered field/level requests validated analysis.
 if(direct&&!input.domain&&!input.seniority){recommendation=null;rows=[direct];}
 else if(recommendation){
  const r=recommendation.candidate;
  const related=R.catalog.roles.filter(x=>x.family===r.family).sort((a,b)=>(b.intent===r.intent)-(a.intent===r.intent)||(b.level===r.level)-(a.level===r.level));
  rows=[recommendation.source,...related.map(x=>occupations.find(o=>o.code===x.ssco))].filter(Boolean).filter((x,i,all)=>all.findIndex(y=>y.code===x.code)===i).slice(0,6);
 }else rows=C.search(occupations,input.objective).slice(0,5);
 const box=document.createElement('div');box.className='demo-v5-directory';
 if(!rows.length){box.innerHTML='<h4>'+t('لا يوجد مرجع مهني موثوق بعد','No confident occupation reference yet')+'</h4><p>'+t('أضف المجال والمسؤوليات، أو استخدم مسمى أو رمز SSCO. الأدلة الحالية غير كافية لإصدار مسمى نهائي.','Add the field and responsibilities, or use an SSCO title or code. Evidence is insufficient for a final title.')+'</p>';out.append(box);settleReview(out,t('فُحصت العينة السريعة ودليل المهن الموسّع؛ لا يوجد مرجع بأدلة كافية. يمكن توصيف المنصب وإحالته لمختص دون اختلاق رمز.','Checked the quick sample and the broader occupation directory; no reference has sufficient evidence. You can draft the position and refer it to a specialist without inventing a code.'));return;}
 if(!recommendation&&rows.length===1){const r=rows[0];recommendation={candidate:{titleAr:r.titleAr,titleEn:r.titleEn||r.titleAr,ssco:r.code,educationCodes:[],family:'directory'},source:r,checks:[{id:'ssco',status:'pass',ar:'المسمى والرمز موجودان في الدليل',en:'Title and code found in the directory'},{id:'tasks',status:'warn',ar:'مطابقة مرجع فقط؛ لم يُتحقق من ملاءمة المهام أو المستوى',en:'Reference lookup only; task and level suitability not validated'}],anchors:[],detection:{family:{ar:'الدليل المهني',en:'Occupation directory'}},finalTitle:{ar:r.titleAr,en:r.titleEn||r.titleAr}};}
 const r=recommendation?.candidate,hr=r?.family==='hc';
 const conflict=recommendation?.detection.conflict?'<div class="demo-domain-conflict" role="status">'+esc(t('المجال المدخل «'+input.domain+'»؛ إشارات الوصف تشمل «'+recommendation.detection.textFamily.ar+'». تم إعطاء الأولوية للمجال المدخل.','Entered field: '+input.domain+'. Task signals also indicate '+recommendation.detection.textFamily.en+'. The entered field takes priority.'))+' <button type="button" class="button button-outline" data-demo-switch>'+t('استخدم المجال المستنتج','Use detected field')+'</button></div>':'';
 const card=r?'<section class="demo-v5-primary-recommendation" data-hr-primary="'+(hr?esc(r.intent):'')+'" data-role-family="'+esc(r.family)+'"><span>'+t('المسمى المقترح','RECOMMENDED ROLE')+'</span><h4>'+esc(ar()?r.titleAr:r.titleEn)+'</h4><p>'+esc(ar()?recommendation.detection.family.ar:recommendation.detection.family.en)+'</p><div class="demo-v5-primary-source"><small>'+t('مرجع التصنيف','CLASSIFICATION REFERENCE')+'</small><strong>'+esc(r.ssco)+'</strong><b>'+esc(recommendation.source?.titleAr||t('غير متحقق','Unverified'))+'</b></div><p>'+t('رموز التعليم المقترحة: ','Proposed education codes: ')+esc(r.educationCodes.join(' · ')||t('تحتاج تحديدًا','To be specified'))+'</p>'+conflict+validationMarkup(recommendation)+'<div class="demo-final-title"><span>'+t('المسمى النهائي المقترح — بانتظار الاعتماد','FINAL PROPOSED TITLE — APPROVAL PENDING')+'</span><strong>'+esc(recommendation.finalTitle?(ar()?recommendation.finalTitle.ar:recommendation.finalTitle.en):t('محجوب بسبب تعارض','Blocked by a validation conflict'))+'</strong></div><p>'+t('دليل الترشيح: ','Matched evidence: ')+(recommendation.anchors.length?recommendation.anchors.map(x=>'<mark>'+esc(x)+'</mark>').join(' '):t('المجال أو المرجع المدخل','Entered field or reference'))+'</p><small>'+t('مطابقة قواعد قابلة للفحص؛ ليست نسبة ثقة إحصائية.','Inspectable rule matching; not a statistical confidence score.')+'</small>'+(recommendation.finalTitle?'<button type="button" class="button button-primary" data-demo-primary-hr>'+t('استخدم هذا الترشيح','Use this recommendation')+'</button>':'')+'</section>':'';
 const hrAll=hr?occupations.filter(x=>['1212','2423','2424'].includes(String(x.parent))||['333306','334103','431300','441601','441602','441603','441604'].includes(x.code)):[];
 box.innerHTML=card+interpretationMarkup(recommendation)+'<h4>'+t('مراجع مرتبطة للمراجعة','Related references for review')+'</h4><p>'+t('يظهر المرجع الأقرب للمهمة والمستوى أولًا. البدائل ليست اعتمادًا تلقائيًا.','The closest task and level reference appears first. Alternatives are not automatic approvals.')+'</p><ul>'+rows.map((r,i)=>'<li><button type="button" class="button button-outline" data-demo-ref="'+i+'"><strong>'+esc(r.code)+'</strong> · '+esc(r.titleAr)+'</button></li>').join('')+'</ul>'+(hrAll.length?'<details class="demo-v5-hr-all"><summary>'+t('عرض أدوار الموارد البشرية في الدليل ('+hrAll.length+')','Show HR-related roles in the supplied directory ('+hrAll.length+')')+'</summary><ul>'+hrAll.map((r,i)=>'<li><button type="button" class="button button-outline" data-demo-hr-ref="'+i+'">'+esc(r.code)+' · '+esc(r.titleAr)+'</button></li>').join('')+'</ul></details>':'');
 out.appendChild(box);
 if(!r)settleReview(out,t('وُجدت مراجع مرتبطة في دليل المهن؛ اختر الأقرب للمهام والمستوى للمراجعة.','Related references were found in the occupation directory; choose the closest match to the tasks and level for review.'));
 if(r){out.classList.remove('review');out.classList.add('good');out.querySelector(':scope > h3').textContent=t('الترشيح الأولي','Preliminary recommendation');out.querySelector(':scope > p').textContent=t('تم تحديد المسمى وربطه بمرجعه وفحصه وفق المدخلات.','The title was linked to its reference and checked against the input.');out.querySelector('.demo-v5-actions')?.remove();if(badge())badge().textContent=t('ترشيح أولي','PRELIMINARY RECOMMENDATION');}
 box.querySelector('[data-demo-primary-hr]')?.addEventListener('click',()=>continueToOD(input,{title:ar()?r.titleAr:r.titleEn,occupationCode:r.ssco,educationFieldCode:r.educationCodes[0]||''}));
 box.querySelectorAll('[data-workstream-field]').forEach(b=>b.onclick=()=>{document.getElementById('domain').value=b.dataset.workstreamField;document.getElementById('role-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 box.querySelector('[data-demo-switch]')?.addEventListener('click',()=>{document.getElementById('domain').value=ar()?recommendation.detection.textFamily.ar:recommendation.detection.textFamily.en;document.getElementById('role-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 box.querySelectorAll('[data-demo-ref]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.demoRef)];continueToOD(input,{title:r.titleAr,occupationCode:r.code});});
 box.querySelectorAll('[data-demo-hr-ref]').forEach(b=>b.onclick=()=>{const r=hrAll[Number(b.dataset.demoHrRef)];continueToOD(input,{title:r.titleAr,occupationCode:r.code});});
}
function renderReview(result,input,id){const p=panel();if(!p)return;recordRun(id,'rules','');const reason=t('جارٍ التحقق من المجال والمستوى والمرجع المهني.','Checking the field, level and occupation reference.');p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output review"><div class="demo-v5-output-label">OUTPUT</div><h3>'+t('تم إنشاء مخرج — يحتاج مراجعة','Output generated — review required')+'</h3><p>'+esc(reason)+'</p><p class="demo-v5-limit">'+t('يبدأ المحرك بعينة سريعة، ثم يستخدم دليل المهن الأوسع للمجالات الأخرى عندما تتوفر أدلة كافية. المراجع المعروضة تحتاج مراجعة بشرية قبل الاعتماد.','The quick engine starts with a small sample, then uses the broader occupation directory for other domains when sufficient evidence is available. Displayed references require human review before approval.')+'</p><div class="demo-v5-actions"><button type="button" class="button button-primary" data-demo-continue>'+t('افتح محرك OD الكامل','Open full OD Engine')+'</button></div></div>';p.querySelector('[data-demo-continue]').onclick=()=>continueToOD(input);directoryFallback(input,p);if(badge())badge().textContent=t('مخرج للمراجعة','REVIEW OUTPUT');}
function renderError(message){const p=panel();if(!p)return;p.innerHTML='<div class="demo-v5-output error"><div class="demo-v5-output-label">OUTPUT</div><h3>'+t('أكمل المدخل المطلوب','Complete the required input')+'</h3><p>'+esc(message)+'</p></div>';if(badge())badge().textContent=t('مدخل ناقص','INPUT REQUIRED');}
function analyze(event){const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='role-form')return;event.preventDefault();event.stopImmediatePropagation();const engine=window.MiyarEngine,data=window.MIYAR_DATA,input=readInput(),error=document.getElementById('form-error');if(!engine||!data?.roles){renderError(t('تعذر تحميل محرك التحليل. أعد تحميل الصفحة.','The analysis engine did not load. Reload the page.'));return;}if(!input.objective){if(error){error.textContent=t('أدخل المسمى أو وصف المهام أولًا.','Enter a title or task description first.');error.hidden=false;}renderError(t('أدخل المسمى أو وصف المهام أولًا.','Enter a title or task description first.'));return;}if(error)error.hidden=true;outputGeneration++;const id=runId();if(document.getElementById('demo-engine-mode')?.value==='ai'){runStrategicAI(input,id);return;}let result;try{result=engine.classify(input,data.roles);}catch(e){renderError(e.message||t('تعذر إكمال التحليل.','Analysis could not be completed.'));return;}if(result.kind==='match'&&(!window.MiyarRoleRecommender?.detect(input)||(!input.domain&&!input.seniority)))renderMatch(result,input,id);else renderReview(result,input,id);const rp=document.querySelector('.result-panel');if(rp){rp.classList.remove('analysis-complete');void rp.offsetWidth;rp.classList.add('analysis-complete');if(window.innerWidth<1100)rp.scrollIntoView({behavior:'smooth',block:'start'});}const heading=document.getElementById('result-heading');heading?.focus?.({preventScroll:true});}
async function runStrategicAI(input,id){
 const p=panel(),generation=outputGeneration;if(!p)return;
 const submit=document.querySelector('#role-form button[type=submit]');if(submit)submit.disabled=true;
 const current=()=>generation===outputGeneration&&p.isConnected&&location.hash==='#demo';
 p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output review"><h3>'+t('المحرك الدلالي: Embedding + LLM','Semantic pipeline: Embedding + LLM')+'</h3><p>'+t('جارٍ التحقق من جاهزية خدمة الذكاء الاصطناعي…','Checking the AI service configuration…')+'</p></div>';
 try{
  const base=window.MiyarEnterprise?.apiBase?.()||window.MIYAR_CONFIG?.apiBase||'',response=await fetch(base+'/api/v1/analyze/strategic/status',{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error(t('المحرك الأصلي غير مفعّل على الخادم الحالي. نتائج القواعد لا تعني تشغيل Embedding أو LLM.','The original pipeline is not deployed on this server. Rule-based results do not mean embeddings or an LLM are active.'));
  const state=await response.json();if(!current())return;
  if(!state.configured)throw Error(t('خدمة الذكاء الاصطناعي لم تُهيأ بعد. يتولى مسؤول معيار إضافة مفتاح المزود على الخادم؛ لا يحتاج المختبر إلى مشاركة أي مفتاح.','The AI service is not configured yet. The Miyar administrator must add the server-side provider key; reviewers do not need to share any API key.'));
  if(!input.domain||!input.seniority)throw Error(t('أدخل المجال والمستوى قبل تشغيل المحرك الأصلي.','Enter the domain and seniority before running the original pipeline.'));
  if(!document.getElementById('demo-ai-consent')?.checked)throw Error(t('اقرأ إشعار إرسال البيانات وحدد الموافقة أولًا.','Read and accept the AI data-processing notice first.'));
  const body={text:input.objective,field:input.domain,seniority:input.seniority,constraints:input.constraints,consentExternalProcessing:true};
  let result,reviewState=null;
  if(window.MiyarEnterprise?.session?.())result=await window.MiyarEnterprise.analyzeStrategic(body);
  else{
   reviewState=await expertStatus(base);if(!current())return;
   if(!reviewState.enabled)throw Error(t('وصول الخبراء إلى AI منتهي أو غير مفعّل. بقية أدوات الموقع متاحة، ويمكن استخدام حساب المؤسسة عند توفره.','Expert AI access has expired or is disabled. Other site tools remain available; an organization account can be used when available.'));
   if(input.objective.length<15||input.objective.length>2500||input.domain.length<2||input.domain.length>120||input.seniority.length<2||input.seniority.length>120)throw Error(t('في تجربة AI العامة: الهدف 15–2500 حرف، والمجال والمستوى 2–120 حرفًا. التحليل المحلي يقبل وصفًا حتى 12000 حرف.','For the public AI trial: objective 15–2500 characters; field and seniority 2–120. Local analysis accepts descriptions up to 12000 characters.'));
   const response=await fetch(base+'/api/v1/review/strategic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300000)});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:t('تعذر إكمال التحليل. راجع المدخلات أو أعد المحاولة لاحقًا.','Analysis did not complete. Check the input or retry later.'));
   result=data;
  }
  if(!current())return;
  p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output '+(result.finalTitle?'good':'review')+'"><h3>'+t(result.route==='matched-objective'?'مطابقة هدف استراتيجي':'مسمى مولّد — يحتاج تصنيفًا',result.route==='matched-objective'?'Strategic-objective match':'Generated title — classification review required')+'</h3><p>'+t('التشابه الدلالي: ','Cosine similarity: ')+esc(result.cosineSimilarity)+' · '+t('ليس احتمال ثقة','not a confidence probability')+'</p><p dir="ltr">'+esc(result.embeddingModel||state.embeddingModel||'')+' → '+esc(result.generationModel||state.generationModel||'')+'</p><p>'+esc(result.validation?.rationale||'')+'</p><div class="demo-final-title"><span>'+t('المسمى النهائي المقترح','FINAL PROPOSED TITLE')+'</span><strong>'+esc(result.finalTitle||t('محجوب للمراجعة','Blocked for review'))+'</strong></div><p>SSCO: '+esc(result.occupationCode||t('غير مربوط — لا يوجد رمز معتمد لهذا المقترح','Unmapped — no approved code attached to this proposal'))+'</p><p>'+esc(result.finalRationale||'')+'</p><small>'+t('عدم المطابقة داخل البيانات المتاحة لا يثبت أن الوظيفة جديدة أو غير موجودة في التصنيف الرسمي.','No match in the available corpus does not establish that the role is new or absent from the official classification.')+'</small>'+(result.finalTitle?'<button type="button" class="button button-primary" data-ai-use>'+t('استخدم المقترح في OD','Use proposal in OD')+'</button>':'')+'</div>';
  if(reviewState)p.querySelector('.demo-v5-output').insertAdjacentHTML('beforeend','<p class="demo-expert-status">'+expertLabel(reviewState)+'</p>');
  recordRun(id,'ai',result.finalTitle||'');
  attachExpertFeedback(p,input,result);
  p.querySelector('[data-ai-use]')?.addEventListener('click',()=>continueToOD(input,{title:result.finalTitle,occupationCode:result.occupationCode||'',educationFieldCode:result.educationCode||''}));if(badge())badge().textContent=t('مقترح AI للمراجعة','AI PROPOSAL FOR REVIEW');
  if(window.innerWidth<1100)p.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){if(!current())return;p.querySelector('.demo-v5-output').innerHTML='<h3>'+t('لم يكتمل مسار الذكاء الاصطناعي','AI pipeline did not complete')+'</h3><p role="alert">'+esc(e.name==='TimeoutError'?t('لم يستجب الخادم. أعد المحاولة لاحقًا.','The server did not respond. Retry later.'):e.message)+'</p>';if(badge())badge().textContent=t('AI غير متاح','AI UNAVAILABLE');}
 finally{if(submit?.isConnected)submit.disabled=false;}
}
async function expertStatus(base){
 const r=await fetch(base+'/api/v1/review/strategic/status',{signal:AbortSignal.timeout(90000)});
 if(!r.ok)throw Error(t('تعذر التحقق من وصول الخبراء إلى AI. حاول لاحقًا.','Could not check expert AI access. Try later.'));
 return r.json();
}
function expertLabel(state){
 const end=new Date(state.expiresAt),date=Number.isNaN(end.valueOf())?'':end.toLocaleString(ar()?'ar-SA-u-ca-gregory':'en-GB',{timeZone:'Asia/Riyadh'});
 return esc(t('تجربة AI للخبراء حتى '+date+' بتوقيت الرياض. الحد المشترك '+state.dailyLimit+' محاولة يوميًا. مسودات بقية الأقسام محفوظة على هذا الجهاز؛ الاعتماد المؤسسي يحتاج حسابًا.','Expert AI access until '+date+' (Riyadh). Shared limit: '+state.dailyLimit+' attempts per day. Other sections keep drafts on this device; organization approval requires an account.'));
}
function attachExpertFeedback(host,input,result){
 const box=document.createElement('details');box.className='demo-expert-feedback';
 box.innerHTML='<summary>'+t('ملاحظات الخبير وتنزيل نتيجة الاختبار','Expert feedback and test-result download')+'</summary><label for="demo-expert-comment">'+t('ملاحظاتك والتعديل المقترح','Comments and proposed correction')+'</label><textarea id="demo-expert-comment" rows="3" maxlength="2000"></textarea><p>'+t('التنزيل يحفظ المدخلات والنتيجة والملاحظة في ملف على جهازك؛ لا يرسل التقييم تلقائيًا.','Download saves input, result and comments to a file on your device; feedback is not submitted automatically.')+'</p><button type="button" class="button button-outline" data-ai-download>'+t('تنزيل النتيجة والملاحظات','Download result and feedback')+'</button>';
 box.querySelector('button').onclick=()=>{const data={application:'Miyar',version:window.MIYAR_RELEASE?.version||'5.1.0',exportedAt:new Date().toISOString(),input,result,feedback:box.querySelector('textarea').value},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Miyar-full-site-review-'+Date.now()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 host.append(box);
}
function engineModeControls(form){
 if(form.querySelector('#demo-engine-mode'))return;
 const box=document.createElement('div');box.className='demo-engine-choice';box.innerHTML='<label for="demo-engine-mode">'+t('مسار التحليل','Analysis method')+'</label><select id="demo-engine-mode"><option value="rules">'+t('الترشيح المرجعي بالقواعد — متاح الآن','Reference and rule-based recommendation — available now')+'</option><option value="ai">'+t('المحرك الدلالي — Embedding ثم LLM','Semantic pipeline — Embedding then LLM')+'</option></select><p>'+t('مسار AI يطابق الهدف بأهداف مخزنة، ثم يستخدم LLM للتوليد والتحقق. متاح للخبراء خلال فترة التجربة دون حساب. عينة الأهداف الأصلية تضم 5 أهداف هندسية فقط؛ المقترحات الأخرى تحتاج مراجعة.','The AI path matches strategic-objective examples, then uses an LLM to generate and validate titles. Experts can use it without an account during the trial. The original corpus contains only 5 engineering objectives; other proposals need review.')+'</p><label class="demo-ai-notice" hidden><input type="checkbox" id="demo-ai-consent">'+t('أوافق على إرسال الهدف والمجال والمستوى والقيود إلى مزود Embedding المهيأ وGoogle Gemini عند تشغيل الخدمة. لا أُدخل بيانات شخصية.','I agree to send the objective, domain, level and constraints to the configured embedding provider and Google Gemini when the service runs. I will not enter personal data.')+'</label>';
 const examples=document.createElement('div');examples.className='demo-ai-examples';examples.hidden=true;
 examples.innerHTML='<button type="button" class="button button-outline" data-ai-example>'+t('تحميل مثال رواتب للاختبار','Load payroll test example')+'</button><p class="demo-expert-status" role="status"></p>';
 box.append(examples);
 examples.querySelector('button').onclick=()=>{const values={objective:'رفع دقة احتساب الرواتب والاستقطاعات ومراجعة مسيرات الأجور وتسوية فروقات الرواتب وإعداد تقارير شهرية لمدير المالية دون إدارة فريق.',domain:'الموارد البشرية والرواتب',seniority:'أخصائي',constraints:'دور تخصصي فردي وليس مديرًا. يرفع تقاريره إلى مدير المالية.'};for(const [id,value] of Object.entries(values)){const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));}box.querySelector('#demo-ai-consent').checked=false;};
 form.querySelector('.run-button')?.before(box);
 box.querySelector('select').addEventListener('change',e=>{box.querySelector('.demo-ai-notice').hidden=e.target.value!=='ai';examples.hidden=e.target.value!=='ai';waiting();
  if(e.target.value==='ai'&&!window.MiyarEnterprise?.session?.()){
   const notice=examples.querySelector('[role=status]');notice.textContent=t('جارٍ التحقق من وصول الخبراء…','Checking expert access…');
   expertStatus(window.MiyarEnterprise?.apiBase?.()||window.MIYAR_CONFIG?.apiBase||'').then(state=>{if(!box.isConnected)return;notice.innerHTML=state.enabled&&state.configured?expertLabel(state):esc(t('تجربة AI غير متاحة حاليًا؛ أدوات الموقع الأخرى متاحة.','Expert AI access is currently unavailable; other site tools remain available.'));}).catch(()=>{if(box.isConnected)notice.textContent=t('تعذر التحقق من الاتصال. يمكنك إعادة المحاولة.','Connection check failed. You can retry.');});
  }
 });
}
function onInput(event){if(location.hash!=='#demo')return;if(!['objective','domain','seniority','constraints'].includes(event.target?.id))return;waiting();}
function labelPanels(){if(location.hash!=='#demo')return;const form=document.getElementById('role-form');if(!form)return;engineModeControls(form);const inputPanel=form.closest('.panel');const resultPanel=document.querySelector('.result-panel');if(inputPanel&&!inputPanel.querySelector('.demo-v5-io-label'))inputPanel.insertAdjacentHTML('afterbegin','<div class="demo-v5-io-label">INPUT</div>');if(resultPanel&&!resultPanel.querySelector('.demo-v5-io-label'))resultPanel.insertAdjacentHTML('afterbegin','<div class="demo-v5-io-label">OUTPUT</div>');if(!form.dataset.v5Primed){form.dataset.v5Primed='1';waiting();}}
function consumeGuidedObjective(){
 if(location.hash!=='#demo')return;
 const form=document.getElementById('role-form'),objective=document.getElementById('objective');
 if(!form||!objective||form.dataset.guidedConsumed)return;
 let value='';try{value=sessionStorage.getItem(GUIDE_KEY)||'';}catch{}
 if(!value)return;
 form.dataset.guidedConsumed='1';
 try{sessionStorage.removeItem(GUIDE_KEY);}catch{}
 objective.value=value;
 objective.dispatchEvent(new Event('input',{bubbles:true}));
 setTimeout(()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})),0);
}
function prime(){labelPanels();if(location.hash==='#demo'){let requested=false;try{requested=sessionStorage.getItem('miyar-open-ai')==='1';if(requested)sessionStorage.removeItem('miyar-open-ai');}catch{}const mode=document.getElementById('demo-engine-mode');if(requested&&mode){mode.value='ai';mode.dispatchEvent(new Event('change',{bubbles:true}));}}consumeGuidedObjective();}
document.addEventListener('submit',analyze,true);
// Clear legacy cards after the base form updates its own input state.
document.addEventListener('input',onInput);
window.addEventListener('hashchange',()=>setTimeout(prime,0));
window.addEventListener('miyar:navigate',()=>setTimeout(prime,0));
new MutationObserver(()=>{if(window.location?.hash==='#demo')setTimeout(prime,0);}).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',prime);setTimeout(prime,0);
window.MiyarDemoRuntimeV5={analyze,waiting,prime,directoryFallback};
})();
