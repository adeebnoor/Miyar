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


test('curated HR public directory contains only real occupation codes from the bundled classification',()=>{
 const taxonomy=JSON.parse(fs.readFileSync(path.join(dist,'classifications/ssco-2019.json'),'utf8'));
 const occupations=new Map(taxonomy.nodes.filter(x=>x.level==='occupation').map(x=>[String(x.code),x.titleAr]));
 const expected=['121202','121203','121206','121210','121212','121213','121215','121944','242109','242302','242303','242305','242310','242318','242319','242320','242321','242322','242401','242402','242404','242406','333301','333306','334103','431300','441604'];
 for(const code of expected)assert.ok(occupations.has(code),'missing HR occupation '+code);
 const src=fs.readFileSync(path.join(dist,'demo-runtime-v5.js'),'utf8');
 for(const code of expected)assert.match(src,new RegExp(code));
});
