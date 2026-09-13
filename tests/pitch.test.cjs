const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),dist=path.join(__dirname,'../dist');
const tick=()=>new Promise(r=>setImmediate(r));
async function viewer(url='?lang=ar#1',fail=false){
 const dom=new JSDOM(fs.readFileSync(path.join(dist,'pitch.html'),'utf8'),{url:'https://example.test/Miyar/pitch.html'+url,runScripts:'outside-only'});
 dom.window.fetch=async()=>({ok:!fail,json:async()=>JSON.parse(fs.readFileSync(path.join(dist,'pitch/content.json')))});
 dom.window.eval(fs.readFileSync(path.join(dist,'pitch/viewer.js'),'utf8'));await tick();return dom;
}
test('pitch preserves a shared slide when switching languages; all slides and downloads resolve',async()=>{
 const dom=await viewer('?lang=ar#6'),w=dom.window,$=id=>w.document.getElementById(id);
 try{
  assert.equal($('deck').hidden,false);assert.match($('slide').src,/ar-06.jpg$/);assert.match($('transcript').textContent,/مهندس ميكانيكي/);
  $('language').click();assert.equal(w.document.documentElement.dir,'ltr');assert.equal(w.location.hash,'#6');assert.match($('slide').src,/en-06.jpg$/);assert.match($('transcript').textContent,/Mechanical engineer/);
  $('next').click();assert.equal(w.location.hash,'#7');$('previous').click();assert.equal(w.location.hash,'#6');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal($('next').disabled,true);assert.equal(w.location.hash,'#18');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal($('previous').disabled,true);
  for(const lang of ['en','ar']){
   if(w.document.documentElement.lang!==lang)$('language').click();
   for(const option of $('choose').options){$('choose').value=option.value;$('choose').dispatchEvent(new w.Event('change'));assert.ok(fs.existsSync(path.join(dist,$('slide').getAttribute('src'))));assert.ok($('transcript').textContent.length>40);}
   for(const id of ['pdf','pptx']){const file=path.join(dist,$(id).getAttribute('href'));assert.ok(fs.statSync(file).size>10000);}
  }
 }finally{dom.window.close();}
});
test('invalid shared slide recovers to cover and failed loading offers a PDF',async()=>{
 for(const hash of ['#999','#bad','#-1']){const dom=await viewer('?lang=ar'+hash);assert.equal(dom.window.location.hash,'#1');dom.window.close();}
 const dom=await viewer('?lang=en',true);assert.equal(dom.window.document.getElementById('status').hidden,false);assert.match(dom.window.document.querySelector('#status a').href,/Miyar-Pitch-EN.pdf$/);dom.window.close();
});
