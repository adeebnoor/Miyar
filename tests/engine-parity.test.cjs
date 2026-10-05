const test=require('node:test'),assert=require('node:assert/strict'),R=require('../dist/role-recommender'),E=require('../dist/od-engine');
test('every catalog role has the same family, level and title in both engines, Arabic and English',()=>{
 for(const role of R.catalog.roles)for(const locale of ['ar','en']){
  const family=R.catalog.families.find(x=>x.id===role.family),terms=role.taskKeywords.filter(x=>locale==='ar'?/[\u0600-\u06ff]/.test(x):/[a-z]/i.test(x));
  const duties=(terms.length?terms:role.taskKeywords).map(x=>(locale==='ar'?'مراجعة ':'Review ')+x);
  if(['manager','director','executive'].includes(role.level))duties.push(locale==='ar'?'يقود 25 موظفاً؛ يعتمد الخطط؛ يعرض على المجلس':'Lead 25 employees; approve plans; present to the board');
  if(role.level==='supervisor')duties.push(locale==='ar'?'يشرف على خمسة موظفين':'Supervise five employees');
  const input={department:locale==='ar'?family.ar:family.en,strategyObjective:locale==='ar'?'تحقيق أهداف الإدارة':'Deliver department objectives',responsibilities:duties.join('; '),locale};
  let r;try{r=R.recommend(input);}catch(error){assert.throws(()=>E.generate(input,locale),e=>e.code===error.code,role.titleEn);continue;}
  if(!r||r.status==='blocked'){assert.throws(()=>E.generate(input,locale),role.titleEn);continue;}
  const p=E.generate(input,locale);
  if(r.status==='needs-confirmation'){assert.equal(p.status,r.status,role.titleEn);assert.deepEqual(p.candidates,r.candidates);continue;}
  assert.equal(p.family.id,r.candidate.family,role.titleEn);assert.equal(p.gradeRecommendation.level,r.candidate.level,role.titleEn);assert.equal(p.content.title,locale==='ar'?r.candidate.titleAr:r.candidate.titleEn,role.titleEn);assert.equal(p.content.finalProposedTitle,p.content.title);
 }
});
