import json, math
import pytest
from sqlalchemy import select
from server.strategic import StrategicEngine, Unavailable, unit, Embeddings, E5_MODEL
from server.models import AuditEvent

ROWS=[{'objective':'Improve safe project delivery','title':'Civil Engineer','ssco':'214201','educationCode':'073201'}]
NODES=[{'code':'214201','level':'occupation'}]
CONTEXT={'text':'Improve project delivery','field':'engineering','seniority':'professional','constraints':'office only'}

def engine(score=1, title='Civil Engineer', suitable=True, satisfied=True):
    calls=[];embeds=[]
    def embed(texts,kind):
        embeds.append((texts,kind))
        return [[1.,0.]] if kind=='passage' else [[score,math.sqrt(1-score*score)]]
    def llm(stage,data):
        calls.append((stage,data))
        if stage=='validate':return {'suitable':suitable,'issues':[],'suggestedTitle':title,'rationale':'Scope reviewed'}
        return {'title':title,'rationale':'Proposed from scope','constraintsSatisfied':satisfied}
    return StrategicEngine(ROWS,embed,llm),calls,embeds

def test_match_embeds_objectives_not_titles_then_validates_and_finalizes():
    e,c,b=engine();r=e.analyze(CONTEXT,NODES)
    assert b==[([ROWS[0]['objective']],'passage'),([CONTEXT['text']],'query')]
    assert [s for s,d in c]==['validate','finalize']
    assert c[0][1]['constraints']=='office only'
    assert r['route']=='matched-objective' and r['occupationCode']=='214201'
    assert r['educationCode']=='073201' and not r['similarityIsConfidence']
    e.analyze(CONTEXT,NODES);assert len([x for x in b if x[1]=='passage'])==1

@pytest.mark.parametrize('score,route',[(.85,'matched-objective'),(.849,'generated-proposal')])
def test_threshold_branches(score,route):
    e,c,_=engine(score=score);assert e.analyze(CONTEXT,NODES)['route']==route
    assert [s for s,d in c]==(['generate','validate','finalize'] if score<.85 else ['validate','finalize'])

def test_generated_title_never_inherits_official_code_and_low_similarity_does_not_prove_novelty():
    e,_,_=engine(.1,'AI Workforce Specialist');r=e.analyze(CONTEXT,NODES)
    assert r['finalTitle']=='AI Workforce Specialist' and r['occupationCode'] is None
    assert r['educationCode'] is None and not r['noveltyEstablished']

def test_changed_title_or_missing_reference_clears_code():
    e,_,_=engine(title='Project Specialist');assert e.analyze(CONTEXT,NODES)['occupationCode'] is None
    e,_,_=engine();assert e.analyze(CONTEXT,[])['occupationCode'] is None

@pytest.mark.parametrize('title,suitable,satisfied',[('Engineering Manager',True,True),('Civil Engineer',False,True),('Civil Engineer',True,False)])
def test_rejected_constraints_or_level_block_final_title(title,suitable,satisfied):
    e,_,_=engine(title=title,suitable=suitable,satisfied=satisfied);r=e.analyze(CONTEXT,NODES)
    assert r['status']=='blocked' and r['finalTitle'] is None and r['occupationCode'] is None

@pytest.mark.parametrize('value',[[],[0,0],[True,1],[float('nan'),0],[1e308,1e308],['1',0]])
def test_invalid_vectors_are_rejected(value):
    with pytest.raises(Unavailable):unit(value)

def test_incomplete_query_and_dimension_mismatch_fail_without_a_model_result():
    for vectors in ([],[[1,0,0]]):
        e=StrategicEngine(ROWS,lambda texts,kind:[[1,0]] if kind=='passage' else vectors,lambda *a:pytest.fail('Model should not run'))
        with pytest.raises(Unavailable):e.analyze(CONTEXT,NODES)

def test_remote_e5_prefixes_and_response_order(monkeypatch):
    import server.strategic as module
    seen=[]
    monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODE','remote');monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODEL',E5_MODEL)
    monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_ENDPOINT','https://embeddings.example.test/v1/embeddings');monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_KEY','test-placeholder')
    class Response:
        content=b'{}'
        def raise_for_status(self):pass
        def json(self):return {'data':[{'index':1,'embedding':[0,2]},{'index':0,'embedding':[2,0]}]}
    class Client:
        def __init__(self,**kw):pass
        def __enter__(self):return self
        def __exit__(self,*a):pass
        def post(self,url,**kw):seen.append(kw['json']);return Response()
    monkeypatch.setattr(module.httpx,'Client',Client)
    assert Embeddings()(['A','B'],'passage')==[[1.,0.],[0.,1.]]
    assert seen[0]['input']==['passage: A','passage: B']

def configure(monkeypatch):
    for key,value in {'MIYAR_ENABLE_STRATEGIC_AI':'true','MIYAR_STRATEGIC_EMBEDDING_MODE':'remote','MIYAR_STRATEGIC_EMBEDDING_ENDPOINT':'https://embedding.example.test','MIYAR_STRATEGIC_EMBEDDING_KEY':'private-test-embedding','MIYAR_STRATEGIC_EMBEDDING_MODEL':E5_MODEL,'MIYAR_STRATEGIC_GEMINI_KEY':'private-test-generation','MIYAR_STRATEGIC_GEMINI_MODEL':'configured-model'}.items():monkeypatch.setenv(key,value)

