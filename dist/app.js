(function(){
 'use strict';
 const data=window.MIYAR_DATA,engine=window.MiyarEngine;
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const paths={
  spark:'<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z"/><path d="m20 2 .7 2.3L23 5l-2.3.7L20 8l-.7-2.3L17 5l2.3-.7Z"/>',
  chart:'<path d="M4 20h16M7 16v-5m5 5V5m5 11V8"/>',
  route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  present:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-3-13 6 3-6 3Z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  reset:'<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  building:'<path d="M3 21h18M6 21V5l7-2v18m0-13h5v13M9 7v2m0 3v2m0 3v2m7-8v2m0 3v2"/>',
  gear:'<path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-1 1-3 3-1 2-3-2-2 1-4-3-2-3 1-2-4Z"/><circle cx="12" cy="12" r="3"/>',
  flask:'<path d="M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
  mountain:'<path d="m2 21 8-16 7 16m-4-11 3-6 7 17H2m5-10 3 2 3-2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  arrow:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  document:'<path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h5"/>',
  users:'<circle cx="10" cy="8" r="3"/><path d="M4 21v-3a6 6 0 0 1 12 0v3m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v2"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  flag:'<path d="M5 21V3c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>'
 };
 function icon(name){return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.document)+'</svg>';}
 function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
 const labels={demo:'تجربة التصنيف',value:'القيمة والأثر',journey:'رحلة القرار',catalog:'دليل المهن'};
 let currentResult=null,currentInput=null,isStale=false,eventCounter=0,sessionEvents=[],slideIndex=0;
 let toastTimer;
 const presentation=$('presentation');
 function getInput(){return {objective:$('objective').value.trim(),domain:$('domain').value,seniority:$('seniority').value,constraints:$('constraints').value.trim()};}
 function countText(){$('objective-count').textContent=$('objective').value.length+' / 1600';}
 function announce(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
 function showView(view){
  if(!Object.hasOwn(labels,view))view='demo';
  document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+view);
  document.querySelectorAll('.nav-link').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('breadcrumb-title').textContent=labels[view];
  document.title=labels[view]+' | معيار';
 }
 function navigate(view){if(location.hash==='#'+view)showView(view);else location.hash=view;}
 function addEvent(type,message){
  eventCounter++;
  sessionEvents.unshift({id:eventCounter,time:new Date(),type,message});
  $('session-count').textContent=eventCounter+' أحداث';
  $('session-log').innerHTML=sessionEvents.slice(0,5).map(e=>'<div class="log-entry"><time datetime="'+e.time.toISOString()+'">'+escape(e.time.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))+'</time><span><b>'+escape(e.type)+'</b> — '+escape(e.message)+'</span></div>').join('');
 }
 function setScenario(id){
  $('seniority').value='professional';$('domain').value='all';$('constraints').value='';
  $('objective').value=id==='emerging'?data.emergingObjective:data.roles.find(r=>r.id===id)?.scenario||data.roles[0].scenario;
  $('form-error').hidden=true;$('objective').removeAttribute('aria-invalid');
  document.querySelectorAll('.scenario').forEach(el=>{el.classList.toggle('selected',el.dataset.scenario===id);el.setAttribute('aria-pressed',String(el.dataset.scenario===id));});
  countText();currentInput=getInput();currentResult=engine.classify(currentInput,data.roles);isStale=false;renderResult('مثال جاهز');
 }
 function markStale(){
  countText();isStale=true;
  $('result-badge').textContent='مدخلات معدّلة';
  const note=$('stale-note');if(note)note.hidden=false;
  ['review-btn','export-btn'].forEach(id=>{if($(id))$(id).disabled=true;});
  document.querySelectorAll('.scenario').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-pressed','false');});
 }
 function renderResult(badge='ترشيح أولي'){
  $('result-badge').textContent=badge;
  if(currentResult.kind!=='match'){
   const ambiguous=currentResult.kind==='ambiguous';
   $('result-content').innerHTML='<div id="stale-note" class="stale-note" hidden>تغيّر الاحتياج. أعد التحليل لتحديث النتيجة.</div><div class="empty-result"><span class="role-icon">'+icon('route')+'</span><div class="occupation-kicker">مسار المراجعة البشرية</div><h3>'+(ambiguous?'نحتاج إلى تحديد أدق.':'هذا الاحتياج خارج تغطية العينة.')+'</h3><p>'+escape(currentResult.reason||currentResult.message)+'</p>'+(currentResult.candidates?.length?'<div class="term-chips">'+currentResult.candidates.map(x=>'<span class="term-chip">'+escape(x)+'</span>').join('')+'</div>':'')+'<p class="empty-note">لم يُنشأ رمز مهني أو تعليمي لهذا الاحتياج. في التصور المستهدف، يُجهّز الدور الناشئ كمقترح للمراجعة قبل اعتماده.</p><button class="button button-light" id="use-sample">تجربة احتياج من العينة '+icon('arrow')+'</button></div>';
   $('use-sample').addEventListener('click',()=>setScenario('industrial'));
   return;
  }
  const r=currentResult.role;
  const reviewed=currentResult.review==='acknowledged';
  const checks=[
   {text:'المسمى والرمز مرتبطان بالسجل نفسه في عينة المشروع.',type:'check'},
   {text:currentInput.domain==='all'?'المجال ضمن العينة الهندسية المتاحة.':'المجال المحدد متوافق مع تخصص السجل المرشح.',type:'check'},
   ...currentResult.notes.map(text=>({text,type:'info',warn:true}))
  ];
  $('result-content').innerHTML='<div id="stale-note" class="stale-note" hidden>تغيّر الاحتياج. أعد التحليل لتحديث الترشيح.</div>'+ 
   '<div class="result-top"><div><div class="occupation-kicker">المسمى المرجعي المقترح</div><h3>'+escape(r.title)+'</h3><div class="english-title" lang="en">'+escape(r.titleEn)+'</div></div><span class="role-icon">'+icon(r.icon)+'</span></div>'+ 
   '<div class="result-body"><div class="code-grid"><div class="code-tile"><span>الرمز المهني · SSCO</span><strong>'+r.code+'</strong></div><div class="code-tile"><span>رمز التعليم في العينة</span><strong>'+r.educationCode+'</strong></div><div class="code-tile"><span>المستوى المطلوب</span><strong>'+escape(data.seniority[currentInput.seniority])+'</strong></div></div>'+ 
   '<h4 class="result-subheading">'+icon('spark')+'لماذا هذا الدور؟</h4><p class="reason-text">'+escape(r.reason)+'</p><div class="term-chips">'+currentResult.groups.map(g=>'<span class="term-chip">'+escape(g.label)+'</span>').join('')+'</div>'+ 
   '<h4 class="result-subheading">'+icon('shield')+'فحوص الترشيح</h4><div class="gate-list">'+checks.map(c=>'<div class="gate-row '+(c.warn?'warn':'')+'"><span>'+icon(c.type)+'</span><span>'+escape(c.text)+'</span></div>').join('')+'</div>'+ 
   '<div class="decision-status '+(reviewed?'approved':'')+'">'+icon(reviewed?'check':'clock')+'<span>'+(reviewed?'تم تسجيل الاطلاع في الديمو — دون اعتماد مهني.':'ترشيح أولي — بانتظار مراجعة بشرية.')+'</span></div>'+ 
   '<div class="result-actions"><button id="review-btn" class="button button-light" '+(reviewed?'disabled':'')+'>'+icon('eye')+(reviewed?'سُجّلت المراجعة':'تسجيل الاطلاع')+'</button><button id="export-btn" class="button button-outline">'+icon('download')+'بطاقة القرار</button></div>'+ 
   '<p class="source-caption">المصدر: '+escape(data.source)+'. الترجمات والتفسير أُعدّا للعرض؛ رموز المهن والتعليم من الملف المرفق.</p></div>';
  $('review-btn').addEventListener('click',()=>{
   if(isStale||currentResult.kind!=='match')return;
   currentResult.review='acknowledged';addEvent('اطلاع المراجع',currentResult.role.title+' — تم تسجيل الاطلاع في العرض، دون اعتماد رسمي.');renderResult('سُجّل الاطلاع');
  });
  $('export-btn').addEventListener('click',exportDecision);
 }
 function exportDecision(){
  if(isStale||!currentResult||currentResult.kind!=='match')return;
  const record=engine.decisionRecord(currentResult,currentInput,'MIYAR-DEMO-'+Date.now());
  const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Miyar-Decision-'+currentResult.role.code+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  addEvent('تصدير بطاقة',currentResult.role.title+' — الرمز '+currentResult.role.code);announce('تم تنزيل بطاقة القرار بصيغة JSON.');
 }
 function renderScenarios(){
  $('scenarios').innerHTML=data.scenarios.map(s=>'<button type="button" class="scenario" data-scenario="'+s.id+'" aria-pressed="false"><span class="scenario-icon" data-icon="'+s.icon+'"></span><span><strong>'+escape(s.title)+'</strong><small>'+escape(s.subtitle)+'</small></span><span class="scenario-arrow" aria-hidden="true">↗</span></button>').join('');
  $('scenarios').addEventListener('click',e=>{const btn=e.target.closest('[data-scenario]');if(btn)setScenario(btn.dataset.scenario);});
 }
 function renderValue(){
  $('view-value').innerHTML='<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span>القيمة التي يستهدفها معيار</div><h1 id="value-heading">لغة مشتركة <span>للقرار الوظيفي.</span></h1><p>بين ما تحتاجه المؤسسة، وما يؤديه الدور، وكيف يُصنَّف.</p></div></div>'+ 
  '<section class="narrative-hero"><div><div class="eyebrow">التحدي</div><h2>الهدف واضح.<br>لكن <span>ما الدور الذي يحققه؟</span></h2><p>تختلف المسميات بين الجهات، وتتوزع مبررات الاختيار بين الأوصاف والجداول والمراسلات. يستهدف معيار جمعها في قرار واضح يمكن مراجعته والرجوع إلى مصدره.</p></div><div class="narrative-visual"><div>'+icon('target')+'هدف المؤسسة<small>لماذا نحتاج الدور؟</small></div><div>'+icon('layers')+'المهنة المرجعية<small>ما الذي يطابق المهام؟</small></div><div>'+icon('document')+'أدلة القرار<small>لماذا هذا الترشيح؟</small></div></div></section>'+ 
  '<div class="value-cards"><article class="value-card"><span class="card-icon">'+icon('users')+'</span><h3>اتساق في تعريف الأدوار</h3><p>ربط المهام بمسمى مرجعي ورمز مهني، ليبدأ تخطيط الوظائف والتواصل بين الإدارات من تعريف مشترك.</p><span class="value-audience">للموارد البشرية وتخطيط القوى العاملة</span></article><article class="value-card"><span class="card-icon">'+icon('eye')+'</span><h3>تفسير يمكن مناقشته</h3><p>تظهر صلة الترشيح بالاحتياج، والاعتبارات التي ما زالت تحتاج إلى مراجعة، بدل الاكتفاء بمسمى مقترح.</p><span class="value-audience">للمراجعين وقادة الفرق</span></article><article class="value-card"><span class="card-icon">'+icon('route')+'</span><h3>مسار واضح للحالات الجديدة</h3><p>عندما لا تكفي الأدلة، يُحال الاحتياج إلى مراجعة. التصور المستهدف يدعم توصيف الأدوار الناشئة دون منحها رمزًا معتمدًا تلقائيًا.</p><span class="value-audience">للتحول المؤسسي وتطوير الأدوار</span></article></div>'+ 
  '<h2 class="section-heading">كيف تتغير طريقة العمل؟</h2><div class="comparison-wrap" tabindex="0" role="region" aria-label="مقارنة أسلوب العمل"><table><thead><tr><th scope="col">خطوة العمل</th><th scope="col">التحدي المعتاد</th><th scope="col">ما يستهدفه معيار</th></tr></thead><tbody><tr><td>تحديد الوظيفة</td><td>البدء من مسمى قد لا يشرح المهام</td><td>البدء من المهام والنتيجة المطلوبة</td></tr><tr><td>اختيار التصنيف</td><td>البحث المنفصل عن المسمى ورمزه</td><td>إظهار المسمى والرمز من سجل واحد</td></tr><tr><td>مراجعة الترشيح</td><td>مبررات موزعة أو غير موثقة</td><td>الاحتياج والأسباب والاعتبارات في بطاقة واحدة</td></tr><tr><td>احتياج غير مألوف</td><td>إجباره على مسمى متاح</td><td>تحديد حدود المطابقة وإحالته للمراجعة</td></tr></tbody></table></div>'+ 
  '<div class="pilot-note"><strong>الخطوة التالية: تجربة مؤسسية تقيس القيمة.</strong>مقارنة زمن التصنيف واتفاق الخبراء واكتمال التوثيق على أوصاف وظيفية واقعية. هذه نتائج مستهدفة للقياس؛ لا يعرض الديمو نسب دقة أو وفورات مثبتة.</div>';
 }
 function renderJourney(){
  const steps=[
   ['فهم الاحتياج','وصف المهام والنتيجة المطلوبة، وتحديد المجال ومستوى الخبرة والقيود.'],
   ['البحث عن مرجع مهني','ربط أدلة المهام بسجل مهني محدد، مع الحفاظ على العلاقة بين المسمى والرمز.'],
   ['تفسير الترشيح وفحص السياق','إظهار الأدلة التي قادت للاقتراح، وإبراز ما يحتاج إلى مراجعة أو استكمال.'],
   ['مراجعة القرار وتوثيقه','الاحتفاظ بالمدخلات والمرجع والأسباب وحالة الاطلاع في بطاقة يمكن مشاركتها.']
  ];
  $('view-journey').innerHTML='<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span>منهجية معيار</div><h1 id="journey-heading">كل ترشيح <span>له مسار واضح.</span></h1><p>التصنيف خطوة داخل رحلة تبدأ بالاحتياج وتنتهي بالمراجعة.</p></div></div>'+ 
  '<div class="journey-layout"><div class="journey-steps">'+steps.map((s,i)=>'<article class="journey-step"><span class="journey-number">0'+(i+1)+'</span><div><h3>'+s[0]+'</h3><p>'+s[1]+'</p></div></article>').join('')+'</div><div class="journey-detail"><aside class="journey-side"><span>'+icon('shield')+'</span><h3>حدود واضحة للقرار</h3><p>وجود اقتراح لا يعني اعتماده. يعرض معيار ما يستند إليه الترشيح، ويُبقي الحالات التي لا تدعمها الأدلة في مسار المراجعة.</p></aside><div class="branch-list"><h3>مساران داخل الديمو</h3><div class="branch-item"><span>'+icon('check')+'</span><div><strong>أدلة كافية ضمن العينة</strong><p>مسمى مرجعي ورموز مرتبطة بالسجل، مع تفسير وأسباب للمراجعة.</p></div></div><div class="branch-item warn"><span>'+icon('route')+'</span><div><strong>أدلة ناقصة أو متعارضة</strong><p>إحالة للمراجعة دون اختلاق رمز مهني. يمكن تعديل المجال أو توضيح المهام.</p></div></div></div></div></div>'+ 
  '<details class="method-details"><summary>ما الذي ينفذه هذا الديمو، وما الذي يستهدفه النظام؟</summary><p>الديمو ينفذ مطابقة مصطلحات عربية وإنجليزية على خمس مهن من ملف المشروع. يحتاج الترشيح إلى أدلة في مجموعتين من المهام على الأقل، ويُحال للمراجعة عند التعادل أو تعارض المجال. القواعد توضيحية وليست عتبة ثقة إحصائية.</p><p>الكود الأولي للمشروع يستخدم نموذج E5 للتشابه وGemini للتوليد والمراجعة. واجهة العرض الحالية تعمل محليًا في المتصفح دون اتصال بهذه النماذج. النتائج هنا لا تقيس دقة النموذج الأولي.</p><p>تصف وثيقة المشروع تصورًا أوسع لذكاء اصطناعي خاضع للحوكمة، وتوليد موجّه للأدوار الناشئة، وتوثيق مؤسسي للقرارات. سجل هذا الديمو مؤقت داخل الجلسة؛ لا يمثل سجل تدقيق دائمًا أو تكاملًا مع نظام موارد بشرية.</p><p>رموز المهن والتعليم من العينة المرفقة، ويظل التحقق من المرجع المهني الحالي واستيفاء القيود مسؤولية المرحلة المؤسسية التالية.</p></details>';
 }
 function renderCatalog(){
  $('view-catalog').innerHTML='<div class="page-heading"><div><div class="eyebrow"><span class="eyebrow-line"></span>المراجع المتاحة في التجربة</div><h1 id="catalog-heading">دليل المهن <span>في عينة معيار.</span></h1><p>خمس مهن هندسية من ملف المشروع؛ لكل مهنة مسمى ورموز ثابتة.</p></div></div><div class="catalog-tools"><div class="search-field"><span>'+icon('search')+'</span><label for="catalog-search" class="sr-only">البحث في المهن بالاسم أو الرمز</label><input id="catalog-search" type="search" placeholder="ابحث بالمسمى أو الرمز المهني..." autocomplete="off"></div><span id="catalog-count" class="catalog-count" aria-live="polite"></span></div><div id="catalog-grid" class="catalog-grid"></div><p class="pilot-note">تُستخدم العينة لشرح رحلة القرار. لا تمثل جميع المهن السعودية، ولا تُشتق رموز جديدة عند عدم العثور على تطابق.</p>';
  $('catalog-search').addEventListener('input',e=>filterCatalog(e.target.value));
  $('catalog-grid').addEventListener('click',e=>{const btn=e.target.closest('[data-use-role]');if(btn){setScenario(btn.dataset.useRole);navigate('demo');window.scrollTo({top:0,behavior:'smooth'});}});
  filterCatalog('');
 }
 function filterCatalog(query){
  const q=engine.normalize(query);
  const roles=data.roles.filter(r=>engine.normalize(r.title+' '+r.titleEn+' '+r.code+' '+r.educationCode).includes(q));
  $('catalog-count').textContent=roles.length+' / '+data.roles.length+' مهن';
  $('catalog-grid').innerHTML=roles.length?roles.map(r=>'<article class="catalog-card"><span class="role-icon">'+icon(r.icon)+'</span><h3>'+escape(r.title)+'</h3><span class="english-title" lang="en">'+escape(r.titleEn)+'</span><p>'+escape(r.summary)+'</p><span class="catalog-code">SSCO '+r.code+'</span><div class="catalog-meta">رمز التعليم في العينة: <bdi>'+r.educationCode+'</bdi></div><button class="button button-outline" data-use-role="'+r.id+'">جرّب هذا الدور '+icon('arrow')+'</button></article>').join(''):'<div class="catalog-empty">لا توجد مهنة بهذا الاسم أو الرمز في العينة. جرّب كلمة أخرى.</div>';
 }
 function slideMarkup(){
  const example=data.roles[0];
  const slides=[
   '<div class="slide-kicker">معيار · ذكاء القوى العاملة</div><h2>من هدف استراتيجي،<br>إلى <span>دور واضح الأثر.</span></h2><p class="slide-description">تجربة تربط احتياج المؤسسة بالمرجع المهني، وتُظهر لماذا رُشِّح هذا الدور وما الذي يحتاج إلى مراجعة.</p><div class="slide-pills"><span>'+icon('target')+'احتياج واضح</span><span>'+icon('layers')+'مرجع مهني</span><span>'+icon('eye')+'قرار قابل للتفسير</span></div><p class="slide-fineprint">أ.د. أديب نور · أحمد رضا خان</p>',
   '<div class="slide-kicker">01 / نقطة البداية</div><h2>نبدأ من <span>العمل المطلوب.</span><br>ثم نبحث عن الدور.</h2><p class="slide-description">«تحسين كفاءة التشغيل، وتقليل ازدواجية المهام، وتطوير مؤشرات الأداء وتوزيع الموارد».</p><div class="slide-pills"><span>ما النتيجة المطلوبة؟</span><span>ما المهام الأساسية؟</span><span>ما القيود؟</span></div>',
   '<div class="slide-kicker">02 / بطاقة القرار</div><h2>مسمى، ورمز،<br><span>وأسباب يمكن مناقشتها.</span></h2><div class="slide-role"><span class="role-icon">'+icon(example.icon)+'</span><div><strong>'+escape(example.title)+'</strong><small>'+escape(example.titleEn)+'</small></div><span class="slide-code">'+example.code+'</span></div><p class="slide-description">تبقى الرموز مرتبطة بالسجل المرجعي نفسه، وتظهر الأدلة والاعتبارات بجانب الترشيح.</p><p class="slide-fineprint">المهنة المعروضة من عينة المشروع. بطاقة توضيحية، وليست اعتمادًا مهنيًا.</p>',
   '<div class="slide-kicker">03 / الحوكمة في رحلة القرار</div><h2>حين لا تكفي الأدلة،<br><span>تبدأ المراجعة.</span></h2><div class="slide-steps"><div class="slide-step"><strong>أدلة متسقة</strong><p>ترشيح مرجعي يمكن فحصه ومناقشته.</p></div><div class="slide-step"><strong>احتياج غير مغطّى</strong><p>إحالة للمراجعة دون اختلاق رمز.</p></div><div class="slide-step"><strong>قيود تحتاج تحققًا</strong><p>إظهارها للمراجع قبل القرار المؤسسي.</p></div></div>',
   '<div class="slide-kicker">04 / القيمة المستهدفة</div><h2>اتساق أكبر.<br>تفسير أوضح.<br><span>مراجعة أسهل.</span></h2><p class="slide-description">الخطوة التالية: تجربة مؤسسية تقيس زمن التصنيف، واتفاق الخبراء، واكتمال توثيق القرار على أوصاف وظيفية واقعية.</p><div class="slide-pills"><span>'+icon('users')+'الموارد البشرية</span><span>'+icon('chart')+'تخطيط القوى العاملة</span><span>'+icon('shield')+'مراجعة القرار</span></div><p class="slide-fineprint">نسخة عرض على خمس مهن. لا تُقدَّم نسب دقة أو وفورات على أنها نتائج مثبتة.</p>'
  ];
  return slides;
 }
 function renderSlide(){
  const slides=slideMarkup();$('presentation-content').innerHTML=slides[slideIndex];$('slide-counter').textContent=String(slideIndex+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');$('slide-dots').innerHTML=slides.map((_,i)=>'<span class="slide-dot '+(i===slideIndex?'current':'')+'" aria-hidden="true"></span>').join('');$('prev-slide').disabled=slideIndex===0;$('next-slide').innerHTML=slideIndex===slides.length-1?'جرّب معيار '+icon('arrow'):'التالي '+icon('arrow');presentation.scrollTop=0;
 }
 function closePresentation(){presentation.close();document.body.style.overflow='';}
 function nextSlide(){if(slideIndex<4){slideIndex++;renderSlide();}else{closePresentation();navigate('demo');window.scrollTo({top:0,behavior:'smooth'});}}
 $('present-btn').addEventListener('click',()=>{slideIndex=0;renderSlide();presentation.showModal();document.body.style.overflow='hidden';});
 $('close-presentation').addEventListener('click',closePresentation);
 presentation.addEventListener('close',()=>document.body.style.overflow='');
 $('next-slide').addEventListener('click',nextSlide);
 $('prev-slide').addEventListener('click',()=>{if(slideIndex>0){slideIndex--;renderSlide();}});
 presentation.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();nextSlide();}else if(e.key==='ArrowRight'&&slideIndex>0){e.preventDefault();slideIndex--;renderSlide();}});
 $('role-form').addEventListener('submit',e=>{
  e.preventDefault();const input=getInput();const result=engine.classify(input,data.roles);
  if(result.kind==='invalid'){$('form-error').textContent=result.message;$('form-error').hidden=false;$('objective').setAttribute('aria-invalid','true');$('objective').focus();return;}
  $('form-error').hidden=true;$('objective').removeAttribute('aria-invalid');currentInput=input;currentResult=result;isStale=false;
  addEvent('تحليل الاحتياج',result.kind==='match'?result.role.title+' — الرمز '+result.role.code:'إحالة للمراجعة — '+result.reason);renderResult(result.kind==='match'?'ترشيح أولي':'يحتاج مراجعة');
  if(matchMedia('(max-width: 650px)').matches)document.querySelector('.result-panel').scrollIntoView({behavior:'smooth',block:'start'});
 });
 ['objective','domain','seniority','constraints'].forEach(id=>$(id).addEventListener('input',markStale));
 $('reset-btn').addEventListener('click',()=>{setScenario('industrial');announce('تمت استعادة المثال الأول.');});
 window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));
 renderScenarios();renderValue();renderJourney();renderCatalog();hydrate();setScenario('industrial');showView(location.hash.slice(1));
})();
