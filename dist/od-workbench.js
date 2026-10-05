(function(){
'use strict';
const Engine=window.MiyarODEngine,Core=window.MiyarEnterpriseCore;
if(!Engine||!Core)return;
let currentProposal=null,corporaPromise=null,activePanel=null,appliedPanel=null,outputBlocked=false,generation=0;
const protectedActions='#ent-save, #ent-save-open, #ent-local-json, #ent-preview-draft, #ent-html-draft, #ent-pdf-draft';
const previousActionState=new Map();
const extraKeys=['strategyObjective','marketTitle','jobFamily','careerPath','recommendedLevel','gradeRecommendationBasis','odGenerationBasis'];
const originalImport=Core.importDraft.bind(Core);
Core.importDraft=function(payload){
 const clean=originalImport(payload),source=payload?.content||{};
 for(const key of extraKeys){const value=currentProposal?.content?.[key]??source[key];if(typeof value==='string'&&value.length<=4000)clean[key]=value;}
 return clean;
};
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ar(){return document.documentElement.lang!=='en';}
function t(a,b){return ar()?a:b;}
function norm(value){return Core.normalize(value);}
function blockedNotice(){return t('تعذر تحديث الحزمة. صحح المدخلات وأعد التوليد، أو ابدأ مسودة جديدة، لإتاحة حفظ الحقول السابقة ومعاينتها وتصديرها.','Package update paused. Correct inputs and regenerate, or start a new draft, to save, preview or export the retained fields.');}
function blockOutputs(value){
 outputBlocked=value;
 if(value){for(const control of document.querySelectorAll(protectedActions)){if(!previousActionState.has(control))previousActionState.set(control,control.disabled);control.disabled=true;}}
 else {for(const [control,previous]of previousActionState)control.disabled=previous;previousActionState.clear();}
 const note=activePanel?.querySelector('[data-od-blocked]');if(note){note.hidden=!value;note.textContent=value?blockedNotice():'';}
}
function resetProposal(keepBlocked=false){generation++;currentProposal=null;appliedPanel=null;if(!keepBlocked)blockOutputs(false);}
// Capture also protects against another handler re-enabling a paused action.
document.addEventListener('click',event=>{
 const action=event.target.closest?.(protectedActions);if(!action||!outputBlocked||!activePanel?.isConnected)return;
 event.preventDefault();event.stopImmediatePropagation();blockOutputs(true);status(blockedNotice());
},true);
function setField(key,value){
 const el=document.querySelector('[data-field="'+key+'"], [data-number="'+key+'"]');if(!el||value===undefined||value===null)return false;
 if(el.tagName==='SELECT'){const wanted=String(value);if([...el.options].some(o=>o.value===wanted))el.value=wanted;else return false;}else el.value=String(value);
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function setMatrix(id,rows,keys){const el=document.getElementById(id);if(!el||!rows?.length)return;el.value=rows.map(r=>keys.map(k=>String(r[k]??'').replace(/\|/g,'/')).join(' | ')).join('\n');el.dispatchEvent(new Event('input',{bubbles:true}));}
async function corpora(){
 if(!corporaPromise)corporaPromise=Promise.all([
  fetch('./classifications/ssco-2019.json').then(r=>{if(!r.ok)throw Error('SSCO reference unavailable');return r.json();}),
  fetch('./classifications/education-2020.json').then(r=>{if(!r.ok)throw Error('Education reference unavailable');return r.json();})
 ]).then(([ssco,education])=>({ssco,education})).catch(e=>{corporaPromise=null;throw e;});
 return corporaPromise;
}
function rank(rows,queries,titleKey='titleAr'){
 const q=queries.map(norm).filter(Boolean);
 return rows.map(row=>{const title=norm(row[titleKey]);let score=0;for(const term of q){if(String(row.code)===term||title===term)score=Math.max(score,100);else if(title.includes(term)||term.includes(title))score=Math.max(score,82);else{const tokens=term.split(' ').filter(x=>x.length>2),hit=tokens.filter(x=>title.includes(x)).length;if(tokens.length)score=Math.max(score,Math.round(65*hit/tokens.length));}}return {row,score};}).filter(x=>x.score>=35).sort((a,b)=>b.score-a.score||String(a.row.code).localeCompare(String(b.row.code))).slice(0,5);
}
async function resolveReferences(proposal){
 try{
  const refs=await corpora();
  if(proposal.validation){for(const check of proposal.validation){if(check.id==='ssco'){check.status=refs.ssco.nodes.some(n=>n.level==='occupation'&&proposal.referenceQueries.ssco.includes(n.titleAr))?'pass':'fail';check.ar=check.status==='pass'?'الرمز موجود في دليل SSCO؛ الربط مقترح للمراجعة':'الرمز غير متحقق في الدليل';check.en=check.status==='pass'?'Code exists in SSCO; mapping proposed for review':'Code not verified in the directory';}}}
  const occupations=refs.ssco.nodes.filter(x=>x.level==='occupation');
  const ssco=rank(occupations,proposal.referenceQueries.ssco);
  const education=rank(refs.education.fields,proposal.referenceQueries.education);
  return {ssco,education,release:refs.ssco.id,educationRelease:refs.education.id};
 }catch(error){if(proposal.validation){const c=proposal.validation.find(x=>x.id==='ssco');if(c)c.status='warn';}return {ssco:[],education:[],error:error.message};}
}
function proposalWithMetadata(proposal){
 proposal.content.marketTitle=proposal.content.title;
 proposal.content.jobFamily=proposal.family.label;
 proposal.content.careerPath=(proposal.content.careerPath||'').trim();
 proposal.content.recommendedLevel=proposal.gradeRecommendation.level;
 proposal.content.gradeRecommendationBasis=proposal.gradeRecommendation.rationale;
 return proposal;
}
function applyProposal(proposal,refs){
 currentProposal=proposalWithMetadata(proposal);
 appliedPanel=activePanel;
 const c=currentProposal.content;
 const qualifications=c.qualifications+'\n'+t('المسار المهني المقترح: ','Proposed career path: ')+c.careerPath+'\n'+t('المستوى قبل التقييم: ','Pre-evaluation level: ')+currentProposal.gradeRecommendation.level;
 const values={...c,qualifications,directReports:c.directReports??''};
 for(const key of ['directReports','jobFamily','title','field','seniority','department','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors','certifications','constraints','saudization'])setField(key,values[key]);
 setField('educationLevel',proposal.referenceQueries.educationLevel||'');
 for(const key of ['occupationCode','educationFieldCode','mappingJustification'])setField(key,'');
 if(refs?.ssco?.[0]?.score>=82){setField('occupationCode',refs.ssco[0].row.code);setField('mappingJustification',t('اقتراح مرجع SSCO من محرك OD؛ يحتاج مراجعة مختص OD قبل الاعتماد.','SSCO reference proposed by the OD engine; OD specialist review is required before approval.'));}
 if(refs?.education?.[0]?.score>=82)setField('educationFieldCode',refs.education[0].row.code);
 setMatrix('ent-kpi-matrix',c.kpis,['outcome','metric','target','frequency','deliverable']);
 setMatrix('ent-skill-matrix',c.skillRequirements,['name','type','level','evidence']);
 window.MiyarEnterprise?.applyPositionPackage(c);
}
function refsHtml(refs){
 if(refs.error)return '<div class="od-reference-error">'+esc(t('تعذر تحميل المراجع تلقائيًا. استخدم دليل المهن والتعليم للمراجعة.','Automatic references could not be loaded. Use the occupation and education directory for review.'))+'</div>';
 const occupation=refs.ssco[0],education=refs.education[0];
 return '<div class="od-reference-grid"><div><span>'+t('مرجع SSCO المقترح','Suggested SSCO reference')+'</span><strong>'+(occupation?esc(occupation.row.code+' · '+occupation.row.titleAr):'—')+'</strong><small>'+t('ترشيح مرجعي يحتاج مراجعة، وليس إثبات امتثال.','Reference suggestion for review; not a compliance determination.')+'</small></div><div><span>'+t('مرجع التعليم المقترح','Suggested education reference')+'</span><strong>'+(education?esc(education.row.code+' · '+education.row.titleAr):'—')+'</strong><small>'+t('المستوى التعليمي اقتراح يخضع لتحليل العمل واعتماد الجهة؛ لا يُفترض البكالوريوس للأدوار المساعدة والفنية.','Qualification level follows job analysis and organization review; no bachelor degree is assumed for assistant and technician roles.')+'</small></div></div>';
}
function renderResult(host,proposal,refs){
 const c=proposal.content,level=proposal.gradeRecommendation;
 const levelNames={assistant:['مساعد','Assistant'],technician:['فني','Technician'],entry:['مبتدئ','Entry'],professional:['أخصائي','Professional'],senior:['أخصائي أول','Senior professional'],specialist:['أخصائي','Specialist'],supervisor:['مشرف','Supervisor'],lead:['قائد فريق','Team lead'],manager:['مدير','Manager'],director:['مدير إدارة','Director'],executive:['تنفيذي','Executive']},levelLabel=v=>levelNames[v]?(ar()?levelNames[v][0]:levelNames[v][1]):v,statusNames={pass:['مطابق','Pass'],warn:['تنبيه','Check'],fail:['غير مطابق','Fail'],block:['محجوب','Blocked']},statusLabel=v=>statusNames[v]?(ar()?statusNames[v][0]:statusNames[v][1]):v;
 host.innerHTML='<div class="od-result-head"><div><span>'+t('حزمة OD المقترحة','PROPOSED OD PACKAGE')+'</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.purpose)+'</p></div><span class="od-level">'+esc(levelLabel(level.level))+'</span></div>'+refsHtml(refs)+(proposal.validation?'<section class="demo-validation"><h4>'+t('فحص الترشيح','Recommendation validation')+'</h4><ul>'+proposal.validation.map(v=>'<li data-status="'+v.status+'">'+esc(statusLabel(v.status)+' · '+(ar()?v.ar:v.en))+'</li>').join('')+'</ul><strong>'+t('المسمى النهائي المقترح: ','Final proposed title: ')+esc(c.finalProposedTitle||t('بانتظار المراجعة','Pending review'))+'</strong></section>':'')+'<div class="od-output-grid"><div><span>'+t('العائلة الوظيفية','Job family')+'</span><strong>'+esc(proposal.family.label)+'</strong></div><div><span>'+t('المسار المهني','Career path')+'</span><strong>'+esc(c.careerPath)+'</strong></div><div><span>'+t('الخبرة المقترحة','Experience proposal')+'</span><strong>'+esc(c.experience)+'</strong></div><div><span>'+t('المؤهل المقترح','Qualification proposal')+'</span><strong>'+esc(c.qualifications)+'</strong></div></div><div class="od-result-columns"><div><h4>'+t('الجدارات الفنية','Technical competencies')+'</h4><ul>'+c.skills.split('\n').map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><h4>'+t('الجدارات السلوكية','Behavioral competencies')+'</h4><ul>'+c.behaviors.split('\n').map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><h4>'+t('مؤشرات الأداء','Suggested KPIs')+'</h4><ul>'+c.kpis.map(x=>'<li>'+esc(x.outcome)+'</li>').join('')+'</ul></div></div><div class="od-grade-note"><strong>'+t('توصية المستوى قبل التقييم','Pre-evaluation level recommendation')+': '+esc(levelLabel(level.level))+'</strong><p>'+esc(level.rationale)+'</p><small>'+esc(proposal.notices.join(' '))+'</small></div><div class="od-actions"><button type="button" class="button button-primary" data-od-apply>'+t('تطبيق الحزمة على نموذج المنصب','Apply package to position form')+'</button><a class="button button-outline" href="#enterprise/grading">'+t('فتح التقييم الوظيفي','Open job evaluation')+'</a><button type="button" class="button button-outline" data-od-export>'+t('تنزيل حزمة OD JSON','Download OD package JSON')+'</button></div>';
 host.querySelector('[data-od-apply]').onclick=()=>{applyProposal(proposal,refs);const form=document.querySelector('.ent-form-grid');form?.scrollIntoView({behavior:'smooth',block:'start'});status(t('تم تطبيق الحزمة. راجع الحقول والمراجع ثم احفظ المسودة.','Package applied. Review the fields and references, then save the draft.'));};
 host.querySelector('[data-od-export]').onclick=()=>download(JSON.stringify({...proposal,references:{ssco:refs.ssco.map(x=>x.row),education:refs.education.map(x=>x.row)}},null,2),'miyar-od-package.json','application/json');
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
function status(message){const el=document.querySelector('#miyar-od-workbench [data-od-status]');if(el)el.textContent=message;}
function readInput(panel){return {strategyObjective:document.querySelector('[data-od-strategy]').value.trim(),responsibilities:document.querySelector('[data-od-responsibilities]').value.trim(),department:panel.querySelector('[data-od-department]').value.trim(),requestedLevel:panel.querySelector('[data-od-level]').value.trim(),constraints:panel.querySelector('[data-od-constraints]').value.trim(),saudizationNote:panel.querySelector('[data-od-saudization]').value.trim()};}
function mount(){
 if(!location.hash.startsWith('#enterprise/create'))return;
 const anchor=document.querySelector('#ent-content .ent-card .ent-form-grid');if(!anchor||document.getElementById('miyar-od-workbench'))return;
 const panel=document.createElement('section');panel.id='miyar-od-workbench';panel.className='od-workbench';panel.innerHTML='<div class="od-workbench-head"><div><span class="od-phase">'+t('طلب منصب جديد','New position request')+'</span><h2>'+t('من احتياج الأعمال إلى وصف وظيفي قابل للتقييم','From business need to an evaluation-ready job description')+'</h2><p>'+t('أدخل الهدف الاستراتيجي والمسؤوليات. يولد معيار حزمة قابلة للتحرير ثم يمررها إلى الترميز والتقييم والاعتماد.','Enter the strategic objective and responsibilities. Miyar generates an editable package, then hands it to coding, evaluation and approval.')+'</p></div><button type="button" class="button button-outline" data-od-example>'+t('تحميل مثال HC','Load HC example')+'</button></div><div class="od-foundation"><div><b>1</b><span><strong>'+t('هيكل المؤسسة','Organization structure')+'</strong><small>'+t('الإدارة والمدير ونطاق الإشراف تُراجع مع الهيكل المعتمد.','Department, manager and span are reviewed against the approved structure.')+'</small></span></div><div><b>2</b><span><strong>'+t('هيكل الدرجات','Grading structure')+'</strong><small>'+t('التقييم النهائي يستخدم إطار الجهة المعتمد؛ لا تُستخدم جداول Korn Ferry/Mercer غير المرخصة.','Final evaluation uses the approved organization framework; unlicensed Korn Ferry/Mercer tables are not used.')+'</small></span></div></div><div class="od-input-grid"><label>'+t('الهدف الاستراتيجي / احتياج الأعمال','Strategic objective / business need')+'<textarea data-od-strategy rows="3" placeholder="'+t('مثال: تحويل استراتيجية رأس المال البشري إلى مبادرات ذات أولوية ورفع كفاءة التنفيذ','Example: Cascade the HC strategy into prioritized initiatives and improve execution efficiency')+'"></textarea></label><label class="od-wide">'+t('الأدوار والمسؤوليات','Roles & responsibilities')+'<textarea data-od-responsibilities rows="7" placeholder="'+t('اذكر مسؤوليتين تخصصيتين مستقلتين؛ تقبل الأسطر والجمل المركبة','State at least two independent specialist duties; lines and complex sentences are accepted')+'"></textarea></label><label>'+t('الإدارة','Department')+'<input data-od-department placeholder="Human Capital"></label><label>'+t('المستوى المطلوب من الأعمال — اختياري','Business-requested level — optional')+'<input data-od-level placeholder="Manager"></label><label>'+t('قيود أو اعتبارات','Constraints / considerations')+'<input data-od-constraints></label><label>'+t('قاعدة توطين مقدمة من الجهة — اختيارية','Organization-provided Saudization rule — optional')+'<input data-od-saudization placeholder="'+t('لا تفترض نسبة دون مصدر','Do not assume a percentage without a source')+'"></label></div><div class="od-run-row"><button type="button" class="button button-primary" data-od-generate>'+t('توليد حزمة OD','Generate OD package')+'</button><span data-od-status role="status">'+t('المخرجات اقتراحات للمراجعة البشرية وليست اعتمادًا نهائيًا.','Outputs are review proposals, not final approval.')+'</span></div><div data-od-result></div><div class="od-roadmap"><span class="active">'+t('المرحلة 1 · تصميم وتقييم الوظائف','Phase 1 · Job design & evaluation')+'</span><a href="#enterprise/manpower">'+t('المرحلة 2 · تخطيط القوى العاملة','Phase 2 · Manpower planning')+'</a><a href="#enterprise/compensation">'+t('المرحلة 3 · التعويضات','Phase 3 · Compensation')+'</a></div>';
 const primary=anchor.closest('#ent-position-start');
 if(primary){for(const selector of ['[data-od-strategy]','[data-od-responsibilities]'])panel.querySelector(selector)?.closest('label')?.remove();
  const advanced=document.createElement('details');advanced.id='miyar-od-advanced';advanced.open=!!window.MiyarEnterprise?.draftContent()?.title;
  advanced.innerHTML='<summary>'+t('حزمة وصف وظيفي موسعة — اختياري','Extended job-description package — optional')+'</summary><p>'+t('تستخدم الهدف والمهام أعلاه. أضف سياق الجهة عند الحاجة لتطوير المسار والجدارات؛ لا تنشئ صلاحيات أو أدلة فعلية.','Uses the goal and duties above. Add organization context when you need career-path and competency proposals; actual authority and evidence remain user supplied.')+'</p>';
  while(panel.firstChild)advanced.append(panel.firstChild);panel.append(advanced);
 }
 resetProposal();activePanel=panel;
 panel.querySelector('.od-run-row').insertAdjacentHTML('afterend','<p data-od-blocked role="alert" class="od-reference-error" hidden></p>');
 if(primary)primary.after(panel);else anchor.parentElement.insertBefore(panel,anchor);
 const draft=window.MiyarEnterprise?.draftContent()||{};for(const [key,value]of Object.entries({strategy:draft.strategyObjective||draft.businessNeed,responsibilities:draft.responsibilities,department:draft.department,level:draft.seniority,constraints:draft.constraints,saudization:draft.saudization})){const input=document.querySelector('[data-od-'+key+']');if(input&&value)input.value=String(value);}
 panel.querySelector('[data-od-example]').onclick=()=>{resetProposal(outputBlocked);panel.querySelector('[data-od-result]').replaceChildren();panel.querySelector('[data-od-generate]').disabled=false;const e=Engine.hcExample;document.querySelector('[data-od-strategy]').value=e.strategyObjective;document.querySelector('[data-od-responsibilities]').value=e.responsibilities;for(const selector of ['[data-od-strategy]','[data-od-responsibilities]'])document.querySelector(selector).dispatchEvent(new Event('input',{bubbles:true}));panel.querySelector('[data-od-department]').value=e.department;panel.querySelector('[data-od-level]').value='';panel.querySelector('[data-od-saudization]').value=e.saudizationNote;status(t('تم تحميل حالة HC التي قدمها الخبير.','The expert-provided HC case has been loaded.'));};
 panel.querySelector('[data-od-generate]').onclick=async()=>{const button=panel.querySelector('[data-od-generate]'),attempt=++generation,previouslyApplied=appliedPanel===panel||outputBlocked,current=()=>attempt===generation&&panel.isConnected&&activePanel===panel;button.disabled=true;currentProposal=null;if(previouslyApplied)blockOutputs(true);panel.querySelector('[data-od-result]').replaceChildren();status(t('جارٍ بناء الوصف وربط المراجع…','Building the job description and checking references…'));try{const input=readInput(panel),raw=Engine.generate({...input,confirmedRole:panel.dataset.confirmedRole||''},ar()?'ar':'en');delete panel.dataset.confirmedRole;if(raw.status==='needs-confirmation'){
 const host=panel.querySelector('[data-od-result]'),clarify=['work-design','actor-object'].includes(raw.clarificationKind);
 host.innerHTML='<p role="status">'+esc((ar()?raw.messageAr:raw.messageEn)||raw.message||t('اختر الدور الأقرب أو أضف تفاصيل المهام.','Select the closest role or add duty details.'))+'</p>'+(raw.alternatives?.length?'<ul>'+raw.alternatives.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
 for(const role of raw.candidates||[]){const b=document.createElement('button');b.type='button';b.className='button button-outline';b.textContent=(ar()?role.titleAr:role.titleEn)+' · '+(role.ssco||role.code||'');b.onclick=()=>{panel.dataset.confirmedRole=role.titleEn;if(clarify){status(t('اختير الدور للمقارنة. أضف مسؤولياته الفعلية ثم أعد التوليد؛ اختيار المسمى وحده لا ينشئ منصبًا.','Role selected for comparison. Add its actual duties and regenerate; selecting a title alone does not create a position.'));const input=document.querySelector('[data-od-responsibilities]');input.focus();input.scrollIntoView?.({block:'center',behavior:'auto'});}else button.click();};host.append(b);}
 blockOutputs(true);status(clarify?t('حدد هل يلزم منصب جديد ومن يقوم بالعمل، ثم أضف المسؤوليات الفعلية. لم تُنشأ حزمة.','Clarify whether a new position is needed and who performs the work, then add actual duties. No package generated.'):t('بانتظار تأكيد الدور؛ لم تُنشأ حزمة.','Awaiting role confirmation; no package generated.'));return;
 }const proposal=proposalWithMetadata(raw),refs=await resolveReferences(proposal);if(!current())return;if(JSON.stringify(readInput(panel))!==JSON.stringify(input))throw Error(t('تغيرت المدخلات أثناء التوليد؛ أعد التوليد للمدخلات الحالية.','Inputs changed during generation; regenerate for the current inputs.'));currentProposal=proposal;renderResult(panel.querySelector('[data-od-result]'),proposal,refs);applyProposal(proposal,refs);blockOutputs(false);window.dispatchEvent(new CustomEvent('miyar:od-generated',{detail:{proposal,references:refs,panel}}));status(t('تم توليد الحزمة وتطبيقها على نموذج المنصب. راجعها قبل الحفظ والتقييم.','Package generated and applied to the position form. Review it before saving and evaluation.'));}catch(error){if(current())status(error.message);}finally{if(current())button.disabled=false;}};
}
const observer=new MutationObserver(()=>mount());const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(mount));window.addEventListener('miyar:navigate',()=>requestAnimationFrame(mount));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
