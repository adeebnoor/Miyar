const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');

test('home keeps one guided objective input and two clear starting paths',()=>{
  const src=fs.readFileSync(path.join(dist,'landing.js'),'utf8');
  assert.match(src,/id="lp-guided-form"/);
  assert.match(src,/id="lp-guided-objective"/);
  assert.match(src,/href="#enterprise\/create"/);
  assert.match(src,/sessionStorage\.setItem\('miyar-guided-objective-v1'/);
});

test('guided objective is consumed by the strategic engine and auto-submitted',()=>{
  const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
  assert.match(src,/GUIDE_KEY='miyar-guided-objective-v1'/);
  assert.match(src,/sessionStorage\.removeItem\(GUIDE_KEY\)/);
  assert.match(src,/new Event\('submit',\{bubbles:true,cancelable:true\}\)/);
});

test('release layer no longer overwrites the simplified hero or adds phase links to primary nav',()=>{
  const src=fs.readFileSync(path.join(dist,'release-home.js'),'utf8');
  assert.doesNotMatch(src,/title\.innerHTML/);
  assert.doesNotMatch(src,/dataReleaseNav|dataset\.releaseNav/);
});

test('deployment is gated by free real-browser tests',()=>{
  const src=fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8');
  assert.match(src,/@playwright\/test@1\.55\.0/);
  assert.match(src,/needs: \[server-test, ui-test, e2e-test\]/);
});


test('long objectives use the OD family detector instead of being dropped by a six-word limit',()=>{
  const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
  assert.doesNotMatch(src,/words\.length>6/);
  assert.match(src,/MiyarODEngine/);
  assert.match(src,/detectedBusinessFamily/);
  assert.match(src,/family\.ssco/);
  assert.match(src,/No confident occupation reference yet/);
});


test('HR public directory is derived from the bundled HR taxonomy units and support roles',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path.join(dist,'classifications/ssco-2019.json'),'utf8'));
 const parents=new Set(['1212','2423','2424']),support=new Set(['333306','334103','431300','441601','441602','441603','441604']);
 const rows=taxonomy.nodes.filter(x=>x.level==='occupation'&&(parents.has(String(x.parent))||support.has(String(x.code))));
 assert.ok(rows.length>=50,'expected broad HR taxonomy coverage');
 const titles=rows.map(x=>x.titleAr).join(' ');
 for(const expected of ['مدير تنفيذي للموارد البشرية','مدير عمليات الموارد البشرية','أخصائي توظيف','أخصائي مكافآت','أخصائي مواهب','اخصائي رواتب وبدلات','محلل وظائف','أخصائي تدريب','اختصاصي تطوير موارد بشرية','فني موارد بشرية','كاتب رواتب','كاتب شؤون موظفين'])assert.match(titles,new RegExp(expected));
 const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
 assert.match(src,/HR_PARENT_UNITS/);assert.match(src,/1212/);assert.match(src,/2423/);assert.match(src,/2424/);
});


test('HR payroll recommendation separates the business title from the classification title',()=>{
 const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
 assert.match(src,/payroll:\{ar:'أخصائي رواتب'/);
 assert.match(src,/code:'242322'/);
 assert.match(src,/CLASSIFICATION REFERENCE/);
});


test('HR expected-output engine grounds every specialist and manager mapping in the bundled taxonomy',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path.join(dist,'classifications/ssco-2019.json'),'utf8'));
 const codes=new Set(taxonomy.nodes.filter(x=>x.level==='occupation').map(x=>String(x.code)));
 const required=['242303','121202','121201','242305','121206','242322','121210','242306','121207','242307','121208','242302','121215','242319','121203','242402','121212','242404','121213','242109','121205','242323','121204','242310','121214','441602'];
 for(const code of required)assert.ok(codes.has(code),'missing mapped HR source code '+code);
 const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
 for(const id of ['payroll','recruitment','rewards','talent','employeeRelations','workforce','learning','hrDevelopment','od','jobAnalysis','personnel','hrOperations','attendance'])assert.match(src,new RegExp(id));
 assert.match(src,/function hrLevel/);
 assert.match(src,/Preliminary recommendation/);
});
