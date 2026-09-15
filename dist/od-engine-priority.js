(function(root){
'use strict';
const engine=root.MiyarODEngine;if(!engine||engine.__domainPriority)return;engine.__domainPriority=true;
const original=engine.generate.bind(engine);
const normalize=engine.normalize;
const priorities=[
 {terms:['human capital','human resources','hr','hc','موارد بشرية','رأس المال البشري','راس المال البشري','شؤون الموظفين'],context:'human capital human resources hr hc workforce talent people employee'},
 {terms:['project management office','pmo','مكتب إدارة المشاريع','مكتب اداره المشاريع'],context:'project program portfolio pmo milestone initiative'},
 {terms:['procurement','supply chain','المشتريات','سلاسل الإمداد'],context:'procurement sourcing rfp purchase request purchase order vendor contract invoice'},
 {terms:['finance','financial','المالية','المالي'],context:'finance financial budget opex capex forecast cost accounting'},
 {terms:['information technology','digital transformation','تقنية المعلومات','التحول الرقمي'],context:'technology digital software system platform data cyber automation'},
 {terms:['operations','operational excellence','العمليات','التميز التشغيلي'],context:'operations process efficiency continuous improvement quality service delivery'}
];
function priorityContext(input){
 const primary=normalize([input.department,input.strategyObjective].filter(Boolean).join(' '));
 const match=priorities.find(p=>p.terms.some(term=>primary.includes(normalize(term))));
 return match?match.context:'';
}
engine.generate=function(input={},locale='en'){
 const context=priorityContext(input);return original(context?{...input,context:[input.context,context].filter(Boolean).join(' ')}:input,locale);
};
})(typeof window!=='undefined'?window:globalThis);
