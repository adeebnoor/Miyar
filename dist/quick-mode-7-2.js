/* Miyar 7.2 Quick mode: three screens from a described need to a saved, defensible position draft.
   Screen 1 collects the need and duties. Screen 2 shows every inferred proposal, editable and tagged
   "proposed — review it". Screen 3 is the defensible summary, saved as a local draft and opened in
   Position design with the core fields filled. The same suggestion engine and local store are used;
   nothing here invents organization data. */
(function(){
'use strict';
const t=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='miyar-quick-mode-7-2';
const REVIEW=['title','field','seniority','purpose','alternatives','successMeasures','team','budget','authority','experience','qualifications','skills'];
let step=1,input={businessNeed:'',responsibilities:'',department:''},proposal=null,edits={},kpis=[];
const store={get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{return null;}},set(v){try{sessionStorage.setItem(KEY,JSON.stringify(v));}catch{}}};
function restore(){const v=store.get();if(!v)return;step=v.step||1;input=v.input||input;proposal=v.proposal||null;edits=v.edits||{};kpis=v.kpis||[];}
function persist(){store.set({step,input,proposal,edits,kpis});}
function api(){return window.MiyarEnterprise;}
function content(){
 const c={...input,...(proposal?.values||{}),...edits};
 if(kpis.length)c.kpis=kpis.map(k=>({...k}));
 c.occupationRelease=api()?.occupationRelease?.()||'';
 c.odGenerationBasis=t('الوضع السريع: مقترحات مستنتجة من الحاجة والمهام ودليل المهن؛ تحتاج مراجعة بشرية قبل الاعتماد.','Quick mode: proposals inferred from the need, the duties and the occupation directory; human review is required before approval.');
 if(c.successMeasures===undefined&&kpis.length)c.successMeasures=kpis.map(k=>k.metric+(k.target?' — '+k.target:'')).join('\n');
 for(const key of Object.keys(c))if(c[key]===''||c[key]===undefined)delete c[key];
 return c;
}
function completeness(){const core=api()?.coreFields?.()||[];const c=content();const done=core.filter(k=>String(c[k]||'').trim());return {done:done.length,total:core.length,missing:core.filter(k=>!String(c[k]||'').trim())};}
function stepper(){return '<ol class="qm-steps">'+[[1,'صف الحاجة','Describe the need'],[2,'راجع المقترحات','Review proposals'],[3,'المسودة القابلة للدفاع','Defensible draft']].map(([n,ar,en])=>'<li'+(n===step?' aria-current="step"':n<step?' class="done"':'')+'><i>'+n+'</i><span>'+t(ar,en)+'</span></li>').join('')+'</ol>';}
function head(){return '<div class="qm-head"><div><span class="qm-eyebrow">'+t('الوضع السريع · ≈ 20 دقيقة','Quick mode · ≈ 20 minutes')+'</span><h2>'+t('من الحاجة إلى مسودة منصب قابلة للدفاع في ثلاث شاشات','From a need to a defensible position draft in three screens')+'</h2><p>'+t('اكتب ما يجب أن يتغير وما سيُنجز. يستنتج معيار الدور والمستوى والبدائل ونطاق الإشراف والميزانية ومؤشرين، ويسم كل قيمة مستنتجة «مقترح — راجعه». الأرقام المالية الفعلية والأدلة تبقى من الجهة.','Write what must change and what will be delivered. Miyar infers the role, level, alternatives, supervision scope, budget scope and two KPIs, tagging every inferred value “Proposed — review it”. Actual financial figures and evidence stay with your organization.')+'</p></div></div>'+stepper();}
function screen1(){
 return head()+'<section class="ent-card qm-card"><h3>'+t('1 · صف الحاجة والمهام','1 · Describe the need and the duties')+'</h3><div class="ent-form-grid"><label class="ent-field">'+t('ما الذي يجب أن يتغير؟ (الهدف أو المشكلة)','What must change? (goal or problem)')+' <span aria-hidden="true">*</span><textarea data-qm="businessNeed" rows="3" maxlength="4000" dir="auto" placeholder="'+t('مثال: رفع جودة التعليم في مدارس المنطقة وتطوير أداء المعلمين خلال عامين','Example: raise teaching quality across the district’s schools and develop teacher performance within two years')+'">'+esc(input.businessNeed)+'</textarea><small>'+t('لماذا؟ يربط الطلب بنتيجة للأعمال ويُشتق منه هدف المنصب والبدائل.','Why? It ties the request to a business outcome and derives the position purpose and alternatives.')+'</small></label><label class="ent-field">'+t('ما الذي سينجزه صاحب المنصب؟ (ثلاث مهام على الأقل، كل مهمة في سطر)','What will the position deliver? (at least three duties, one per line)')+' <span aria-hidden="true">*</span><textarea data-qm="responsibilities" rows="5" maxlength="4000" dir="auto" placeholder="'+t('الإشراف التربوي على المدارس\nتدريب المعلمين وتقويم أدائهم\nإعداد تقارير جودة التعليم للإدارة','Supervise schools’ teaching practice\nTrain teachers and evaluate their performance\nPrepare teaching-quality reports for management')+'">'+esc(input.responsibilities)+'</textarea><small>'+t('لماذا؟ المهام الفعلية هي ما يحدد المهنة والمستوى ونطاق الإشراف، لا المسمى.','Why? The actual duties determine the occupation, the level and the span of control, not the title.')+'</small></label><label class="ent-field">'+t('الإدارة أو المجال — اختياري','Department or field — optional')+'<input data-qm="department" maxlength="120" dir="auto" value="'+esc(input.department)+'"><small>'+t('لماذا؟ يضيّق الترشيح على العائلة الوظيفية الصحيحة.','Why? It narrows the match to the right job family.')+'</small></label></div><p class="ent-message" data-qm-status hidden></p><div class="action-row"><button type="button" class="button button-primary" data-qm-next>'+t('اقترح المسودة','Propose the draft')+'</button><a class="button button-outline" href="#enterprise/create">'+t('أفضّل النموذج الكامل','I prefer the full form')+'</a></div></section>';
}
function value(key){return edits[key]!==undefined?edits[key]:(proposal?.values?.[key]??'');}
function screen2(){
 if(!proposal||proposal.status!=='proposed-for-review'){
  const cands=(proposal?.candidates||[]).slice(0,4);
  return head()+'<section class="ent-card qm-card"><h3>'+t('2 · نحتاج توضيحًا قبل الاقتراح','2 · A clarification is needed before proposing')+'</h3><p class="ent-message">'+esc(proposal?.message||t('المهام لا تكفي لاختيار دور موثوق.','The duties do not yet establish a reliable role.'))+'</p>'+(cands.length?'<p>'+t('أقرب الأدوار المحتملة:','Closest possible roles:')+'</p><ul>'+cands.map(c=>'<li>'+esc(t(c.titleAr||c.title||'',c.titleEn||c.title||''))+'</li>').join('')+'</ul>':'')+'<div class="action-row"><button type="button" class="button button-primary" data-qm-back>'+t('عدّل الحاجة والمهام','Edit the need and duties')+'</button></div></section>';
 }
 const prov=Object.fromEntries((proposal.provenance||[]).map(p=>[p.field,p]));
 const source=key=>{const p=prov[key];if(!p)return t('مدخل منك','Entered by you');if(p.source==='inferred-from-need')return t('مستنتج من الحاجة والمستوى','Inferred from the need and level');if(p.source==='user-description')return t('من وصف الحاجة','From your need');return t('دليل المهن SSCO · الرمز ','SSCO directory · code ')+esc(p.referenceCode)+' · '+t('صفحة ','page ')+esc(p.sourcePage);};
 const field=key=>{const v=value(key),name=api()?.fieldName?.(key)||key,tag=edits[key]===undefined&&proposal.values[key]!==undefined;return '<label class="ent-field'+(tag?' ent-suggested':'')+'">'+esc(name)+(tag?'<span class="ent-suggested-tag">'+t('مقترح — راجعه','Proposed — review it')+'</span>':'')+(String(v).length>60||/\n/.test(String(v))?'<textarea data-qm-field="'+key+'" rows="3" dir="auto">'+esc(v)+'</textarea>':'<input data-qm-field="'+key+'" dir="auto" value="'+esc(v)+'">')+'<small>'+source(key)+'</small></label>';};
 const kpiRows=kpis.map((k,i)=>'<tr><td><input data-qm-kpi="'+i+'" data-k="metric" dir="auto" value="'+esc(k.metric)+'"></td><td><input data-qm-kpi="'+i+'" data-k="baseline" dir="auto" value="'+esc(k.baseline)+'" placeholder="'+t('من بياناتكم','From your data')+'"></td><td><input data-qm-kpi="'+i+'" data-k="target" dir="auto" value="'+esc(k.target)+'"></td><td><input data-qm-kpi="'+i+'" data-k="duration" dir="auto" value="'+esc(k.duration)+'"></td></tr>').join('');
 const c=completeness();
 return head()+'<section class="ent-card qm-card"><h3>'+t('2 · راجع المقترحات وعدّل ما تشاء','2 · Review the proposals and edit freely')+'</h3><p class="qm-note">'+esc(proposal.message||'')+'</p><div class="ent-form-grid">'+REVIEW.map(field).join('')+'</div><h4>'+t('مؤشرات الأداء المقترحة — خط الأساس من بياناتكم','Proposed KPIs — the baseline comes from your data')+'</h4><div class="qm-table"><table class="ent-table"><thead><tr><th>'+t('المقياس','Metric')+'</th><th>'+t('خط الأساس','Baseline')+'</th><th>'+t('المستهدف','Target')+'</th><th>'+t('المدة','Duration')+'</th></tr></thead><tbody>'+kpiRows+'</tbody></table></div><p class="qm-progress">'+t('الحقول الأساسية المكتملة: ','Core fields complete: ')+c.done+' / '+c.total+(c.missing.length?' · '+t('المتبقي: ','Remaining: ')+c.missing.map(k=>api()?.fieldName?.(k)||k).join('، '):'')+'</p><div class="action-row"><button type="button" class="button button-outline" data-qm-back>'+t('السابق','Back')+'</button><button type="button" class="button button-primary" data-qm-next>'+t('اعرض المسودة القابلة للدفاع','Show the defensible draft')+'</button></div></section>';
}
function screen3(){
 const c=content(),cm=completeness();
 const row=(ar,en,v)=>v?'<div class="qm-row"><strong>'+t(ar,en)+'</strong><p dir="auto">'+esc(v).replace(/\n/g,'<br>')+'</p></div>':'';
 return head()+'<section class="ent-card qm-card qm-summary"><h3>'+t('3 · المسودة القابلة للدفاع','3 · The defensible draft')+'</h3><p class="qm-note">'+t('هذا ما يقرؤه المعتمِد: لماذا هذا الدور، ما البدائل التي استُبعدت، كيف يُقاس النجاح، وما نطاق الإشراف والميزانية. كل بند مستنتج موسوم للمراجعة في نموذج المنصب.','This is what an approver reads: why this role, which alternatives were ruled out, how success is measured, and the supervision and budget scope. Every inferred item stays tagged for review in the position form.')+'</p><div class="qm-grid">'+row('المسمى والمستوى','Title and level',[c.title,c.seniority].filter(Boolean).join(' · '))+row('العائلة الوظيفية ورمز المهنة','Job family and occupation code',[c.jobFamily||c.field,c.occupationCode].filter(Boolean).join(' · '))+row('هدف المنصب','Purpose',c.purpose)+row('لماذا منصب وليس بديلًا','Why a position rather than an alternative',c.alternatives)+row('مؤشرات النجاح','Success measures',c.successMeasures)+row('الفريق ونطاق الإشراف','Team and span of control',c.team)+row('نطاق الميزانية','Budget scope',c.budget)+row('صلاحيات القرار','Decision authority',c.authority)+row('الخبرة والمؤهلات','Experience and qualifications',[c.experience,c.qualifications].filter(Boolean).join('\n'))+row('المهارات','Skills',c.skills)+'</div><p class="qm-progress">'+t('الحقول الأساسية المكتملة: ','Core fields complete: ')+cm.done+' / '+cm.total+(cm.missing.length?' · '+t('يُستكمل في نموذج المنصب: ','Completed in the position form: ')+cm.missing.map(k=>api()?.fieldName?.(k)||k).join('، '):'')+'</p><p class="ent-message" data-qm-status hidden></p><div class="action-row"><button type="button" class="button button-outline" data-qm-back>'+t('السابق','Back')+'</button><button type="button" class="button button-primary" data-qm-save>'+t('احفظ كمسودة وافتحها في تصميم المنصب','Save as a draft and open it in Position design')+'</button></div></section>';
}
function status(el,msg,error){const box=el.querySelector('[data-qm-status]');if(!box)return;box.hidden=!msg;box.textContent=msg||'';box.className='ent-message'+(error?' error':'');}
function render(){
 if(location.hash!=='#enterprise/quick')return;const host=document.getElementById('ent-content');if(!host)return;
 restore();
 const heading=document.getElementById('enterprise-heading');if(heading)heading.textContent=t('الوضع السريع','Quick mode');const bc=document.getElementById('breadcrumb-title');if(bc)bc.textContent=t('الوضع السريع','Quick mode');
 document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.enterpriseOpen==='quick'));
 host.innerHTML='<div class="qm-page">'+(step===1?screen1():step===2?screen2():screen3())+'</div>';
 bind(host);
}
function bind(host){
 host.querySelectorAll('[data-qm]').forEach(x=>x.addEventListener('input',()=>{input[x.dataset.qm]=x.value;persist();}));
 host.querySelectorAll('[data-qm-field]').forEach(x=>x.addEventListener('input',()=>{edits[x.dataset.qmField]=x.value;const label=x.closest('label');label?.classList.remove('ent-suggested');label?.querySelector('.ent-suggested-tag')?.remove();persist();}));
 host.querySelectorAll('[data-qm-kpi]').forEach(x=>x.addEventListener('input',()=>{const row=kpis[Number(x.dataset.qmKpi)];if(row)row[x.dataset.k]=x.value;persist();}));
 host.querySelector('[data-qm-back]')?.addEventListener('click',()=>{step=Math.max(1,step-1);persist();render();});
 host.querySelector('[data-qm-next]')?.addEventListener('click',()=>{
  if(step===1){
   const need=input.businessNeed.trim(),duties=input.responsibilities.split(/\n/).map(x=>x.trim()).filter(Boolean);
   if(need.length<12||duties.length<3){status(host,t('اكتب الهدف (12 حرفًا على الأقل) وثلاث مهام على الأقل، كل مهمة في سطر.','Write the goal (at least 12 characters) and at least three duties, one per line.'),true);(need.length<12?host.querySelector('[data-qm="businessNeed"]'):host.querySelector('[data-qm="responsibilities"]'))?.focus();return;}
   try{proposal=api().guidedSuggest({businessNeed:need,responsibilities:duties.join('\n'),department:input.department,field:input.department});}catch(e){proposal={status:'review-required',message:e.message,values:{},provenance:[]};}
   edits={};kpis=(proposal.kpiProposals||(proposal.kpiProposal?[proposal.kpiProposal]:[])).map(k=>({outcome:k.outcome||need,metric:k.metric||'',baseline:k.baseline||'',target:k.target||'',duration:k.duration||'',frequency:k.frequency||'',deliverable:k.deliverable||''}));
   step=2;
  }else if(step===2)step=3;
  persist();render();
 });
 host.querySelector('[data-qm-save]')?.addEventListener('click',()=>{
  try{const saved=api().saveLocal(content());store.set(null);step=1;input={businessNeed:'',responsibilities:'',department:''};proposal=null;edits={};kpis=[];
   if(!api().openLocalDraft(saved.id))location.hash='#enterprise/create';}
  catch(e){status(host,e.message||String(e),true);}
 });
}
window.addEventListener('hashchange',()=>setTimeout(render,0));window.addEventListener('miyar:navigate',()=>setTimeout(render,30));document.addEventListener('DOMContentLoaded',()=>setTimeout(render,30),{once:true});setTimeout(render,30);
new MutationObserver(()=>{if(location.hash==='#enterprise/quick'&&!document.querySelector('.qm-page'))setTimeout(render,0);}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['lang']});
window.MiyarQuickMode={render,steps:3,state:()=>({step,input,proposal,edits,kpis}),content,completeness};
})();
