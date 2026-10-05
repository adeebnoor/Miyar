const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/compensation-engine.js');
const evaluateCsv=csv=>C.evaluate({...C.example,rosterCsv:csv});
const sensitive=[
 ['1012345678','national-id-or-iqama'],['2456789012','national-id-or-iqama'],
 ['EMP-1012345678-X','national-id-or-iqama'],['١٠١٢٣٤٥٦٧٨','national-id-or-iqama'],
 ['EMP-۲۴۵۶۷۸۹۰۱۲-X','national-id-or-iqama'],['10123\u200B45678','national-id-or-iqama'],
 ['0512345678','mobile'],['+966 51 234 5678','mobile'],['٠٥١٢٣٤٥٦٧٨','mobile'],
 ['person@example.test','email'],['Mohammed_Alharbi','name-like-identifier'],['Mohammed-Alharbi','name-like-identifier']
];
for(const [value,kind] of sensitive)test('CSV privacy blocks '+kind+' without reflecting its value: '+sensitive.findIndex(x=>x[0]===value),()=>{
 assert.throws(()=>evaluateCsv('id,currentSalary\n'+value+',25000'),error=>{
  assert.equal(error.code,'ROSTER_PRIVACY');assert.equal(error.row,2);assert.equal(error.pattern,kind);
  assert.match(error.message,/row 2/);assert.ok(!error.message.includes(value));assert.ok(!Object.values(error).includes(value));return true;
 });
});
test('embedded sensitive text is screened in evidence, enum columns and salary text before parsing',()=>{
 for(const [column,value,kind] of [
  ['progressionEvidence','Review references 1012345678 in source record','national-id-or-iqama'],
  ['progressionEvidence','Mohammed Alharbi completed the required assessment','personal-name'],
  ['progressionEvidence','حقق محمد الحربي مستوى الإتقان المطلوب','personal-name'],
  ['progressionEvidence','Contact person@example.test for the evidence','email'],
  ['progressionEvidence','Call 966512345678 for approval','mobile'],
  ['regime','2456789012','national-id-or-iqama'],['serviceYears','١٠١٢٣٤٥٦٧٨','national-id-or-iqama'],
  ['currentSalary','1012345678','national-id-or-iqama']
 ]){
  const headers=column==='currentSalary'?'id,currentSalary':'id,currentSalary,'+column;
  const body=column==='currentSalary'?'EMP-0001,'+value:'EMP-0001,25000,'+value;
  assert.throws(()=>C.parseRoster(headers+'\n'+body),error=>{assert.equal(error.code,'ROSTER_PRIVACY');assert.equal(error.pattern,kind);assert.match(error.message,/row 2/);assert.ok(!error.message.includes(value));return true;});
 }
});
test('direct and nested roster input cannot bypass privacy or retain unsupported employee attributes',()=>{
 for(const row of [
  {id:'1012345678',currentSalary:25000},
  {id:'EMP-0001',currentSalary:25000,progressionEvidence:'محمد الحربي حقق المتطلبات'},
  {id:'EMP-0001',currentSalary:25000,employerCosts:{memo:'person@example.test'}},
  {id:'EMP-0001',currentSalary:25000,extra:{notes:'National ID 2456789012'}}
 ])assert.throws(()=>C.evaluate({...C.example,incumbents:[row]}),error=>error.code==='ROSTER_PRIVACY'&&/row 1/.test(error.message));
 assert.throws(()=>C.evaluate({...C.example,incumbents:[{id:'EMP-0001',currentSalary:25000,name:'Unlisted Person'}]}),/unsupported roster column/);
});
test('valid pseudonyms and ordinary English/Arabic evidence remain usable and export no raw CSV',()=>{
 const evidence='Demonstrated full proficiency in 2026-10-05 review; 120 tasks completed with 99% accuracy';
 const csv='id,currentSalary,progressionEligible,progressionEvidence\nEMP-0001,25000,true,'+evidence+'\nE17,23000,false,دليل أداء موثق: تنفيذ المهام بدقة مع خبرة ثلاث سنوات';
 const v=C.evaluate({...C.example,rosterCsv:csv,progressionEnabled:true,progressionApproved:true,progressionPolicy:'Approved TR policy 2026'});
 assert.deepEqual(v.incumbents.map(x=>x.id),['EMP-0001','E17']);assert.equal(v.input.incumbents[0].progressionEvidence,evidence);assert.ok(!Object.hasOwn(v.input,'rosterCsv'));
 assert.equal(v.incumbents[0].result.optionalProgressionPerFte,5000);assert.equal(v.incumbents[1].result.minimumAdjustmentPerFte,1000);
 const roundTrip=C.evaluate(v.input);assert.equal(roundTrip.result.annualEmployerCost,v.result.annualEmployerCost);
 const raw={...C.example,incumbents:[{id:'E17',currentSalary:25000,progressionEvidence:'Documented skill evidence'}]};
 const clean=C.evaluate(raw);raw.incumbents[0].progressionEvidence='person@example.test';assert.equal(clean.input.incumbents[0].progressionEvidence,'Documented skill evidence');
});
test('optional organization alias format is enforced and survives scenario reload without any admin bypass',()=>{
 const rosterIdPolicy={prefix:'EMP-',digits:4};
 const v=C.evaluate({...C.example,rosterIdPolicy,rosterCsv:'id,currentSalary\nEMP-0001,25000'});assert.deepEqual(v.input.rosterIdPolicy,rosterIdPolicy);assert.deepEqual(C.evaluate(v.input).input.rosterIdPolicy,rosterIdPolicy);
 assert.throws(()=>C.parseRoster('id,currentSalary\nE17,25000',rosterIdPolicy),/row 2.*organization pseudonym format/);
 assert.throws(()=>C.evaluate({...C.example,rosterIdPolicy,incumbents:[{id:'E17',currentSalary:25000}]}),/organization pseudonym format/);
 for(const invalid of [{prefix:'bad.*',digits:4},{prefix:'EMP-',digits:0},{prefix:'EMP-',digits:4,adminOverride:true}])assert.throws(()=>C.evaluate({...C.example,rosterIdPolicy:invalid,incumbents:[{id:'EMP-0001',currentSalary:25000}]}),/pseudonym policy/);
 assert.throws(()=>C.evaluate({...C.example,incumbents:[{id:'EMP-0001',currentSalary:25000},{id:'emp-0001',currentSalary:23000}]}),/unique/);
});
const saudi={asOf:'2026-10-05',regime:'saudi-new',applicabilityConfirmed:true,sanedEligible:true,housingMonthly:0,otherMonthly:0,contributoryExtraMonthly:0,medicalAnnual:0,serviceYears:0};
test('official new GOSI progression uses July 1 rate boundaries distinct from July 3 eligibility',()=>{
 const dates=[['2024-07-03',9],['2025-06-30',9],['2025-07-01',9.5],['2026-06-30',9.5],['2026-07-01',10],['2027-06-30',10],['2027-07-01',10.5],['2027-08-01',10.5],['2028-06-30',10.5],['2028-07-01',11],['2028-12-31',11]];
 for(const [asOf,rate] of dates){const b=C.saudiCost(10000,'monthly',{...saudi,asOf});assert.equal(b.pensionRate,rate,asOf);assert.equal(b.employerRatePercent,rate+2.75);assert.equal(b.annualGosi,120000*(rate+2.75)/100);assert.equal(b.rateReview.systemEffectiveDate,'2024-07-03');assert.equal(b.rateReview.supportedThrough,'2028-12-31');}
});
test('existing and non-Saudi registration rates do not inherit new-system pension increases',()=>{
 for(const asOf of ['2027-08-01','2028-12-31']){
  const existing=C.saudiCost(10000,'monthly',{...saudi,asOf,regime:'saudi-existing'});assert.equal(existing.pensionRate,9);assert.equal(existing.employerRatePercent,11.75);
  const foreign=C.saudiCost(10000,'monthly',{...saudi,asOf,regime:'non-saudi'});assert.equal(foreign.pensionRate,0);assert.equal(foreign.sanedRate,0);assert.equal(foreign.employerRatePercent,2);
 }
});
test('reviewed date horizon, malformed dates and annualization are explicit',()=>{
 for(const asOf of ['2024-07-02','2029-01-01','2030-07-01','2028-02-30','2027-2-01','2028-07-01T00:00:00'])assert.throws(()=>C.saudiCost(10000,'monthly',{...saudi,asOf}),/source review/);
 const v=C.saudiCost(120000,'annual',{...saudi,asOf:'2028-07-01'});assert.equal(v.monthlyBasic,10000);assert.equal(v.annualGosi,16500);assert.match(v.notice,/not a blended calendar-year budget/);assert.match(v.notice,/not a legal expiry/);
});
