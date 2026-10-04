(function(root){
'use strict';
function mount(host,{t,lang,icon,switchLanguage,example}){
 host.classList.add('expert-landing');
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
  [t('التطوير التنظيمي','Organization development'),t('هل الدور مطلوب ومصمم بصورة سليمة؟','Is the role needed and well designed?'),t('يتحقق من المبرر والبدائل وموقع الدور في الهيكل ونطاق الإشراف وربطه بالمرجع المهني.','Checks the business case, alternatives, position in the structure, span of control and occupation reference.')],
  [t('التعويضات والمزايا','Total Rewards'),t('ما قيمة الدور ودرجته؟','How should the role be evaluated?'),t('يوثّق أدلة التقييم الوظيفي والدرجة ونطاق الراتب المعتمد وموضع العرض داخل النطاق.','Documents job-evaluation evidence, the grade, the approved salary band and offer positioning.')],
  [t('المالية والتخطيط','Finance & Planning'),t('هل العدد والتكلفة منسجمان مع الخطة؟','Do headcount and cost fit the plan?'),t('يطابق العدد والتكلفة السنوية مع الميزانية المعتمدة وخطة القوى العاملة.','Reconciles headcount and annual cost with the approved budget and workforce plan.')],
  [t('صاحب الصلاحية','Final authority'),t('هل اكتملت أدلة القرار؟','Is the decision evidence complete?'),t('يعتمد الطلب أو يعيده وفق مصفوفة الصلاحيات؛ ولا يعتمد مقدم الطلب طلبه بنفسه.','Approves or returns the request under the delegation of authority; requesters cannot approve their own requests.')]
 ];
 host.innerHTML=`
 <header class="lp-header"><div class="lp-wrap lp-header-inner">${brand}
  <nav class="lp-nav" aria-label="${t('التنقل الرئيسي','Main navigation')}">
   <a href="#demo" data-lp-strategy>${t('ابدأ','Start')}</a>
   <a href="#home/services" data-lp-scroll="services">${t('الخدمات','Services')}</a>
   <a href="#home/capabilities" data-lp-scroll="capabilities">${t('كيف يعمل','How it works')}</a>
   <a href="#home/governance" data-lp-scroll="governance">${t('الحوكمة','Governance')}</a>
   <a href="#enterprise/overview">${t('مساحة العمل','Workspace')}</a>
  </nav>
  <div class="lp-header-actions"><button type="button" id="lp-language" lang="${lang==='ar'?'en':'ar'}" aria-label="${t('Switch to English','التبديل إلى العربية')}">${t('English','العربية')}</button><a class="lp-signin" href="#enterprise/connection">${t('دخول المؤسسة','Organization sign in')}</a></div>
 </div></header>
 <main id="landing-main" tabindex="-1">
  <section class="lp-hero" aria-labelledby="home-heading"><div class="lp-wrap lp-hero-grid">
   <div class="lp-hero-copy">
    <span class="lp-eyebrow">${t('لمديري الموارد البشرية والتطوير التنظيمي والمالية','FOR HR, ORGANIZATION DEVELOPMENT & FINANCE')}</span>
    <h1 id="home-heading">${t('حوّل احتياج العمل إلى<br><em>قرار قوى عاملة موثّق.</em>','Turn a business need into<br><em>a documented workforce decision.</em>')}</h1>
    <p class="lp-hero-lead">${t('من الدور المطلوب إلى العدد والدرجة والتكلفة. قرار واحد، وأدلة يمكن الرجوع إليها.','Connect role, headcount, grade and cost. One decision, with evidence you can trace.')}</p>
    <form id="lp-guided-form" class="lp-guided-start" novalidate>
     <div class="lp-start-label"><span aria-hidden="true">01</span><strong>${t('ابدأ من احتياج العمل','START WITH THE BUSINESS NEED')}</strong><small>${t('دون حساب مؤسسة','NO ORGANIZATION ACCOUNT NEEDED')}</small></div>
     <label for="lp-guided-objective">${t('صف الهدف أو المشكلة','Describe the goal or problem')}</label>
     <textarea id="lp-guided-objective" name="objective" rows="3" minlength="12" maxlength="12000" placeholder="${t('مثال: رفع اعتمادية المعدات وتقليل التوقف عبر الصيانة الوقائية وتحسين إجراءات التشغيل','Example: Improve equipment reliability and reduce downtime through preventive maintenance and better operating procedures')}"></textarea>
     <div class="lp-guided-examples" aria-label="${t('أمثلة سريعة','Quick examples')}">
      <span>${t('جرّب مثالًا:','Try an example:')}</span>
      <button type="button" data-guided-example="${t('رفع اعتمادية المعدات وتقليل التوقف عبر الصيانة الوقائية وتحسين إجراءات التشغيل','Improve equipment reliability and reduce downtime through preventive maintenance and better operating procedures')}">${t('اعتمادية المعدات','Equipment reliability')}</button>
      <button type="button" data-guided-example="${t('رفع دقة التقارير المالية وتسريع الإقفال الشهري','Improve financial reporting accuracy and accelerate the monthly close')}">${t('التقارير المالية','Financial reporting')}</button>
      <button type="button" data-guided-example="${t('تحسين جودة منصة الخدمات الرقمية وتقليل عيوب الإصدارات','Improve the digital services platform and reduce release defects')}">${t('الخدمات الرقمية','Digital services')}</button>
     </div>
     <div class="lp-guided-actions">
      <button class="lp-button lp-primary" type="submit">${t('اقترح الدور المناسب','Find the right role')} ${icon('arrow')}</button>
      <a class="lp-secondary" href="#enterprise/create">${t('أعرف المسمى — صمّم الوظيفة مباشرة','I know the role — design the position directly')}</a>
     </div>
     <p id="lp-guided-status" class="lp-guided-status" role="status" hidden></p>
    </form>
    <div class="lp-guided-steps" aria-label="${t('رحلة معيار المبسطة','Simplified Miyar journey')}">
     <div><span>01</span><strong>${t('افهم','Understand')}</strong><small>${t('الهدف والاحتياج','Goal and need')}</small></div>
     <div><span>02</span><strong>${t('رشّح وفسّر','Recommend')}</strong><small>${t('الدور والمرجع والسبب','Role, reference and rationale')}</small></div>
     <div><span>03</span><strong>${t('نفّذ','Act')}</strong><small>${t('صمّم، خطّط، قيّم أو اعتمد','Design, plan, evaluate or approve')}</small></div>
    </div>
    <p class="lp-caption">${t('البداية مبسطة، لكن قدرات معيار المؤسسية تبقى كاملة: 5,041 مهنة، تصميم الوظيفة، تخطيط القوى العاملة، التعويضات، الإصدارات والاعتمادات.','The start is simplified, while Miyar retains its full enterprise depth: a versioned supplied occupation reference, job design, workforce planning, compensation, revisions and approvals.')}</p>
   </div>
   <div class="lp-showcase lp-decision-preview">
    <div class="lp-preview-label"><span>${icon('target')} ${t('شاهد المحرك قبل الدخول إلى بقية المنصة','See the engine before the rest of the platform')}</span><span>${t('مثال توضيحي','ILLUSTRATIVE')}</span></div>
    <section class="lp-document" aria-label="${t('مثال على رحلة الهدف إلى الدور','Example objective-to-role journey')}">
     <div class="lp-document-top"><span class="lp-document-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${t('الهدف → الاحتياج → الدور','OBJECTIVE → NEED → ROLE')}</span><span class="lp-example-tag">${t('المحرك العام','PUBLIC ENGINE')}</span></div>
     <div class="lp-decision-heading"><span>${t('لوحة قرار المنصب','POSITION DECISION CANVAS')}</span><span class="lp-review-badge">${icon('shield')}${t('مقترح للمراجعة','REVIEW PROPOSAL')}</span></div>
     <div class="lp-document-heading"><div><span class="lp-overline">${t('هدف أعمال','BUSINESS OBJECTIVE')}</span><h2>${t('رفع اعتمادية المعدات','Improve equipment reliability')}</h2></div><span class="lp-document-code" dir="ltr">SSCO<br><b>214401</b></span></div>
     <div class="lp-preview-content">
      <h3>${t('من الهدف إلى ترشيح يمكن مراجعته.','From an objective to a reviewable suggestion.')}</h3>
      <p>${t('رفع اعتمادية الأنظمة الميكانيكية وتقليل توقف المعدات، عبر تخطيط الصيانة الوقائية وتحسين إجراءات التركيب والتشغيل.','Improve mechanical reliability and reduce equipment downtime through preventive maintenance and better installation and operating procedures.')}</p>
      <div class="lp-responsibility">${icon('check')}<span><strong>${t('الترشيح التوضيحي: مهندس ميكانيكي','Illustrative suggestion: Mechanical Engineer')}</strong><br>${t('السبب ظاهر، والرمز مرجعي، والمراجعة البشرية تبقى مطلوبة.','The rationale is visible, the code is traceable, and human review remains required.')}</span></div>
      <div class="lp-map-heading"><span>${t('مسار القرار','DECISION PATH')}</span><small>${t('الدليل يتبع كل خطوة','Evidence follows every step')}</small></div>
      <div class="lp-approval-grid lp-decision-map">
       <svg class="lp-map-connectors" viewBox="0 0 400 190" preserveAspectRatio="none" aria-hidden="true"><path d="M100 45H300M100 45V145H300V45"/><circle cx="100" cy="45" r="4"/><circle cx="300" cy="45" r="4"/><circle cx="100" cy="145" r="4"/><circle cx="300" cy="145" r="4"/></svg>
       <div><span class="lp-stage-number">01</span>${icon('target')}<strong>${t('هدف','Objective')}</strong><small>${t('ما الذي نريد تحقيقه؟','What must change?')}</small></div>
       <div><span class="lp-stage-number">02</span>${icon('spark')}<strong>${t('احتياج','Need')}</strong><small>${t('ما العمل المطلوب؟','What work is needed?')}</small></div>
       <div><span class="lp-stage-number">03</span>${icon('layers')}<strong>${t('دور','Role')}</strong><small>${t('ما المرجع الأقرب؟','Which reference fits?')}</small></div>
       <div><span class="lp-stage-number">04</span>${icon('document')}<strong>${t('منصب','Position')}</strong><small>${t('حوّل القرار إلى تصميم.','Turn it into a design.')}</small></div>
      </div>
     </div>
     <div class="lp-preview-review"><span>${icon('document')}${t('مرجع مهني ظاهر','Visible occupation reference')}</span><span>${icon('check')}${t('مراجعة بشرية مطلوبة','Human review required')}</span></div>
     <div class="lp-document-bottom"><span>${icon('shield')}${t('ترشيح قابل للتفسير → تصميم → تقييم → اعتماد','Explainable suggestion → design → evaluation → approval')}</span><a href="#demo">${t('افتح المحرك','Open engine')} ${t('←','→')}</a></div>
    </section>
   </div>
  </div><div class="lp-wrap lp-hero-benefits">
    <ul class="lp-value-points" aria-label="${t('لماذا معيار؟','Why Miyar?')}">
     <li><strong>${t('مرجع سعودي وسياق عربي','Saudi references, Arabic context')}</strong><span>${t('رمز ومصدر وإصدار ظاهر؛ الربط المقترح يبقى قابلًا للمراجعة.','Visible code, source and edition; proposed mappings remain reviewable.')}</span></li>
     <li><strong>${t('العدد والدرجة والتكلفة في رحلة واحدة','Headcount, grade and cost in one journey')}</strong><span>${t('انقل الفجوة إلى تصميم المنصب والدرجة إلى نطاق التعويض.','Move the workforce gap to job design and the grade to compensation.')}</span></li>
     <li><strong>${t('قرار يمكن مراجعته','A decision you can review')}</strong><span>${t('افتراضات وأدلة وإصدارات؛ الاعتماد بصلاحيات المؤسسة.','Assumptions, evidence and revisions; approval under organization permissions.')}</span></li>
    </ul>
    <p>${t('ما الدور المطلوب؟ كم نحتاج؟ وما الدرجة والتكلفة؟ يربط معيار هذه الأسئلة بتصميم الوظيفة والتخطيط والتعويضات ومراجعة الإصدار نفسه قبل الاعتماد. ابدأ بهدف أو وصف مهام؛ المسمى والمرجع يظهران عندما تكفي الأدلة.','What role is needed, how many positions, and at what grade and cost? Miyar connects these questions to job design, workforce planning, compensation and review of the same revision before approval. Start with a goal or task description; titles and references follow the evidence.')}</p>
  </div></section>

  <section class="lp-proof lp-wrap" aria-label="${t('قدرات متاحة في معيار','Available Miyar capabilities')}">
   <div><strong dir="ltr">5,041</strong><span><b>${t('مهنة في المرجع المؤسسي','occupations in the enterprise reference')}</b><small>${t('التصنيف السعودي للمهن · إصدار 2019 المرفق بالمشروع','Supplied Saudi occupation classification · 2019 edition')}</small></span></div>
   <div><strong dir="ltr">599</strong><span><b>${t('تخصصاً تعليمياً','education specializations')}</b><small>${t('تسعة مستويات · إصدار 2020 المرفق بالمشروع','Nine levels · supplied 2020 edition')}</small></span></div>
   <div><strong dir="ltr">04</strong><span><b>${t('مراحل اعتماد مؤسسي','institutional approval stages')}</b><small>${t('صلاحيات وإصدارات وأثر قرار','Permissions, revisions and decision trail')}</small></span></div>
  </section>

  <section id="lp-capabilities" class="lp-section lp-wrap" aria-labelledby="lp-capabilities-title">
   <div class="lp-section-heading"><span class="lp-eyebrow">${t('رحلة واحدة بدلاً من أدوات متفرقة','ONE JOURNEY INSTEAD OF DISCONNECTED TOOLS')}</span><h2 id="lp-capabilities-title">${t('من الاستراتيجية إلى قرار منصب<br>في ست خطوات واضحة.','From strategy to a position decision<br>in six clear steps.')}</h2><p>${t('المحرك الاستراتيجي هو نقطة البداية. أدوات إنشاء المناصب والتقييم والاعتماد تأتي بعده، لا بدلاً منه.','The strategic engine is the starting point. Position design, evaluation and approval follow it rather than replacing it.')}</p></div>
   <div class="lp-story-groups"><span>${t('01 · افهم الاحتياج','01 · FRAME THE NEED')}</span><span>${t('02 · صمّم القرار','02 · DESIGN THE DECISION')}</span><span>${t('03 · راجع واعتمد','03 · REVIEW & APPROVE')}</span></div>
   <div class="lp-capabilities">${journey.map(([ico,title,desc],i)=>`<article><span class="lp-feature-icon">${icon(ico)}</span><span class="lp-feature-number">0${i+1}</span><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div>
  </section>

  <section id="lp-governance" class="lp-governance" aria-labelledby="lp-governance-title"><div class="lp-wrap">
   <div class="lp-governance-intro"><div><span class="lp-eyebrow">${t('بعد أن نحدد الدور، تبدأ الحوكمة','GOVERNANCE FOLLOWS THE ROLE DECISION')}</span><h2 id="lp-governance-title">${t('لا يتوقف معيار<br><em>عند الترشيح.</em>','Miyar does not stop<br><em>at the suggestion.</em>')}</h2></div><p>${t('بعد تحديد الاحتياج والدور، ينتقل نفس القرار إلى تصميم المنصب والتقييم والتمويل والاعتماد، مع ربط كل مراجعة بالإصدار الذي راجعته.','After the need and role are defined, the same decision moves into position design, evaluation, finance and approval, with every review tied to the revision that was assessed.')}</p></div>
   <ol class="lp-workflow">${stages.map(([title,question,evidence],i)=>`<li><span class="lp-flow-number">0${i+1}</span><h3>${title}</h3><strong>${question}</strong><p>${evidence}</p></li>`).join('')}</ol>
   <div class="lp-governance-foot">${icon('route')}<p>${t('إذا كان لديك هدف ولم تعرف الدور بعد، ابدأ بالمحرك الاستراتيجي. إذا كان لديك منصب محدد بالفعل، ابدأ مباشرة من مساحة العمل.','If you have an objective but not the role, start with the strategic engine. If the position is already defined, start directly in the workspace.')}</p><a href="#demo">${t('ابدأ بالمحرك','Start with the engine')} <span aria-hidden="true">${t('←','→')}</span></a></div>
  </div></section>

  <section class="lp-section lp-wrap lp-start" aria-labelledby="lp-start-title">
   <div><span class="lp-eyebrow">${t('اختر نقطة البداية الصحيحة','CHOOSE THE RIGHT STARTING POINT')}</span><h2 id="lp-start-title">${t('هدف أولاً، أو منصب جاهز.','Objective first, or a position already defined.')}</h2><p>${t('للاستراتيجية وتخطيط القوى العاملة: ابدأ من الهدف. للتطوير التنظيمي عندما يكون المنصب معروفاً: افتح مساحة العمل مباشرة.','For strategy and workforce planning, start from the objective. For OD when the position is already known, open the workspace directly.')}</p><div class="lp-hero-actions"><a class="lp-button lp-primary" href="#demo" data-lp-strategy>${t('المحرك الاستراتيجي','Strategic workforce engine')} ${icon('arrow')}</a><button type="button" class="lp-button" data-lp-demo>${t('تحميل مثال منصب جاهز','Load a ready position example')}</button></div><div id="lp-status" role="status" class="lp-status" hidden></div></div>
   <div class="lp-faq">
    <details open><summary>${t('ما الذي يفعله المحرك الاستراتيجي الآن؟','What does the strategic engine do today?')}</summary><p>${t('يأخذ هدفاً أو احتياج أعمال أو وصف مهام، ويبحث عن مرجع مهني أو يحلل الأدلة ثم يعرض سبب الترشيح. يبدأ بطبقة ترشيح سريعة، ثم ينتقل عند الحاجة إلى دليل المهن الأوسع وطبقات مجالّية مع إبقاء المرجع والمراجعة البشرية ظاهرين.','It takes an objective, business need or task description, looks up or analyzes occupation evidence, and shows the rationale for the suggestion. It starts with a quick recommendation layer, then uses the broader occupation directory and domain-specific layers when needed, while keeping the source reference and human review visible.')}</p></details>
    <details><summary>${t('أين توجد القدرات المؤسسية الأوسع؟','Where are the broader enterprise capabilities?')}</summary><p>${t('مساحة العمل تضم المرجع الموسع، تصميم المناصب، تحليل المهارات، التقييم، الإصدارات، الصلاحيات، الاعتمادات والتصدير. تشغيل المطابقة الدلالية يعتمد على إعداد خدمة المؤسسة، وتبقى المراجعة البشرية مطلوبة.','The workspace contains the broader reference set, position design, skill analysis, evaluation, revisions, permissions, approvals and exports. Semantic matching depends on organization-service configuration, and human review remains required.')}</p></details>
    <details><summary>${t('هل هذا محرك تنبؤ بالأعداد المستقبلية؟','Is this a future headcount forecasting engine?')}</summary><p>${t('ليس بعد. النسخة الحالية تربط الهدف باحتياج ودور وتصميم قرار القوى العاملة. التنبؤ المستقبلي بالأعداد والطاقة والمهارات سيكون طبقة مستقلة ولا ندّعي أنها موجودة الآن.','Not yet. The current product connects an objective to a workforce need, role and governed position decision. Future headcount, capacity and skill forecasting would be a separate layer and is not claimed today.')}</p></details>
   </div>
  </section>
 </main>
 <footer class="lp-footer"><div class="lp-wrap">${brand}<p>${t('معيار · من الاستراتيجية إلى قرار القوى العاملة','Miyar · From strategy to workforce decisions')}</p><a href="pitch.html?lang=${lang}">${t('العرض التعريفي','Pitch deck')}</a><a href="https://adeebnoor.github.io/" target="_blank" rel="noopener">${t('الفريق والتواصل','Team & contact')} ↗</a><a href="#enterprise/overview">${t('مساحة العمل','Workspace')}</a></div></footer>`;

 host.querySelector('#lp-language').onclick=switchLanguage;
 host.querySelectorAll('[data-lp-scroll]').forEach(a=>a.onclick=e=>{e.preventDefault();const target=host.querySelector('#lp-'+a.dataset.lpScroll);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
 const guidedForm=host.querySelector('#lp-guided-form');
 if(guidedForm){
  const objective=guidedForm.querySelector('#lp-guided-objective');
  const status=guidedForm.querySelector('#lp-guided-status');
  host.querySelectorAll('[data-guided-example]').forEach(button=>button.onclick=()=>{
   objective.value=button.dataset.guidedExample||'';
   if(status)status.hidden=true;
   objective.focus();
  });
  guidedForm.onsubmit=event=>{
   event.preventDefault();
   const value=(objective?.value||'').trim();
   if(value.length<12){
    if(status){status.hidden=false;status.textContent=t('اكتب هدفًا أو مشكلة أوضح قليلًا — جملة واحدة تكفي.','Describe the goal or problem a little more clearly — one sentence is enough.');}
    objective?.focus();
    return;
   }
   try{sessionStorage.setItem('miyar-guided-objective-v1',value);}catch{}
   window.location.hash='#demo';
  };
 }
 host.querySelectorAll('[data-lp-demo]').forEach(control=>control.onclick=async()=>{
  const status=host.querySelector('#lp-status');status.hidden=false;status.textContent=t('جارٍ تجهيز مثال المنصب…','Preparing the position example…');
  host.querySelectorAll('[data-lp-demo]').forEach(b=>b.disabled=true);
  try{await example();status.hidden=true;}catch{status.textContent=t('تعذر تحميل المثال. تحقق من الاتصال ثم أعد المحاولة.','The example could not load. Check your connection and try again.');status.scrollIntoView({block:'nearest'});}
  finally{host.querySelectorAll('[data-lp-demo]').forEach(b=>b.disabled=false);}
 });
}
root.MiyarLanding={mount};
})(window);
