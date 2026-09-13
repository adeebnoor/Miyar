const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../dist/position.js');
const E=require('../dist/engine.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/data.js'),'utf8'),context);
const data=context.window.MIYAR_DATA;
const match=i=>E.classify({objective:i.purpose+'\n'+i.responsibilities,domain:'all',seniority:'professional'},data.roles);

test('empty requests expose missing inputs and never receive a grade or code',()=>{
 const p=P.packageRecord(P.blank(),null);
 assert.equal(p.inputCompleteness.filled,0);
 assert.equal(p.inputCompleteness.missing.length,p.inputCompleteness.total);
 assert.equal(p.evaluation.status,'pending');
 assert.equal(p.evaluation.score,null);
 assert.equal(p.evaluation.grade,null);
 assert.equal(p.occupationMapping.saudiCode,null);
 assert.equal(p.positionApproval,'pending');
});
test('both sample languages give a complete draft with the same source mapping',()=>{
 for(const locale of ['ar','en']){
  const i=P.sample(locale),r=match(i),p=P.packageRecord(i,r,locale);
  assert.equal(p.inputCompleteness.missing.length,0);
  assert.equal(r.kind,'match');
  assert.equal(p.occupationMapping.saudiCode,'214116');
  assert.equal(p.occupationMapping.educationCode,'071903');
  assert.equal(p.jobDescription.status,'draft');
  assert.equal(p.evaluation.status,'pending');
  assert.equal(p.regulatoryReview.saudization.status,'pending');
 }
});
test('the package preserves responsibilities and role evidence without rewriting user input',()=>{
 const i=P.sample('en');
 i.responsibilities='First responsibility\n\nSecond responsibility';
 i.businessNeed='<script>example</script>';
 const p=P.packageRecord(i,null,'en');
 assert.deepEqual(p.jobDescription.responsibilities,['First responsibility','Second responsibility']);
 assert.equal(p.jobDescription.businessJustification,i.businessNeed);
 assert.equal(p.jobDescription.technicalCompetencies,i.skills);
 assert.equal(p.jobDescription.behavioralCompetencies,i.behaviors);
 assert.equal(p.jobDescription.budget,i.budget);
});
test('business review needs a name, a date and complete core inputs',()=>{
 const i=P.sample('ar');i.businessReviewed=true;
 assert.equal(P.packageRecord(i,match(i)).jobDescription.status,'draft');
 i.businessReviewer='Demo reviewer';i.businessReviewDate='2026-09-12';
 assert.equal(P.packageRecord(i,match(i)).jobDescription.status,'business-review-recorded');
 i.purpose=' ';
 assert.equal(P.packageRecord(i,null).jobDescription.status,'draft');
});
test('a specialist outcome is recorded only as reported and does not approve the position',()=>{
 const i=P.sample('en');Object.assign(i,{method:'Organization-approved method, ref E-1',evaluator:'Example evaluator',evaluationDate:'2026-09-12',score:'0',grade:'Example G-1',rationale:'Recorded evidence reference E-1'});
 const p=P.packageRecord(i,match(i),'en');
 assert.equal(p.evaluation.status,'reported-unverified');
 assert.equal(p.evaluation.score,'0');
 assert.equal(p.evaluation.grade,'Example G-1');
 assert.equal(p.evaluation.calculatedByMiyar,false);
 assert.equal(p.positionApproval,'pending');
 delete i.problemSolving;
 assert.equal(P.evaluation(i).status,'pending');
});
test('regulatory entries need a source and date, and remain unverified',()=>{
 const i=P.sample('en');Object.assign(i,{saudization:'Example requirement',saudizationSource:'javascript:alert(1)',saudizationDate:'2026-09-12'});
 assert.equal(P.packageRecord(i,null).regulatoryReview.saudization.status,'pending');
 i.saudizationSource='https://example.org/reference';
 assert.equal(P.packageRecord(i,null).regulatoryReview.saudization.status,'reported-unverified');
 assert.equal(P.packageRecord(i,null).regulatoryReview.certification.status,'pending');
});
test('every English occupation scenario matches its immutable sample record',()=>{
 for(const role of data.roles){
  const r=E.classify({objective:role.scenarioEn,domain:'all',seniority:'professional'},data.roles);
  assert.equal(r.kind,'match');assert.equal(r.role.id,role.id);
  assert.ok(r.role.reasonEn&&r.groups.every(g=>g.labelEn));
 }
});

