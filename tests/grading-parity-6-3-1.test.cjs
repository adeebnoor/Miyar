const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const F=require('../dist/classifications/framework-example.json');
test('browser and server return the same score and grade at a half-point boundary and across geometric levels',()=>{
  const context=vm.createContext({window:{},localStorage:{}});
  vm.runInContext(fs.readFileSync('dist/enterprise-core.js','utf8'),context);
  const vectors=Array.from({length:6},(_,i)=>Object.fromEntries(F.factors.map(f=>[f.id,String(i+1)])));
  vectors.push(Object.fromEntries(F.factors.map(f=>[f.id,['autonomy','communication','financial'].includes(f.id)?'4':'1'])));
  vectors.push(Object.fromEntries(F.factors.map((f,i)=>[f.id,String(i%6+1)])));
  const script="import json,sys\nfrom server.domain import grade,DEFAULT_FRAMEWORK\nv=json.loads(sys.stdin.read())\nprint(json.dumps([{'points':(r:=grade(DEFAULT_FRAMEWORK,a,dict.fromkeys(a,'Recorded role evidence')))['points'],'band':r['band']['id']} for a in v]))";
  const server=spawnSync('python3',['-c',script],{input:JSON.stringify(vectors),encoding:'utf8'});
  assert.equal(server.status,0,server.stderr);
  const actual=vectors.map(a=>{const r=context.window.MiyarEnterpriseCore.customGrade(F,a);return {points:r.points,band:r.band.id};});
  assert.deepEqual(actual,JSON.parse(server.stdout));
  assert.equal(actual[6].points,155,'154.5 must round upward consistently');
});
