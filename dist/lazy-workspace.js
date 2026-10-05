/* Catalog and compensation code are fetched on entering a working page. */
(function(){
window.MiyarRoleCatalog=window.MiyarRoleCatalog||{families:[],roles:[]};
let pending,ready=false;
function load(){if(ready)return Promise.resolve();if(pending)return pending;pending=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./__WORKSPACE_ASSET__';s.onload=()=>{ready=true;window.dispatchEvent(new CustomEvent('miyar:workspace-ready'));window.MiyarCompensationWorkbench?.render();resolve();};s.onerror=()=>{pending=null;s.remove();reject(Error('تعذر تحميل أدوات العمل. أعد المحاولة. / Workspace could not load. Please retry.'));};document.head.append(s);});return pending;}
window.MiyarLoadWorkspace=load;
function route(){if(/^#(?:demo|enterprise)/.test(location.hash))load().catch(e=>{let box=document.getElementById('workspace-load-error');if(!box){box=document.createElement('div');box.id='workspace-load-error';box.setAttribute('role','alert');document.body.append(box);}box.textContent=e.message;});}
window.addEventListener('hashchange',route);route();
for(const type of ['submit','click'])document.addEventListener(type,event=>{const target=event.target;if(ready||!(target instanceof Element))return;const action=type==='submit'?target:target.closest('[data-od-generate], [data-comp-run], [data-load-demo], [data-tour-start]');if(!action)return;event.preventDefault();event.stopImmediatePropagation();load().then(()=>{document.getElementById('workspace-load-error')?.remove();if(type==='submit')action.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));else action.click();}).catch(e=>{alert(e.message);});},true);
})();
