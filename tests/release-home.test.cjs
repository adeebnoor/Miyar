const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const dir=path.join(__dirname,'../dist');

test('homepage release layer reflects OD, manpower and compensation with direct routes',async()=>{
 const dom=new JSDOM(`<!doctype html><html lang="en"><body><div id="view-home"><main><header><nav class="lp-nav"><a href="#enterprise/overview">Workspace</a></nav></header><section class="lp-hero"><div class="lp-hero-copy"><span class="lp-eyebrow">Old</span><h1>Old</h1><p>Old</p><p class="lp-caption">Old</p></div></section><section class="lp-proof"></section></main></div></body></html>`,{runScripts:'outside-only',url:'https://example.test/Miyar/#home',pretendToBeVisual:true});
 try{
  const w=dom.window;w.eval(fs.readFileSync(path.join(dir,'release-home.js'),'utf8'));w.MiyarReleaseHome.apply();
  const suite=w.document.getElementById('miyar-release-home');assert.ok(suite);
  assert.match(suite.textContent,/OD & Job Architecture/);assert.match(suite.textContent,/Manpower Planning/);assert.match(suite.textContent,/Compensation/);
  assert.ok(suite.querySelector('a[href="#enterprise/create"]'));assert.ok(suite.querySelector('a[href="#enterprise/manpower"]'));assert.ok(suite.querySelector('a[href="#enterprise/compensation"]'));
  assert.match(w.document.querySelector('.lp-hero-copy').textContent,/plan capacity/i);assert.match(w.document.querySelector('.lp-hero-copy').textContent,/compensation/i);
  assert.equal(w.document.querySelectorAll('.lp-nav [data-release-nav]').length,3);
 }finally{dom.window.close();}
});

test('index loads the final homepage assets after the three phase workbenches',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.match(html,/release-home\.css/);assert.match(html,/release-home\.js/);assert.match(html,/manpower-workbench\.js/);assert.match(html,/compensation-workbench\.js/);
 assert.match(html,/Strategy → OD → Job Evaluation → Manpower Planning → Compensation → Approval/);
});