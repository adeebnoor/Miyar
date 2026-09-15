(function(root){
'use strict';
function mount(host,{t,lang,icon,switchLanguage,example}){
 const brand='<a class="lp-brand" href="#home" aria-label="'+t('معيار — الرئيسية','Miyar — Home')+'"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span lang="ar">معيار<small lang="en" dir="ltr">MI’YĀR</small></span></a>';
 const journey=[
  ['target',t('الهدف الاستراتيجي','Strategic objective'),t('ابدأ بما تريد المؤسسة تحقيقه، لا بمسمى وظيفي جاهز.','Start with what the organization needs to achieve, not a preselected job title.')],
  ['spark',t('احتياج القوى العاملة','Workforce need'),t('حوّل الهدف إلى أعمال ونتائج وقدرات مطلوبة يمكن مناقشتها.','Translate the objective into work, outcomes and capabilities that can be reviewed.')],
  ['layers',t('الدور أو القدرة','Role or capability'),t('اقترح مرجعاً مهنياً قابلاً للتفسير، أو أحِل الحالة للمراجعة إذا لم تكفِ الأدلة.','Suggest an explainable occupation reference, or route the case to review when evidence is insufficient.')],
  ['document',t('تصميم المنصب','Position design'),t('حوّل القرار إلى غرض ومسؤوليات ومتطلبات ومؤشرات وRACI.','Turn the decision into purpose, responsibilities, requirements, KPIs and RACI.')],
  ['chart',t('التقييم','Evaluation'),t('وثّق أدلة التقييم والدرجة والنطاق المالي وفق إطار الجهة.','Record evaluation evidence, grade and compensation range under the organization framework.')],
  ['shield',t('الاعتماد','Approval'),t('مرّر الإصدار نفسه عبر المراجعات واحفظ أثر القرار.','Move the same revision through reviews and retain the decision trail.')]
 ];
 const stages=[
  [t('التطوير التنظيمي','Organization development'),t('هل الدور مطلوب ومصمم بصورة سليمة؟','Is the role needed and well designed?')],
  [t('التعويضات والمزايا','Total Rewards'),t('ما قيمة الدور ودرجته؟','How should the role be evaluated?')],
  [t('المالية والتخطيط','Finance & Planning'),t('هل العدد والتكلفة منسجمان مع الخطة؟','Do headcount and cost fit the plan?')],
  [t('صاحب الصلاحية','Final authority'),t('هل اكتملت أدلة القرار؟','Is the decision evidence complete?')]
 ];
 host.innerHTML=`
 <header class="lp-header"><div class="lp-wrap lp-header-inner">${brand}
  <nav class="lp-nav" aria-label="${t('التنقل الرئيسي','Main navigation')}">
   <a href="#demo" data-lp-strategy>${t('المحرك الاستراتيجي','Strategic engine')}</a>
   <a href="#home/capabilities" data-lp-scroll="capabilities">${t('كيف يعمل','How it works')}</a>
   <a href="#home/governance" data-lp-scroll="governance">${t('الحوكمة','Governance')}</a>
   <a href="#enterprise/overview">${t('مساحة العمل','Workspace')}</a>
  </nav>
  <div class="lp-header-actions"><button type="button" id="lp-language" lang="${lang==='ar'?'en':'ar'}" aria-label="${t('Switch to English','التبديل إلى العربية')}">${t('English','العربية')}</button><a class="lp-signin" href="#enterprise/connection">${t('دخول المؤسسة','Organization sign in')}</a></div>
 </div></header>
 <main id="landing-main" tabindex="-1">
  <section class="lp-hero" aria-labelledby="home-heading"><div class="lp-wrap lp-hero-grid">
   <div class="lp-hero-copy">
    <span class="lp-eyebrow">${t('المحرك الاستراتيجي للقوى العاملة','STRATEGIC WORKFORCE ENGINE')}</span>
    <h1 id="home-heading">${t('ابدأ بالهدف الاستراتيجي.<br><em>ثم صمّم القوى العاملة<br class="lp-wide-break"> التي تحققه.</em>','Start with the strategic objective.<br><em>Then design the workforce<br class="lp-wide-break"> to deliver it.</em>')}</h1>
    <p>${t('معيار يبدأ من هدف أو احتياج أعمال، يحوله إلى ترشيح وظيفي قابل للتفسير، ثم ينقل القرار إلى تصميم المنصب وتقييمه واعتماده.','Miyar starts with a strategic or business objective, turns it into an explainable role suggestion, then carries the decision into position design, evaluation and approval.')}</p>
    <div class="lp-hero-actions">
     <a class="lp-button lp-primary" href="#demo" data-lp-strategy>${t('ابدأ من الهدف الاستراتيجي','Start with a strategic objective')} ${icon('arrow')}</a>
     <a class="lp-secondary" href="#enterprise/overview">${t('لدي منصب جاهز — افتح مساحة العمل','I already have a position — open the workspace')}</a>
    </div>
    <p class="lp-caption">${t('المسار العام يقدم مطابقة توضيحية قابلة للتفسير؛ لا يدّعي تنبؤ الأعداد المستقبلية.','The public path provides explainable illustrative matching; it does not claim future headcount forecasting.')}</p>
   </div>
   <div class="lp-showcase">
    <div class="lp-preview-label"><span>${icon('target')} ${t('شاهد المحرك قبل الدخول إلى بقية المنصة','See the engine before the rest of the platform')}</span><span>${t('مثال توضيحي','ILLUSTRATIVE')}</span></div>
    <section class="lp-document" aria-label="${t('مثال على رحلة الهدف إلى الدور','Example objective-to-role journey')}">
     <div class="lp-document-top"><span>${t('الهدف → الاحتياج → الدور','OBJECTIVE → NEED → ROLE')}</span><span class="lp-example-tag">${t('المحرك العام','PUBLIC ENGINE')}</span></div>
     <div class="lp-document-heading"><div><span class="lp-overline">${t('هدف أعمال','BUSINESS OBJECTIVE')}</span><h2>${t('رفع اعتمادية المعدات','Improve equipment reliability')}</h2></div><span class="lp-document-code" dir="ltr">SSCO<br><b>214401</b></span></div>
     <div class="lp-preview-content">
      <h3>${t('من الهدف إلى ترشيح يمكن مراجعته.','From an objective to a reviewable suggestion.')}</h3>
      <p>${t('رفع اعتمادية الأنظمة الميكانيكية وتقليل توقف المعدات، عبر تخطيط الصيانة الوقائية وتحسين إجراءات التركيب والتشغيل.','Improve mechanical reliability and reduce equipment downtime through preventive maintenance and better installation and operating procedures.')}</p>
      <div class="lp-responsibility">${icon('check')}<span><strong>${t('الترشيح التوضيحي: مهندس ميكانيكي','Illustrative suggestion: Mechanical Engineer')}</strong><br>${t('السبب ظاهر، والرمز مرجعي، والمراجعة البشرية تبقى مطلوبة.','The rationale is visible, the code is traceable, and human review remains required.')}</span></div>
      <div class="lp-approval-grid" style="margin-top:18px">
       <div><span class="lp-stage-number">01</span>${icon('target')}<strong>${t('هدف','Objective')}</strong><small>${t('ما الذي نريد تحقيقه؟','What must change?')}</small></div>
       <div><span class="lp-stage-number">02</span>${icon('spark')}<strong>${t('احتياج','Need')}</strong><small>${t('ما العمل المطلوب؟','What work is needed?')}</small></div>
       <div><span class="lp-stage-number">03</span>${icon('layers')}<strong>${t('دور','Role')}</strong><small>${t('ما المرجع الأقرب؟','Which reference fits?')}</small></div>
       <div><span class="lp-stage-number">04</span>${icon('document')}<strong>${t('منصب','Position')}</strong><small>${t('حوّل القرار إلى تصميم.','Turn it into a design.')}</small></div>
      </div>
     </div>
     <div class="lp-document-bottom"><span>${icon('shield')}${t('ترشيح قابل للتفسير → تصميم → تقييم → اعتماد','Explainable suggestion → design → evaluation → approval')}</span><a href="#demo">${t('افتح المحرك','Open engine')} ${t('←','→')}</a></div>
    </section>
   </div>
  </div></section>

  <section class="lp-proof lp-wrap" aria-label="${t('قدرات متاحة في معيار','Available Miyar capabilities')}">
   <div><strong dir="ltr">5,041</strong><span><b>${t('مهنة في المرجع المؤسسي','occupations in the enterprise reference')}</b><small>${t('التصنيف السعودي للمهن · إصدار 2019 المرفق بالمشروع','Supplied Saudi occupation classification · 2019 edition')}</small></span></div>
   <div><strong dir="ltr">599</strong><span><b>${t('تخصصاً تعليمياً','education specializations')}</b><small>${t('تسعة مستويات · إصدار 2020 المرفق بالمشروع','Nine levels · supplied 2020 edition')}</small></span></div>
   <div><strong dir="ltr">04</strong><span><b>${t('مراحل اعتماد مؤسسي','institutional approval stages')}</b><small>${t('صلاحيات وإصدارات وأثر قرار','Permissions, revisions and decision trail')}</small></span></div>
  </section>

  <section id="lp-capabilities" class="lp-section lp-wrap" aria-labelledby="lp-capabilities-title">
   <div class="lp-section-heading"><span class="lp-eyebrow">${t('رحلة واحدة بدلاً من أدوات متفرقة','ONE JOURNEY INSTEAD OF DISCONNECTED TOOLS')}</span><h2 id="lp-capabilities-title">${t('من الاستراتيجية إلى قرار منصب<br>في ست خطوات واضحة.','From strategy to a position decision<br>in six clear steps.')}</h2><p>${t('المحرك الاستراتيجي هو نقطة البداية. أدوات إنشاء المناصب والتقييم والاعتماد تأتي بعده، لا بدلاً منه.','The strategic engine is the starting point. Position design, evaluation and approval follow it rather than replacing it.')}</p></div>
   <div class="lp-capabilities">${journey.map(([ico,title,desc],i)=>`<article><span class="lp-feature-icon">${icon(ico)}</span><span class="lp-feature-number">0${i+1}</span><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div>
  </section>

  <section id="lp-governance" class="lp-governance" aria-labelledby="lp-governance-title"><div class="lp-wrap">
   <div class="lp-governance-intro"><div><span class="lp-eyebrow">${t('بعد أن نحدد الدور، تبدأ الحوكمة','GOVERNANCE FOLLOWS THE ROLE DECISION')}</span><h2 id="lp-governance-title">${t('لا يتوقف معيار<br><em>عند الترشيح.</em>','Miyar does not stop<br><em>at the suggestion.</em>')}</h2></div><p>${t('بعد تحديد الاحتياج والدور، ينتقل نفس القرار إلى تصميم المنصب والتقييم والتمويل والاعتماد، مع ربط كل مراجعة بالإصدار الذي راجعته.','After the need and role are defined, the same decision moves into position design, evaluation, finance and approval, with every review tied to the revision that was assessed.')}</p></div>
   <ol class="lp-workflow">${stages.map(([title,question],i)=>`<li><span class="lp-flow-number">0${i+1}</span><h3>${title}</h3><strong>${question}</strong><p>${t('مراجعة مستقلة مع حالة واضحة وأثر محفوظ على الإصدار.','An independent review with explicit status and a retained revision trail.')}</p></li>`).join('')}</ol>
   <div class="lp-governance-foot">${icon('route')}<p>${t('إذا كان لديك هدف ولم تعرف الدور بعد، ابدأ بالمحرك الاستراتيجي. إذا كان لديك منصب محدد بالفعل، ابدأ مباشرة من مساحة العمل.','If you have an objective but not the role, start with the strategic engine. If the position is already defined, start directly in the workspace.')}</p><a href="#demo">${t('ابدأ بالمحرك','Start with the engine')} <span aria-hidden="true">${t('←','→')}</span></a></div>
  </div></section>

  <section class="lp-section lp-wrap lp-start" aria-labelledby="lp-start-title">
   <div><span class="lp-eyebrow">${t('اختر نقطة البداية الصحيحة','CHOOSE THE RIGHT STARTING POINT')}</span><h2 id="lp-start-title">${t('هدف أولاً، أو منصب جاهز.','Objective first, or a position already defined.')}</h2><p>${t('للاستراتيجية وتخطيط القوى العاملة: ابدأ من الهدف. للتطوير التنظيمي عندما يكون المنصب معروفاً: افتح مساحة العمل مباشرة.','For strategy and workforce planning, start from the objective. For OD when the position is already known, open the workspace directly.')}</p><div class="lp-hero-actions"><a class="lp-button lp-primary" href="#demo" data-lp-strategy>${t('المحرك الاستراتيجي','Strategic workforce engine')} ${icon('arrow')}</a><button type="button" class="lp-button" data-lp-demo>${t('تحميل مثال منصب جاهز','Load a ready position example')}</button></div><div id="lp-status" role="status" class="lp-status" hidden></div></div>
   <div class="lp-faq">
    <details open><summary>${t('ما الذي يفعله المحرك الاستراتيجي الآن؟','What does the strategic engine do today?')}</summary><p>${t('يأخذ هدفاً أو احتياج أعمال أو وصف مهام، ويبحث عن مرجع مهني أو يحلل الأدلة ثم يعرض سبب الترشيح. النسخة العامة الحالية عينة توضيحية من خمس مهن هندسية.','It takes an objective, business need or task description, looks up or analyzes occupation evidence, and shows the rationale for the suggestion. The current public engine is an illustrative five-engineering-role sample.')}</p></details>
    <details><summary>${t('أين توجد القدرات المؤسسية الأوسع؟','Where are the broader enterprise capabilities?')}</summary><p>${t('مساحة العمل تضم المرجع الموسع، تصميم المناصب، تحليل المهارات، التقييم، الإصدارات، الصلاحيات، الاعتمادات والتصدير. تشغيل المطابقة الدلالية يعتمد على إعداد خدمة المؤسسة، وتبقى المراجعة البشرية مطلوبة.','The workspace contains the broader reference set, position design, skill analysis, evaluation, revisions, permissions, approvals and exports. Semantic matching depends on organization-service configuration, and human review remains required.')}</p></details>
    <details><summary>${t('هل هذا محرك تنبؤ بالأعداد المستقبلية؟','Is this a future headcount forecasting engine?')}</summary><p>${t('ليس بعد. النسخة الحالية تربط الهدف باحتياج ودور وتصميم قرار القوى العاملة. التنبؤ المستقبلي بالأعداد والطاقة والمهارات سيكون طبقة مستقلة ولا ندّعي أنها موجودة الآن.','Not yet. The current product connects an objective to a workforce need, role and governed position decision. Future headcount, capacity and skill forecasting would be a separate layer and is not claimed today.')}</p></details>
   </div>
  </section>
 </main>
 <footer class="lp-footer"><div class="lp-wrap">${brand}<p>${t('معيار · من الاستراتيجية إلى قرار القوى العاملة','Miyar · From strategy to workforce decisions')}</p><a href="pitch.html?lang=${lang}">${t('العرض التعريفي','Pitch deck')}</a><a href="https://adeebnoor.github.io/" target="_blank" rel="noopener">${t('الفريق والتواصل','Team & contact')} ↗</a><a href="#enterprise/overview">${t('مساحة العمل','Workspace')}</a></div></footer>`;

 host.querySelector('#lp-language').onclick=switchLanguage;
 host.querySelectorAll('[data-lp-scroll]').forEach(a=>a.onclick=e=>{e.preventDefault();const target=host.querySelector('#lp-'+a.dataset.lpScroll);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
 host.querySelectorAll('[data-lp-demo]').forEach(control=>control.onclick=async()=>{
  const status=host.querySelector('#lp-status');status.hidden=false;status.textContent=t('جارٍ تجهيز مثال المنصب…','Preparing the position example…');
  host.querySelectorAll('[data-lp-demo]').forEach(b=>b.disabled=true);
  try{await example();status.hidden=true;}catch{status.textContent=t('تعذر تحميل المثال. تحقق من الاتصال ثم أعد المحاولة.','The example could not load. Check your connection and try again.');status.scrollIntoView({block:'nearest'});}
  finally{host.querySelectorAll('[data-lp-demo]').forEach(b=>b.disabled=false);}
 });
}
root.MiyarLanding={mount};
})(window);
