const test=require('node:test'),assert=require('node:assert/strict');
const product=require('../dist/enterprise-product.js'),C=require('../dist/enterprise-core.js');

test('effort scenarios distinguish illustrative time value, missing costs, zero costs and negative outcomes',()=>{
 const values={cases:'40',before:'120',after:'90',hourly:'150',annualFee:'',setupFee:''};
 const r=product.estimate(values);
 assert.equal(r.monthlyHours,20);assert.equal(r.annualHours,240);assert.equal(r.annualTimeValue,36000);
 assert.equal(r.firstYearNet,null);assert.equal(r.firstYearROI,null);
 const zero=product.estimate({...values,annualFee:'0',setupFee:'0'});
 assert.equal(zero.firstYearNet,36000);assert.equal(zero.firstYearROI,null);
 const paid=product.estimate({...values,annualFee:'20000',setupFee:'5000'});
 assert.equal(paid.firstYearNet,11000);assert.equal(paid.firstYearROI,44);
 const slower=product.estimate({...values,after:'150',annualFee:'0',setupFee:'0'});
 assert.equal(slower.annualTimeValue,-36000);assert.equal(slower.firstYearNet,-36000);
 for(const invalid of [{before:''},{before:0},{cases:'2.5'},{hourly:'NaN'},{after:-1},{annualFee:-1},{setupFee:Infinity}])assert.throws(()=>product.estimate({...values,...invalid}));
});

test('pilot plans enforce an explicit bounded scope and escape organization text',()=>{
 const html=product.pilotPlan({organization:'<script>alert(1)</script>',departments:'2',positions:'20'},'en');
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.match(html,/not sent to the Miyar team/);assert.match(html,/Week 4: Adoption decision/);
 assert.match(html,/not a quotation/);
 for(const v of [{departments:0,positions:20},{departments:2.5,positions:20},{departments:2,positions:10001}])assert.throws(()=>product.pilotPlan(v));
});

test('matrix parsing cannot silently drop rows or extra cells',()=>{
 assert.throws(()=>C.parseMatrix(Array(101).fill('Task|Person').join('\n'),['task','person']),/100/);
 assert.throws(()=>C.parseMatrix('Task|Person|Lost data',['task','person']),/extra columns/);
 assert.deepEqual(C.parseMatrix('Task | Person\nNext |',['task','person']),[{task:'Task',person:'Person'},{task:'Next',person:''}]);
});
