// JSDOM outside-only does not fetch dynamic scripts. Serve the real, built
// workspace asset through the same script load event used by browsers.
const fs=require('node:fs'),path=require('node:path');
module.exports=function(w){const append=w.document.head.append.bind(w.document.head);w.document.head.append=function(...nodes){append(...nodes);for(const node of nodes)if(node.tagName==='SCRIPT'&&/miyar-workspace-[a-f0-9]+\.js$/.test(node.src))queueMicrotask(()=>{try{w.eval(fs.readFileSync(path.join(__dirname,'../dist',new URL(node.src).pathname.split('/').at(-1)),'utf8'));node.dispatchEvent(new w.Event('load'));}catch(e){node.dispatchEvent(new w.Event('error'));throw e;}});};};
