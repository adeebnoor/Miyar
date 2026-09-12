/* Position workflow model. No proprietary evaluation calculation is performed. */
(function(root){
 'use strict';
 const fields = [
  ['title',0,'المسمى المقترح','Proposed position title',true],
  ['department',0,'الإدارة','Department',true],
  ['manager',0,'يرفع تقاريره إلى','Reports to',true],
  ['effectiveDate',0,'تاريخ السريان المقترح','Proposed effective date',false,'date'],
  ['businessNeed',0,'مبرر إنشاء المنصب والفجوة التي يعالجها','Business justification and capability gap',true,'textarea'],
  ['purpose',0,'الغرض من المنصب','Position purpose',true,'textarea'],
  ['responsibilities',0,'المسؤوليات الرئيسية — كل مسؤولية في سطر','Key responsibilities — one per line',true,'textarea'],
  ['team',1,'نطاق الإشراف وعدد المرؤوسين','Supervision scope and direct reports',true],
  ['budget',1,'نطاق الميزانية والتعرض المالي','Budget scope and financial exposure',true],
  ['authority',1,'صلاحيات اتخاذ القرار وحدود الدور','Decision authority and role boundaries',true,'textarea'],
  ['impact',1,'الأثر التنظيمي ومخرجات النجاح','Organizational impact and success outcomes',true,'textarea'],
  ['stakeholders',1,'أصحاب المصلحة داخليًا وخارجيًا','Internal and external stakeholders',true,'textarea'],
  ['qualifications',1,'المؤهلات والمعرفة الفنية','Qualifications and technical knowledge',true,'textarea'],
  ['experience',1,'الخبرات المطلوبة','Required experience',true],
  ['skills',1,'المهارات والكفاءات الفنية','Technical skills and competencies',true,'textarea'],
  ['behaviors',1,'الكفاءات السلوكية','Behavioral competencies',true,'textarea'],
  ['certifications',1,'الشهادات المقترحة — تتطلب تحققًا نظاميًا','Proposed certifications — require regulatory verification',false,'textarea'],
  ['businessReviewer',2,'اسم مراجع الإدارة','Business reviewer name',false],
  ['businessReviewDate',2,'تاريخ مراجعة الوصف','JD review date',false,'date'],
  ['knowHow',3,'أدلة المعرفة والمهارة','Know-how evidence',false,'textarea'],
  ['problemSolving',3,'أدلة حل المشكلات','Problem-solving evidence',false,'textarea'],
  ['accountability',3,'أدلة المساءلة والأثر','Accountability evidence',false,'textarea'],
  ['method',3,'منهجية التقييم ومرجعها','Evaluation methodology and reference',false],
  ['evaluator',3,'اسم المقيم المختص','Qualified evaluator name',false],
  ['evaluationDate',3,'تاريخ التقييم','Evaluation date',false,'date'],
  ['score',3,'نتيجة التقييم المدخلة من المختص','Score supplied by the evaluator',false],
  ['grade',3,'الدرجة الوظيفية المدخلة من المختص','Job grade supplied by the evaluator',false],
  ['rationale',3,'مبررات التقييم ومرجع الأدلة','Evaluation rationale and evidence reference',false,'textarea'],
  ['saudization',3,'متطلبات التوطين ونطاق انطباقها','Saudization requirements and applicability',false,'textarea'],
  ['saudizationSource',3,'رابط المرجع النظامي للتوطين','Saudization regulatory source URL',false,'url'],
  ['saudizationDate',3,'تاريخ التحقق من متطلبات التوطين','Saudization verification date',false,'date'],
  ['license',3,'الشهادات والتراخيص المطلوبة والجهة المنظمة','Required certificates, licenses and regulator',false,'textarea'],
  ['licenseSource',3,'رابط مرجع الشهادات والتراخيص','Certificates and licensing source URL',false,'url'],
  ['licenseDate',3,'تاريخ التحقق من الشهادات والتراخيص','Certificates and licensing verification date',false,'date']
 ].map(([id,step,ar,en,required,type='text'])=>({id,step,ar,en,required,type}));
 function blank(){return Object.fromEntries(fields.map(f=>[f.id,'']).concat([['businessReviewed',false]]));}
 function sample(locale='ar'){
  const ar={title:'مهندس صناعي — تميز العمليات',department:'إدارة التميز التشغيلي',manager:'مدير التميز التشغيلي',businessNeed:'توجد ازدواجية في المهام وتفاوت في قياس الأداء بين فرق التشغيل. نحتاج إلى دور يوحد التحليل ومتابعة التحسين.',purpose:'تحسين كفاءة التشغيل وتقليل ازدواجية المهام وتطوير مؤشرات الأداء وتوزيع الموارد.',responsibilities:'تحليل العمليات وتحديد فرص تقليل الهدر\nتطوير مؤشرات الأداء ومراجعة نتائجها مع فرق التشغيل\nاقتراح تحسين توزيع الموارد وأساليب العمل\nتوثيق مبادرات التحسين ورفع تقارير دورية',team:'دور تخصصي؛ لا يوجد مرؤوسون مباشرون',budget:'لا يملك ميزانية مباشرة؛ يقدم توصيات لتحسين استخدام الموارد',authority:'يقترح تحسينات العمليات؛ اعتماد الميزانية وتغيير الهيكل من صلاحيات مدير الإدارة.',impact:'تحسين وضوح مؤشرات الأداء وتوثيق فرص خفض الهدر. تُحدد المستهدفات الكمية في تجربة المؤسسة.',stakeholders:'داخليًا: التشغيل، الجودة، المالية، الموارد البشرية. خارجيًا: شركاء تحسين العمليات عند الحاجة.',qualifications:'بكالوريوس في الهندسة الصناعية أو تخصص مناسب، ومعرفة بتحليل العمليات والإحصاء التطبيقي.',experience:'خبرة مناسبة في تحليل العمليات ومشروعات التحسين؛ تُحدد المدة عند مراجعة النطاق.',skills:'تحليل البيانات، تصميم مؤشرات الأداء، رسم العمليات، تحليل السبب الجذري.',behaviors:'التعاون، التواصل الواضح، التفكير التحليلي، توثيق الأدلة.',certifications:'شهادات التحسين المستمر ميزة مقترحة؛ متطلبات التسجيل المهني لم تتحقق بعد.',knowHow:'معرفة بتحليل العمليات وقياس الأداء؛ ينسق مع فرق متعددة دون إشراف مباشر.',problemSolving:'تحليل أسباب الهدر ومقارنة بدائل تحسين العمليات ضمن سياسات الإدارة.',accountability:'توصيات تؤثر في أداء العمليات؛ الاعتماد النهائي للميزانية لدى مدير الإدارة.'};
  const en={title:'Industrial Engineer — Operational Excellence',department:'Operational Excellence',manager:'Operational Excellence Manager',businessNeed:'Duplicated tasks and inconsistent performance measurement across operations teams require a dedicated role for analysis and improvement tracking.',purpose:'Improve operations efficiency, reduce duplication and waste, and develop KPIs and resource allocation methods.',responsibilities:'Analyze operations and identify waste reduction opportunities\nDevelop KPIs and review results with operations teams\nRecommend improvements to resource allocation and working methods\nDocument improvement initiatives and prepare periodic reports',team:'Individual contributor; no direct reports',budget:'No direct budget ownership; recommends improvements to resource use',authority:'Recommends process improvements. Budget approval and structural changes remain with the department manager.',impact:'Clearer performance indicators and documented waste reduction opportunities. Quantitative targets will be set in an institutional pilot.',stakeholders:'Internal: operations, quality, finance and HR. External: process improvement partners when needed.',qualifications:'Bachelor degree in industrial engineering or a relevant discipline; knowledge of process analysis and applied statistics.',experience:'Relevant experience in operations analysis and improvement projects; duration to be agreed after scope review.',skills:'Data analysis, KPI design, process mapping and root cause analysis.',behaviors:'Collaboration, clear communication, analytical thinking and evidence documentation.',certifications:'Continuous improvement certifications are a proposed advantage; professional registration requirements have not been verified.',knowHow:'Process analysis and performance measurement knowledge; coordinates across teams without direct supervision.',problemSolving:'Analyzes waste causes and compares process improvement options within departmental policies.',accountability:'Recommendations affect operational performance; final budget approval remains with the department manager.'};
  return Object.assign(blank(),locale==='en'?en:ar);
 }
 function completeness(input){const core=fields.filter(f=>f.required);const missing=core.filter(f=>!String(input[f.id]??'').trim());return {filled:core.length-missing.length,total:core.length,missing:missing.map(f=>f.id)};}
 function evaluation(input){
  const needed=['method','evaluator','evaluationDate','score','grade','rationale','knowHow','problemSolving','accountability'];
  const complete=needed.every(k=>String(input[k]??'').trim());
  return {status:complete?'reported-unverified':'pending',method:input.method||null,evaluator:input.evaluator||null,date:input.evaluationDate||null,score:input.score||null,grade:input.grade||null,rationale:input.rationale||null,evidence:{knowHow:input.knowHow||null,problemSolving:input.problemSolving||null,accountability:input.accountability||null},calculatedByMiyar:false};
 }
 function sourceStatus(text,url,date){let valid=false;try{valid=['https:','http:'].includes(new URL(url).protocol);}catch{}return text&&valid&&date?'reported-unverified':'pending';}
 function packageRecord(input,result,locale='ar'){
  const complete=completeness(input);const role=result?.kind==='match'?result.role:null;
  return {schema:'miyar-position-package/1.0',createdAt:new Date().toISOString(),locale,mode:'browser-demo',positionApproval:'pending',inputCompleteness:complete,
   position:{title:input.title,department:input.department,reportsTo:input.manager,effectiveDate:input.effectiveDate||null},
   jobDescription:{status:input.businessReviewed&&String(input.businessReviewer||'').trim()&&String(input.businessReviewDate||'').trim()&&!complete.missing.length?'business-review-recorded':'draft',purpose:input.purpose,businessJustification:input.businessNeed,responsibilities:String(input.responsibilities||'').split(/\n+/).map(s=>s.trim()).filter(Boolean),authority:input.authority,impact:input.impact,team:input.team,budget:input.budget,stakeholders:input.stakeholders,qualifications:input.qualifications,experience:input.experience,technicalCompetencies:input.skills,behavioralCompetencies:input.behaviors,proposedCertifications:input.certifications,reviewer:input.businessReviewer||null,reviewDate:input.businessReviewDate||null},
   evaluation:evaluation(input),
   occupationMapping:role?{status:'sample-suggestion-pending-verification',titleAr:role.title,titleEn:role.titleEn,saudiCode:role.code,educationCode:role.educationCode,source:'Supplied data.xlsx — five-record sample'}:{status:'unmapped',saudiCode:null,educationCode:null},
   regulatoryReview:{saudization:{status:sourceStatus(input.saudization,input.saudizationSource,input.saudizationDate),requirement:input.saudization||null,source:input.saudizationSource||null,checkedAt:input.saudizationDate||null},certification:{status:sourceStatus(input.license,input.licenseSource,input.licenseDate),requirement:input.license||null,source:input.licenseSource||null,checkedAt:input.licenseDate||null}},
   limitations:['Draft assembled from supplied form values; no live AI generation or automatic translation of user input.','No proprietary Korn Ferry scoring model, certification or grade calculation.','Reported reviews and scores are unverified entries, not approvals.','Occupation and education codes require current source verification.','No automatic Saudization or licensing compliance determination.','Data exists only in this browser session unless exported.']};
 }
 const api={fields,blank,sample,completeness,evaluation,packageRecord};root.MiyarPosition=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
