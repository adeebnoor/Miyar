const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/role-recommender'),E=require('../dist/od-engine');

function catalogInput(role,locale){
 const ar=locale==='ar',family=R.catalog.families.find(x=>x.id===role.family);
 const terms=role.taskKeywords.filter(x=>ar?/[\u0600-\u06ff]/.test(x):/[a-z]/i.test(x));
 const duties=(terms.length?terms:[ar?family.ar:family.en]).map(x=>(ar?'مراجعة ':'Review ')+x);
 // General family work remains explicit when a catalog leadership profile has
 // no specialty keywords. Two independently stated activities establish scope.
 duties.push((ar?'توثيق أعمال ':'Document work in ')+(ar?family.ar:family.en));
 if(role.level==='manager')duties.push(ar?'يدير خمسة موظفين؛ يعتمد خطط الإدارة':'Manage five employees; approve department plans');
 if(['director','executive'].includes(role.level))duties.push(ar?'يقود 25 موظفاً؛ يعتمد الخطط؛ يعرض على المجلس':'Lead 25 employees; approve plans; present to the board');
 if(role.level==='supervisor')duties.push(ar?'يشرف على خمسة موظفين':'Supervise five employees');
 if(role.family==='maintenance'&&role.level==='specialist')duties.push(ar?'مراجعة التصميم الهندسي لمعدات الصيانة':'Review engineering design of maintenance equipment');
 return {department:ar?family.ar:family.en,strategyObjective:ar?'تحقيق أهداف الإدارة':'Deliver department objectives',responsibilities:duties.join('; '),requestedLevel:role.level==='executive'?'Chief Executive Officer':role.level,locale};
}

test('282 bilingual catalog cases produce proposals with exact recommender/OD family, level and title parity',()=>{
 let checked=0;
 for(const role of R.catalog.roles)for(const locale of ['ar','en']){
  const input=catalogInput(role,locale),label=role.family+'/'+role.intent+'/'+role.level+'/'+locale;
  const r=R.recommend(input);
  assert.ok(r?.candidate,label+' must select a supported proposal; errors/confirmation are not parity coverage');
  assert.equal(r.status,'proposed-for-review',label);
  assert.equal(r.candidate.family,role.family,label+' catalog family');
  assert.equal(r.candidate.level,role.level,label+' duty-supported catalog level');
  const p=E.generate(input,locale);
  assert.equal(p.family.id,r.candidate.family,label+' OD family');
  assert.equal(p.gradeRecommendation.level,r.candidate.level,label+' OD level');
  assert.equal(p.content.title,locale==='ar'?r.candidate.titleAr:r.candidate.titleEn,label+' OD title');
  assert.equal(p.content.finalProposedTitle,p.content.title,label+' final title');
  checked++;
 }
 assert.equal(checked,R.catalog.roles.length*2);
});
