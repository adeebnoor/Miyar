const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../dist/classifications/framework-example.json');
const R=require('../dist/classifications/reference-maintenance.json');
const S=require('../dist/classifications/ssco-2019.json');
const E=require('../dist/classifications/education-2020.json');
const {customGrade}=require('../dist/enterprise-core');

const answers=level=>Object.fromEntries(F.factors.map(f=>[f.id,String(level)]));

test('expert illustrative scale preserves zero and 1000, with growing increments and strictly wider upper grades',()=>{
 assert.equal(F.illustrative,true);assert.equal(F.calibrationStatus,'independent-expert-and-organization-validation-required');
 assert.equal(customGrade(F,answers(1)).points,0);assert.equal(customGrade(F,answers(6)).points,1000);
 assert.equal(customGrade(F,answers(1)).band.id,'G01');assert.equal(customGrade(F,answers(6)).band.id,'G12');
 for(const factor of F.factors){
  const gaps=factor.levels.slice(1).map((l,i)=>l.points-factor.levels[i].points);
  assert.ok(gaps.every(x=>x>0));
  for(let i=1;i<gaps.length;i++)assert.ok(Math.abs(gaps[i]/gaps[i-1]-1.15)<.003,'Successive increments grow about 15%, preserving the zero baseline');
  let last=-1;for(const level of factor.levels){const a=answers(1);a[factor.id]=level.id;const grade=customGrade(F,a);assert.ok(grade.points>last);last=grade.points;}
 }
 const widths=F.bands.map(b=>b.max-b.min+1);
 assert.equal(widths.reduce((a,b)=>a+b,0),1001);
 assert.ok(widths.every((w,i)=>!i||w>widths[i-1]));assert.ok(widths.at(-1)>4*widths[0]);
 for(let score=0;score<=1000;score++)assert.equal(F.bands.filter(b=>b.min<=score&&score<=b.max).length,1,'Every rounded total has exactly one grade');
 assert.match(F.notice,/independent expert calibration/);assert.match(F.notice,/not automatically replaced/);
});

test('a fractional weighted half point is rounded consistently before selecting a widening grade',()=>{
 const a=answers(1);for(const id of ['autonomy','communication','financial'])a[id]='4';
 const result=customGrade(F,a);
 assert.equal(result.breakdown.reduce((total,f)=>total+f.points,0),154.5);
 assert.equal(result.points,155);assert.equal(result.band.id,'G04');
});

test('official reference discoveries remain pending migration, preserving every supplied occupation and specialization',()=>{
 assert.equal(R.status,'supplied-snapshots-not-certified-latest');
 assert.deepEqual(R.currentSnapshots,[S.id,E.id]);
 assert.equal(S.nodes.filter(x=>x.level==='occupation').length,5041);assert.equal(E.fields.length,599);
 const candidate=R.reviewCandidates.find(x=>x.id==='ssco-2023-official-master-review');
 assert.equal(candidate.sourceVerified,true);assert.equal(candidate.edition,'2023');assert.equal(candidate.activationAllowed,false);
 assert.equal(candidate.completeForCurrentApplicability,false);assert.equal(candidate.observedCounts.occupations,2048);
 assert.equal(candidate.observedCounts.duplicates,0);assert.equal(candidate.observedCounts.units,433);
 assert.match(candidate.pipelineCompatibility,/sourceSheet\/sourceRow/);assert.match(candidate.pipelineCompatibility,/Do not relabel/);
 const guide=R.sourceChecks.find(x=>x.documentEdition==='2025-01');
 assert.equal(guide.sourcePages,21);assert.equal(guide.bytes,774913);assert.match(guide.finding,/2,122/);assert.match(guide.scope,/not-full-code-table/);
 assert.equal(guide.sha256,'c87dab525c1808927e6eb4f3a8d55b402018f2cf8eab292904ce2c9d41263065');
 assert.equal(candidate.sourceSha256,'fc310aa1da81a465bd0f830ce3fe36f755a1f4019dd0d2f8270723b89990411a');
 const education=R.reviewCandidates.find(x=>x.kind==='education');assert.equal(education.sourceVerified,false);assert.equal(education.activationAllowed,false);assert.equal(education.sourceSha256,null);
 assert.match(R.finding,/not proof/);assert.ok(R.sourceChecks.every(x=>x.checkedOn===R.checkedOn));
 assert.ok(R.officialSources.every(x=>/^(stats|www\.stats|moe|www\.moe|www\.hrsd)\.gov\.sa$/.test(new URL(x).hostname)));
});
