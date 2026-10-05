const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/compensation-engine.js');
const saudi={mode:'saudi',asOf:'2026-10-05',regime:'saudi-existing',applicabilityConfirmed:true,sanedEligible:true,housingMonthly:0,otherMonthly:0,contributoryExtraMonthly:0,medicalAnnual:0,serviceYears:0};

test('identifier screening rejects mobile and passport IDs after the same normalization used for storage',()=>{
 for(const [id,pattern] of [
  ['501234567','mobile'],[' 501234567 ','mobile'],['\t٥٠١٢٣٤٥٦٧\t','mobile'],
  ['A12345678','passport'],[' A12345678 ','passport'],['ab1234567','passport'],
  ['PASSPORT-A12345678','passport'],[' PASSPORT-A12345678 ','passport']
 ]){
  assert.equal(C.privacyPattern(id,{identifier:true}),pattern,id);
  for(const run of [()=>C.parseRoster('id,currentSalary\n"'+id+'",25000'),()=>C.evaluate({...C.example,incumbents:[{id,currentSalary:25000}]})])
   assert.throws(run,e=>e.code==='ROSTER_PRIVACY'&&e.pattern===pattern&&!e.message.includes(id));
 }
 for(const text of ['501234567','A12345678','PASSPORT-A12345678'])assert.equal(C.privacyPattern(text),null,'new patterns apply only to identifiers');
});

test('functional identifiers and short pseudonyms remain usable with surrounding whitespace',()=>{
 for(const id of ['Pos-Senior-Accountant','EMP-0001','E17']){
  assert.equal(C.privacyPattern(' '+id+' ',{identifier:true}),null);
  assert.equal(C.parseRoster('ID;CurrentSalary\n" '+id+' ";٢٥٠٠٠')[0].id,id);
  assert.equal(C.evaluate({...C.example,incumbents:[{id:' '+id+' ',currentSalary:25000}]}).input.incumbents[0].id,id);
 }
 assert.throws(()=>C.parseRoster('id,currentSalary\nUnknown-Person,25000'),e=>e.code==='ROSTER_PRIVACY'&&e.pattern==='name-like-identifier');
});

test('common CSV delimiters, quoted thousands and Indian digits all produce the same salary',()=>{
 for(const csv of [
  'id;currentSalary\nE17;25000','ID,CurrentSalary\nE17,25000',
  'iD,cUrReNtSaLaRy\nE17,"25,000"','ID;CurrentSalary\nE17;٢٥٠٠٠',
  'ID;CurrentSalary\nE17;"٢٥٬٠٠٠"','ID;CurrentSalary\nE17;۲۵۰۰۰'
 ])assert.equal(C.evaluate({...C.example,rosterCsv:csv}).input.incumbents[0].currentSalary,25000,csv);
 const row=C.parseRoster('ID;CurrentSalary;progressionEvidence\r\nE17;"25,000";"Documented ""senior"" proficiency; reviewed"')[0];
 assert.equal(row.progressionEvidence,'Documented "senior" proficiency; reviewed');
 assert.throws(()=>C.parseRoster('id,ID,currentSalary\nE17,E18,25000'),/template headers/);
 assert.throws(()=>C.parseRoster('id,currentSalary\nE17,"25,000'),/Unclosed CSV quote/);
});

test('Indian digits and quoted thousands are accepted throughout Saudi CSV cost columns',()=>{
 const csv='ID;CurrentSalary;regime;HousingMonthly;otherMonthly;contributoryExtraMonthly;medicalAnnual;serviceYears;sanedEligible;eosWageMonthly\nE17;٢٥٠٠٠;saudi-existing;"٢٬٥٠٠";٥٠٠;١٠٠;"٤٬٠٠٠";٤;true;٢٨٠٠٠';
 const actual=C.evaluate({...C.example,oncostPercent:0,employerCosts:saudi,rosterCsv:csv});
 const expected=C.evaluate({...C.example,oncostPercent:0,employerCosts:{...saudi,housingMonthly:2500,otherMonthly:500,contributoryExtraMonthly:100,medicalAnnual:4000,serviceYears:4,eosWageMonthly:28000},incumbents:[{id:'E17',currentSalary:25000}]});
 assert.equal(actual.result.annualEmployerCost,expected.result.annualEmployerCost);
 assert.equal(actual.incumbents[0].employerBreakdown.housingMonthly,2500);
});

test('partial Saudi CSV cost columns override only the supplied components',()=>{
 const actual=C.evaluate({...C.example,oncostPercent:0,employerCosts:saudi,rosterCsv:'id,currentSalary,housingMonthly\nE17,25000,"2,500"'});
 assert.equal(actual.incumbents[0].employerBreakdown.housingMonthly,2500);
 assert.equal(actual.incumbents[0].employerBreakdown.otherMonthly,0);
 const regimeOnly=C.evaluate({...C.example,oncostPercent:0,employerCosts:saudi,rosterCsv:'id,currentSalary,regime\nE17,25000,non-saudi'});
 assert.equal(regimeOnly.incumbents[0].employerBreakdown.regime,'non-saudi');
 assert.equal(regimeOnly.incumbents[0].employerBreakdown.housingMonthly,0);
});

test('Saudi salary and housing numeric strings are converted before arithmetic and invalid numbers fail',()=>{
 const raw={...saudi,housingMonthly:'2500'};
 assert.deepEqual(C.saudiCost('10000','monthly',raw),C.saudiCost(10000,'monthly',{...raw,housingMonthly:2500}));
 assert.equal(C.saudiCost('10000','monthly',raw).annualEmployerCost,173875);
 for(const salary of [-1,NaN,Infinity,-Infinity,'not a salary','',null])assert.throws(()=>C.saudiCost(salary,'monthly',raw),/positive finite/);
 for(const housingMonthly of [-1,NaN,Infinity,'not housing','',false])assert.throws(()=>C.saudiCost('10000','monthly',{...raw,housingMonthly}),/Monthly cash housing must be a valid number/);
});
