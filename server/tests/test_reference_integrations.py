import io,copy,json,hashlib,hmac
import pytest,httpx
from sqlalchemy import select
from server.taxonomy import Catalog,read_rows,bulk_diagnosis
from server.governed import route,DEFAULT_POLICY
from server.models import OutboxEvent
from server.worker import deliver_one
from .conftest import activate

def test_bulk_xlsx_zero_and_formula_cells_remain_literal():
    from openpyxl import Workbook
    w=Workbook();s=w.active;s.append(['title','department','occupationCode','directReports','budgetAmount','authority']);s.append(['مدير نظم','IT','251104',0,0,'يوصي']);out=io.BytesIO();w.save(out)
    rows=read_rows(out.getvalue(),'positions.xlsx');assert rows[0]['directReports']=='0';r=bulk_diagnosis(rows,Catalog());assert r['titleScopeReviewRows']==1
    rows[0]['budgetAmount']='NaN';r=bulk_diagnosis(rows,Catalog());assert r['scopeAssessableRows']==0;assert 'invalid_scope_numbers' in r['rows'][0]['flags']

def test_dual_gates_fallback_and_provisional_parent():
    c=Catalog();candidates=[{'code':'251204','cosineSimilarity':.9},{'code':'251104','cosineSimilarity':.7},{'code':'251403','cosineSimilarity':.65}]
    assert route(candidates,c,set())['route']=='candidate_for_review'
    policy={**DEFAULT_POLICY,'similarityThreshold':.95}
    d=route(candidates,c,{'251104'},policy);assert d['route']=='approved_library_fallback';assert d['selected']['code']=='251104';assert d['humanApprovalRequired'];assert not d['nationalCodeReleaseAllowed']
    d=route(candidates,c,set(),policy);assert d['route']=='provisional_required';assert d['provisionalParent']=='2512'
    d=route(candidates,c,{'251204'},{**DEFAULT_POLICY,'rules':{'251204':{'licenseRequired':True}}});assert d['route']=='provisional_required'
    bad=[{'code':'523401','cosineSimilarity':.95},{'code':'251104','cosineSimilarity':.6}];assert route(bad,c,set())['rules'][1]['pass'] is False
    with pytest.raises(ValueError):route(candidates,c,set(),{'similarityThreshold':float('nan'),'minimumMargin':.01})

def test_import_idempotency_and_approved_snapshot_export(env):
    app,c,auth,create=env;p=create();body={'source':'sap','positions':[{'externalId':'P100','departmentId':'org-a-one','content':p['content']}]};headers={**auth('integration'),'Idempotency-Key':'test-import-001'}
    a=c.post('/api/v1/integrations/positions/import',headers=headers,json=body);assert a.status_code==200,a.text;assert a.json()['items'][0]['state']=='draft'
    assert c.post('/api/v1/integrations/positions/import',headers=headers,json=body).json()==a.json()
    changed=copy.deepcopy(body);changed['positions'][0]['content']['title']='changed';assert c.post('/api/v1/integrations/positions/import',headers=headers,json=changed).status_code==409
    assert c.post('/api/v1/integrations/positions/import',headers={**auth(),'Idempotency-Key':'test-import-002'},json=body).status_code==403
    activate(c,auth,p);assert len(c.get('/api/v1/integrations/approved-positions',headers=auth('integration')).json()['items'])==1