def test_endpoint_requires_auth_consent_and_configuration_without_fallback(env,monkeypatch):
    _,c,auth,_=env;path='/api/v1/analyze/strategic';body={**CONTEXT,'consentExternalProcessing':True}
    monkeypatch.delenv('MIYAR_ENABLE_STRATEGIC_AI',raising=False)
    status=c.get(path+'/status');assert status.status_code==200 and not status.json()['configured']
    assert status.json()['corpusRecords']==5
    assert c.post(path,json=body).status_code==401
    assert c.post(path,headers=auth('finance'),json=body).status_code==403
    assert c.post(path,headers=auth(),json={**body,'consentExternalProcessing':False}).status_code==422
    r=c.post(path,headers=auth(),json=body);assert r.status_code==503 and 'No rule-based result' in r.text

def test_endpoint_success_audits_only_digest_and_rate_limits(env,monkeypatch):
    app,c,auth,_=env;configure(monkeypatch);e,_,_=engine()
    monkeypatch.setattr(StrategicEngine,'analyze',lambda self,*a:e.analyze_original(*a))
    # Save the real bound implementation independently of the class patch.
    e.analyze_original=REAL_ANALYZE.__get__(e,StrategicEngine)
    status=c.get('/api/v1/analyze/strategic/status');assert status.json()['configured']
    assert 'private-test' not in status.text
    path='/api/v1/analyze/strategic';body={**CONTEXT,'consentExternalProcessing':True}
    r=c.post(path,headers=auth(),json=body);assert r.status_code==200,r.text
    assert r.json()['occupationCode']=='214201' and r.json()['auditEventId']
    observed=c.get(path+'/status').json();assert observed['liveVerified'] and observed['lastSuccessfulRunAt']
    assert r.json()['embeddingModel']==E5_MODEL
    assert c.post(path,headers=auth(),json=body).status_code==429
    with app.state.sessions() as db:
        event=db.scalar(select(AuditEvent).where(AuditEvent.action=='strategic-ai.analyzed'))
        detail=json.dumps(event.detail);assert CONTEXT['text'] not in detail and CONTEXT['constraints'] not in detail
    assert c.get('/api/v1/audit/verify',headers=auth('admin')).json()['valid']

REAL_ANALYZE=StrategicEngine.analyze

def test_provider_failure_is_redacted_and_no_fabricated_title(env,monkeypatch):
    _,c,auth,_=env;configure(monkeypatch)
    def fail(*a):raise Unavailable('provider error contains private-test-generation')
    monkeypatch.setattr(StrategicEngine,'analyze',fail)
    r=c.post('/api/v1/analyze/strategic',headers=auth(),json={**CONTEXT,'consentExternalProcessing':True})
    assert r.status_code==503 and 'private-test' not in r.text and 'finalTitle' not in r.text

def test_exact_arabic_reference_alias_retains_source_code():
    e,_,_=engine(title='مهندس مدني')
    assert e.analyze(CONTEXT,[{**NODES[0],'titleAr':'مهندس مدني'}])['occupationCode']=='214201'

@pytest.mark.parametrize('kind,task',[('query','RETRIEVAL_QUERY'),('passage','RETRIEVAL_DOCUMENT')])
def test_gemini_embeddings_use_one_server_key_and_preserve_real_vector_order(monkeypatch,kind,task):
    import server.strategic as module
    seen=[]
    monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODE','gemini');monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODEL','gemini-embedding-001');monkeypatch.setenv('MIYAR_STRATEGIC_GEMINI_KEY','private-test-generation')
    class Response:
        content=b'{}'
        def raise_for_status(self):pass
        def json(self):return {'embeddings':[{'values':[3,0]},{'values':[0,2]}]}
    class Client:
        def __init__(self,**kw):pass
        def __enter__(self):return self
        def __exit__(self,*a):pass
        def post(self,url,**kw):seen.append((url,kw));return Response()
    monkeypatch.setattr(module.httpx,'Client',Client)
    assert Embeddings()(['Objective A','Objective B'],kind)==[[1.,0.],[0.,1.]]
    url,kw=seen[0];assert url=='https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents'
    assert 'key=' not in url and kw['headers']['x-goog-api-key']=='private-test-generation'
    assert [x['content']['parts'][0]['text'] for x in kw['json']['requests']]==['Objective A','Objective B']
    assert all(x['taskType']==task for x in kw['json']['requests'])

def test_one_key_configuration_does_not_claim_live_inference(monkeypatch):
    from server.strategic import capability
    configure(monkeypatch);monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODE','gemini');monkeypatch.setenv('MIYAR_STRATEGIC_EMBEDDING_MODEL','gemini-embedding-001')
    monkeypatch.delenv('MIYAR_STRATEGIC_EMBEDDING_KEY');monkeypatch.delenv('MIYAR_STRATEGIC_EMBEDDING_ENDPOINT')
    r=capability();assert r['configured'] and r['embeddingConfigured'] and r['generationConfigured']
    assert not r['liveVerified'] and r['embeddingModel']=='gemini-embedding-001' and r['provider']=='Google Gemini'
    monkeypatch.delenv('MIYAR_STRATEGIC_GEMINI_KEY');assert not capability()['configured']
