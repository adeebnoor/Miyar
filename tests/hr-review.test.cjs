const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../dist/engine.js'),P=require('../dist/position.js'),W=require('../dist/workspace.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/data.js'),'utf8'),context);const roles=context.window.MIYAR_DATA.roles;
const classify=objective=>E.classify({objective,domain:'all',seniority:'professional'},roles);
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};

test('existing Arabic, English and feminine titles work without invented task evidence',()=>{
 for(const title of ['مهندس مدني','مُهندس مَدَني','مهندسة مدنية','مدني مهندس','Civil Engineer','engineer civil']){const r=classify(title);assert.equal(r.kind,'match',title);assert.equal(r.role.code,'214201');assert.equal(r.basis,'title');assert.equal(r.groups.length,0);assert.equal(r.evidenceCount,0);}
});
test('occupation lookup normalizes Arabic and Persian digits; education codes stay distinct',()=>{
 for(const code of ['214201','٢١٤٢٠١','۲۱۴۲۰۱']){const r=classify(code);assert.equal(r.role.code,'214201');assert.equal(r.basis,'occupation-code');}
 assert.equal(classify('٠٧٣٢٠١').kind,'outside');assert.equal(E.search('٠٧٣٢٠١',roles)[0].basis,'education-code');assert.equal(classify('999999').kind,'outside');
});
test('catalog search accepts reversed words, aliases and partial codes',()=>{
 for(const query of ['مدني مهندس','مهندسة مدنية','٢١٤٢','engineer civil'])assert.equal(E.search(query,roles)[0].role.id,'civil');
});
test('generic finance, web work, IT maintenance and manufacturing do not become engineering jobs',()=>{
 for(const query of ['تحسين الأداء وتوزيع الموارد ومتابعة العمل في الإدارة المالية','تحسين العمليات المالية وتقليل الهدر وتطوير مؤشرات الأداء','تحسين موقع الويب ومتابعة تنفيذ خطط التسويق','Improve website specifications and project delivery','Plan equipment maintenance and improve reliability in IT support','Improve production safety and manufacturing quality'])assert.equal(classify(query).kind,'outside',query);
});
test('negated engineering tasks are referred for clarification rather than counted positively',()=>{
 for(const query of ['لا نحتاج إلى صيانة المعدات الميكانيكية','Not mechanical maintenance, only financial analysis'])assert.equal(classify(query).kind,'ambiguous');
});
test('editing reviewed role content preserves evidence but requires fresh business and evaluation review',()=>{
 const original={...P.sample('en'),businessReviewed:true,businessReviewer:'Example reviewer',businessReviewDate:'2026-09-12',method:'Internal method',evaluator:'Example evaluator',evaluationDate:'2026-09-12',score:'100',grade:'G7',rationale:'Evidence ref 1'};
 const changed=P.change(original,'responsibilities','Prepare monthly forecasts\nReview budget variances\nAdvise cost owners');const pkg=P.packageRecord(changed,null,'en');
 assert.equal(original.businessReviewed,true);assert.equal(changed.businessReviewed,false);assert.equal(pkg.jobDescription.status,'needs-review');assert.equal(pkg.evaluation.status,'needs-review');assert.equal(pkg.evaluation.grade,'G7');assert.equal(pkg.positionApproval,'pending');
});
test('review dates must exist in the calendar and cannot be in the future',()=>{
 for(const date of ['2026-02-30','2026-13-01','9999-01-01','today',' '])assert.equal(P.validDate(date),false,date);
 assert.equal(P.validDate('2024-02-29'),true);const i={...P.sample(),businessReviewed:true,businessReviewer:'Example',businessReviewDate:'2026-02-30'};assert.equal(P.packageRecord(i,null).jobDescription.status,'draft');
});
test('draft save survives reopening and updates the same internal position ID',()=>{
 const store=storage(),i=P.sample('ar'),first=W.save(store,i);assert.match(first.id,/^MJR-/);assert.equal(first.revision,1);assert.equal(W.read(store).records[0].input.title,i.title);
 const second=W.save(store,{...i,title:'محلل عمليات'},first);assert.equal(second.id,first.id);assert.equal(second.revision,2);assert.equal(W.read(store).records.length,1);assert.equal(W.search('محلل',W.read(store).records).length,1);
 assert.throws(()=>W.save(store,i,first),/conflict/);
});
test('storage corruption and write failure are surfaced without destroying the form or old data',()=>{
 const store=storage();store.setItem(W.KEY,'{broken');assert.equal(W.read(store).error,'storage');assert.throws(()=>W.save(store,P.sample()),/storage/);assert.equal(store.getItem(W.KEY),'{broken');
 const i=P.sample();assert.throws(()=>W.save({getItem:()=>null,setItem:()=>{throw Error('quota');}},i),/quota/);assert.equal(i.title,P.sample().title);
});
test('export-import round trip keeps editable inputs and requires re-review of reported outcomes',()=>{
 const i={...P.sample('en'),businessReviewed:true,businessReviewer:'Example',businessReviewDate:'2026-09-12'};const data={...P.packageRecord(i,null,'en'),editableDraft:W.transfer(i)};const imported=W.importDraft(JSON.stringify(data));
 assert.equal(imported.title,i.title);assert.equal(imported.successMeasures,i.successMeasures);assert.equal(imported.businessReviewed,false);assert.equal(imported.reviewStale,true);assert.equal(P.packageRecord(imported,null).occupationMapping.saudiCode,null);
});
test('invalid, oversized and untrusted import properties do not enter the editable model',()=>{
 for(const raw of ['{}','{"schema":"unknown"}','x'.repeat(150001)])assert.throws(()=>W.importDraft(raw));
 const payload=JSON.stringify({...W.transfer(P.sample()),input:{...P.sample(),title:{unsafe:true}}});assert.throws(()=>W.importDraft(payload));
 const safe=W.importDraft(JSON.stringify({...W.transfer(P.sample()),input:{...P.sample(),saudiCode:'FAKE',__proto__:{polluted:true}}}));assert.equal(safe.saudiCode,undefined);assert.equal(safe.polluted,undefined);
});
test('quality review flags duplicate duties and self-reporting; overlap excludes the draft itself',()=>{
 const i=P.sample(),store=storage();i.responsibilities='تحليل العمليات\nتحليل العمليات\nتوثيق النتائج';i.manager=i.title;const issues=W.quality(i).map(x=>x.id);assert.ok(issues.includes('duplicate-tasks'));assert.ok(issues.includes('reporting'));
 const saved=W.save(store,i);assert.equal(W.overlaps(i,[saved],roles,null).saved.length,1);assert.equal(W.overlaps(i,[saved],roles,saved.id).saved.length,0);assert.equal(W.overlaps(i,[],roles,null).reference[0].role.id,'industrial');
});
