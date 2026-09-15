/* QA hardening for Miyar 5.0 OD proposals.
 * Keeps the transparent rule-based engine, but prevents manager-code leakage
 * into specialist roles and adds healthcare/sales coverage with auditable KPIs.
 */
(function(root){
'use strict';
const E=root.MiyarODEngine;if(!E||E.__qaReview20260915)return;E.__qaReview20260915=true;
const baseGenerate=E.generate.bind(E);
const norm=E.normalize||function(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();};
const defs={
 hc:{ar:'رأس المال البشري',en:'Human Capital',deptAr:'رأس المال البشري',deptEn:'Human Capital',keywords:['human capital','human resources','workforce','talent','employee','موارد بشرية','راس المال البشري','القوى العاملة','المواهب'],education:['إدارة الموارد البشرية','الموارد البشرية'],manager:['مدير موارد بشرية','مدير عمليات الموارد البشرية'],specialist:['أخصائي موارد بشرية'],techAr:['عمليات رأس المال البشري','إدارة المشاريع والمبادرات','متابعة المشتريات والموردين','تخطيط ومتابعة OPEX','التقارير الإدارية','تحسين العمليات','تنفيذ الاستراتيجية'],techEn:['Human capital operations','Project and initiative management','Procurement and vendor coordination','OPEX planning and monitoring','Management reporting','Process improvement','Strategy execution']},
 finance:{ar:'المالية والتخطيط',en:'Finance & Planning',deptAr:'المالية',deptEn:'Finance',keywords:['finance','financial','accounting','accountant','budget','cost','محاسبة','محاسب','مالية','مالي','ميزانية','تكلفة','ذمم','اقفال','إقفال'],education:['المحاسبة','المالية','إدارة الأعمال'],manager:['مدير مالي'],specialist:['محاسب','محلل مالي','محلل موازنة'],techAr:['المحاسبة وإعداد القيود','التسويات والمطابقات','التقارير المالية','تحليل الانحرافات','الميزانية والتوقعات'],techEn:['Accounting entries','Reconciliations','Financial reporting','Variance analysis','Budgeting and forecasting']},
 it:{ar:'التقنية والتحول الرقمي',en:'Technology & Digital',deptAr:'تقنية المعلومات',deptEn:'Information Technology',keywords:['software','developer','programmer','technology','digital','system','platform','data','cyber','برمجيات','مبرمج','مطور','تقنية','رقمي','نظام','منصة','بيانات','سيبراني'],education:['تقنية المعلومات','علوم الحاسب','نظم المعلومات'],manager:['مدير تقنية المعلومات'],specialist:['مهندس برمجيات','مطور برامج','أخصائي تقنية المعلومات','محلل نظم تقنية المعلومات'],techAr:['تطوير البرمجيات','تحليل الأنظمة','الاختبار وضمان الجودة','إدارة الإصدارات','توثيق الحلول التقنية'],techEn:['Software development','Systems analysis','Testing and quality assurance','Release management','Technical documentation']},
 health:{ar:'الرعاية الصحية والتمريض',en:'Healthcare & Nursing',deptAr:'الخدمات الصحية',deptEn:'Health Services',keywords:['nurse','nursing','patient','clinical','hospital','emergency','medical','ممرض','ممرضة','تمريض','مرضى','مريض','سريري','مستشفى','طوارئ','أدوية','رعاية صحية'],education:['التمريض','التمريض السريري'],manager:['مديرو الخدمات الصحية الآخرون'],specialist:['ممرض','اختصاصي تمريض'],techAr:['تقييم المرضى وفرز الحالات','تقديم الرعاية السريرية','إعطاء الأدوية وفق الوصفات','التوثيق الطبي','مكافحة العدوى وسلامة المرضى'],techEn:['Patient assessment and triage','Clinical care delivery','Medication administration','Clinical documentation','Infection prevention and patient safety'],certAr:'التسجيل المهني لدى الهيئة السعودية للتخصصات الصحية، وأي متطلبات دعم حياة حسب سياسة المنشأة — يتحقق منها مختص الجهة.',certEn:'Professional registration with the Saudi Commission for Health Specialties and life-support requirements per facility policy — organization verification required.'},
 sales:{ar:'المبيعات وتطوير الأعمال',en:'Sales & Business Development',deptAr:'المبيعات',deptEn:'Sales',keywords:['sales','revenue','key account','pipeline','customer','client','sell','مبيعات','ايرادات','إيرادات','عملاء','صفقات','بيع','تفاوض'],education:['التسويق','إدارة الأعمال'],manager:['مدير مبيعات'],specialist:['اختصاصي مبيعات','أخصائي تسويق'],techAr:['إدارة حسابات العملاء','إدارة فرص البيع','التفاوض','التنبؤ بالمبيعات','إدارة علاقات العملاء'],techEn:['Account management','Pipeline management','Negotiation','Sales forecasting','Customer relationship management']}
};
function score(def,text){const n=norm(text);return def.keywords.reduce((s,k)=>s+(n.includes(norm(k))?1:0),0);}
function detect(input){const text=[input.strategyObjective,input.responsibilities,input.department,input.context].join(' ');const ranked=Object.entries(defs).map(([id,d])=>({id,d,s:score(d,text)})).sort((a,b)=>b.s-a.s);return ranked[0]?.s?ranked[0]:null;}
function peopleManager(input,family,proposal){
 const text=norm([input.strategyObjective,input.responsibilities,input.requestedLevel,input.context].join(' '));
 if(/(?:^| )(manager|director|head|chief|vp|مدير|رئيس|نائب الرئيس)(?: |$)/.test(norm(input.requestedLevel||'')))return true;
 if(/manage team|lead team|supervise staff|direct reports|people manager|ادارة فريق|إدارة فريق|قيادة فريق|مرؤوس|يشرف على الموظفين/.test(text))return true;
 // Preserve the expert HC case: broad ownership across strategy, OPEX, procurement,
 // reporting and projects is a manager-level scope even without direct reports.
 if(family==='hc'){
  const signals=['project','rfp','purchase','vendor','opex','budget','report','strategy','مشروع','مشتريات','مورد','ميزانية','تقارير','استراتيجية'];
  if(signals.filter(x=>text.includes(norm(x))).length>=4)return true;
 }
 return false;
}
const KPI={
 project:{ar:['إنجاز المعالم في موعدها','المعالم المنجزة في موعدها ÷ المعالم المستحقة × 100','≥95%'],en:['Deliver milestones on time','Milestones delivered on time / milestones due × 100','≥95%']},
 reporting:{ar:['إصدار التقارير الدورية في موعدها','التقارير المصدرة في موعدها ÷ التقارير المجدولة × 100','100%'],en:['Issue scheduled reports on time','Reports issued on time / scheduled reports × 100','100%']},
 budget:{ar:['ضبط توقعات المصروفات','(المصروف الفعلي − المتوقع) ÷ المتوقع × 100','ضمن الحد الذي تعتمده المالية'],en:['Control spend forecast','(Actual − forecast spend) / forecast × 100','Within Finance-approved threshold']},
 patient:{ar:['سلامة المرضى وجودة التوثيق','الأحداث القابلة للتجنب + نسبة الالتزام في تدقيق التوثيق','صفر أحداث قابلة للتجنب؛ ≥95% التزام'],en:['Patient safety and documentation quality','Avoidable incidents + documentation audit compliance','Zero avoidable incidents; ≥95% compliance']},
 waiting:{ar:['زمن انتظار المرضى','متوسط الدقائق من الوصول إلى التقييم','يحدد من خط الأساس ومعيار المنشأة'],en:['Patient waiting time','Average minutes from arrival to assessment','Set from baseline and facility standard']},
 revenue:{ar:['تحقيق مستهدف الإيرادات','الإيرادات المحققة ÷ المستهدفة × 100','≥100% من المستهدف المعتمد'],en:['Achieve revenue target','Revenue achieved / target × 100','≥100% of approved target']},
 pipeline:{ar:['تغطية فرص البيع','قيمة الفرص المؤهلة ÷ مستهدف الفترة القادمة','تغطية يحددها مدير المبيعات'],en:['Qualified pipeline coverage','Qualified pipeline value / next-period target','Coverage set by sales leadership']},
 finance:{ar:['جودة الإقفال المالي','الحسابات المسواة دون فروقات جوهرية ÷ الحسابات المطلوبة × 100','100% أو حسب سياسة المالية'],en:['Financial close quality','Accounts reconciled without material variance / accounts due × 100','100% or Finance policy']},
 software:{ar:['جودة التسليم التقني','الإصدارات المقبولة دون عيوب حرجة ÷ الإصدارات المسلمة × 100','≥95% دون عيوب حرجة'],en:['Technical delivery quality','Releases accepted without critical defects / releases delivered × 100','≥95% without critical defects']},
 commitments:{ar:['الالتزامات المنجزة في موعدها','الالتزامات المنجزة في موعدها ÷ المستحقة × 100','≥95%'],en:['Commitments delivered on time','On-time commitments / commitments due × 100','≥95%']},
 stakeholders:{ar:['تحديث أصحاب العلاقة','التحديثات المرسلة في موعدها ÷ المجدولة × 100','100%'],en:['Stakeholder updates','Updates sent on time / scheduled updates × 100','100%']}
};
function kpis(family,text,locale){const n=norm(text),ids=[];if(family==='health')ids.push('patient','waiting');if(family==='sales')ids.push('revenue','pipeline');if(family==='finance')ids.push('finance','budget');if(family==='it')ids.push('software');if(/project|initiative|مشروع|مبادرة/.test(n))ids.push('project');if(/report|تقرير/.test(n))ids.push('reporting');if(/budget|opex|ميزانية|مصروف/.test(n))ids.push('budget');ids.push('commitments','stakeholders');return [...new Set(ids)].slice(0,5).map(id=>{const v=KPI[id][locale==='ar'?'ar':'en'];return {outcome:v[0],metric:v[1],target:v[2]+(locale==='ar'?' — مقترح للمراجعة':' — proposed for review'),frequency:locale==='ar'?'شهريًا؛ مع مراجعة ربع سنوية':'Monthly; quarterly review',deliverable:locale==='ar'?'سجل قياس ومصدر بيانات تعتمدُه الإدارة':'Measurement log and department-approved data source'};});}
function patchTitle(family,manager,locale,proposal){if(family==='health')return manager?(locale==='ar'?'مدير خدمات صحية':'Health Services Manager'):(locale==='ar'?'ممرض / اختصاصي تمريض':'Nurse / Nursing Specialist');if(family==='sales')return manager?(locale==='ar'?'مدير مبيعات':'Sales Manager'):(locale==='ar'?'أخصائي مبيعات':'Sales Specialist');if(family==='finance'&&!manager)return locale==='ar'?'أخصائي مالي / محاسب':'Finance Specialist / Accountant';if(family==='it'&&!manager)return locale==='ar'?'أخصائي تقنية / برمجيات':'Technology / Software Specialist';return proposal.content.title;}
E.generate=function(input={},locale='en'){
 const p=baseGenerate(input,locale),hit=detect(input);if(!hit)return p;
 const {id,d}=hit,manager=peopleManager(input,id,p),ar=locale==='ar',text=[input.strategyObjective,input.responsibilities].join(' ');
 p.family={id,label:ar?d.ar:d.en};
 p.content.jobFamily=ar?d.ar:d.en;
 if(!String(input.department||'').trim())p.content.department=ar?d.deptAr:d.deptEn;
 p.content.title=patchTitle(id,manager,locale,p);p.content.marketTitle=p.content.title;
 p.content.skills=(ar?d.techAr:d.techEn).join('\n');
 if(d.certAr)p.content.certifications=ar?d.certAr:d.certEn;
 p.content.kpis=kpis(id,text,locale);
 p.content.skillRequirements=(ar?d.techAr:d.techEn).slice(0,7).map(name=>({name,type:ar?'فنية':'Technical',level:manager?(ar?'متقدم':'Advanced'):(ar?'متوسط':'Working'),evidence:ar?'مقترح من نطاق المسؤوليات؛ يحتاج اعتماد OD.':'Proposed from the responsibility scope; OD review required.'}));
 p.referenceQueries=p.referenceQueries||{};p.referenceQueries.ssco=(manager?d.manager:d.specialist).slice();p.referenceQueries.education=d.education.slice();
 return p;
};
E.hcExampleAr={strategyObjective:'تحويل استراتيجية رأس المال البشري إلى خطط عمل ذات أولوية ورفع كفاءة التنفيذ.',department:'رأس المال البشري',responsibilities:'إدارة مشاريع رأس المال البشري من حيث التنسيق والمتابعة ورصد التقدم والتقارير\nإدارة دورة المشتريات بما فيها طلبات العروض (RFP) وطلبات وأوامر الشراء (PR/PO) وعقود الموردين وتقديم الفواتير\nإعداد تقارير التقدم اليومية والأسبوعية والشهرية والربعية والسنوية\nالإشراف على إعداد ميزانية المصروفات التشغيلية (OPEX) لرأس المال البشري ورفعها ومتابعتها\nتحسين إجراءات رأس المال البشري لرفع الكفاءة\nتحويل استراتيجية رأس المال البشري إلى خطط عمل بجداول زمنية وأولويات للمبادرات الحرجة',saudizationNote:'100% سعودي — متطلب المثال الذي قدّمه الخبير؛ يجب التحقق منه من المصدر الرسمي الحالي قبل الاعتماد.'};
if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
