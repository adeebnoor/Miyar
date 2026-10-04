"""Real API boundaries around deterministic providers, never real customer data."""
from datetime import datetime,timedelta,timezone
from sqlalchemy import select
from server.models import ExpertReviewQuota,Position,User,AuditEvent
from server.taxonomy import Catalog
import server.performance as performance

ORIGIN={'Origin':'https://adeebnoor.github.io'}
TEXT='Analyze SQL evidence and risk-based audit planning without approval authority.'
INPUT={'text':TEXT,'field':'Internal Audit','seniority':'Specialist','consentExternalProcessing':True}
CONTENT={'title':'Internal Audit Specialist','successMeasures':'Reduce overdue findings by 20% in 90 days','responsibilities':TEXT}
ROWS=[{'outcome':CONTENT['successMeasures'],'metric':'Overdue findings / all findings x 100','target':'Proposed 20% reduction within 90 days','frequency':'Monthly','deliverable':'Auditable findings register'}]*3

def setup(env,monkeypatch):
    app,c,auth,_=env
    for key,value in {'MIYAR_ENABLE_EMBEDDINGS':'true','MIYAR_EMBEDDING_PROVIDER':'gemini','MIYAR_STRATEGIC_EMBEDDING_MODEL':'gemini-embedding-001','MIYAR_STRATEGIC_GEMINI_KEY':'synthetic-private-provider-key','MIYAR_STRATEGIC_GEMINI_MODEL':'gemini-test','MIYAR_KPI_PROVIDER':'gemini','MIYAR_ENABLE_EXPERT_REVIEW':'true','MIYAR_EXPERT_REVIEW_EXPIRES_AT':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}.items():monkeypatch.setenv(key,value)
    monkeypatch.setattr(Catalog,'semantic_status',lambda self:{'configured':True,'enabled':True,'modelReady':True})
    calls=[]
    def semantic(self,text,candidate_codes=None,field='',seniority=''):
        calls.append(('semantic',text))
        return {'model':'gemini-embedding-001','modelFingerprint':'synthetic-fingerprint','candidates':[],'semanticSkills':[],'extractedSkills':[]}
    def kpis(content,lang):calls.append(('kpis',content,lang));return ROWS
    monkeypatch.setattr(Catalog,'semantic',semantic);monkeypatch.setattr(performance,'generate_kpis',kpis)
    return app,c,auth,calls

def test_new_public_ai_features_require_consent_origin_and_active_window(env,monkeypatch):
    app,c,auth,calls=setup(env,monkeypatch)
    for route,body in [('/review/semantic',INPUT),('/review/kpis',{'content':CONTENT,'lang':'en','consentExternalProcessing':True})]:
        path='/api/v1'+route
        assert c.post(path,json={**body,'consentExternalProcessing':False},headers=ORIGIN).status_code==422
        assert c.post(path,json=body,headers={'Origin':'https://unrelated.example'}).status_code==403
        monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT','2020-01-01T00:00:00Z')
        assert c.post(path,json=body,headers=ORIGIN).status_code==410
        monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT',(datetime.now(timezone.utc)+timedelta(days=1)).isoformat())
    assert not calls
    with app.state.sessions() as db:assert db.get(ExpertReviewQuota,'global').requests==0

def test_local_semantic_processing_does_not_require_external_consent_or_relax_public_guards(env,monkeypatch):
    app,c,_,calls=setup(env,monkeypatch)
    monkeypatch.setenv('MIYAR_EMBEDDING_PROVIDER','local-e5-small')
    monkeypatch.setattr(Catalog,'semantic_status',lambda self:{'configured':True,'enabled':True,'modelReady':True,'externalProcessing':False})
    body={**INPUT,'consentExternalProcessing':False}
    assert c.post('/api/v1/review/semantic',json=body,headers={'Origin':'https://unrelated.example'}).status_code==403
    result=c.post('/api/v1/review/semantic',json=body,headers=ORIGIN)
    assert result.status_code==200 and result.json()['organizationAccess'] is False
    assert result.json()['inputStored'] is False
    assert c.post('/api/v1/review/kpis',json={'content':CONTENT,'consentExternalProcessing':False},headers=ORIGIN).status_code==422
    monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT','2020-01-01T00:00:00Z')
    assert c.post('/api/v1/review/semantic',json=body,headers=ORIGIN).status_code==410
    assert [call[0] for call in calls]==['semantic']
    with app.state.sessions() as db:assert db.get(ExpertReviewQuota,'global').requests==1

