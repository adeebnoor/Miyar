const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),dist=path.join(__dirname,'../dist');
const catalog=JSON.parse(fs.readFileSync(path.join(dist,'classifications/ssco-2019.json'),'utf8'));
const framework=JSON.parse(fs.readFileSync(path.join(dist,'classifications/framework-example.json'),'utf8'));
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};

async function administrator(locale){
 const errors=[],requests=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM('<main id="enterprise"></main>',{url:'https://example.test/Miyar/#enterprise/connection',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console}),w=dom.window;require('./local-workspace.cjs')(w);
 let configured=structuredClone(framework);
 const base='https://fixture-api.example.test',response=value=>({ok:true,status:200,json:async()=>value});
 w.structuredClone=structuredClone;w.AbortSignal=AbortSignal;w.confirm=()=>true;w.MIYAR_CONFIG={apiBase:base};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options={})=>{
  const name=String(url);if(!name.startsWith(base))return response(JSON.parse(fs.readFileSync(path.join(dist,name),'utf8')));
  const route=new URL(name).pathname,body=options.body?JSON.parse(options.body):undefined;requests.push({route,method:options.method||'GET',body});
  if(route.endsWith('/auth/login'))return response({accessToken:'synthetic-administrator-token'});
  if(route.endsWith('/me'))return response({id:'fixture-admin',name:'Synthetic administrator',role:'admin',organization:{id:'fixture-organization',name:'Synthetic organization'}});
  if(route.endsWith('/departments'))return response([{id:'fixture-department',name:'Synthetic department'}]);
  if(route.endsWith('/settings'))return response({branding:{nameAr:'جهة اختبار',nameEn:'Synthetic organization',color:'#146954',footer:'Synthetic only'},framework:configured,workflow:[]});
  if(route.endsWith('/organization/taxonomy/export'))return response(catalog);
  if(route.endsWith('/positions'))return response({items:[],total:0});
  if(route.endsWith('/integrations/status'))return response({connectors:[],outboundWebhookConfigured:false});
  if(route.endsWith('/users'))return response([]);
  if(route.endsWith('/settings/framework/preview'))return response({nextVersion:2});
  if(route.endsWith('/settings/framework')){configured={...body.framework,version:2};return response({framework:configured});}
  throw Error('Unexpected synthetic API request: '+route);
 };
 for(const name of ['enterprise-document.js','enterprise-core.js','enterprise-product.js','enterprise-service.js','enterprise.js'])w.eval(fs.readFileSync(path.join(dist,name),'utf8'));
 await w.MiyarEnterprise.mount(w.document.getElementById('enterprise'),{lang:locale});
 const $=name=>w.document.getElementById('ent-'+name);
 $('email').value='administrator@fixture.example.test';$('password').value='synthetic-administrator-password';$('login').dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
 w.MiyarEnterprise.open('connection');await settle();
 return {dom,w,$,errors,requests};
}

for(const locale of ['ar','en'])test('administrator framework preview and explicit activation work with the real file input DOM: '+locale,async()=>{
 const a=await administrator(locale);try{
  const input=a.$('framework-file');assert.ok(input,'Administrator has a framework upload input');
  const candidate={...structuredClone(framework),name:'Acceptance framework <img src=x onerror=alert(1)>'};
  Object.defineProperty(input,'files',{configurable:true,value:[{name:'framework.json',size:JSON.stringify(candidate).length,text:async()=>JSON.stringify(candidate)}]});
  a.$('import-framework').click();await settle();
  const panel=a.$('framework-preview');assert.ok(panel,'Preview must render instead of failing at its insertion point');
  assert.ok(panel.isConnected);assert.equal(panel.querySelector('img'),null,'Uploaded framework labels are escaped');
  assert.ok(panel.textContent.includes(candidate.name));assert.equal(panel.querySelectorAll('li').length,framework.factors.length);
  assert.equal(a.requests.filter(x=>x.route.endsWith('/settings/framework/preview')).length,1);
  assert.equal(a.requests.filter(x=>x.route.endsWith('/settings/framework')).length,0,'Preview does not activate configuration');
  assert.ok(!a.$('message').classList.contains('error'),'Successful preview leaves no error alert');

  a.$('framework-reason').value='Short';a.$('framework-activate').click();await settle();
  assert.ok(a.$('message').classList.contains('error'));assert.equal(a.requests.filter(x=>x.route.endsWith('/settings/framework')).length,0,'A short reason cannot activate');
  a.$('framework-reason').value='Synthetic acceptance activation reason';a.$('framework-activate').click();await settle();
  const activation=a.requests.filter(x=>x.route.endsWith('/settings/framework'));assert.equal(activation.length,1);
  assert.equal(activation[0].body.reason,'Synthetic acceptance activation reason');assert.equal(activation[0].body.framework.name,candidate.name);
  assert.match(a.$('framework-status').textContent,locale==='ar'?/حُفظ الإطار بإصدار جديد/:/Framework saved as a new version/);
  assert.ok(a.$('framework-activate').disabled,'A completed activation cannot be sent twice by clicking');
  assert.ok(!a.$('message').classList.contains('error'),'A valid activation clears the preceding validation error');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
});
