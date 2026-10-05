// Offline review: validates a candidate against source bytes and reports impact; never activates it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function review(kind,baseline,candidate,sourceBytes,record,positions=[]){
 if(!['occupation','education'].includes(kind))throw Error('Choose occupation or education');
 if(candidate.schema!==(kind==='occupation'?'miyar-taxonomy/1.0':'miyar-education/1.0'))throw Error('Wrong reference schema');
 if(!candidate.id||candidate.id===baseline.id||!candidate.edition)throw Error('A distinct version identifier and edition are required');
 if(candidate.sha256!==digest(sourceBytes))throw Error('Source SHA256 differs from the supplied document');
 const source=new URL(record.sourceUrl);if(source.protocol!=='https:'||!/(^|\.)(stats|moe|hrsd)\.gov\.sa$/.test(source.hostname))throw Error('Use the official publisher HTTPS source');
 if(record.sourceReviewed!==true||!String(record.reviewedBy||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedOn||'')||!String(record.reason||'').trim())throw Error('Source authenticity, reviewer, date and reason must be recorded');
 const key=kind==='occupation'?'nodes':'fields',rows=candidate[key];if(!Array.isArray(rows)||!rows.length||rows.length>30000)throw Error('Invalid reference size');
 const ids=new Set();for(const row of rows){if(!/^\d{1,6}$/.test(row.code)||ids.has(row.code)||!String(row.titleAr||'').trim()||!Number.isInteger(row.sourcePage)||row.sourcePage<1)throw Error('Invalid or duplicate code, title or source page');ids.add(row.code);}
 const old=new Map(baseline[key].map(x=>[x.code,x])),next=new Map(rows.map(x=>[x.code,x]));
 const added=rows.filter(x=>!old.has(x.code)).map(x=>x.code),removed=[...old.keys()].filter(x=>!next.has(x)),changed=rows.filter(x=>old.has(x.code)&&['titleAr','parent','level'].some(k=>x[k]!==old.get(x.code)[k])).map(x=>x.code);
 const missingParents=kind==='occupation'?rows.filter(x=>x.parent&&!next.has(x.parent)).map(x=>({code:x.code,parent:x.parent})):[];
 const affected=new Set([...removed,...changed]),field=kind==='occupation'?'occupationCode':'educationFieldCode';
 return {schema:'miyar-reference-review/1.0',kind,baseline:baseline.id,candidate:candidate.id,candidateSha256:digest(Buffer.from(JSON.stringify(candidate))),sourceSha256:candidate.sha256,sourceReview:record,added,removed,changed,missingParents,affectedPositionIds:positions.filter(p=>affected.has((p.content||p)[field])).map(p=>p.id||p.internalCode||'unidentified'),activationAllowed:false,nextAction:kind==='occupation'?'Administrator stages the new edition; OD separately reviews source and impact before activation. Existing positions retain their edition.':'Release review must preserve the old education snapshot and assess all affected mappings before deploying a new bundled edition. No automatic replacement.',status:missingParents.length?'source-issues-require-review':'reviewed-candidate-not-active'};
}
module.exports={review};
if(require.main===module){try{const [kind,candidateFile,sourceFile,recordFile,positionsFile]=process.argv.slice(2);if(!recordFile)throw Error('Usage: node scripts/review-reference-update.cjs occupation|education candidate.json source.pdf review-record.json [positions.json]');const dir=path.join(__dirname,'../dist/classifications'),base=JSON.parse(fs.readFileSync(path.join(dir,kind==='occupation'?'ssco-2019.json':'education-2020.json')));const out=review(kind,base,JSON.parse(fs.readFileSync(candidateFile)),fs.readFileSync(sourceFile),JSON.parse(fs.readFileSync(recordFile)),positionsFile?JSON.parse(fs.readFileSync(positionsFile)):[]);process.stdout.write(JSON.stringify(out,null,2)+'\n');}catch(e){console.error(e.message);process.exitCode=1;}}
