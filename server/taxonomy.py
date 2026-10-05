import csv,io,json,math,os,re,threading,zipfile,hashlib
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
from .domain import normalized,digest
from .semantic_scope import read_role_catalog,normalize_phrase
from .semantic_provider import capability as semantic_capability, GeminiOccupationEmbeddings, BATCH_SIZE, failure_details

ROOT=Path(__file__).resolve().parent.parent
class Catalog:
    def __init__(self,directory=None,occupation_payload=None):
        path=Path(directory or ROOT/'dist/classifications')
        self.occupations=occupation_payload or json.loads((path/'ssco-2019.json').read_text());self.education=json.loads((path/'education-2020.json').read_text())
        self.nodes={n['code']:n for n in self.occupations['nodes']};self.roles={k:v for k,v in self.nodes.items() if v['level']=='occupation'}
        self.education_fields={n['code']:n for n in self.education['fields']}
        self.flagged={n['code'] for n in self.occupations['validation']['missingParents']}
        self.skills=json.loads((path/'skills.json').read_text()) if (path/'skills.json').exists() else []
        self.profiles={p['code']:p for p in json.loads((path/'role-profiles.json').read_text())} if (path/'role-profiles.json').exists() else {}
        if occupation_payload:self.profiles={}
        for k,p in self.profiles.items():
            if k in self.roles:self.roles[k]['titleEn']=p['titleEn']
        authored=read_role_catalog();self.occupation_aliases=authored.get('occupationAliases',{});self.title_word_forms=authored.get('titleWordForms',{});self.title_index=defaultdict(list)
        for record in self.roles.values():
            for label in [record['titleAr'],record.get('titleEn',''),*record.get('aliases',[])]:
                if label:self.title_index[normalize_phrase(label)].append((record['code'],'source-title',record.get('titleEn','')))
        verified=set()
        for role in authored['roles']:
            record=self.roles.get(role['ssco'])
            if not record or normalize_phrase(record['titleAr'])!=normalize_phrase(role['referenceTitleAr']) or record.get('sourcePage')!=role['sourcePage']:continue
            verified.add(role['ssco'])
            for label in [role['titleAr'],role['titleEn'],role['referenceTitleAr']]:
                self.title_index[normalize_phrase(label)].append((role['ssco'],'proposed-catalog-translation',role['titleEn']))
        for label,code in self.occupation_aliases.items():
            if code in self.roles and (not occupation_payload or code in verified):self.title_index[normalize_phrase(label)].append((code,'proposed-search-translation',label))
        self.role_skills={k:p['skills'] for k,p in self.profiles.items()};self.model=None;self.matrix=None;self.model_lock=threading.Lock()
        self.skill_matrix=None;self.semantic_index_status='pending';self.semantic_indexed_documents=0;self.semantic_failure=None
    def match_occupation(self,title):
        q=normalize_phrase(title).replace('hr manager','human resources manager');singular=re.sub(r'\b(engineers|teachers|nurses|accountants|drivers|cleaners)\b',lambda m:m.group()[:-1],q);matches=[];seen=set()
        masculine=' '.join(self.title_word_forms.get(word,word) for word in q.split());terms=list(dict.fromkeys([q,singular,masculine]))
        for term in terms:
            for code,basis,title_en in self.title_index.get(term,[]):
                if code in seen:continue
                record=self.roles[code];seen.add(code);matches.append({'code':code,'titleAr':record['titleAr'],'titleEn':title_en,'sourcePage':record['sourcePage'],'basis':basis,'translationStatus':'proposed-search-translation' if title_en else 'official-source-title'})
        if re.fullmatch(r'\d{6}',q) and q in self.roles and q not in seen:
            record=self.roles[q];matches.insert(0,{'code':q,'titleAr':record['titleAr'],'titleEn':record.get('titleEn',''),'sourcePage':record['sourcePage'],'basis':'occupation-code','translationStatus':'official-source-title'})
        return {'status':'matched' if len(matches)==1 else 'ambiguous' if matches else 'unknown','matches':matches}
    def match_title_code(self,title,code):
        lookup=self.match_occupation(title);expected=[r['code'] for r in lookup['matches']];match=next((r for r in lookup['matches'] if r['code']==str(code)),None)
        return {'status':'matched' if match else 'inconsistent' if expected else 'unknown','match':match,'expectedCodes':expected,'matches':lookup['matches']}
    def search(self,text='',parent=None,limit=50):
        q=normalize_phrase(text);lookup=self.match_occupation(text);exact={r['code'] for r in lookup['matches']};queries=[normalize_phrase(r['titleAr']) for r in lookup['matches']] or [q];rows=self.nodes.values() if parent is not None else self.roles.values()
        found=[r for r in rows if (parent is None or r.get('parent')==parent) and (r['code'] in exact or any(all(t in normalize_phrase(r['titleAr']+' '+r['code']+' '+r.get('titleEn','')+' '+' '.join(r.get('aliases',[]))) for t in query.split()) for query in queries))]
        found.sort(key=lambda r:(r['code'] not in exact and normalize_phrase(r['titleAr'])!=q and r['code']!=q,r['code']))
        return {'total':len(found),'items':[{**r,'sourceWarning':r['code'] in self.flagged,'translationStatus':'proposed-search-translation' if any(x['code']==r['code'] and x['translationStatus']=='proposed-search-translation' for x in lookup['matches']) else 'official-source-title'} for r in found[:limit]],'release':self.occupations['id']}
    def extract_skills(self,text):
        normalized_text=' '+normalized(text)+' ';found=[]
        for skill in self.skills:
            terms=[skill.get('labelAr',''),skill.get('labelEn',''),*skill.get('aliases',[])]
            evidence=[term for term in terms if term and any(prefix+normalized(term)+' ' in normalized_text for prefix in [' ',' و',' ف'])]
            if evidence:found.append({**skill,'evidence':list(dict.fromkeys(evidence)),'method':'dictionary-extraction'})
        return found
    def load_semantic(self):
        caps=semantic_capability()
        if caps['provider']=='local-e5-small':return self._load_e5_semantic(caps)
        if caps['provider']=='gemini':return self._load_remote_semantic(caps)
        if caps['provider']!='local':raise RuntimeError('Unsupported semantic embedding provider')
        name=os.getenv('MIYAR_EMBEDDING_MODEL','sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        if os.getenv('MIYAR_ENABLE_EMBEDDINGS')!='true':raise RuntimeError('Semantic model is disabled; configure MIYAR_ENABLE_EMBEDDINGS=true and provision model resources')
        with self.model_lock:
            if self.model is not None:return
            from fastembed import TextEmbedding
            from huggingface_hub import snapshot_download
            revision='faf4aa4225822f3bc6376869cb1164e8e3feedd0'
            folder=snapshot_download('qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q',revision=revision,cache_dir=os.getenv('MIYAR_MODEL_CACHE',str(ROOT/'.model-cache')))
            model=TextEmbedding(name,specific_model_path=folder,threads=2)
            artifacts={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(folder).iterdir() if p.is_file()}
            self.model_fingerprint=digest({'artifacts':artifacts,'fastembed':'0.8.0','pooling':'mean'})
            roles=list(self.roles.values());documents=[r['titleAr']+' '+self.nodes.get(r.get('parent'),{}).get('titleAr','')+' '+r.get('titleEn','') for r in roles]
            cache=Path(os.getenv('MIYAR_MODEL_CACHE',str(ROOT/'.model-cache')));cache.mkdir(parents=True,exist_ok=True)
            filename=cache/('occupation-vectors-'+digest({'release':self.occupations['sha256'],'model':name,'fingerprint':self.model_fingerprint,'text':documents})[:24]+'.npy')
            matrix=np.load(filename,allow_pickle=False) if filename.exists() else np.asarray(list(model.embed(documents,batch_size=32)))
            matrix=matrix/np.maximum(np.linalg.norm(matrix,axis=1,keepdims=True),1e-12)
            if not filename.exists():np.save(filename,matrix,allow_pickle=False)
            self.matrix=matrix;self.vector_roles=roles;self.model_name=name;self.model=model
            self.semantic_index_status='ready';self.semantic_indexed_documents=len(roles)
    def semantic_status(self):
        caps=semantic_capability()
        status=self.semantic_index_status if caps['configured'] else ('disabled' if not caps['enabled'] else 'not-configured')
        return {**caps,'modelReady':self.model is not None,'indexStatus':status,
                'indexedDocuments':self.semantic_indexed_documents,
                'totalDocuments':len(self.roles)+(len(self.skills) if caps['provider'] in {'gemini','local-e5-small'} else 0),
                'occupationRecords':len(self.roles),'skillRecords':len(self.skills),
                'lastFailure':self.semantic_failure}
    def _load_e5_semantic(self,caps):
        if not caps['configured']:raise RuntimeError('Local semantic embeddings are disabled')
        with self.model_lock:
            if self.model is not None:return
            self.semantic_index_status='indexing';self.semantic_indexed_documents=0;self.semantic_failure=None
            try:
                from .local_semantic_provider import LocalE5Embeddings
                model=LocalE5Embeddings();roles=list(self.roles.values())
                documents=[r['titleAr']+' '+self.nodes.get(r.get('parent'),{}).get('titleAr','')+' '+r.get('titleEn','') for r in roles]
                documents += [' '.join([s.get('labelAr',''),s.get('labelEn',''),*s.get('aliases',[])]) for s in self.skills]
                cache=Path(os.getenv('MIYAR_MODEL_CACHE',str(ROOT/'.model-cache')));cache.mkdir(parents=True,exist_ok=True)
                key=digest({'release':self.occupations['sha256'],'model':model.name,'fingerprint':model.fingerprint,'text':documents})
                filename=cache/('local-e5-corpus-vectors-'+key[:24]+'.npy');matrix=None
                if filename.exists() and filename.stat().st_size<=len(documents)*model.dimensions*4+4096:
                    try:
                        loaded=np.load(filename,allow_pickle=False,mmap_mode='r')
                        if loaded.shape==(len(documents),model.dimensions) and loaded.dtype==np.float32 and np.isfinite(loaded).all() and np.all(np.abs(loaded)<=1.0001) and np.allclose(np.linalg.norm(loaded,axis=1),1,atol=1e-4):matrix=loaded
                    except (OSError,ValueError):pass
                if matrix is None:
                    matrix=np.empty((len(documents),model.dimensions),dtype=np.float32)
                    for first,document in enumerate(documents):
                        matrix[first]=np.asarray(model([document],'passage')[0],dtype=np.float32)
                        self.semantic_indexed_documents=first+1
                    temporary=filename.with_suffix('.tmp')
                    with temporary.open('wb') as target:np.save(target,matrix,allow_pickle=False)
                    temporary.replace(filename)
                    matrix=np.load(filename,allow_pickle=False,mmap_mode='r')
                self.matrix=matrix[:len(roles)];self.skill_matrix=matrix[len(roles):];self.vector_roles=roles
                self.model_name=model.name;self.model_fingerprint=model.fingerprint
                self.semantic_indexed_documents=len(documents);self.semantic_index_status='ready';self.model=model
            except Exception as error:
                self.semantic_index_status='failed';self.semantic_failure=failure_details(error)
                raise
    def _load_remote_semantic(self,caps):
        if not caps['configured']:raise RuntimeError('Configure the server-side semantic embedding provider')
        with self.model_lock:
            if self.model is not None:return
            self.semantic_index_status='indexing';self.semantic_indexed_documents=0;self.semantic_failure=None
            try:
                model=GeminiOccupationEmbeddings();roles=list(self.roles.values())
                documents=[r['titleAr']+' '+self.nodes.get(r.get('parent'),{}).get('titleAr','')+' '+r.get('titleEn','') for r in roles]
                documents += [' '.join([s.get('labelAr',''),s.get('labelEn',''),*s.get('aliases',[])]) for s in self.skills]
                if not documents:raise RuntimeError('Semantic corpus is empty')
                cache=Path(os.getenv('MIYAR_MODEL_CACHE',str(ROOT/'.model-cache')));cache.mkdir(parents=True,exist_ok=True)
                cache_key=digest({'release':self.occupations['sha256'],'model':model.name,'fingerprint':model.fingerprint,'text':documents})
                filename=cache/('gemini-corpus-vectors-'+cache_key[:24]+'.npy')
                matrix=None
                if filename.exists() and filename.stat().st_size<=len(documents)*model.dimensions*4+4096:
                    try:
                        loaded=np.load(filename,allow_pickle=False)
                        if loaded.shape==(len(documents),model.dimensions) and loaded.dtype==np.float32 and np.isfinite(loaded).all() and np.all(np.abs(loaded)<=1.0001) and np.all(np.linalg.norm(loaded,axis=1)>0):matrix=loaded
                    except (OSError,ValueError):pass
                if matrix is None:
                    matrix=np.empty((len(documents),model.dimensions),dtype=np.float32)
                    parts=cache/(filename.stem+'-parts');parts.mkdir(exist_ok=True)
                    for first in range(0,len(documents),BATCH_SIZE):
                        batch=documents[first:first+BATCH_SIZE];part=parts/(str(first).zfill(6)+'-'+str(len(batch))+'.npy');vectors=None
                        if part.exists() and part.stat().st_size<=len(batch)*model.dimensions*4+4096:
                            try:
                                loaded=np.load(part,allow_pickle=False)
                                if loaded.shape==(len(batch),model.dimensions) and loaded.dtype==np.float32 and np.isfinite(loaded).all() and np.all(np.abs(loaded)<=1.0001) and np.all(np.linalg.norm(loaded,axis=1)>0):vectors=loaded
                            except (OSError,ValueError):pass
                        if vectors is None:
                            vectors=np.asarray(model(batch,'passage'),dtype=np.float32)
                            temporary=part.with_suffix('.tmp')
                            with temporary.open('wb') as target:np.save(target,vectors,allow_pickle=False)
                            temporary.replace(part)
                        matrix[first:first+len(batch)]=vectors
                        self.semantic_indexed_documents=first+len(batch)
                    temporary=filename.with_suffix('.tmp')
                    with temporary.open('wb') as target:np.save(target,matrix,allow_pickle=False)
                    temporary.replace(filename)
                matrix=matrix/np.maximum(np.linalg.norm(matrix,axis=1,keepdims=True),1e-12)
                # Publish the model last. Requests fail fast until the complete index is usable.
                self.matrix=matrix[:len(roles)];self.skill_matrix=matrix[len(roles):];self.vector_roles=roles
                self.model_name=model.name;self.model_fingerprint=model.fingerprint
                self.semantic_indexed_documents=len(documents);self.semantic_index_status='ready';self.model=model
            except Exception as error:
                self.semantic_index_status='failed';self.semantic_failure=failure_details(error)
                raise
    def semantic(self,text,candidate_codes=None,field='',seniority=''):
        caps=semantic_capability()
        if not caps['configured']:raise RuntimeError('Semantic model is disabled or its provider is not configured')
        if caps['provider'] in {'gemini','local-e5-small'} and self.model is None:raise RuntimeError('Semantic index is warming up or unavailable; retry after readiness succeeds')
        if self.model is None:self.load_semantic()
        vector=np.asarray(next(iter(self.model.embed([text]))),dtype=np.float32);vector/=max(float(np.linalg.norm(vector)),1e-12)
        cosine=self.matrix@vector;order=np.argsort(-cosine)
        scope=None
        if caps['provider']=='local-e5-small':
            from .semantic_scope import OccupationScope
            scope=OccupationScope(field,seniority,self.nodes,self.flagged)
            order=[i for i in order if self.vector_roles[int(i)]['code'] in scope.references]
        if candidate_codes is not None:order=[i for i in order if self.vector_roles[int(i)]['code'] in candidate_codes]
        order=order[:3];skills=self.extract_skills(text);required={s['id'] for s in skills};items=[]
        for index in order:
            role=self.vector_roles[int(index)];known=set(self.role_skills.get(role['code'],[]));common=sorted(required&known)
            similarity=float(np.clip(cosine[index],-1,1))
            items.append({'code':role['code'],'titleAr':role['titleAr'],'sourcePage':role['sourcePage'],'cosineSimilarity':round(similarity,5),'semanticDistance':round(1-similarity,5),'skillOverlapPercent':round(100*len(common)/len(required),1) if required and known else None,'matchedSkillIds':common,'sourceWarning':role['code'] in self.flagged,'skillDenominator':len(required),'profile':self.profiles.get(role['code']),'taskOverlapPercent':None})
            if scope:items[-1].update(mappingStatus=scope.references[role['code']]['mappingStatus'],scopeFamilies=scope.references[role['code']]['families'])
        semantic_skills=[];suppressed_skills=0;skill_threshold=float(os.getenv('MIYAR_SEMANTIC_SKILL_THRESHOLD','.8' if caps['provider']=='local-e5-small' else '.5'))
        if not math.isfinite(skill_threshold) or not -1<=skill_threshold<=1:raise RuntimeError('Semantic skill threshold must be between minus one and one')
        if self.skill_matrix is not None and len(self.skill_matrix):
            skill_cosine=self.skill_matrix@vector
            for index in np.argsort(-skill_cosine)[:5]:
                similarity=float(np.clip(skill_cosine[int(index)],-1,1))
                if similarity>=skill_threshold:
                    skill=self.skills[int(index)]
                    evidence=scope.skill_evidence(skill['id'],required) if scope else None
                    if scope and evidence is None:
                        suppressed_skills+=1;continue
                    semantic_skills.append({**skill,'cosineSimilarity':round(similarity,5),'method':'multilingual-embedding-cosine','humanReviewRequired':True})
                    if scope:semantic_skills[-1]['scopeEvidence']=evidence
        query_metadata=self.model.query_metadata(text) if hasattr(self.model,'query_metadata') else {}
        if scope:
            query_metadata.update(occupationScope=scope.metadata(len(items)),semanticSkillScope={
                'coverage':'authored-limited','policy':'explicit-field-family-or-dictionary-evidence',
                'suppressedFromTopFive':suppressed_skills,
                'notice':'Skills in the limited authored domain-scope mapping need explicit field support or direct dictionary evidence. The actual top five are filtered without refilling. Transferable skills remain proposals; this is not a complete workforce skills inventory.'})
        return {'method':'multilingual-embedding-cosine','model':self.model_name,'modelFingerprint':self.model_fingerprint,'provider':caps['provider'],**query_metadata,'referenceText':'Occupation title and unit title; the supplied SSCO PDF does not contain task/skill profiles','release':self.occupations['id'],'candidates':items,'extractedSkills':skills,'semanticSkills':semantic_skills,'semanticSkillThreshold':skill_threshold,'semanticSkillThresholdCalibrated':False,'semanticSkillCorpusRecords':len(self.skills),'notice':'Cosine similarity is not a probability, approval, or a 65/35 role composition. Semantic skills are reviewable suggestions from the limited skill dictionary; the retrieval threshold is experimental, not an expert-accuracy percentage. Skill overlap is the share of extracted request skills in the selected proposed O*NET crosswalk. These two authored crosswalks require OD review; absent profiles and task overlap remain null.'}

def read_rows(raw,filename):
    if len(raw)>10_000_000:raise ValueError('Upload limit: 10 MB')
    if filename.lower().endswith('.csv'):
        text=raw.decode('utf-8-sig');sample=text[:8192]
        try:delimiter=csv.Sniffer().sniff(sample,delimiters=',;\t').delimiter
        except csv.Error:delimiter=','
        reader=csv.DictReader(io.StringIO(text),delimiter=delimiter,strict=True);rows=[]
        if not reader.fieldnames or len(reader.fieldnames)!=len(set(reader.fieldnames)):raise ValueError('Missing or duplicate column names')
        for i,row in enumerate(reader):
            if i>=10000:raise ValueError('Row limit: 10,000')
            if None in row:raise ValueError('Row has more values than the header')
            rows.append(row)
    elif filename.lower().endswith('.xlsx'):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if sum(x.file_size for x in archive.infolist())>100_000_000:raise ValueError('Expanded workbook limit exceeded')
        from openpyxl import load_workbook
        workbook=load_workbook(io.BytesIO(raw),read_only=True,data_only=False,keep_links=False);sheet=workbook.active;values=sheet.iter_rows(values_only=True);headers=[str(x or '').strip() for x in next(values,[])];rows=[]
        if len(headers)!=len(set(headers)):raise ValueError('Duplicate column names')
        for i,row in enumerate(values):
            if i>=10000:raise ValueError('Row limit: 10,000')
            rows.append(dict(zip(headers,row)))
        workbook.close()
    else:raise ValueError('Use UTF-8 CSV or XLSX')
    aliases={'المسمى':'title','المسمى الوظيفي':'title','الإدارة':'department','الرمز المهني':'occupationCode','المسؤوليات':'responsibilities','المرؤوسون':'directReports','الميزانية':'budgetAmount','الصلاحيات':'authority','العدد':'headcount','معرف المنصب':'positionId','المنصب الأب':'parentPositionId','الدرجة':'grade'}
    allowed={'title','department','occupationCode','responsibilities','directReports','budgetAmount','authority','headcount','internalCode','positionId','parentPositionId','grade'}
    canonical={k.lower():k for k in allowed}
    def header(k):
        value=aliases.get(str(k).strip(),str(k).strip());return canonical.get(value.lower(),value)
    headers=reader.fieldnames if filename.lower().endswith('.csv') else headers
    canonical_headers=[header(k) for k in headers]
    if len(canonical_headers)!=len(set(canonical_headers)):raise ValueError('Duplicate column names after language normalization')
    clean=[]
    for row_index,row in enumerate(rows,2):
        item={header(k):str('' if v is None else v).strip() for k,v in row.items() if k is not None}
        if not any(item.values()):continue
        if any(len(v)>10000 for v in item.values()):raise ValueError('Cell length exceeds 10,000 characters')
        clean.append({**{k:v for k,v in item.items() if k in allowed},'__row':row_index})
    if not clean:raise ValueError('No position rows found')
    return clean

def bulk_diagnosis(rows,catalog):
    if not rows or len(rows)>10000:raise ValueError('Use 1–10,000 rows')
    def number(value):
        import unicodedata
        text=unicodedata.normalize('NFKC',str(value or '')).translate(str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')).replace('−','-').replace(',','').replace('٬','').strip()
        try:return float(text) if text else 0.0
        except (ValueError,OverflowError):return float('nan')
    def rank(value):
        match=re.match(r'^(?:G|grade\s*|الدرجة\s*)?0*(\d+)(?:\b|$)',str(value or ''),re.I)
        return int(match.group(1)) if match else None
    budgets=sorted(number(r.get('budgetAmount')) for r in rows if math.isfinite(number(r.get('budgetAmount'))) and number(r.get('budgetAmount'))>0)
    median_budget=(budgets[(len(budgets)-1)//2]+budgets[len(budgets)//2])/2 if budgets else None
    output=[];groups=defaultdict(list);errors=[];matched=valid=assessable=0
    for offset,row in enumerate(rows,2):
        index=row.get('__row',offset);code=normalized(row.get('occupationCode','')).replace(' ','');record=catalog.roles.get(code);title=str(row.get('title','')).strip();flags=[];status='unknown'
        source_ok=record is not None and code not in catalog.flagged;valid+=int(source_ok)
        if not title:flags.append('missing_title');errors.append({'row':index,'field':'title','code':'missing_title'})
        elif not code:flags.append('missing_code')
        elif not record:flags.append('unknown_code')
        elif code in catalog.flagged:flags.append('source_issue')
        else:
            pair=catalog.match_title_code(title,code);status=pair['status']
            if status=='matched':matched+=1
            else:flags.append('title_code_inconsistent' if status=='inconsistent' else 'title_code_unknown')
        supplied=lambda key:row.get(key) is not None and str(row.get(key)).strip()!=''
        reports=number(row['directReports']) if supplied('directReports') else None;budget=number(row['budgetAmount']) if supplied('budgetAmount') else None
        if reports is not None and (not math.isfinite(reports) or reports<0 or reports!=int(reports)):flags.append('invalid_direct_reports')
        if budget is not None and (not math.isfinite(budget) or budget<0):flags.append('invalid_budget')
        if any(f in flags for f in ['invalid_direct_reports','invalid_budget']):flags.append('invalid_scope')
        if all(supplied(k) for k in ['directReports','budgetAmount','authority']) and 'invalid_scope' not in flags:
            assessable+=1
            if re.search(r'(?:^| )(?:مدير|رئيس|director|head|chief)(?: |$)',normalized(title)) and reports==0 and budget==0 and re.search(r'recommend|يقترح|توصيات|يوصي',normalized(row['authority'])):flags.append('title_scope_review')
        if re.fullmatch(r'(?:all|unlimited|absolute|كافة|كافه|كل|مطلقه|مطلقة|جميع)(?: الصلاحيات| authority| authorities)?',normalized(row.get('authority',''))):flags.append('absolute_authority')
        if budget is not None and math.isfinite(budget) and median_budget and budget>median_budget*10:flags.append('budget_outlier')
        if reports is not None and reports>15:flags.append('wide_span')
        if title:groups[(normalized(title),normalized(row.get('department','')))].append(index)
        output.append({'row':index,'title':title,'department':row.get('department',''),'positionId':str(row.get('positionId','')).strip(),'parentPositionId':str(row.get('parentPositionId','')).strip(),'grade':str(row.get('grade','')).strip(),'directReports':reports if reports is None or math.isfinite(reports) else None,'budgetAmount':budget if budget is None or math.isfinite(budget) else None,'occupationCode':code,'sourceTitle':record['titleAr'] if record else '','sourceTitleEn':record.get('titleEn','') if record else '','sourcePage':record['sourcePage'] if record else None,'titleCodeAligned':status=='matched','titleCodeStatus':status,'layer':None,'flags':flags})
    by_id={};ids=defaultdict(list)
    for row in output:
        if row['positionId']:ids[row['positionId']].append(row);by_id.setdefault(row['positionId'],row)
    for group in ids.values():
        if len(group)>1:
            for row in group:row['flags'].append('duplicate_position_id')
    memo={}
    def depth(start):
        if id(start) in memo:return memo[id(start)]
        path=[];seen={};current=start;base=None
        while current is not None:
            identity=id(current)
            if identity in memo:base=memo[identity];break
            if identity in seen:
                for entry in path[seen[identity]:]:
                    if 'hierarchy_cycle' not in entry['flags']:entry['flags'].append('hierarchy_cycle')
                break
            if not current['positionId'] or 'duplicate_position_id' in current['flags']:break
            seen[identity]=len(path);path.append(current)
            if not current['parentPositionId']:base=0;break
            parent=by_id.get(current['parentPositionId'])
            if parent is None:
                if 'missing_parent' not in current['flags']:current['flags'].append('missing_parent')
                break
            current=parent
        for entry in reversed(path):
            base=None if base is None else base+1;memo[id(entry)]=base
        memo.setdefault(id(start),None)
        return memo[id(start)]
    hierarchy_provided=any(r['positionId'] or r['parentPositionId'] or r['grade'] for r in output)
    for row in output:
        if hierarchy_provided and not row['positionId']:row['flags'].append('missing_position_id')
        if row['parentPositionId'] and row['parentPositionId'] not in by_id:row['flags'].append('missing_parent')
        row['layer']=depth(row);parent=by_id.get(row['parentPositionId']);grade=rank(row['grade']);parent_grade=rank(parent['grade']) if parent else None
        if parent and parent is not row and 'hierarchy_cycle' not in row['flags'] and grade is not None and parent_grade is not None and grade>=parent_grade:row['flags'].append('grade_inversion')
        if row['grade'] and grade is None:row['flags'].append('unknown_grade')
    for row in output:
        row['actualDirectReports']=sum(child is not row and child['parentPositionId']==row['positionId'] for child in output)
        if hierarchy_provided and row['positionId'] and row['directReports'] is not None and row['directReports']!=row['actualDirectReports']:row['flags'].append('direct_reports_mismatch')
    spans=sorted(row['directReports'] for row in output if row['directReports'] is not None and row['directReports']>0 and row['directReports']==int(row['directReports']))
    span={'managers':len(spans),'averageSpan':round(sum(spans)/len(spans),1),'medianSpan':(spans[(len(spans)-1)//2]+spans[len(spans)//2])/2,'singleReportManagers':sum(n==1 for n in spans),'narrowManagers':sum(n<=3 for n in spans),'wideManagers':sum(n>=15 for n in spans)} if spans else None
    hierarchy={'layers':max((r['layer'] or 0 for r in output),default=0),'roots':sum(bool(r['positionId']) and not r['parentPositionId'] for r in output),'missingParents':[r['row'] for r in output if 'missing_parent' in r['flags']],'cycleRows':[r['row'] for r in output if 'hierarchy_cycle' in r['flags']],'gradeInversions':[{'row':r['row'],'positionId':r['positionId'],'parentPositionId':r['parentPositionId'],'grade':r['grade'],'parentGrade':by_id[r['parentPositionId']]['grade']} for r in output if 'grade_inversion' in r['flags']]}
    duplicates=[{'title':key[0],'department':key[1],'rows':values} for key,values in groups.items() if len(values)>1]
    return {'release':catalog.occupations['id'],'totalRows':len(rows),'validRows':sum(bool(r['title']) for r in output),'rowErrors':errors,'codesFoundWithoutSourceIssue':valid,'exactTitleCodePairs':matched,'titleCodeAlignmentPercent':round(100*matched/len(rows),1),'duplicateGroups':duplicates,'scopeAssessableRows':assessable,'titleScopeReviewRows':sum(any(f in r['flags'] for f in ['title_scope_review','absolute_authority','budget_outlier','wide_span','invalid_scope']) for r in output),'spanOfControl':span,'hierarchy':hierarchy,'rows':output,'notice':'The report measures reference terminology and reporting links. Task fit and authority require specialist review; employee identity columns are discarded.'}
