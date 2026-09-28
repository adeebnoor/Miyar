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
function waiting(){const p=panel();if(!p||location.hash!=='#demo')return;p.innerHTML='<div class="demo-v5-wait"><span>INPUT → OUTPUT</span><h3>'+t('المدخلات جاهزة للتحليل','Input ready for analysis')+'</h3><p>'+t('اضغط «ابحث / حلّل الاحتياج». ستظهر نتيجة جديدة هنا مع رقم تشغيل ووقت واضحين.','Press “Find / analyze the need”. A fresh output will appear here with a visible run number and time.')+'</p></div>';if(badge())badge().textContent=t('بانتظار التشغيل','WAITING');}
function outputHeader(id,input){return '<div class="demo-v5-run"><span>'+t('OUTPUT GENERATED','OUTPUT GENERATED')+'</span><strong>Run #'+id+' · '+esc(stamp())+'</strong></div><div class="demo-v5-input"><b>INPUT</b><p>'+esc(input.objective)+'</p>'+(input.domain?'<small>'+t('المجال: ','Field: ')+esc(input.domain)+'</small>':'')+'</div>';}
function renderMatch(result,input,id){const r=result.role,p=panel();if(!p)return;const title=ar()?r.title:r.titleEn,reason=result.basis==='tasks'?(ar()?r.reason:r.reasonEn):t('تم العثور على سجل مطابق بالمسمى أو الرمز.','A matching title or occupation-code record was found.');p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output good"><div class="demo-v5-output-label">OUTPUT</div><h3>'+esc(title)+'</h3><div class="demo-v5-codes"><div><span>SSCO</span><strong>'+esc(r.code)+'</strong></div><div><span>'+t('رمز التعليم','Education code')+'</span><strong>'+esc(r.educationCode)+'</strong></div></div><p>'+esc(reason)+'</p><div class="demo-v5-actions"><button type="button" class="button button-primary" data-demo-continue>'+t('تابع إلى محرك OD الكامل','Continue to the full OD Engine')+'</button></div></div>';p.querySelector('[data-demo-continue]').onclick=()=>continueToOD(input,{title:r.title,occupationCode:r.code,educationFieldCode:r.educationCode});if(badge())badge().textContent=t('تم تحديث المخرج','OUTPUT UPDATED');}
function continueToOD(input,role={}){const describesNeed=input.objective.split(/\s+/).filter(Boolean).length>=3&&input.objective!==role.title;const fields={title:role.title||'',occupationCode:role.occupationCode||'',educationFieldCode:role.educationFieldCode||'',field:input.domain,seniority:input.seniority,constraints:input.constraints,businessNeed:describesNeed?input.objective:'',purpose:role.title&&describesNeed?input.objective:''};const message=role.title?t('نُقل الترشيح إلى المسودة: المسمى والرمز المهني والاحتياج. أكمل المسؤوليات ثم راجع الحزمة.','The recommendation was carried into the draft: title, occupation code and need. Complete the responsibilities, then review the package.'):t('نُقل الاحتياج إلى المسودة. اختر المرجع المهني وأكمل المسؤوليات.','The need was carried into the draft. Choose the occupation reference and complete the responsibilities.');const E=window.MiyarEnterprise;const fillStrategy=()=>{const box=document.querySelector('#miyar-od-workbench [data-od-strategy]');if(box&&!box.value&&describesNeed){box.value=input.objective;box.dispatchEvent(new Event('input',{bubbles:true}));}};if(E?.prefill){E.prefill(fields,message).then(ok=>{if(ok){setTimeout(fillStrategy,150);setTimeout(fillStrategy,600);}});}else location.hash='#enterprise/create';}
let directoryPromise=null;
function directoryNodes(){if(!directoryPromise)directoryPromise=fetch('./classifications/ssco-2019.json').then(r=>r.ok?r.json():null).then(d=>d?.nodes||[]).catch(()=>[]);return directoryPromise;}
const HR_PARENT_UNITS=new Set(['1212','2423','2424']);
const HR_SUPPORT_CODES=new Set(['333306','334103','431300','441601','441602','441603','441604']);
const HR_CLUSTERS={
 recruitment:['242305','121206','242320','242321','333301'],
 payroll:['242322','242318','241107','121210','431300'],
 rewards:['242306','121207','242322','121210'],
 talent:['242307','121208','242303'],
 employeeRelations:['242302','242310','121215','334103','441604'],
 workforce:['242319','121203','242303','121202','333306'],
 learning:['242402','242401','242406','121212'],
 hrDevelopment:['242404','121213','242402'],
 od:['242109','121205','242404','121213'],
 jobAnalysis:['242323','242304','121204'],
 personnel:['242310','121215','441601','441604'],
 hrOperations:['242303','121214','333306'],
 attendance:['441602','242310','334103'],
 general:['242303','121202','242302','242310','333306']
};
const HR_INTENTS=[
 ['payroll',['مسير الرواتب','مسيرات الرواتب','معالجة رواتب','اعداد الرواتب','إعداد الرواتب','رواتب الموظفين','الرواتب','رواتب','اجور','أجور','payroll','salary processing','payroll processing']],
 ['recruitment',['توظيف','استقطاب','مرشح','مرشحين','تعيين','recruit','recruitment','talent acquisition','candidate']],
 ['rewards',['تعويضات','مكافآت','مزايا','compensation','rewards','benefits']],
 ['talent',['ادارة المواهب','إدارة المواهب','المواهب','talent management','succession','high potential']],
 ['employeeRelations',['علاقات الموظفين','علاقات موظفين','employee relations','labor relations']],
 ['workforce',['تخطيط القوى العاملة','القوى العاملة','تخطيط القوى','workforce planning','manpower planning']],
 ['hrDevelopment',['تطوير الموارد البشرية','تطوير موارد بشرية','سياسات الموارد البشرية','ممارسات الموارد البشرية','وظائف الموارد البشرية','كفاءة وظائف الموارد البشرية','human resources development','hr development','hr policies','hr practices','hr function effectiveness']],
 ['learning',['تدريب','ابتعاث','تعلم وتطوير','التعلم والتطوير','learning and development','training']],
 ['od',['تطوير تنظيمي','تطوير مؤسسي','الهياكل التنظيمية','هيكل تنظيمي','الهيكل التنظيمي','تصميم الهيكل','تصميم الهياكل','تصميم تنظيمي','نطاقات المسؤولية','organizational development','organization development','organization design','organizational design','organization structure','organizational structure']],
 ['jobAnalysis',['تحليل وظائف','تحليل الوظائف','تصنيف وظائف','تصنيف مهن','job analysis','job classification']],
 ['personnel',['شؤون الموظفين','شؤون موظفين','شؤون الافراد','شؤون الأفراد','personnel affairs','personnel']],
 ['hrOperations',['عمليات الموارد البشرية','عمليات رأس المال البشري','hr operations','human resources operations']],
 ['attendance',['دوام','حضور وانصراف','الحضور والانصراف','attendance','timekeeping']]
];
const HR_ROLE_LEVELS={
 general:{specialist:{ar:'أخصائي موارد بشرية',en:'Human Resources Specialist',code:'242303'},manager:{ar:'مدير موارد بشرية',en:'Human Resources Manager',code:'121202'},executive:{ar:'مدير تنفيذي للموارد البشرية',en:'Executive Director, Human Resources',code:'121201'}},
 recruitment:{specialist:{ar:'أخصائي توظيف',en:'Recruitment Specialist',code:'242305'},manager:{ar:'مدير توظيف',en:'Recruitment Manager',code:'121206'}},
 payroll:{specialist:{ar:'أخصائي رواتب',en:'Payroll Specialist',code:'242322'},manager:{ar:'مدير الرواتب والبدلات',en:'Payroll & Allowances Manager',code:'121210'}},
 rewards:{specialist:{ar:'أخصائي مكافآت وتعويضات',en:'Rewards & Compensation Specialist',code:'242306'},manager:{ar:'مدير المكافآت والتعويضات',en:'Rewards & Compensation Manager',code:'121207'}},
 talent:{specialist:{ar:'أخصائي مواهب',en:'Talent Management Specialist',code:'242307'},manager:{ar:'مدير مواهب',en:'Talent Management Manager',code:'121208'}},
 employeeRelations:{specialist:{ar:'أخصائي علاقات الموظفين',en:'Employee Relations Specialist',code:'242302'},manager:{ar:'مدير علاقات الموظفين',en:'Employee Relations Manager',code:'121215'}},
 workforce:{specialist:{ar:'أخصائي تخطيط القوى العاملة',en:'Workforce Planning Specialist',code:'242319'},manager:{ar:'مدير القوى العاملة',en:'Workforce Planning Manager',code:'121203'}},
 learning:{specialist:{ar:'أخصائي تدريب وتطوير',en:'Learning & Development Specialist',code:'242402'},manager:{ar:'مدير التدريب والتطوير',en:'Learning & Development Manager',code:'121212'}},
 hrDevelopment:{specialist:{ar:'أخصائي تطوير موارد بشرية',en:'Human Resources Development Specialist',code:'242404'},manager:{ar:'مدير تطوير الموارد البشرية',en:'Human Resources Development Manager',code:'121213'}},
 od:{specialist:{ar:'أخصائي تطوير تنظيمي',en:'Organization Development Specialist',code:'242109'},manager:{ar:'مدير تطوير مؤسسي',en:'Organization Development Manager',code:'121205'}},
 jobAnalysis:{specialist:{ar:'محلل وظائف',en:'Job Analyst',code:'242323'},manager:{ar:'مدير تصنيف الوظائف',en:'Job Classification Manager',code:'121204'}},
 personnel:{specialist:{ar:'أخصائي شؤون موظفين',en:'Personnel Affairs Specialist',code:'242310'},manager:{ar:'مدير شؤون موظفين',en:'Personnel Affairs Manager',code:'121215'}},
 hrOperations:{specialist:{ar:'أخصائي عمليات موارد بشرية',en:'HR Operations Specialist',code:'242303'},manager:{ar:'مدير عمليات الموارد البشرية',en:'HR Operations Manager',code:'121214'}},
 attendance:{specialist:{ar:'مسؤول دوام',en:'Time & Attendance Officer',code:'441602'},manager:{ar:'مدير شؤون موظفين',en:'Personnel Affairs Manager',code:'121215'}}
};
function rowsByCodes(occupations,codes){const map=new Map(occupations.map(r=>[String(r.code),r]));return codes.map(code=>map.get(code)).filter(Boolean);}
function normalizedHRText(input){
 const C=window.MiyarEnterpriseCore;
 return C?.normalize?C.normalize([input.objective,input.domain,input.constraints].join(' ')):String([input.objective,input.domain,input.constraints].join(' ')).toLowerCase();
}
function hrIntent(input){
 const C=window.MiyarEnterpriseCore,n=normalizedHRText(input),norm=x=>C?.normalize?C.normalize(x):String(x).toLowerCase();
 for(const [id,terms] of HR_INTENTS)if(terms.some(x=>n.includes(norm(x))))return id;
 return'general';
}
function isExplicitHRInput(input){
 const C=window.MiyarEnterpriseCore,n=normalizedHRText(input),norm=x=>C?.normalize?C.normalize(x):String(x).toLowerCase();
 if(HR_INTENTS.some(([,terms])=>terms.some(x=>n.includes(norm(x)))))return true;
 return ['موارد بشرية','راس المال البشري','رأس المال البشري','human resources','human capital','hr operations','hr specialist','hr manager'].some(x=>n.includes(norm(x)));
}
function hrLevel(input){
 const C=window.MiyarEnterpriseCore,n=C?.normalize?C.normalize([input.seniority,input.objective].join(' ')):String([input.seniority,input.objective].join(' ')).toLowerCase();
 const has=terms=>terms.some(x=>n.includes(C?.normalize?C.normalize(x):String(x).toLowerCase()));
 if(has(['رئيس تنفيذي','تنفيذي','chief human resources','chro','executive director']))return'executive';
 if(has(['مدير','رئيس قسم','رئيس ادارة','رئيس إدارة','manager','director','head of']))return'manager';
 return'specialist';
}
function hrDirectoryRows(occupations,input){
 const intent=hrIntent(input),preferred=[...(HR_CLUSTERS[intent]||HR_CLUSTERS.general),...HR_CLUSTERS.general];
 const top=rowsByCodes(occupations,[...new Set(preferred)]).slice(0,6);
 const all=occupations.filter(r=>HR_PARENT_UNITS.has(String(r.parent))||HR_SUPPORT_CODES.has(String(r.code))).sort((a,b)=>String(a.code).localeCompare(String(b.code)));
 return {intent,top,all};
}
function hrPrimaryRecommendation(intent,input,occupations){
 const levels=HR_ROLE_LEVELS[intent]||HR_ROLE_LEVELS.general;
 let level=hrLevel(input);
 if(level==='executive'&&!levels.executive)level='manager';
 const spec=levels[level]||levels.specialist;
 const source=occupations.find(r=>String(r.code)===spec.code)||null;
 return source?{...spec,level,intent,source}:null;
}

function detectedBusinessFamily(input){
 const C=window.MiyarEnterpriseCore,n=C?.normalize?C.normalize([input.objective,input.domain,input.constraints].join(' ')):String([input.objective,input.domain,input.constraints].join(' ')).toLowerCase();
 if(['حوكمة','امتثال','governance','compliance'].some(x=>n.includes(C?.normalize?C.normalize(x):x))||C?.normalize?.(input.domain||'').includes('التزام'))return{id:'governance',ar:'الحوكمة والالتزام',en:'Governance & Compliance',ssco:['مدير التزام','أخصائي تطوير تنظيمي','خبير تنظيم','باحث تنظيم']};
 if(isExplicitHRInput(input))return{id:'hc',ar:'رأس المال البشري',en:'Human Capital',ssco:['أخصائي موارد بشرية','مدير موارد بشرية']};
 const E=window.MiyarODEngine;if(!E?.detectFamily)return null;
 try{
  const family=E.detectFamily({strategyObjective:input.objective,department:input.domain,context:input.constraints});
  return family&&family.id!=='generic'&&Array.isArray(family.ssco)&&family.ssco.length?family:null;
 }catch{return null;}
}
async function directoryFallback(input,host){
 const C=window.MiyarEnterpriseCore;if(!C?.search||!host)return;
 const words=C.normalize(input.objective).split(' ').filter(Boolean);if(!words.length)return;
 const occupations=(await directoryNodes()).filter(x=>x.level==='occupation');if(!host.isConnected)return;
 let rows=[],family=null,source='direct';const explicitHR=isExplicitHRInput(input);
 if(!explicitHR&&words.length<=6){
  rows=C.search(occupations,input.objective).slice(0,5);
  if(!rows.length){const q=C.normalize(input.objective);rows=occupations.filter(r=>{const title=C.normalize(r.titleAr||'');return title===q||title.includes(q)||q.includes(title);}).slice(0,5);}
 }
 let hrAll=[],hrIntentId='',hrPrimary=null;
 if(!rows.length||explicitHR){
  family=detectedBusinessFamily(input);
  if(family?.id==='hc'){
   source='hr-family';const h=hrDirectoryRows(occupations,input);rows=h.top;hrAll=h.all;hrIntentId=h.intent;hrPrimary=hrPrimaryRecommendation(h.intent,input,occupations);
  }else if(family){
   source='family';const seen=new Set();
   for(const query of family.ssco){
    let found=C.search(occupations,query).slice(0,4);
    if(!found.length){const q=C.normalize(query);found=occupations.filter(r=>C.normalize(r.titleAr||'')===q||C.normalize(r.titleAr||'').includes(q)).slice(0,4);}
    for(const row of found){
     if(seen.has(row.code))continue;seen.add(row.code);rows.push(row);if(rows.length>=5)break;
    }
    if(rows.length>=5)break;
   }
  }
 }
 if(!rows.length){
  const box=document.createElement('div');box.className='demo-v5-directory demo-v5-directory-empty';
  box.innerHTML='<h4>'+t('لا يوجد مرجع مهني موثوق بعد','No confident occupation reference yet')+'</h4><p>'+t('تم تحليل الاحتياج، لكن الأدلة الحالية لا تكفي لربطه بمسمى من الدليل دون تخمين. افتح محرك OD لتوثيق المسؤوليات؛ عندها يصبح الترشيح أدق.','The need was analyzed, but the current evidence is not sufficient to link it to a directory title without guessing. Open the OD Engine and add responsibilities for a more defensible recommendation.')+'</p>';
  host.querySelector('.demo-v5-output')?.appendChild(box);return;
 }
 const familyName=family?(ar()?family.ar:family.en):'';
 const intro=source==='hr-family'
  ?t('تم التعرف على الاحتياج ضمن رأس المال البشري. تظهر أولاً الأدوار الأقرب للمهمة، ويمكنك فتح عائلة أدوار HR المستخرجة مباشرة من وحدات الموارد البشرية في نسخة الدليل المرفقة.','The need was detected within Human Capital. The closest task-related roles appear first, and you can expand the HR role family derived directly from the Human Resources units in the supplied classification snapshot.')
  :source==='family'
  ?t('حدد معيار مجال الاحتياج مبدئيًا كـ «'+familyName+'» ويعرض مراجع مهنية مرتبطة بالمجال للمراجعة — وليست مطابقة نهائية.','Miyar preliminarily detected the business domain as “'+familyName+'” and is showing related occupation references for review — not a final match.')
  :t('لم يطابق المدخل عينة المحرك السريع، لكنه يطابق مسميات في دليل المهن (5,041 مهنة). اختر المرجع لنقله إلى محرك OD.','The input did not match the quick-engine sample, but it matches titles in the occupation directory (5,041 occupations). Choose a reference to carry it into the OD Engine.');
 const hrPrimaryCard=source==='hr-family'&&hrPrimary
  ?'<section class="demo-v5-primary-recommendation" data-hr-primary="'+esc(hrIntentId)+'"><span>'+t('المسمى المقترح','RECOMMENDED ROLE')+'</span><h4>'+esc(ar()?hrPrimary.ar:hrPrimary.en)+'</h4><p class="demo-v5-primary-basis">'+t('بناءً على وصف العمل والمجال والمستوى المدخل.','Based on the described work, field and entered level.')+'</p><div class="demo-v5-primary-source"><small>'+t('مرجع التصنيف','CLASSIFICATION REFERENCE')+'</small><strong>'+esc(hrPrimary.source.code)+'</strong><b>'+esc(hrPrimary.source.titleAr||hrPrimary.source.titleEn)+'</b></div><button type="button" class="button button-primary" data-demo-primary-hr>'+t('استخدم هذا الترشيح','Use this recommendation')+'</button></section>':'';
 const hrMore=source==='hr-family'&&hrAll.length
  ?'<details class="demo-v5-hr-all"><summary>'+t('عرض أدوار الموارد البشرية في الدليل ('+hrAll.length+')','Show HR-related roles in the supplied directory ('+hrAll.length+')')+'</summary><p class="demo-v5-hr-note">'+t('هذه مسميات مرجعية من نسخة التصنيف المرفقة بالمشروع؛ ظهورها لا يعني أنها مناسبة تلقائيًا لهذا الاحتياج.','These are reference titles from the classification snapshot supplied with the project; listing them does not mean each one is automatically suitable for this need.')+'</p><ul>'+hrAll.map((r,i)=>'<li><button type="button" class="button button-outline" data-demo-hr-ref="'+i+'"><strong>'+esc(r.code)+'</strong> · '+esc(r.titleAr||r.titleEn)+'</button></li>').join('')+'</ul></details>':'';
 const box=document.createElement('div');box.className='demo-v5-directory';box.dataset.referenceSource=source;
 box.innerHTML=hrPrimaryCard+'<h4>'+t(source==='hr-family'?'بدائل HR مرتبطة بالمهمة':'مراجع من دليل المهن الكامل',source==='hr-family'?'Related HR alternatives':'References from the full occupation directory')+'</h4><p>'+esc(intro)+'</p><ul>'+rows.map((r,i)=>'<li><button type="button" class="button button-outline" data-demo-ref="'+i+'"><strong>'+esc(r.code)+'</strong> · '+esc(r.titleAr||r.titleEn)+'</button></li>').join('')+'</ul>'+hrMore;
 host.querySelector('.demo-v5-output')?.appendChild(box);
 if(source==='hr-family'&&hrPrimary){
  const output=host.querySelector('.demo-v5-output');
  output?.classList.remove('review');output?.classList.add('good');
  const heading=output?.querySelector(':scope > h3');if(heading)heading.textContent=t('الترشيح الأولي','Preliminary recommendation');
  const limit=output?.querySelector('.demo-v5-limit');if(limit)limit.textContent=t('المسمى المقترح مبني على طبيعة العمل المكتوبة، بينما يظهر مرجع التصنيف منفصلًا للتتبع والمراجعة البشرية.','The recommended business title is based on the described work, while the classification reference remains separate for traceability and human review.');
  output?.querySelector('.demo-v5-actions')?.remove();
  if(badge())badge().textContent=t('ترشيح أولي','PRELIMINARY RECOMMENDATION');
 }
 box.querySelector('[data-demo-primary-hr]')?.addEventListener('click',()=>{if(hrPrimary)continueToOD(input,{title:ar()?hrPrimary.ar:hrPrimary.en,occupationCode:hrPrimary.source.code});});
 box.querySelectorAll('[data-demo-ref]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.demoRef)];continueToOD(input,{title:r.titleAr||r.titleEn,occupationCode:r.code});});
 box.querySelectorAll('[data-demo-hr-ref]').forEach(b=>b.onclick=()=>{const r=hrAll[Number(b.dataset.demoHrRef)];continueToOD(input,{title:r.titleAr||r.titleEn,occupationCode:r.code});});
 const lead=host.querySelector('.demo-v5-output > p');if(lead)lead.textContent=source==='hr-family'?t('تم تحليل الاحتياج كحالة موارد بشرية وعرض المراجع الأقرب للمهمة من دليل المهن، مع إتاحة بقية أدوار HR للمراجعة.','The need was analyzed as an HR case. Miyar is showing the closest task-related occupation references and keeps the broader HR role set available for review.'):source==='family'?t('لم تعطِ العينة الهندسية ترشيحًا مباشرًا؛ لذلك انتقل معيار إلى مجال العمل ودليل المهن الأوسع بدل إرجاع نتيجة فارغة.','The engineering sample did not provide a direct recommendation, so Miyar used the detected business domain and broader occupation directory instead of returning an empty result.'):t('لا يوجد تطابق ضمن عينة المحرك السريع (خمس مهن هندسية)، لكن توجد مطابقات في دليل المهن أدناه.','No match in the quick-engine sample (five engineering roles), but directory matches are listed below.');
}
function renderReview(result,input,id){const p=panel();if(!p)return;const reason=ar()?(result.reason||result.message||''):(result.reasonEn||result.messageEn||result.reason||result.message||'');p.innerHTML=outputHeader(id,input)+'<div class="demo-v5-output review"><div class="demo-v5-output-label">OUTPUT</div><h3>'+t('تم إنشاء مخرج — يحتاج مراجعة','Output generated — review required')+'</h3><p>'+esc(reason)+'</p><p class="demo-v5-limit">'+t('يبدأ المحرك بعينة سريعة، ثم يستخدم دليل المهن الأوسع للمجالات الأخرى عندما تتوفر أدلة كافية. المراجع المعروضة تحتاج مراجعة بشرية قبل الاعتماد.','The quick engine starts with a small sample, then uses the broader occupation directory for other domains when sufficient evidence is available. Displayed references require human review before approval.')+'</p><div class="demo-v5-actions"><button type="button" class="button button-primary" data-demo-continue>'+t('افتح محرك OD الكامل','Open full OD Engine')+'</button></div></div>';p.querySelector('[data-demo-continue]').onclick=()=>continueToOD(input);directoryFallback(input,p);if(badge())badge().textContent=t('مخرج للمراجعة','REVIEW OUTPUT');}
function renderError(message){const p=panel();if(!p)return;p.innerHTML='<div class="demo-v5-output error"><div class="demo-v5-output-label">OUTPUT</div><h3>'+t('أكمل المدخل المطلوب','Complete the required input')+'</h3><p>'+esc(message)+'</p></div>';if(badge())badge().textContent=t('مدخل ناقص','INPUT REQUIRED');}
function analyze(event){const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='role-form')return;event.preventDefault();event.stopImmediatePropagation();const engine=window.MiyarEngine,data=window.MIYAR_DATA,input=readInput(),error=document.getElementById('form-error');if(!engine||!data?.roles){renderError(t('تعذر تحميل محرك التحليل. أعد تحميل الصفحة.','The analysis engine did not load. Reload the page.'));return;}if(!input.objective){if(error){error.textContent=t('أدخل المسمى أو وصف المهام أولًا.','Enter a title or task description first.');error.hidden=false;}renderError(t('أدخل المسمى أو وصف المهام أولًا.','Enter a title or task description first.'));return;}if(error)error.hidden=true;let result;try{result=engine.classify(input,data.roles);}catch(e){renderError(e.message||t('تعذر إكمال التحليل.','Analysis could not be completed.'));return;}const id=runId();if(result.kind==='match')renderMatch(result,input,id);else renderReview(result,input,id);const rp=document.querySelector('.result-panel');if(rp){rp.classList.remove('analysis-complete');void rp.offsetWidth;rp.classList.add('analysis-complete');if(window.innerWidth<1100)rp.scrollIntoView({behavior:'smooth',block:'start'});}const heading=document.getElementById('result-heading');heading?.focus?.({preventScroll:true});}
function onInput(event){if(location.hash!=='#demo')return;if(!['objective','domain','seniority','constraints'].includes(event.target?.id))return;waiting();}
function labelPanels(){if(location.hash!=='#demo')return;const form=document.getElementById('role-form');if(!form)return;const inputPanel=form.closest('.panel');const resultPanel=document.querySelector('.result-panel');if(inputPanel&&!inputPanel.querySelector('.demo-v5-io-label'))inputPanel.insertAdjacentHTML('afterbegin','<div class="demo-v5-io-label">INPUT</div>');if(resultPanel&&!resultPanel.querySelector('.demo-v5-io-label'))resultPanel.insertAdjacentHTML('afterbegin','<div class="demo-v5-io-label">OUTPUT</div>');if(!form.dataset.v5Primed){form.dataset.v5Primed='1';waiting();}}
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
function prime(){labelPanels();consumeGuidedObjective();}
document.addEventListener('submit',analyze,true);
document.addEventListener('input',onInput,true);
window.addEventListener('hashchange',()=>setTimeout(prime,0));
window.addEventListener('miyar:navigate',()=>setTimeout(prime,0));
new MutationObserver(()=>{if(window.location?.hash==='#demo')setTimeout(prime,0);}).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',prime);setTimeout(prime,0);
window.MiyarDemoRuntimeV5={analyze,waiting,prime};
})();