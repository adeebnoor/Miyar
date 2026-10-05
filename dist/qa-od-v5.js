/* QA hardening for Miyar 5.0 OD proposals.
 * Keeps the transparent rule-based engine, but prevents manager-code leakage
 * into specialist roles and adds healthcare/sales coverage with auditable KPIs.
 */
(function(root){
'use strict';
const E=root.MiyarODEngine;if(!E||E.__qaReview20260915)return;E.__qaReview20260915=true;
const baseGenerate=E.generate.bind(E);
const norm=E.normalize||function(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();};
function professionalReview(p,input,locale){
 const ar=locale==='ar',text=norm(input.responsibilities||''),family=p.family.id;
 const supervisor=p.gradeRecommendation.level==='supervisor';
 const row=(outcome,metric)=>({outcome,metric,target:ar?'يُحدد من خط الأساس وسياسة الجهة؛ بانتظار اعتماد المختص':'Set from baseline and organization policy; specialist approval pending',frequency:ar?'شهريًا — دورية مقترحة للمراجعة':'Monthly — proposed cadence for review',deliverable:ar?'سجل قياس موثق يحدد البسط والمقام والاستثناءات':'Documented measurement log defining numerator, denominator and exclusions'});
 if(family==='hc'&&/payroll|رواتب|مسير/.test(text)&&!['director','executive'].includes(p.gradeRecommendation.level)){
  p.content.kpis=ar?[row('دقة الرواتب من أول معالجة','بنود رواتب الموظفين الصحيحة دون إعادة معالجة ÷ جميع بنود الرواتب المعالجة × 100'),row('الصرف في الموعد المعتمد','مدفوعات الرواتب المنفذة في الموعد ÷ المدفوعات المستحقة × 100'),row('مطابقة اشتراكات التأمينات','سجلات الاشتراك المطابقة بين المسير وفاتورة التأمينات ÷ السجلات المطلوب مطابقتها × 100')]:[row('First-pass payroll accuracy','Correct employee payroll records without rework / all processed payroll records × 100'),row('On-time payroll payment','Payroll payments made by approved due date / payments due × 100'),row('GOSI reconciliation accuracy','Contribution records reconciled between payroll and GOSI invoice / contribution records due for reconciliation × 100')];
  p.content.qualifications=ar?'معرفة مهنية موثقة بعمليات الرواتب والمحاسبة أو الموارد البشرية؛ المؤهل ومستواه يحددهما تحليل العمل وسياسة الجهة.':'Demonstrated payroll, accounting or HR knowledge; qualification and level follow job analysis and organization policy.';
 }
 if(family==='health'){
  p.content.qualifications=ar?'مؤهل مناسب في التمريض؛ يتحقق مختص المنشأة من المستوى والتسجيل والترخيص المهني الساري. لا يُستبدل بمؤهل إدارة أعمال.':'Appropriate nursing qualification; the facility specialist verifies level, current professional registration and licence.';
  p.content.kpis=ar?[row('معدل أخطاء إعطاء الدواء الموثقة','أخطاء إعطاء الدواء المسجلة ÷ مرات إعطاء الدواء × 1000؛ تُراجع مع اكتمال الإبلاغ ولا يُعاقب الإبلاغ'),row('اكتمال تقييم كفاءة طاقم الوردية','الممرضون المستكملون لتقييم الكفاءة المستحق ÷ الممرضين المستحق لهم التقييم × 100'),row('اكتمال التوثيق التمريضي','السجلات المستوفية لعناصر التدقيق ÷ السجلات التمريضية المدققة × 100')]:[row('Reported medication administration error rate','Reported administration errors / medication administrations × 1000; review alongside reporting completeness, without penalizing reporting'),row('Due nursing competency assessments completed','Nurses completing due competency assessment / nurses due for assessment × 100'),row('Nursing documentation completeness','Records meeting documentation audit requirements / nursing records audited × 100')];
  p.notices.unshift(ar?'قالب تمريض محدود للمراجعة التخصصية فقط؛ ليس بروتوكولًا سريريًا أو إثباتًا لصلاحية مهنية.':'Limited nursing template for specialist review only; not a clinical protocol or confirmation of professional eligibility.');
 }

 const leading=supervisor||/manager|director|رئيس|مدير/.test(String(p.content.seniority).toLowerCase());
 p.content.purpose=ar?(leading?'الإشراف على تنفيذ نطاق الدور':'تنفيذ نطاق الدور التخصصي')+' لدعم الهدف الاستراتيجي: '+String(input.strategyObjective||''):(leading?'Oversee delivery of the role scope':'Deliver the professional role scope')+' in support of the strategic objective: '+String(input.strategyObjective||'');
 p.content.successMeasures=p.content.kpis.map(x=>x.outcome).join('\n');
 if(p.content.finalProposedTitle)p.content.finalProposedTitle=p.content.title;
 if(supervisor){const check=p.validation?.find(x=>x.id==='level');if(check&&check.status!=='fail'){check.status='warn';check.ar='الإشراف مستدل من المسؤوليات؛ راجع عدد المرؤوسين والصلاحيات مع الهيكل';check.en='Supervision is evidenced by duties; confirm direct-report count and authority against the structure';}p.content.careerPath=ar?'مشرف تمريض ← مسؤول تمريض أعلى (بعد التقييم والتحقق المهني)':'Nursing Supervisor → Senior nursing responsibility (subject to evaluation and professional review)';if(family!=='health')p.content.careerPath=ar?'مشرف ← مدير في '+p.family.label+' (بعد التقييم)':'Supervisor → '+p.family.label+' Manager (subject to evaluation)';}
 if(!['hc','finance','admin'].includes(family))p.notices.unshift(ar?'هذا المجال خارج نطاق التجربة الأولي (الموارد البشرية والمالية والإدارة)؛ المخرج مسودة تحتاج مراجعة خبير المجال.':'Outside the initial HR, Finance and Administration pilot; this draft needs domain-expert validation.');
 return p;
}
E.generate=function(input={},locale='en'){
 const R=root.MiyarRoleRecommender;
 R?.validateScope(input,locale);
 const recommendation=R?.recommend({objective:input.strategyObjective,responsibilities:input.responsibilities,domain:input.department,seniority:input.requestedLevel,title:input.title,confirmedRole:input.confirmedRole,directReports:input.directReports,constraints:input.constraints});
 if(!recommendation)throw Error(locale==='ar'?'لا تتوفر تغطية كافية للمسمى والمستوى المطلوبين؛ يلزم تأكيد النطاق من المختص.':'The requested title and level do not have sufficient supported coverage; a specialist must confirm the scope.');
 if(recommendation?.status==='needs-confirmation')return recommendation;
 if(recommendation?.status==='blocked')throw Error(locale==='ar'?'لا يمكن توليد الوصف قبل تصحيح تعارض المجال أو المستوى أو القيود.':'Correct the domain, level or constraint conflict before generating the job description.');
 const p=baseGenerate({...input,requestedLevel:recommendation.candidate.level},locale);
 if(recommendation){
  const r=recommendation.candidate,f=recommendation.detection.family,ar=locale==='ar',title=ar?r.titleAr:r.titleEn,manager=['manager','director','executive'].includes(r.level);
  p.family={id:f.id,label:ar?f.ar:f.en};p.content.jobFamily=p.family.label;p.content.title=title;p.content.marketTitle=title;{const labels={technician:['مستوى فني','Technician level'],supervisor:['مستوى مشرف','Supervisor level'],assistant:['مستوى مساعد','Assistant level'],specialist:['مستوى مهني','Professional level'],manager:['مستوى مدير','Manager level'],director:['مستوى مدير إدارة / رئيس','Director / Head level'],executive:['مستوى تنفيذي','Executive level']};p.content.seniority=(labels[r.level]||labels.specialist)[ar?0:1];}
  p.content.purpose=ar?'تنفيذ '+title+' لدعم الهدف: '+String(input.strategyObjective||''):'Deliver the '+title+' scope in support of: '+String(input.strategyObjective||'');
  const analysis=recommendation.levelAnalysis||R.analyzeLevel(input);
  p.content.levelEvidence=analysis.evidence;
  if(analysis.directReports!==null&&analysis.directReports!==undefined){p.content.directReports=analysis.directReports;p.content.team=ar?'عدد المرؤوسين المستدل من المدخل: '+analysis.directReports+'؛ راجع العدد والصلاحيات مع الهيكل المعتمد.':'Direct reports evidenced by the input: '+analysis.directReports+'; confirm count and authority against the approved structure.';}
  p.gradeRecommendation={level:r.level,rationale:ar?analysis.rationaleAr:analysis.rationaleEn,status:'pre-evaluation',directReports:analysis.directReports,evidence:analysis.evidence};
  if(r.intent!=='portfolio'){
   const skills=(ar?r.skillsAr:r.skillsEn),fallback=ar?[f.ar+' — مهارات تخصصية تحتاج تحديدًا','تحليل الأدلة','توثيق النتائج']:[f.en+' — detailed skills need specification','Evidence analysis','Outcome documentation'];
   p.content.skills=(skills.length?skills:fallback).join('\n');
   p.content.skillRequirements=(skills.length?skills:fallback).map(name=>({name,type:ar?'فنية':'Technical',level:manager?(ar?'متقدم':'Advanced'):(ar?'متوسط':'Working'),evidence:ar?'اقتراح من كتالوج الدور؛ يعتمد بعد مراجعة المسؤوليات.':'Role catalog proposal; validate against responsibilities.'}));
   const metric=ar?r.metricAr:r.metricEn;
   p.content.kpis=metric?metric.split(/[;؛]/).filter(x=>x.trim()).map(metric=>({outcome:ar?'جودة وفعالية '+title:title+' effectiveness',metric,target:ar?'يحدد من خط الأساس ويعتمده مالك العملية':'Set from baseline and approved by the process owner',frequency:ar?'شهريًا':'Monthly',deliverable:ar?'سجل قياس بمصدر موثق':'Measurement log with documented source'})):p.content.kpis;
   p.content.successMeasures=p.content.kpis.map(x=>x.metric).join('\n');
   p.content.careerPath=manager?(ar?'مدير أول في '+f.ar+' ← مدير إدارة (بعد التقييم)':'Senior '+f.en+' Manager → Director (subject to evaluation)'):(ar?'أخصائي أول في '+f.ar+' ← مدير (بعد التقييم)':'Senior '+f.en+' Specialist → Manager (subject to evaluation)');
   p.content.qualifications=ar?'مؤهل مرتبط بـ '+f.ar+'؛ الرموز التعليمية روابط مقترحة تحتاج مراجعة.':'Qualification relevant to '+f.en+'; education-code links are proposed and require review.';
   p.content.certifications=ar?'تحدد الشهادات حسب تخصص الدور وسياسة الجهة؛ لا يُفترض اشتراط شهادة مشاريع.':'Certifications depend on the role and organization policy; no project certificate is assumed.';
  }
  if(f.id==='internalAudit'){
   p.content.authorities=ar?'الوصول إلى الأدلة وتقييم الضوابط ورفع النتائج وفق ميثاق المراجعة المعتمد؛ لا يمتلك تشغيل الضوابط أو اعتماد المعاملات التي يراجعها.':'Access evidence, assess controls and report findings under the approved audit charter; does not own operating controls or approve the transactions being audited.';
   p.content.stakeholders=ar?'لجنة المراجعة؛ رئيس المراجعة الداخلية؛ ملاك العمليات والضوابط؛ المالية وGRC حسب نطاق المهمة.':'Audit Committee; Chief Audit Executive; process and control owners; Finance and GRC within engagement scope.';
  }
  if(recommendation.detection.workstreams.length>1)p.notices.unshift(ar?'نطاق متعدد الوظائف: راجع المهمة الرئيسية والمهام المساندة أو افصلها إلى أدوار قبل الاعتماد.':'Multi-function scope: confirm primary and supporting work, or split it into roles before approval.');
  p.content.odGenerationBasis=ar?'اقتراح قواعد شفافة من الهدف والمسؤوليات مع فحص المجال والمستوى والقيود؛ بانتظار اعتماد المختص.':'Transparent rule-based proposal from the objective and responsibilities, with domain, level and constraint checks; expert approval pending.';
  p.referenceQueries={ssco:[r.referenceTitleAr],education:r.educationCodes,educationLevel:['assistant','technician'].includes(r.level)?'':'6'};
  if(r.licenseReviewRequired)p.notices.unshift(ar?r.licenseNoteAr:r.licenseNoteEn);
  p.validation=recommendation.checks;p.content.roleValidation=recommendation.checks;p.content.finalProposedTitle=recommendation.finalTitle?title:'';
  if(recommendation.detection.conflict)p.notices.unshift(ar?'نطاق مختلط: معالجة الرواتب في المالية؛ راجع توزيع مسؤولياتها بين الإدارتين.':'Mixed function scope: payroll is processed in Finance; confirm the departmental accountability.');
  if((r.intent==='general'&&!r.domainProfileVersion)||!r.skillsAr.length)p.notices.unshift(ar?'قالب عام داخل المجال؛ يجب تخصيص المهارات والمؤشرات مع مختص.':'Generic template within this family; specialize skills and KPIs with a domain reviewer.');
  return professionalReview(p,input,locale);
 }
 return professionalReview(p,input,locale);
};
E.hcExampleAr={strategyObjective:'تحويل استراتيجية رأس المال البشري إلى خطط عمل ذات أولوية ورفع كفاءة التنفيذ.',department:'رأس المال البشري',responsibilities:'إدارة مشاريع رأس المال البشري من حيث التنسيق والمتابعة ورصد التقدم والتقارير\nإدارة دورة المشتريات بما فيها طلبات العروض (RFP) وطلبات وأوامر الشراء (PR/PO) وعقود الموردين وتقديم الفواتير\nإعداد تقارير التقدم اليومية والأسبوعية والشهرية والربعية والسنوية\nالإشراف على إعداد ميزانية المصروفات التشغيلية (OPEX) لرأس المال البشري ورفعها ومتابعتها\nتحسين إجراءات رأس المال البشري لرفع الكفاءة\nتحويل استراتيجية رأس المال البشري إلى خطط عمل بجداول زمنية وأولويات للمبادرات الحرجة',saudizationNote:'100% سعودي — متطلب المثال الذي قدّمه الخبير؛ يجب التحقق منه من المصدر الرسمي الحالي قبل الاعتماد.'};
if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