def test_public_semantic_and_kpis_share_quota_without_creating_org_records(env,monkeypatch):
    app,c,_,calls=setup(env,monkeypatch)
    import server.expert_review as review
    stamp=int(review.time.time());monkeypatch.setattr(review.time,'time',lambda:stamp)
    with app.state.sessions() as db:users=list(db.scalars(select(User.id)))
    result=c.post('/api/v1/review/semantic',json=INPUT,headers=ORIGIN)
    assert result.status_code==200,result.text
    assert result.json()['inputStored'] is False and result.json()['organizationAccess'] is False
    assert c.post('/api/v1/review/kpis',json={'content':CONTENT,'consentExternalProcessing':True},headers=ORIGIN).status_code==429
    stamp+=21
    result=c.post('/api/v1/review/kpis',json={'content':CONTENT,'lang':'en','consentExternalProcessing':True},headers=ORIGIN)
    assert result.status_code==200,result.text
    assert result.json()['kpis']==ROWS and result.json()['status']=='human-review-required'
    assert [call[0] for call in calls]==['semantic','kpis']
    with app.state.sessions() as db:
        assert list(db.scalars(select(User.id)))==users
        assert not list(db.scalars(select(Position)))
        assert not list(db.scalars(select(AuditEvent)))
        assert db.get(ExpertReviewQuota,'global').requests==2

def test_public_kpi_content_rejects_approval_and_tenant_injection_before_provider(env,monkeypatch):
    _,c,_,calls=setup(env,monkeypatch)
    for content in [{**CONTENT,'approvals':[{'role':'chro'}]},{**CONTENT,'organizationId':'org-b'},{'title':'Auditor'}]:
        r=c.post('/api/v1/review/kpis',json={'content':content,'consentExternalProcessing':True},headers=ORIGIN)
        assert r.status_code==422,r.text
    assert c.post('/api/v1/review/semantic',json={**INPUT,'organizationId':'org-b'},headers=ORIGIN).status_code==422
    assert not calls

def test_provider_failure_redacted_reservation_kept_and_slot_released(env,monkeypatch):
    app,c,_,_=setup(env,monkeypatch)
    import server.expert_review as review
    stamp=int(review.time.time());monkeypatch.setattr(review.time,'time',lambda:stamp)
    def failure(*args):raise ValueError('synthetic-private-provider-key')
    monkeypatch.setattr(performance,'generate_kpis',failure)
    r=c.post('/api/v1/review/kpis',json={'content':CONTENT,'consentExternalProcessing':True},headers=ORIGIN)
    assert r.status_code==503 and 'synthetic-private-provider-key' not in r.text and 'kpis' not in r.json()
    stamp+=21
    assert c.post('/api/v1/review/semantic',json=INPUT,headers=ORIGIN).status_code==200
    with app.state.sessions() as db:assert db.get(ExpertReviewQuota,'global').requests==2

def test_authenticated_ai_requires_consent_correct_role_and_keeps_audit_digest(env,monkeypatch):
    app,c,auth,calls=setup(env,monkeypatch)
    body={'content':CONTENT,'lang':'en'}
    assert c.post('/api/v1/performance/kpis',json=body).status_code==401
    assert c.post('/api/v1/analyze/semantic',json=INPUT).status_code==401
    assert c.post('/api/v1/performance/kpis',json=body,headers=auth()).status_code==422
    assert c.post('/api/v1/analyze/semantic',json={**INPUT,'consentExternalProcessing':False},headers=auth()).status_code==422
    assert c.post('/api/v1/performance/kpis',json={**body,'consentExternalProcessing':True},headers=auth('finance')).status_code==403
    r=c.post('/api/v1/performance/kpis',json={**body,'consentExternalProcessing':True},headers=auth())
    assert r.status_code==200,r.text
    assert c.post('/api/v1/analyze/semantic',json=INPUT,headers=auth()).status_code==429
    with app.state.sessions() as db:
        event=db.scalar(select(AuditEvent).where(AuditEvent.action=='performance.suggested'))
        assert event.org_id=='org-a' and len(event.detail['inputDigest'])==64
        assert CONTENT['successMeasures'] not in str(event.detail)
    assert len(calls)==1

def test_kpi_and_semantic_health_configuration_never_expose_keys(env,monkeypatch):
    _,c,auth,_=setup(env,monkeypatch)
    for path,headers in [('/health',{}),('/api/v1/capabilities',auth()),('/api/v1/review/strategic/status',{})]:
        r=c.get(path,headers=headers)
        assert r.status_code==200 and 'synthetic-private-provider-key' not in r.text
    status=c.get('/health').json()['services']
    assert status['kpiGenerationEnabled'] and status['semanticEnabled']
