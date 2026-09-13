const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/data.js'),'utf8'),context);
const data=context.window.MIYAR_DATA;
const E=require('../dist/engine.js');
const request=(objective,extra={})=>({objective,domain:'all',seniority:'professional',constraints:'',...extra});

test('five scenarios preserve the matching title and source codes',()=>{
 for(const role of data.roles){
  const input=request(role.scenario),r=E.classify(input,data.roles);
  assert.equal(r.kind,'match');assert.equal(r.role.id,role.id);
  const c=E.decisionRecord(r,input,'test');
  assert.equal(c.role.saudiCode,role.code);assert.equal(c.role.educationCode,role.educationCode);assert.equal(c.role.titleEn,role.titleEn);
 }
});
test('unknown AI role has no invented code',()=>{
 const i=request(data.emergingObjective),r=E.classify(i,data.roles);
 assert.equal(r.kind,'outside');assert.equal(E.decisionRecord(r,i,'test').role,null);
});
test('unknown domain cannot receive an engineering code',()=>{
 assert.equal(E.classify(request(data.roles[0].scenario,{domain:'other'}),data.roles).kind,'outside');
});
test('single task term is insufficient',()=>{
 assert.equal(E.classify(request('نحتاج إلى دور يهتم بالمواد فقط'),data.roles).kind,'outside');
});
test('equal task evidence requires disambiguation',()=>{
 const r=E.classify(request('soil construction mechanical maintenance'),data.roles);
 assert.equal(r.kind,'ambiguous');assert.equal(r.candidates.length,2);
});
test('wrong selected domain cannot force an unrelated title',()=>{
 assert.notEqual(E.classify(request(data.roles[1].scenario,{domain:'mining'}),data.roles).kind,'match');
});
test('constraints and leadership remain review items',()=>{
 const i=request(data.roles[0].scenario,{seniority:'leadership',constraints:'دون عمل ميداني'}),r=E.classify(i,data.roles);
 assert.equal(r.kind,'match');assert.equal(r.role.titleEn,'Industrial Engineer');assert.equal(r.role.code,'214116');
 assert.ok(r.notes.some(x=>x.includes('قيادية')));assert.ok(r.notes.some(x=>x.includes('لم يتحقق')));assert.equal(r.review,'pending');
});
test('English task request works without a confidence percentage',()=>{
 const r=E.classify(request('Improve mechanical reliability with preventive maintenance of equipment.'),data.roles);
 assert.equal(r.kind,'match');assert.equal(r.role.id,'mechanical');assert.equal(r.confidence,undefined);
});
test('blank and underspecified requests are rejected',()=>{
 for(const objective of ['', '   ', 'مهندس', 'هدف قصير'])assert.equal(E.classify(request(objective),data.roles).kind,'invalid');
});
test('Arabic diacritics and hamza do not prevent matching',()=>{
 const r=E.classify(request('تَحْسِين الكَفَاءَة وتَقْلِيل الهَدْر وتَطْوِير مُؤَشِّرَات الأداء'),data.roles);
 assert.equal(r.kind,'match');assert.equal(r.role.id,'industrial');
});
test('export preserves input and demo limitations',()=>{
 const i=request(data.roles[2].scenario,{constraints:'مراجعة عبء العمل'}),r=E.classify(i,data.roles);r.review='acknowledged';
 const c=E.decisionRecord(r,i,'specific-id');
 assert.equal(c.id,'specific-id');assert.equal(c.input.constraints,i.constraints);assert.equal(c.reviewStatus,'acknowledged');assert.equal(c.mode,'deterministic-demo');assert.ok(c.limitations.length>=4);
});

