(function(root){
'use strict';
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const uniq=rows=>[...new Set(rows.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
function sentences(value){
 return uniq(String(value||'').replace(/\r/g,'\n').split(/\n+|[;؛]+/).map(x=>x.replace(/^\s*[-•*\d.)]+\s*/,'').trim()).filter(x=>x.length>2));
}
const families=[
 {id:'hc',ar:'رأس المال البشري',en:'Human Capital',departmentAr:'رأس المال البشري',departmentEn:'Human Capital',keywords:['human capital','human resources','hr ','hc ','workforce','talent','people','employee','موارد بشرية','راس المال البشري','رأس المال البشري','شؤون الموظفين','القوى العاملة','المواهب'],education:['إدارة الموارد البشرية','الموارد البشرية'],ssco:['مدير الموارد البشرية','مدير شؤون الموظفين','أخصائي موارد بشرية'],qualificationEn:"Bachelor's degree in Human Resources Management, Business Administration or a related field",qualificationAr:'بكالوريوس في إدارة الموارد البشرية أو إدارة الأعمال أو تخصص ذي صلة',technicalEn:['Human capital operations','Project and portfolio coordination','Procurement and vendor coordination','OPEX planning and monitoring','Management reporting','Process improvement','Strategy execution'],technicalAr:['عمليات رأس المال البشري','تنسيق المشاريع والمحفظة','تنسيق المشتريات والموردين','تخطيط ومتابعة المصروفات التشغيلية','التقارير الإدارية','تحسين العمليات','تنفيذ الاستراتيجية'],careerEn:['Senior Human Capital Projects & Operations Manager','Director, Human Capital Operations / Transformation','VP Human Capital / CHRO'],careerAr:['مدير أول لمشاريع وعمليات رأس المال البشري','مدير إدارة عمليات / تحول رأس المال البشري','نائب الرئيس لرأس المال البشري / الرئيس التنفيذي للموارد البشرية']},
 {id:'project',ar:'إدارة المشاريع',en:'Project Management',departmentAr:'مكتب إدارة المشاريع',departmentEn:'Project Management Office',keywords:['project','program','portfolio','pmo','milestone','initiative','مشروع','مشاريع','برنامج','محفظة','مبادرات'],education:['إدارة المشاريع','إدارة الأعمال'],ssco:['مدير مشروع','أخصائي إدارة مشاريع'],qualificationEn:"Bachelor's degree in Project Management, Business Administration, Engineering or a related field",qualificationAr:'بكالوريوس في إدارة المشاريع أو إدارة الأعمال أو الهندسة أو تخصص ذي صلة',technicalEn:['Project planning','Schedule control','Risk and issue management','Stakeholder coordination','Progress reporting','Vendor coordination'],technicalAr:['تخطيط المشاريع','ضبط الجداول الزمنية','إدارة المخاطر والمشكلات','تنسيق أصحاب العلاقة','تقارير التقدم','تنسيق الموردين'],careerEn:['Senior Project Manager','Program Manager / PMO Manager','Director, Portfolio Management'],careerAr:['مدير مشروع أول','مدير برنامج / مدير مكتب إدارة المشاريع','مدير إدارة المحافظ والمشاريع']},
 {id:'procurement',ar:'المشتريات وإدارة الموردين',en:'Procurement & Vendor Management',departmentAr:'المشتريات',departmentEn:'Procurement',keywords:['procurement','rfp','purchase request','purchase order','vendor','contract','invoice','sourcing','مشتريات','مورد','موردين','عقد','عقود','فاتورة','فواتير','طرح','منافسة'],education:['إدارة سلاسل الإمداد','إدارة الأعمال','المشتريات'],ssco:['مدير مشتريات','أخصائي مشتريات'],qualificationEn:"Bachelor's degree in Supply Chain, Procurement, Business Administration or a related field",qualificationAr:'بكالوريوس في سلاسل الإمداد أو المشتريات أو إدارة الأعمال أو تخصص ذي صلة',technicalEn:['Sourcing','RFP management','Purchase requisitions and orders','Contract administration','Vendor performance','Invoice coordination'],technicalAr:['التوريد الاستراتيجي','إدارة طلبات العروض','طلبات وأوامر الشراء','إدارة العقود','أداء الموردين','تنسيق الفواتير'],careerEn:['Senior Procurement Specialist','Procurement Manager','Director, Procurement & Supply Chain'],careerAr:['أخصائي مشتريات أول','مدير مشتريات','مدير إدارة المشتريات وسلاسل الإمداد']},
 {id:'finance',ar:'المالية والتخطيط',en:'Finance & Planning',departmentAr:'المالية',departmentEn:'Finance',keywords:['finance','financial','budget','opex','capex','forecast','cost','accounting','مالية','ميزانية','تكلفة','تكاليف','مصروفات','محاسبة'],education:['المالية','المحاسبة','إدارة الأعمال'],ssco:['مدير مالي','أخصائي ميزانية','محاسب'],qualificationEn:"Bachelor's degree in Finance, Accounting, Business Administration or a related field",qualificationAr:'بكالوريوس في المالية أو المحاسبة أو إدارة الأعمال أو تخصص ذي صلة',technicalEn:['Budgeting','Forecasting','Cost control','Financial analysis','Management reporting'],technicalAr:['إعداد الميزانية','التنبؤ المالي','ضبط التكاليف','التحليل المالي','التقارير الإدارية'],careerEn:['Senior Finance Specialist','Finance Manager','Director, Financial Planning & Analysis'],careerAr:['أخصائي مالي أول','مدير مالي','مدير إدارة التخطيط والتحليل المالي']},
 {id:'it',ar:'التقنية والتحول الرقمي',en:'Technology & Digital',departmentAr:'تقنية المعلومات',departmentEn:'Information Technology',keywords:['technology','digital','software','system','platform','data','cyber','automation','تقنية','رقمي','برمجيات','نظام','منصة','بيانات','سيبراني','أتمتة'],education:['تقنية المعلومات','علوم الحاسب','نظم المعلومات'],ssco:['مدير تقنية المعلومات','أخصائي تقنية معلومات','مهندس برمجيات'],qualificationEn:"Bachelor's degree in Information Technology, Computer Science, Information Systems or a related field",qualificationAr:'بكالوريوس في تقنية المعلومات أو علوم الحاسب أو نظم المعلومات أو تخصص ذي صلة',technicalEn:['Technology delivery','Systems analysis','Digital transformation','Data literacy','Service management'],technicalAr:['تنفيذ الحلول التقنية','تحليل الأنظمة','التحول الرقمي','الإلمام بالبيانات','إدارة الخدمات'],careerEn:['Senior Technology Specialist','Technology Manager','Director, Digital Transformation / IT'],careerAr:['أخصائي تقنية أول','مدير تقنية','مدير إدارة التحول الرقمي / تقنية المعلومات']},
 {id:'operations',ar:'العمليات والتحسين',en:'Operations & Improvement',departmentAr:'العمليات',departmentEn:'Operations',keywords:['operations','process','efficiency','continuous improvement','quality','service delivery','عمليات','عملية','اجراءات','إجراءات','كفاءة','تحسين','جودة','تشغيل'],education:['إدارة العمليات','إدارة الأعمال','الهندسة الصناعية'],ssco:['مدير عمليات','أخصائي تطوير إداري','مهندس صناعي'],qualificationEn:"Bachelor's degree in Business Administration, Operations, Industrial Engineering or a related field",qualificationAr:'بكالوريوس في إدارة الأعمال أو العمليات أو الهندسة الصناعية أو تخصص ذي صلة',technicalEn:['Operating model design','Process mapping','Continuous improvement','Performance management','Service delivery'],technicalAr:['تصميم نموذج التشغيل','رسم العمليات','التحسين المستمر','إدارة الأداء','إدارة تقديم الخدمة'],careerEn:['Senior Operations Specialist','Operations Manager','Director, Operations Excellence'],careerAr:['أخصائي عمليات أول','مدير عمليات','مدير إدارة التميز التشغيلي']},
 {id:'generic',ar:'الأعمال والدعم المؤسسي',en:'Business & Corporate Support',departmentAr:'الإدارة المعنية',departmentEn:'Business Department',keywords:[],education:['إدارة الأعمال'],ssco:['مدير إداري','أخصائي إداري'],qualificationEn:"Bachelor's degree in Business Administration or a discipline relevant to the role",qualificationAr:'بكالوريوس في إدارة الأعمال أو تخصص مناسب لطبيعة الدور',technicalEn:['Planning and coordination','Performance reporting','Stakeholder management','Process improvement'],technicalAr:['التخطيط والتنسيق','تقارير الأداء','إدارة أصحاب العلاقة','تحسين العمليات'],careerEn:['Senior Specialist','Manager','Director'],careerAr:['أخصائي أول','مدير','مدير إدارة']}
];
const behaviorEn=['Stakeholder management','Communication','Analytical thinking','Planning and prioritization','Accountability','Continuous improvement','Collaboration'];
const behaviorAr=['إدارة أصحاب العلاقة','التواصل','التفكير التحليلي','التخطيط وتحديد الأولويات','المساءلة','التحسين المستمر','التعاون'];
function familyScore(def,text){return def.keywords.reduce((score,k)=>score+(normalize(text).includes(normalize(k))?1:0),0);}
function detectFamily(input){
 const text=[input.strategyObjective,input.responsibilities,input.department,input.context].join(' ');
 const ranked=families.filter(x=>x.id!=='generic').map(x=>({family:x,score:familyScore(x,text)})).sort((a,b)=>b.score-a.score);
 return ranked[0]?.score?ranked[0].family:families.find(x=>x.id==='generic');
}
function detectSignals(text){const n=normalize(text);const any=terms=>terms.some(x=>n.includes(normalize(x)));return {
 project:any(['project','program','portfolio','initiative','milestone','مشروع','برنامج','محفظة','مبادرة']),
 procurement:any(['rfp','purchase request','purchase order','procurement','vendor','contract','invoice','مشتريات','مورد','عقد','فاتورة']),
 budget:any(['opex','capex','budget','cost','ميزانية','مصروفات','تكلفة']),
 reporting:any(['report','dashboard','progress','تقرير','تقارير','تقدم']),
 improvement:any(['improve','efficiency','process improvement','continuous improvement','تحسين','كفاءة','تطوير العمليات']),
 strategy:any(['strategy','strategic','cascade','initiative','استراتيجية','استراتيجي','مواءمة','مبادرة']),
 people:any(['team','direct report','lead','manage people','فريق','مرؤوس','قيادة فريق']),
 manager:any(['manage','manager','oversee','lead','own','مدير','إدارة','يشرف','قيادة','يتولى']),
 director:any(['director','head of','chief','general manager','مدير عام','رئيس','نائب الرئيس'])
};}
function recommendLevel(input,signals,responsibilityCount){
 const explicit=normalize(input.requestedLevel||'');
 if(explicit)return {id:'specified',en:input.requestedLevel,ar:input.requestedLevel,rationaleEn:'Level retained from the business input and must be confirmed by job evaluation.',rationaleAr:'تم الاحتفاظ بالمستوى المدخل من الأعمال ويجب تأكيده بالتقييم الوظيفي.'};
 if(signals.director)return {id:'director',en:'Director / Head level',ar:'مستوى مدير إدارة / رئيس',rationaleEn:'The scope includes organization-level leadership language. Final level requires the approved job-evaluation framework.',rationaleAr:'النطاق يتضمن مؤشرات قيادة على مستوى الإدارة. المستوى النهائي يتطلب إطار التقييم الوظيفي المعتمد.'};
 const managerial=[signals.project,signals.procurement,signals.budget,signals.reporting,signals.improvement,signals.strategy,signals.manager].filter(Boolean).length;
 if(managerial>=4||signals.manager&&responsibilityCount>=4)return {id:'manager',en:'Manager level',ar:'مستوى مدير',rationaleEn:'The role coordinates several HC/business workstreams, resources, reporting and delivery accountability. Confirm through the approved grading framework.',rationaleAr:'الدور ينسق عدة مسارات عمل وموارد وتقارير ومسؤولية عن التنفيذ. يجب تأكيده عبر هيكل الدرجات المعتمد.'};
 if(responsibilityCount>=4)return {id:'senior',en:'Senior professional level',ar:'مستوى مهني أول',rationaleEn:'The breadth suggests independent professional ownership without enough evidence to assert a management grade.',rationaleAr:'اتساع المهام يشير إلى ملكية مهنية مستقلة دون دليل كافٍ لإثبات درجة إدارية.'};
 return {id:'professional',en:'Professional level',ar:'مستوى مهني',rationaleEn:'The current scope supports a professional role; grade remains subject to formal evaluation.',rationaleAr:'النطاق الحالي يدعم دورًا مهنيًا؛ وتبقى الدرجة خاضعة للتقييم الرسمي.'};
}
function proposedTitle(family,level,signals,locale){
 const ar=locale==='ar';
 if(family.id==='hc'){
  if(level.id==='director')return ar?'مدير إدارة عمليات وتحول رأس المال البشري':'Director, Human Capital Operations & Transformation';
  if(level.id==='manager'&&(signals.project||signals.procurement||signals.budget))return ar?'مدير مشاريع وعمليات رأس المال البشري':'Human Capital Projects & Operations Manager';
  if(level.id==='manager')return ar?'مدير رأس المال البشري':'Human Capital Manager';
  return ar?'أخصائي مشاريع وعمليات رأس المال البشري':'Human Capital Projects & Operations Specialist';
 }
 const base=ar?family.ar:family.en;
 if(level.id==='director')return ar?'مدير إدارة '+base:'Director, '+base;
 if(level.id==='manager')return ar?'مدير '+base:base+' Manager';
 if(level.id==='senior')return ar?'أخصائي أول - '+base:'Senior '+base+' Specialist';
 return ar?'أخصائي - '+base:base+' Specialist';
}
function successMeasures(signals,locale){
 const ar=locale==='ar',rows=[];
 if(signals.project)rows.push(ar?'إنجاز ≥95% من المعالم والمخرجات المستحقة في موعدها وفق الخطة المعتمدة':'Deliver ≥95% of due milestones and outputs on time against the approved plan');
 if(signals.reporting)rows.push(ar?'إصدار 100% من التقارير الدورية في موعدها مع توثيق الانحرافات والإجراءات التصحيحية':'Issue 100% of scheduled progress reports on time with documented variances and corrective actions');
 if(signals.procurement)rows.push(ar?'متابعة 100% من طلبات الشراء والعقود والفواتير ضمن سجل حالة واضح ورفع حالات التعثر':'Maintain current status for 100% of procurement, contract and invoice items and escalate blocked cases');
 if(signals.budget)rows.push(ar?'تحديث توقعات المصروفات التشغيلية شهريًا وتفسير الانحرافات عن الميزانية المعتمدة':'Update OPEX forecast monthly and explain variance against the approved budget');
 if(signals.improvement)rows.push(ar?'تنفيذ تحسينات عمليات موثقة بخط أساس وقياس بعدي للزمن أو الجودة أو الجهد':'Deliver process improvements with documented baseline and post-change cycle-time, quality or effort evidence');
 if(signals.strategy)rows.push(ar?'تحويل المبادرات الاستراتيجية ذات الأولوية إلى خطط عمل بمالك وتاريخ ومعلم وقياس تقدم':'Translate priority strategic initiatives into action plans with owners, dates, milestones and progress measures');
 if(rows.length<3)rows.push(ar?'تحقيق ≥95% من الالتزامات التشغيلية المتفق عليها في موعدها':'Deliver ≥95% of agreed operational commitments on time',ar?'إغلاق الإجراءات المتأخرة وفق خطة تصحيحية معتمدة':'Close overdue actions through an approved corrective plan',ar?'تحديث أصحاب العلاقة بالمخاطر والقرارات المطلوبة في الدورية المتفق عليها':'Update stakeholders on risks and required decisions at the agreed cadence');
 return uniq(rows).slice(0,6);
}
function kpiRows(measures,locale){
 const ar=locale==='ar';return measures.slice(0,5).map((outcome,i)=>({outcome,metric:i===1?(ar?'نسبة التقارير/المخرجات المسلمة في موعدها':'Percent of scheduled reports/outputs delivered on time'):(ar?'المخرجات المقبولة في موعدها ÷ المخرجات المستحقة × 100':'Accepted outputs delivered on time / outputs due × 100'),target:/[0-9٠-٩]/.test(outcome)?outcome:(ar?'≥95% — هدف مقترح للمراجعة':'≥95% — proposed target for review'),frequency:ar?'شهريًا؛ مع مراجعة ربع سنوية':'Monthly; quarterly review',deliverable:ar?'سجل قياس ومصدر بيانات معتمد من الإدارة':'Measurement log and department-approved data source'}));
}
function generationPurpose(input,family,title,locale){
 const ar=locale==='ar',objective=String(input.strategyObjective||'').trim();
 if(ar)return 'قيادة وتنسيق '+family.ar+' بما يضمن تنفيذ '+(objective?('الهدف الاستراتيجي «'+objective+'»'):'أولويات الإدارة')+' من خلال التخطيط والمتابعة والتقارير وتحسين كفاءة التنفيذ، مع إبقاء الصلاحيات النهائية وفق تفويضات الجهة.';
 return 'Lead and coordinate '+family.en+' to deliver '+(objective?('the strategic objective “'+objective+'”'):'department priorities')+' through planning, follow-up, reporting and execution improvement, while final authorities remain governed by organizational delegation.';
}
function generationAuthority(signals,locale){const ar=locale==='ar';const rows=[ar?'تنسيق خطط العمل ومتابعة التنفيذ ورفع الانحرافات والتوصيات':'Coordinate work plans, monitor delivery and escalate variances and recommendations'];if(signals.procurement)rows.push(ar?'إعداد ومتابعة وثائق المشتريات والعقود والفواتير دون افتراض صلاحية اعتماد نهائي':'Prepare and track procurement, contract and invoice documents without assuming final approval authority');if(signals.budget)rows.push(ar?'متابعة المصروفات والتوقعات ورفع التوصيات؛ الاعتماد المالي وفق مصفوفة الصلاحيات':'Monitor spend and forecasts and raise recommendations; financial approval follows delegated authority');return rows.join('\n');}
function buildSkills(family,signals,locale){const ar=locale==='ar',base=ar?family.technicalAr:family.technicalEn,extra=[];if(signals.project)extra.push(ar?'إدارة الجداول والمخاطر والمبادرات':'Schedules, risks and initiative management');if(signals.procurement)extra.push(ar?'إدارة دورة RFP / PR / PO والعقود':'RFP / PR / PO and contract lifecycle coordination');if(signals.budget)extra.push(ar?'متابعة OPEX وتحليل الانحراف':'OPEX monitoring and variance analysis');if(signals.reporting)extra.push(ar?'إعداد تقارير التقدم ولوحات المتابعة':'Progress reporting and management dashboards');if(signals.improvement)extra.push(ar?'تحليل وتحسين العمليات':'Process analysis and improvement');return uniq([...base,...extra]).slice(0,10);}
function generate(input={},locale='en'){
 const ar=locale==='ar',responsibilities=sentences(input.responsibilities),strategy=String(input.strategyObjective||'').trim();
 if(!strategy&&!responsibilities.length)throw Error(ar?'أدخل هدفًا استراتيجيًا أو مسؤوليات الدور.':'Enter a strategic objective or role responsibilities.');
 if(responsibilities.length<2)throw Error(ar?'أدخل مسؤوليتين على الأقل حتى تكون حزمة الوصف الوظيفي قابلة للمراجعة.':'Enter at least two responsibilities so the job-description proposal is reviewable.');
 const text=[strategy,responsibilities.join(' '),input.department,input.context].join(' '),family=detectFamily(input),signals=detectSignals(text),level=recommendLevel(input,signals,responsibilities.length),title=proposedTitle(family,level,signals,locale),skills=buildSkills(family,signals,locale),measures=successMeasures(signals,locale),career=ar?family.careerAr:family.careerEn;
 const department=String(input.department||'').trim()||(ar?family.departmentAr:family.departmentEn);
 const behaviors=ar?behaviorAr:behaviorEn;
 const qualification=ar?family.qualificationAr:family.qualificationEn;
 const experience=level.id==='director'?(ar?'خبرة ذات صلة 10+ سنوات، منها خبرة قيادية موثقة — مقترح للمراجعة':'10+ years of relevant experience including demonstrated leadership — proposed for review'):level.id==='manager'?(ar?'خبرة ذات صلة 7–10 سنوات، منها خبرة في قيادة/تنسيق أعمال متعددة — مقترح للمراجعة':'7–10 years of relevant experience, including ownership of multiple workstreams — proposed for review'):level.id==='senior'?(ar?'خبرة ذات صلة 4–7 سنوات — مقترح للمراجعة':'4–7 years of relevant experience — proposed for review'):(ar?'خبرة ذات صلة 2–5 سنوات — مقترح للمراجعة':'2–5 years of relevant experience — proposed for review');
 const stakeholder=family.id==='hc'?(ar?'قيادة رأس المال البشري؛ المالية؛ المشتريات؛ الإدارات المستفيدة؛ الموردون':'HC leadership; Finance; Procurement; business departments; vendors'):(ar?'قيادة الإدارة؛ المالية؛ المشتريات؛ الإدارات ذات العلاقة؛ الموردون عند الحاجة':'Department leadership; Finance; Procurement; related departments; vendors where applicable');
 const content={
  strategyObjective:strategy,
  marketTitle:title,
  title,
  jobFamily:ar?family.ar:family.en,
  careerPath:career.join(' → '),
  field:ar?family.ar:family.en,
  seniority:ar?level.ar:level.en,
  department,
  requestType:'proposed-role',
  businessNeed:strategy||(ar?'تجميع المسؤوليات المتفرقة في دور واضح قابل للقياس والمساءلة.':'Consolidate the stated responsibilities into a clear, measurable and accountable role.'),
  alternatives:ar?'قبل إنشاء المنصب: راجع إعادة توزيع العمل على الفريق الحالي، الخدمات المشتركة، الأتمتة أو الاستعانة بمورد. يوثق المراجع سبب عدم كفاية البدائل.':'Before creating the position, review redistribution to the existing team, shared services, automation or external support. The reviewer records why alternatives are insufficient.',
  successMeasures:measures.join('\n'),
  purpose:generationPurpose(input,family,title,locale),
  responsibilities:responsibilities.join('\n'),
  team:ar?'يقود التنسيق عبر أصحاب علاقة متعددين؛ عدد المرؤوسين المباشرين لا يُفترض ويحدده الهيكل التنظيمي المعتمد.':'Coordinates across multiple stakeholders; direct reports are not assumed and must follow the approved organization structure.',
  budget:signals.budget?(ar?'متابعة OPEX والمصروفات والعقود ذات الصلة؛ سقف وصلاحية الاعتماد تحددهما الجهة.':'Monitor related OPEX, spend and contracts; approval limits are defined by the organization.'):(ar?'لا يُفترض نطاق مالي؛ يحدده المراجع وفق الهيكل والصلاحيات.':'No budget authority is assumed; reviewers define it from the approved structure and delegation.'),
  authority:generationAuthority(signals,locale),
  impact:ar?('أثر على تنفيذ '+family.ar+' وجودة المتابعة والشفافية وكفاءة العمليات داخل الإدارة.'):( 'Impact on '+family.en+' delivery, execution visibility and process efficiency within the department.'),
  stakeholders:stakeholder,
  qualifications:qualification,
  experience,
  skills:skills.join('\n'),
  behaviors:behaviors.join('\n'),
  certifications:family.id==='hc'?(ar?'PMP أو ما يعادلها مفضلة لأدوار المشاريع؛ SHRM/CIPD أو اعتماد موارد بشرية مناسب مفضل — ليست اشتراطات تنظيمية تلقائية.':'PMP or equivalent preferred for project-heavy scope; SHRM/CIPD or relevant HR certification preferred — not automatic regulatory requirements.'):(ar?'تحدد الشهادات المهنية المناسبة بعد مراجعة طبيعة العمل وسياسة الجهة.':'Relevant professional certifications are defined after reviewing the work and organization policy.'),
  constraints:String(input.constraints||'').trim(),
  kpis:kpiRows(measures,locale),
  skillRequirements:skills.slice(0,7).map((name,i)=>({name,type:i<Math.ceil(skills.length/2)?(ar?'فنية':'Technical'):(ar?'عابرة للمهن':'Transferable'),level:level.id==='professional'?(ar?'متوسط':'Working'):(ar?'متقدم':'Advanced'),evidence:ar?'مقترح مولد من نطاق المسؤوليات؛ يحتاج اعتماد OD.':'Generated from the responsibility scope; OD review required.'})),
  odGenerationBasis:ar?'اقتراح قواعد شفافة من الهدف والمسؤوليات؛ ليس مسح سوق حيًا ولا تقييمًا وظيفيًا معتمدًا.':'Transparent rule-based proposal from the objective and responsibilities; not a live market survey or approved job evaluation.'
 };
 if(input.saudizationNote)content.saudization=String(input.saudizationNote).trim();
 return {schema:'miyar-od-proposal/1.0',mode:'transparent-rules',locale,family:{id:family.id,label:ar?family.ar:family.en},signals,gradeRecommendation:{level:ar?level.ar:level.en,rationale:ar?level.rationaleAr:level.rationaleEn,status:'pre-evaluation'},content,referenceQueries:{ssco:family.ssco,education:family.education,educationLevel:'6'},notices:[ar?'المسمى «متوافق مع السوق» هو اقتراح تسمية شائع وليس نتيجة مسح سوق حي.':'The market-aligned title is a naming proposal, not a live market-survey result.',ar?'الدرجة النهائية تُحسب فقط من إطار التقييم المعتمد لدى الجهة؛ لا يحسب هذا المحرك Korn Ferry أو Mercer أو WTW.':'Final grade comes only from the organization-approved evaluation framework; this engine does not calculate Korn Ferry, Mercer or WTW.',ar?'نسبة التوطين والمتطلبات المهنية يجب التحقق منها من مصدر رسمي حالي قبل الاعتماد.':'Saudization and professional requirements must be verified against a current official source before approval.']};
}
const hcExample={strategyObjective:'Cascade the Human Capital strategy into prioritized action plans and improve execution efficiency.',department:'Human Capital',responsibilities:'Manage HC projects in terms of coordination, follow up, progress monitoring and reports\nManage procurement process including RFP, PR and PO, vendor contracts and invoice submission\nProvide daily, weekly, monthly, quarterly and annual progress reports\nOversee HC OPEX preparation, submission and monitoring\nImprove HC processes for greater efficiency\nCascade HC strategy into action plans with timelines and prioritization of critical initiatives',saudizationNote:'100% Saudi — expert-provided example requirement; verify against the current official source before approval.'};
const api={generate,normalize,sentences,detectFamily,detectSignals,recommendLevel,hcExample};
root.MiyarODEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
