'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/role-recommender.js'),E=require('../dist/od-engine.js');

// Authored adversarial regression cases, separate from the missing independent
// pilot benchmark. Reporting recipients retain ownership across relative commas.
for(const context of [
 'reports to a Finance Director, who leads forty accountants and approves consolidated statements',
 'reports directly to the Finance Director, who leads thirty accountants and approves consolidated statements',
 'reporting line: Finance Director who leads forty accountants and approves consolidated statements',
 'their line manager leads 25 accountants and approves consolidated statements',
 'supports a manager who manages 25 accountants and approves consolidated statements',
 'works for a Finance Director who oversees thirty accountants and approves consolidated statements',
 'يرتبط إدارياً بمدير المالية الذي يدير ثلاثين محاسباً ويعتمد القوائم المالية',
 'يرفع تقاريره إلى المدير المالي، الذي يقود ثلاثين موظفاً ويعتمد القوائم المالية',
 'يعمل مع مدير يقود عشرين محاسباً ويعتمد القوائم المالية'
])test('recipient actor cannot confer people or approval authority: '+context,()=>{
 const ar=/[\u0600-\u06ff]/.test(context),input={department:ar?'المالية':'Finance',strategyObjective:'Deliver department objectives',responsibilities:(ar?'إعداد القيود؛ تسوية الحسابات البنكية؛ ':'Prepare accounting entries; reconcile bank accounts; ')+context};
 const r=R.recommend(input),p=E.generate(input,ar?'ar':'en');
 assert.equal(r.status,'proposed-for-review');assert.equal(r.candidate.level,'specialist');
 assert.equal(r.directReports,null);assert.deepEqual(r.levelAnalysis.evidence.people,[]);
 assert.deepEqual(r.levelAnalysis.evidence.approval,[]);assert.ok(r.detection.interpretation.reporting.length);
 assert.equal(p.content.title,ar?r.candidate.titleAr:r.candidate.titleEn);assert.equal(p.gradeRecommendation.level,'specialist');
 for(const field of ['requestedLevel','title']){
  const elevated={...input,[field]:'director'};assert.equal(R.recommend(elevated).status,'blocked');
  assert.throws(()=>E.generate(elevated));
 }
});

for(const duties of [
 'Report findings to the Finance Director and manage a team of four accountants and approve accounting entries; reconcile bank accounts',
 'Reporting line: Finance Director; manage four accountants; approve accounting entries; reconcile bank accounts',
 'يرفع تقاريره إلى المدير المالي، ويدير أربعة محاسبين؛ يعتمد القيود؛ يسوي الحسابات البنكية'
])test('later independently owned actions retain their authority: '+duties,()=>{
 const input={department:'Finance',strategyObjective:'Deliver department objectives',responsibilities:duties},r=R.recommend(input),p=E.generate(input);
 assert.equal(r.candidate.level,'manager');assert.equal(r.directReports,4);assert.equal(p.gradeRecommendation.level,'manager');
});

for(const [duties,count,level]of [
 ['Manage twenty-five accounting employees; approve financial statements',25,'director'],
 ['Manage eight treasury employees; review bank transfers',8,'manager'],
 ['Manage one hundred and twenty employees; approve financial statements',120,'director'],
 ['يدير واحداً وعشرين محاسباً؛ يعتمد القيود',21,'director'],
 ['لديه خمسة مرؤوسين مباشرين؛ يعتمد القيود',5,'manager'],
 ['يشرف على محاسب واحد؛ يراجع القيود',1,'specialist']
])test('owned counts handle modifiers and compound words: '+duties,()=>{
 const a=R.analyzeLevel({responsibilities:duties});assert.equal(a.directReports,count);assert.equal(a.evidenceCeiling,level);
});

test('an assistant to a director does not inherit the director title',()=>{
 const input={department:'Administration',title:'Assistant to the Finance Director',strategyObjective:'Deliver department objectives',responsibilities:'Arrange executive meetings; book business flights; maintain the executive calendar'};
 const r=R.recommend(input),p=E.generate(input);assert.equal(r.candidate.level,'assistant');assert.equal(p.gradeRecommendation.level,'assistant');
});

for(const duties of [
 'Lead twenty-five accountants; prepare journal entries; reconcile bank accounts; budget approval authority resides with the CFO',
 'Lead twenty-five accountants; prepare journal entries requiring approval by Finance Director; reconcile bank accounts',
 'يقود خمسة وعشرين محاسباً؛ إعداد القيود؛ تسوية الحسابات البنكية؛ تتطلب القيود اعتماد المدير المالي'
])test('approval belonging to a different actor cannot confer director authority: '+duties,()=>{
 const input={department:'Finance',strategyObjective:'Deliver department objectives',responsibilities:duties},r=R.recommend(input),p=E.generate(input);
 assert.equal(r.levelAnalysis.evidenceCeiling,'manager');assert.deepEqual(r.levelAnalysis.evidence.approval,[]);
 assert.equal(r.candidate.level,'manager');assert.equal(p.gradeRecommendation.level,'manager');
});

test('supporting a team supplies no owned direct reports',()=>{
 const input={department:'Finance',strategyObjective:'Deliver department objectives',responsibilities:'Prepare accounting entries; reconcile bank accounts; supports a team of 25 accountants'},r=R.recommend(input),p=E.generate(input);
 assert.equal(r.candidate.level,'specialist');assert.equal(r.directReports,null);assert.equal(p.gradeRecommendation.level,'specialist');
});
