/* Core QA adapters loaded before the enterprise workspace. */
(function(){
'use strict';
const C=window.MiyarEnterpriseCore;if(!C)return;
const norm=C.normalize||function(v){return String(v||'').toLowerCase().trim();};

if(C.search&&!C.__qaSearch){
 C.__qaSearch=true;const original=C.search.bind(C);
 const aliases={'accountant':'محاسب','accounting':'محاسب','nurse':'ممرض','registered nurse':'ممرض','software engineer':'مهندس برمجيات','software developer':'مطور برامج','programmer':'مطور برامج','sales manager':'مدير مبيعات','sales specialist':'اختصاصي مبيعات','human resources':'موارد بشرية','hr specialist':'أخصائي موارد بشرية','mechanical engineer':'مهندس ميكانيكي','civil engineer':'مهندس مدني'};
 C.search=function(nodes,q,parent){const raw=norm(q),mapped=aliases[raw]||String(q??''),soft=mapped.split(/\s+/).map(x=>x.length>3&&/[ةه]$/.test(x)?x.slice(0,-1):x).join(' ');let rows=original(nodes,soft,parent);if(!rows.length&&soft!==mapped)rows=original(nodes,mapped,parent);return rows;};
}

if(C.skills&&!C.__qaSkills){
 C.__qaSkills=true;const original=C.skills.bind(C);
 const local=[
  {id:'qa-accounting',labelAr:'المحاسبة وإعداد القيود',labelEn:'Accounting and journal entries',aliases:['محاسبة','محاسب','قيود محاسبية','journal entries','accounting'],source:'Miyar local review vocabulary'},
  {id:'qa-reconciliation',labelAr:'مطابقة وتسوية الحسابات',labelEn:'Account reconciliation',aliases:['مطابقة الحسابات','تسوية الحسابات','مطابقة بنكية','bank reconciliation','reconciliation'],source:'Miyar local review vocabulary'},
  {id:'qa-financial-reporting',labelAr:'إعداد التقارير المالية',labelEn:'Financial reporting',aliases:['تقارير مالية','القوائم المالية','financial reporting','financial statements'],source:'Miyar local review vocabulary'},
  {id:'qa-payables-receivables',labelAr:'الذمم الدائنة والمدينة',labelEn:'Accounts payable and receivable',aliases:['ذمم دائنة','ذمم مدينة','accounts payable','accounts receivable'],source:'Miyar local review vocabulary'},
  {id:'qa-budgeting',labelAr:'إعداد ومتابعة الميزانية',labelEn:'Budgeting and monitoring',aliases:['ميزانية','موازنة','budgeting','budget monitoring'],source:'Miyar local review vocabulary'}
 ];
 const loose=v=>norm(v).split(/\s+/).filter(Boolean).map(token=>{let x=token;if(/^و.+/.test(x)&&x.length>3)x=x.slice(1);if(/^ال.+/.test(x)&&x.length>4)x=x.slice(2);return x;}).join(' ');
 C.skills=function(text,vocabulary){const base=original(text,vocabulary),hay=' '+loose(text)+' ',ids=new Set(base.map(x=>x.id));for(const s of local){const evidence=s.aliases.filter(a=>hay.includes(' '+loose(a)+' '));if(evidence.length&&!ids.has(s.id)){base.push({...s,evidence});ids.add(s.id);}}return base;};
}

const ERROR_AR={
 'Record an evaluation for this revision first':'اضغط «حفظ التقييم لهذا الإصدار» أولًا، ثم اعتمد المرحلة.',
 'Illustrative framework cannot approve an institutional grade; configure the organization framework':'لا يمكن اعتماد درجة بإطار تقييم توضيحي. اعتمد إطار تقييم الجهة أولًا ثم أعد حفظ التقييم.',
 'Confirm vacancy, headcount and sufficient annual budget against the request':'أكد الشاغر والعدد، وأدخل ميزانية سنوية معتمدة لا تقل عن التكلفة المطلوبة.',
 'Confirm the pay framework review':'أكد مراجعة إطار التعويضات المعتمد قبل الاعتماد.',
 'OD must review scope and occupation mapping':'أكد مراجعة نطاق العمل والإشراف ومرجع المهنة في مرحلة OD.',
 'Evaluation is only open during the Total Rewards review stage':'التقييم متاح فقط أثناء مرحلة مراجعة التعويضات والمزايا.',
 'Line managers require a department':'اختر الإدارة لحساب مدير الإدارة.',
 'Occupation code does not exist in the selected release':'رمز المهنة غير موجود في إصدار الدليل المعتمد. اختر الرمز من دليل المهن.',
 'Unknown educational specialization code':'رمز التخصص التعليمي غير موجود في دليل التعليم.',
 'Headcount must be positive':'العدد المطلوب يجب أن يكون عددًا صحيحًا أكبر من صفر.',
 'Direct reports must be a whole number':'عدد المرؤوسين يجب أن يكون عددًا صحيحًا.',
 'Provide the salary range source or rationale':'أدخل مصدر نطاق الراتب أو مبرره.',
 'Answer every configured factor':'اختر مستوى لكل عامل من عوامل التقييم.',
 'Each factor requires a valid level and evidence':'اختر مستوى واكتب دليلًا لكل عامل من عوامل التقييم.',
 'Weights must total 100':'مجموع أوزان عوامل التقييم يجب أن يساوي 100.',
 'An unmapped position needs a provisional-code justification':'المنصب بلا رمز مهني يحتاج مبررًا للتعريف الداخلي المؤقت.',
 'Confirm the unmapped role is internal only; national-code verification remains pending':'أكد أن التعريف المؤقت داخلي فقط وأن التحقق من الرمز الوطني ما زال معلقًا.'
};
if(window.fetch&&!window.__miyarQaFetch){
 window.__miyarQaFetch=true;const native=window.fetch.bind(window);
 window.fetch=async function(...args){const r=await native(...args);if(document.documentElement.lang==='en'||r?.status!==422||typeof r.clone!=='function'||typeof Response==='undefined')return r;try{const data=await r.clone().json(),detail=typeof data?.detail==='string'?data.detail:'';if(!detail)return r;const translated=ERROR_AR[detail]||('تعذر قبول الطلب. سبب الخادم: '+detail);return new Response(JSON.stringify({...data,detail:translated}),{status:r.status,statusText:r.statusText,headers:r.headers});}catch{return r;}};
}

/* demo-runtime owns the directory result UI. Intercept a chosen directory
 * result before its legacy onclick and persist an auditable OD handoff. */
if(!window.__miyarQaDirectoryHandoff){
 window.__miyarQaDirectoryHandoff=true;
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-demo-ref]');if(!button)return;
  const strong=button.querySelector('strong'),code=strong?.textContent?.trim()||'';
  const title=button.textContent.replace(code,'').replace(/^\s*[·\-–—:]\s*/,'').trim();
  const input={objective:document.getElementById('objective')?.value?.trim()||'',domain:document.getElementById('domain')?.value?.trim()||'',seniority:document.getElementById('seniority')?.value?.trim()||'',constraints:document.getElementById('constraints')?.value?.trim()||''};
  sessionStorage.setItem('miyar-demo-od-handoff-v2',JSON.stringify({input,role:{title,occupationCode:code,educationFieldCode:''},need:input.objective,at:Date.now()}));
  event.preventDefault();event.stopImmediatePropagation();window.location.hash='#enterprise/create';window.dispatchEvent(new Event('hashchange'));
 },true);
}
window.MiyarQACore={errorTranslations:ERROR_AR,version:'2026-09-15'};
})();
