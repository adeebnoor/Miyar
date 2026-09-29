(function(){
'use strict';
const workspaces=[];
const t=(a,b)=>document.documentElement.lang==='en'?b:a;
function errorText(error){
 const message=error?.message||String(error||'');if(document.documentElement.lang==='en')return message;
 const names={'Band minimum':'الحد الأدنى','Band midpoint':'منتصف النطاق','Band maximum':'الحد الأعلى','Target range position':'موضع الهدف','Headcount':'عدد FTE','Employer on-cost':'تكلفة صاحب العمل الإضافية','Current / reference salary':'الراتب الحالي','Baseline workload':'عبء العمل الحالي','Target workload':'عبء العمل المستهدف','Capacity per FTE':'القدرة لكل FTE','Current FTE':'FTE الحالي','Horizon':'أفق التخطيط','Attrition':'الاستنزاف','Committed hires':'التوظيفات المعتمدة','Internal moves / reskilling':'النقل والتطوير الداخلي','Productivity improvement':'تحسن الإنتاجية','Annual cost per FTE':'التكلفة السنوية لكل FTE','Known retirements':'التقاعد وانتهاء العقود المعروف','Current national FTE':'FTE المواطنين الحاليين','Localization target':'هدف التوطين','Fixed allowances':'البدلات الثابتة'};
 for(const [name,label] of Object.entries(names))if(message.startsWith(name+' must'))return 'أدخل قيمة رقمية صحيحة للحقل: '+label+'، ضمن الحدود المحددة.';
 return ({'Salary band must satisfy minimum < midpoint < maximum':'يجب أن يكون الحد الأدنى أقل من المنتصف، والمنتصف أقل من الحد الأعلى.','Provide the organization salary-band source or rationale':'أدخل مصدر نطاق الراتب أو المبرر الموثق للجهة.','Known retirements cannot exceed current FTE':'لا يمكن أن يتجاوز التقاعد وانتهاء العقود المعروف عدد FTE الحالي.','Enter both current national FTE and the localization target':'أدخل عدد المواطنين الحاليين وهدف التوطين معًا، أو اتركهما فارغين.','Current national FTE cannot exceed current FTE':'لا يمكن أن يتجاوز عدد المواطنين الحاليين إجمالي FTE الحالي.'})[message]||message;
}
function create(options){
 const o=options,p=o.prefix;let form=null,result=null,error=null,selected=null;
 const storageKey=()=>{const session=window.MiyarEnterprise?.session?.();return session?o.key+':'+encodeURIComponent(session.scope):o.key;};
 function rows(){let value;try{value=JSON.parse(localStorage.getItem(storageKey())||'[]');}catch{throw Error(t('تعذر قراءة المحفوظات؛ لم تُستبدل بياناتك.','Saved data could not be read; your data was not replaced.'));}if(!Array.isArray(value))throw Error(t('صيغة المحفوظات غير صالحة.','Invalid saved data format.'));return value;}
 function message(){const node=document.querySelector('[data-'+p+'-message]');if(node)node.dataset.state=error?'error':result?'done':'idle';if(node)node.textContent=error?errorText(error):result?t('تم الحساب وفق المدخلات الحالية.','Calculated from the current inputs.'):t('راجع المدخلات ثم احسب النتيجة.','Review inputs and calculate the result.');}
 function draw(){const node=document.querySelector('[data-'+p+'-'+o.resultAttribute+']');if(!node)return;node.innerHTML=result?o.renderResult(result):'';if(result)o.bindResult(result);message();window.dispatchEvent(new CustomEvent('miyar:scenario-result',{detail:{prefix:p}}));}
 function invalidate(){form=o.values();result=null;error=null;draw();}
 function calculate(){form=o.values();result=null;error=null;try{result=o.calculate(form);}catch(e){error=e;}draw();return result;}
 function load(value){if(!value||value.schema!==o.schema||!value.input)throw Error(t('اختر ملف السيناريو المطابق لهذه الصفحة.','Choose a scenario file for this workspace.'));const raw=o.fromInput(value.input),verified=o.calculate(raw);form=raw;result=verified;error=null;selected=value.id||null;o.fill(form);draw();}
 function list(){
  const host=document.querySelector('[data-'+p+'-saved]');if(!host)return;host.replaceChildren();const heading=document.createElement('h3');heading.textContent=t('المحفوظات على هذا الجهاز','Saved on this device');host.append(heading);const note=document.createElement('p');note.textContent=t('هذه الخطط محلية لهذا الحساب والمتصفح؛ صدّر JSON لنقلها إلى جهاز آخر.','These plans are local to this account and browser; export JSON to move them to another device.');host.append(note);
  try{for(const row of rows()){const button=document.createElement('button');button.type='button';button.className='button button-outline';button.dataset[p+'Open']=row.id;button.textContent=(row.input?.role||row.input?.jobFamily||row.id)+' · '+row.id;button.onclick=()=>{try{load(row);}catch(e){error=e;message();}};host.append(button);}}catch(e){error=e;message();}
  const label=document.createElement('label');label.className='ent-field';label.textContent=t('استيراد خطة / سيناريو JSON','Import plan / scenario JSON');const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.dataset[p+'Import']='true';file.onchange=async()=>{const value=file.files[0];if(!value)return;try{if(value.size>1000000)throw Error(t('الحد الأقصى للملف 1 ميجابايت.','Maximum file size is 1 MB.'));load(JSON.parse(await value.text()));selected=null;}catch(e){error=e instanceof SyntaxError?Error(t('الملف ليس JSON صالحًا.','The file is not valid JSON.')):e;message();}finally{file.value='';}};label.append(file);host.append(label);
 }
 function save(value){const records=rows();const id=selected||p.toUpperCase()+'-'+(crypto.randomUUID?.()||Date.now().toString(36));const row={...value,id};const others=records.filter(x=>x.id!==id);if(others.length>=30)throw Error(t('بلغت حد 30 خطة؛ افتح خطة محفوظة لتحديثها.','30-plan limit reached; open an existing plan to update it.'));localStorage.setItem(storageKey(),JSON.stringify([row,...others]));selected=id;list();return row;}
 function mount(content){if(form)o.fill(form);else form=o.values();let host=content.querySelector('[data-'+p+'-saved]');if(!host){host=document.createElement('section');host.dataset[p+'Saved']='true';host.className='scenario-saved';content.querySelector('[data-'+p+'-'+o.resultAttribute+']').before(host);}list();draw();}
 function example(value){selected=null;o.fill(value);invalidate();}
 document.addEventListener('input',e=>{if(e.target.closest('.'+p+'-form'))invalidate();});
 document.addEventListener('change',e=>{if(e.target.closest('.'+p+'-form'))invalidate();});
 const workspace={rows,save,mount,calculate,example,load,result:()=>result,fail:e=>{error=e;message();},reset:()=>{form=null;result=null;error=null;selected=null;}};workspaces.push(workspace);return workspace;
}
window.addEventListener('miyar:session',()=>{for(const w of workspaces)w.reset();for(const key of ['miyar-manpower-handoff','miyar-compensation-handoff'])sessionStorage.removeItem(key);});
window.MiyarScenarioWorkspace={create,errorText};
})();