def test_versioned_taxonomy_staging_activation_and_old_revision_source(env):
    app,c,auth,create=env;p=create();release={'schema':'miyar-taxonomy/1.0','id':'organization-test-2026','edition':'Test fixture only','sha256':'a'*64,'nodes':[{'code':code,'titleAr':'Test '+code,'parent':parent,'level':level,'sourcePage':1} for code,parent,level in [('2',None,'major'),('29','2','submajor'),('299','29','minor'),('2999','299','unit'),('299901','2999','occupation')]]}
    assert c.post('/api/v1/taxonomy/releases/import',headers=auth('admin'),json=release).status_code==200
    assert c.post('/api/v1/organization/taxonomy/activate',headers=auth('admin'),json={'release':release['id'],'sourceReviewed':True,'reason':'Expert verification of test source'}).status_code==403
    assert c.post('/api/v1/organization/taxonomy/activate',headers=auth('od_specialist'),json={'release':release['id'],'sourceReviewed':True,'reason':'Expert verification of test source'}).status_code==200
    assert c.get('/api/v1/organization/taxonomy',headers=auth()).json()['release']==release['id']
    r=c.post('/api/v1/positions',headers=auth(),json={'departmentId':'org-a-one','content':{'title':'New','occupationCode':'299901'},'reason':'Test active edition'});assert r.status_code==201,r.text;assert r.json()['content']['occupationRelease']==release['id']
    assert c.get('/api/v1/positions/'+p['id'],headers=auth()).json()['content']['occupationRelease']=='ssco-2019-supplied'
    assert c.get('/api/v1/organization/taxonomy/releases',headers=auth('admin','org-b')).json()['active']=='ssco-2019-supplied'

def test_signed_outbox_retry_and_tenant_destination(env,monkeypatch):
    app,c,auth,create=env;p=activate(c,auth,create());key='test-webhook-secret-that-is-long-enough';monkeypatch.setenv('MIYAR_WEBHOOKS_JSON',json.dumps({'org-a':{'url':'https://hr.example.test/webhook','allowedHost':'hr.example.test','secret':key}}))
    monkeypatch.setattr('server.worker.socket.getaddrinfo',lambda *a,**k:[(2,1,6,'',('93.184.215.14',443))]);requests=[]
    def receive(request):
        requests.append(request);stamp=request.headers['X-Miyar-Timestamp'];sig=hmac.new(key.encode(),stamp.encode()+b'.'+request.content,hashlib.sha256).hexdigest();assert request.headers['X-Miyar-Signature']=='sha256='+sig
        return httpx.Response(503 if len(requests)==1 else 200)
    transport=httpx.MockTransport(receive)
    with app.state.sessions() as db:
        assert deliver_one(db,transport);event=db.scalar(select(OutboxEvent));assert event.status=='retry';event.next_attempt=0;db.commit();assert deliver_one(db,transport);assert event.status=='delivered';assert event.attempts==2
    assert requests[0].headers['X-Miyar-Event-Id']==requests[1].headers['X-Miyar-Event-Id']

def test_csv_duplicate_aliases_and_malformed_xlsx_are_rejected(env):
    app,c,auth,create=env
    for raw in [b'title,title\na,b', 'title,المسمى\na,b'.encode(),b'title\na,b']:
        with pytest.raises(ValueError):read_rows(raw,'bad.csv')
    r=c.post('/api/v1/organization/diagnose',headers=auth('admin'),files={'file':('bad.xlsx',b'not a workbook')})
    assert r.status_code==422

def test_semantic_request_preserves_unrestricted_context_and_marks_constraints_for_review(env,monkeypatch):
    app,c,auth,create=env;seen=[]
    def semantic(text,candidate_codes=None):
        seen.append(text);return {'model':'test-only-model','modelFingerprint':'test-only-fingerprint','release':app.state.catalog.occupations['id'],'candidates':[{'code':'251204','cosineSimilarity':.9},{'code':'251104','cosineSimilarity':.7}],'extractedSkills':[]}
    monkeypatch.setattr(app.state.catalog,'semantic',semantic)
    body={'text':'Build software for research','field':'Health informatics / digital twins','seniority':'Principal - 12+ years','constraints':'No direct reports'}
    r=c.post('/api/v1/analyze/governed',headers=auth(),json=body)
    assert r.status_code==200,r.text
    assert r.json()['request']==body;assert r.json()['constraintsReviewRequired'] is True
    assert body['field'] in seen[0] and body['seniority'] in seen[0]
    assert r.json()['decision']['humanApprovalRequired'] is True
