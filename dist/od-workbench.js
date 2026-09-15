(function(){
'use strict';
const Engine=window.MiyarODEngine,Core=window.MiyarEnterpriseCore;
if(!Engine||!Core)return;
let currentProposal=null,corporaPromise=null;
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
function setField(key,value){
 const el=document.querySelector('[data-field="'+key+'"]');if(!el||value===undefined||value===null)return false;
 if(el.tagName==='SELECT'){const wanted=String(value);if([...el.options].some(o=>o.value===wanted))el.value=wanted;else return false;}else el.value=String(value);
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function setMatrix(id,rows,keys){const el=document.getElementById(id);if(!el||!rows?.length)return;el.value=rows.map(r=>keys.map(k=>String(r[k]??'').replace(/\|/g,'/')).join(' | ')).join('\n');el.dispatchEvent(new Event('input',{bubbles:true}));}
async function corpora(){
 if(!corporaPromise)corporaPromise=Promise.all([
  fetch('./classifications/ssco-2019.json').then(r=>{if(!r.ok)throw Error('SSCO reference unavailable');return r.json();}),
  fetch('./classifications/education-2020.json').then(r=>{if(!r.ok)throw Error('Education reference unavailable');return r.json();})
 ]).then(([ssco,education])=>({ssco,education}));
 return corporaPromise;
}
function rank(rows,queries,titleKey='titleAr'){
 const q=queries.map(norm).filter(Boolean);
 return rows.map(row=>{const title=norm(row[titleKey]);let score=0;for(const term of q){if(title===term)score=Math.max(score,100);else if(title.includes(term)||term.includes(title))score=Math.max(score,82);else{const tokens=term.split(' ').filter(x=>x.length>2),hit=tokens.filter(x=>title.includes(x)).length;if(tokens.length)score=Math.max(score,Math.round(65*hit/tokens.length));}}return {row,score};}).filter(x=>x.score>=35).sort((a,b)=>b.score-a.score||String(a.row.code).localeCompare(String(b.row.code))).slice(0,5);
}
async function resolveReferences(proposal){
 try{
  const refs=await corpora();
  const occupations=refs.ssco.nodes.filter(x=>x.level==='occupation');
  const ssco=rank(occupations,proposal.referenceQueries.ssco);
  const education=rank(refs.education.fields,proposal.referenceQueries.education);
  return {ssco,education,release:refs.ssco.id,educationRelease:refs.education.id};
 }catch(error){return {ssco:[],education:[],error:error.message};}
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
 const c=currentProposal.content;
 const qualifications=c.qualifications+'\n'+t('المسار المهني المقترح: ','Proposed career path: ')+c.careerPath+'\n'+t('المستوى قبل التقييم: ','Pre-evaluation level: ')+currentProposal.gradeRecommendation.level;
 const values={...c,qualifications};
 for(const key of ['title','field','seniority','department','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors','certifications','constraints','saudization'])setField(key,values[key]);
 setField('educationLevel','6');
 if(refs?.ssco?.[0]?.score>=82){setField('occupationCode',refs.ssco[0].row.code);setField('mappingJustification',t('اقتراح مرجع SSCO من محرك OD؛ يحتاج مراجعة مختص OD قبل الاعتماد.','SSCO reference proposed by the OD engine; OD specialist review is required before approval.'));}
 if(refs?.education?.[0]?.score>=82)setField('educationFieldCode',refs.education[0].row.code);
 setMatrix('ent-kpi-matrix',c.kpis,['outcome','metric','target','frequency','deliverable']);
 setMatrix('ent-skill-matrix',c.skillRequirements,['name','type','level','evidence']);
}
function refsHtml(refs){
 if(refs.error)return '<div class="od-reference-error">'+esc(t('تعذر تحميل المراجع تلقائيًا. استخدم دليل المهن والتعليم للمراجعة.','Automatic references could not be loaded. Use the occupation and education directory for review.'))+'</div>';
 const occupation=refs.ssco[0],education=refs.education[0];
 return '<div class="od-reference-grid"><div><span>'+t('مرجع SSCO المقترح','Suggested SSCO reference')+'</span><strong>'+(occupation?esc(occupation.row.code+' · '+occupation.row.titleAr):'—')+'</strong><small>'+t('ترشيح مرجعي يحتاج مراجعة، وليس إثبات امتثال.','Reference suggestion for review; not a compliance determination.')+'</small></div><div><span>'+t('مرجع التعليم المقترح','Suggested education reference')+'</span><strong>'+(education?esc(education.row.code+' · '+education.row.titleAr):'—')+'</strong><small>'+t('مستوى البكالوريوس 6 مقترح؛ متطلبات المؤهل تعتمدها الجهة.','Bachelor level 6 proposed; the organization approves qualification requirements.')+'</small></div></div>';
}
function renderResult(host,proposal,refs){
 const c=proposal.content,level=proposal.gradeRecommendation;
 host.innerHTML='<div class="od-result-head"><div><span>'+t('حزمة OD المقترحة','PROPOSED OD PACKAGE')+'</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.purpose)+'</p></div><span class="od-level">'+esc(level.level)+'</span></div>'+refsHtml(refs)+'<div class="od-output-grid"><div><span>'+t('العائلة الوظيفية','Job family')+'</span><strong>'+esc(proposal.family.label)+'</strong></div><div><span>'+t('المسار المهني','Career path')+'</span><strong>'+esc(c.careerPath)+'</strong></div><div><span>'+t('الخبرة المقترحة','Experience proposal')+'</span><strong>'+esc(c.experience)+'</strong></div><div><span>'+t('المؤهل المقترح','Qualification proposal')+'</span><strong>'+esc(c.qualifications)+'</strong></div></div><div class="od-result-columns"><div><h4>'+t('الجدارات الفنية','Technical competencies')+'</h4><ul>'+c.skills.split('\n').map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><h4>'+t('الجدارات السلوكية','Behavioral competencies')+'</h4><ul>'+c.behaviors.split('\n').map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><h4>'+t('مؤشرات الأداء','Suggested KPIs')+'</h4><ul>'+c.kpis.map(x=>'<li>'+esc(x.outcome)+'</li>').join('')+'</ul></div></div><div class="od-grade-note"><strong>'+t('توصية المستوى قبل التقييم','Pre-evaluation level recommendation')+': '+esc(level.level)+'</strong><p>'+esc(level.rationale)+'</p><small>'+esc(proposal.notices.join(' '))+'</small></div><div class="od-actions"><button type="button" class="button button-primary" data-od-apply>'+t('تطبيق الحزمة على نموذج المنصب','Apply package to position form')+'</button><a class="button button-outline" href="#enterprise/grading">'+t('فتح التقييم الوظيفي','Open job evaluation')+'</a><button type="button" class="button button-outline" data-od-export>'+t('تنزيل حزمة OD JSON','Download OD package JSON')+'</button></div>';
 host.querySelector('[data-od-apply]').onclick=()=>{applyProposal(proposal,refs);const form=document.querySelector('.ent-form-grid');form?.scrollIntoView({behavior:'smooth',block:'start'});status(t('تم تطبيق الحزمة. راجع الحقول والمراجع ثم احفظ المسودة.','Package applied. Review the fields and references, then save the draft.'));};
 host.querySelector('[data-od-export]').onclick=()=>download(JSON.stringify({...proposal,references:{ssco:refs.ssco.map(x=>x.row),education:refs.education.map(x=>x.row)}},null,2),'miyar-od-package.json','application/json');
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800);}
function status(message){const el=document.querySelector('#miyar-od-workbench [data-od-status]');if(el)el.textContent=message;}
function readInput(panel){return {strategyObjective:panel.querySelector('[data-od-strategy]').value.trim(),responsibilities:panel.querySelector('[data-od-responsibilities]').value.trim(),department:panel.querySelector('[data-od-department]').value.trim(),requestedLevel:panel.querySelector('[data-od-level]').value.trim(),constraints:panel.querySelector('[data-od-constraints]').value.trim(),saudizationNote:panel.querySelector('[data-od-saudization]').value.trim()};}
function mount(){
 if(!location.hash.startsWith('#enterprise/create'))return;
 const anchor=document.querySelector('#ent-content .ent-card .ent-form-grid');if(!anchor||document.getElementById('miyar-od-workbench'))return;
 const panel=document.createElement('section');panel.id='miyar-od-workbench';panel.className='od-workbench';panel.innerHTML='<div class="od-workbench-head"><div><span class="od-phase">'+t('PHASE 1 · محرك OD','PHASE 1 · OD ENGINE')+'</span><h2>'+t('من احتياج الأعمال إلى وصف وظيفي قابل للتقييم','From business need to an evaluation-ready job description')+'</h2><p>'+t('أدخل الهدف الاستراتيجي والمسؤوليات. يولد معيار حزمة قابلة للتحرير ثم يمررها إلى الترميز والتقييم والاعتماد.','Enter the strategic objective and responsibilities. Miyar generates an editable package, then hands it to coding, evaluation and approval.')+'</p></div><button type="button" class="button button-outline" data-od-example>'+t('تحميل مثال HC','Load HC example')+'</button></div><div class="od-foundation"><div><b>1</b><span><strong>'+t('هيكل المؤسسة','Organization structure')+'</strong><small>'+t('الإدارة والمدير ونطاق الإشراف تُراجع مع الهيكل المعتمد.','Department, manager and span are reviewed against the approved structure.')+'</small></span></div><div><b>2</b><span><strong>'+t('هيكل الدرجات','Grading structure')+'</strong><small>'+t('التقييم النهائي يستخدم إطار الجهة المعتمد؛ لا تُستخدم جداول Korn Ferry/Mercer غير المرخصة.','Final evaluation uses the approved organization framework; unlicensed Korn Ferry/Mercer tables are not used.')+'</small></span></div></div><div class="od-input-grid"><label>'+t('الهدف الاستراتيجي / احتياج الأعمال','Strategic objective / business need')+'<textarea data-od-strategy rows="3" placeholder="'+t('مثال: تحويل استراتيجية رأس المال البشري إلى مبادرات ذات أولوية ورفع كفاءة التنفيذ','Example: Cascade the HC strategy into prioritized initiatives and improve execution efficiency')+'"></textarea></label><label class="od-wide">'+t('الأدوار والمسؤوليات','Roles & responsibilities')+'<textarea data-od-responsibilities rows="7" placeholder="'+t('ضع مسؤولية واحدة في كل سطر','Enter one responsibility per line')+'"></textarea></label><label>'+t('الإدارة','Department')+'<input data-od-department placeholder="Human Capital"></label><label>'+t('المستوى المطلوب من الأعمال — اختياري','Business-requested level — optional')+'<input data-od-level placeholder="Manager"></label><label>'+t('قيود أو اعتبارات','Constraints / considerations')+'<input data-od-constraints></label><label>'+t('قاعدة توطين مقدمة من الجهة — اختيارية','Organization-provided Saudization rule — optional')+'<input data-od-saudization placeholder="'+t('لا تفترض نسبة دون مصدر','Do not assume a percentage without a source')+'"></label></div><div class="od-run-row"><button type="button" class="button button-primary" data-od-generate>'+t('توليد حزمة OD','Generate OD package')+'</button><span data-od-status role="status">'+t('المخرجات اقتراحات للمراجعة البشرية وليست اعتمادًا نهائيًا.','Outputs are review proposals, not final approval.')+'</span></div><div data-od-result></div><div class="od-roadmap"><span class="active">'+t('المرحلة 1 · تصميم وتقييم الوظائف','Phase 1 · Job design & evaluation')+'</span><span>'+t('المرحلة 2 · تخطيط القوى العاملة','Phase 2 · Manpower planning')+'</span><span>'+t('المرحلة 3 · التعويضات','Phase 3 · Compensation')+'</span></div>';
 anchor.parentElement.insertBefore(panel,anchor);
 panel.querySelector('[data-od-example]').onclick=()=>{const e=Engine.hcExample;panel.querySelector('[data-od-strategy]').value=e.strategyObjective;panel.querySelector('[data-od-responsibilities]').value=e.responsibilities;panel.querySelector('[data-od-department]').value=e.department;panel.querySelector('[data-od-level]').value='';panel.querySelector('[data-od-saudization]').value=e.saudizationNote;status(t('تم تحميل حالة HC التي قدمها الخبير.','The expert-provided HC case has been loaded.'));};
 panel.querySelector('[data-od-generate]').onclick=async()=>{const button=panel.querySelector('[data-od-generate]');button.disabled=true;status(t('جارٍ بناء الوصف وربط المراجع…','Building the job description and checking references…'));try{const proposal=proposalWithMetadata(Engine.generate(readInput(panel),ar()?'ar':'en')),refs=await resolveReferences(proposal);currentProposal=proposal;renderResult(panel.querySelector('[data-od-result]'),proposal,refs);applyProposal(proposal,refs);status(t('تم توليد الحزمة وتطبيقها على نموذج المنصب. راجعها قبل الحفظ والتقييم.','Package generated and applied to the position form. Review it before saving and evaluation.'));}catch(error){status(error.message);}finally{button.disabled=false;}};
}
const observer=new MutationObserver(()=>mount());const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(mount));window.addEventListener('miyar:navigate',()=>requestAnimationFrame(mount));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
