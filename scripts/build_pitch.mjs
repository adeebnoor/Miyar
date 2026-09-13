// Rebuild with the Codex presentation runtime. All slide text is editable.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
if(!runtime)throw new Error('Set CODEX_PRIMARY_RUNTIME_NODE_MODULES');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(runtime,'@oai/artifact-tool/dist/artifact_tool.mjs')));
const data=JSON.parse(await fs.readFile(path.join(root,'dist/pitch/content.json'),'utf8'));
const bg=await fs.readFile(path.join(root,'dist/pitch/boardroom.jpg'));
const W=1601,H=1000,navy='#0c0b1d',teal='#1bb4bd',white='#fafafa';
const languages=process.argv.includes('--en-only')?['en']:process.argv.includes('--ar-only')?['ar']:['ar','en'];
for(const lang of languages){
 const p=Presentation.create({slideSize:{width:W,height:H}});
 const out=path.join(root,'tmp/pitch-build',lang);await fs.mkdir(out,{recursive:true});
 const font=lang==='ar'?'DejaVu Sans':'Nimbus Sans',align=lang==='ar'?'right':'left';
 const T=x=>typeof x==='string'?x:(x?.[lang]??'');
 let s,fg,muted,accent;
 function rect(name,x,y,w,h,fill){return s.shapes.add({name,geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
 function text(name,value,x,y,w,h,size=36,color=fg,bold=false,alignment=align){
  const sh=s.shapes.add({name,geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  sh.text=T(value);sh.text.style={typeface:font,fontSize:size,color,bold,alignment,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};return sh;
 }
 function list(items,x,y,w,step=110,size=36){items.forEach((a,i)=>{
  rect('item-rule-'+i,lang==='ar'?x+w-5:x,y+i*step+18,5,28,accent);
  text('item-'+i,a,lang==='ar'?x:x+30,y+i*step,w-30,step-14,size);
 });}
 for(let i=0;i<data.slides.length;i++){
  const d=data.slides[i];s=p.slides.add();
  const light=d.theme==='light';fg=light?navy:white;muted=light?'#4c5262':'#d7e1e7';accent=d.theme==='teal'?navy:teal;
  s.background.fill=light?white:d.theme==='teal'?teal:navy;
  if(d.theme==='photo'){
   s.images.add({name:'Illustrative architectural background',blob:bg,contentType:'image/jpeg',alt:'AI-generated illustrative empty boardroom and city skyline; not a customer location',fit:'cover',position:{left:0,top:0,width:W,height:H}});
   rect('photo-legibility-overlay',0,0,W,H,'#0c0b1d/58');
  }
  text('brand','MIYAR',1280,52,210,50,29,fg,true,'right');
  text('folio',String(i+1),110,929,50,40,23,muted,false,'left');
  if(d.type!=='cover'){
   text('slide-title',d.title,110,155,1381,140,lang==='ar'?52:58,fg,true);
   rect('title-rule',lang==='ar'?1271:110,309,220,5,accent);
  }
  if(d.type==='cover'){
   rect('cover-top-rule',110,278,1381,5,teal);
   text('cover-title',d.title,110,298,1381,170,120,white,true);
   rect('cover-bottom-rule',110,481,1381,5,teal);
   text('cover-subtitle',d.subtitle,110,527,1381,90,56,white,true);
   text('cover-body',d.body,110,654,1281,140,37,white);
  }else if(['columns','performance'].includes(d.type)){
   d.columns.forEach((c,j)=>{
    const x=lang==='ar'?(j===0?855:110):(j===0?110:855),width=636;
    text('column-title-'+j,c.title,x,374,width,100,38,accent,true);
    list(c.items,x,491,width,d.type==='performance'?85:111,lang==='ar'?31:34);
   });
  }else if(d.type==='steps'){
   const n=d.steps.length;
   if(n===4){
    d.steps.forEach((a,j)=>{const x=110+(lang==='ar'?(1-j%2):j%2)*726,y=376+Math.floor(j/2)*234;
     text('step-number-'+j,String(j+1),lang==='ar'?x+552:x,y,80,80,58,accent,true);
     const tx=lang==='ar'?x:x+106;
     text('step-title-'+j,a.title,tx,y+3,520,105,36,fg,true);
     text('step-body-'+j,a.body,tx,y+105,520,100,30,fg);
    });
   }else{
    d.steps.forEach((a,j)=>{const x=110+(lang==='ar'?n-1-j:j)*483;
     text('step-number-'+j,String(j+1),x,379,415,115,76,accent,true);
     text('step-title-'+j,a.title,x,518,415,116,38,fg,true);
     text('step-body-'+j,a.body,x,654,415,180,31,fg);
    });
   }
  }else if(d.type==='record'){
   text('record-title',d.recordTitle,110,365,1381,85,48,navy,true);
   const values=d.rows.map(row=>(lang==='ar'?[...row].reverse():row).map(T));
   const table=s.tables.add({rows:4,columns:2,left:110,top:482,width:1381,height:334,columnWidths:lang==='ar'?[940,441]:[441,940],values});
   table.styleOptions={headerRow:false,bandedRows:false};table.borders.assign({fill:'#c8d3d6',width:1});
   for(let r=0;r<4;r++){table.rows[r].height=83.5;for(let c=0;c<2;c++){
    const cell=table.getCell(r,c),label=c===(lang==='ar'?1:0);
    cell.fill=label?'#e7f2f3':white;cell.text.style={typeface:font,fontSize:30,bold:label,color:navy,alignment:align,verticalAlignment:'middle',insets:{left:18,right:18,top:10,bottom:10}};
   }}
  }else if(d.type==='metrics'||d.type==='pilot'){
   const n=d.metrics.length,w=1381/n;
   d.metrics.forEach((m,j)=>{const x=110+(lang==='ar'?n-1-j:j)*w;
    text('metric-value-'+j,m.value,x,375,w-40,155,d.type==='pilot'?108:130,fg,true,'center');
    text('metric-label-'+j,m.label,x,548,w-40,100,37,fg,false,'center');
    if(m.detail)text('metric-detail-'+j,m.detail,x,671,w-40,90,29,fg,false,'center');
   });
   if(d.items)list(d.items,110,676,1381,63,29);
  }else if(d.type==='team'){
   d.people.forEach((a,j)=>{const x=110+(lang==='ar'?1-j:j)*726;
    rect('person-rule-'+j,lang==='ar'?x+506:x,408,150,5,teal);
    text('person-name-'+j,a.name,x,461,656,100,46,navy,true);
    text('person-detail-'+j,a.detail,x,597,656,190,34,muted);
   });
  }else{
   text('statement',d.statement,110,370,1381,150,lang==='ar'?46:50,fg,true);
   list(d.items,110,571,1381,d.link?95:100,lang==='ar'?35:38);
   if(d.link){const sh=text('platform-link','adeebnoor.github.io/Miyar',110,785,1381,65,36,teal,true);sh.text.get('adeebnoor.github.io/Miyar').link={uri:d.link,isExternal:true};}
  }
  if(d.note)text('slide-note',d.note,205,887,1286,75,23,muted);
  s.speakerNotes.textFrame.setText([
   T(d.title),d.source||'Miyar product narrative and proposed institutional pilot. Product: https://adeebnoor.github.io/Miyar/',
   T(d.note),d.theme==='photo'?'Architectural photo generated by OpenAI image generation for this deck. Illustrative setting; not a customer location.':'',
   'Visual reference: supplied Uber_Pitch_Deck_Template.pdf. Original Miyar copy; no Uber logos, market figures or customer claims reused.'
  ].filter(Boolean).join('\n\n'));
  const png=await p.export({slide:s,format:'png',scale:1});await fs.writeFile(path.join(out,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
  const layout=await s.export({format:'layout'});await fs.writeFile(path.join(out,`slide-${i+1}.layout.json`),await layout.text());
  console.log(`${lang} ${i+1}/${data.slides.length}`);
 }
 await(await PresentationFile.exportPptx(p)).save(path.join(out,'candidate.pptx'));
 console.log(`Candidate complete: ${lang}`);
}
