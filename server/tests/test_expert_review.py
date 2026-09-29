from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from server.models import ExpertReviewQuota, User, Position
from server.strategic import StrategicEngine, Unavailable

PATH='/api/v1/review/strategic'
ORIGIN={'Origin':'https://adeebnoor.github.io'}
BODY={'text':'Improve civil project design and construction quality.','field':'Engineering','seniority':'Professional','constraints':'No team management.','consentExternalProcessing':True}


def setup(monkeypatch):
    for key,value in {'MIYAR_ENABLE_EXPERT_REVIEW':'true','MIYAR_EXPERT_REVIEW_EXPIRES_AT':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),'MIYAR_ENABLE_STRATEGIC_AI':'true','MIYAR_STRATEGIC_EMBEDDING_MODE':'gemini','MIYAR_STRATEGIC_EMBEDDING_MODEL':'gemini-embedding-001','MIYAR_STRATEGIC_GEMINI_MODEL':'test-model','MIYAR_STRATEGIC_GEMINI_KEY':'private-provider-test-key'}.items():monkeypatch.setenv(key,value)
    calls=[]
    def analyze(self,context,nodes,threshold):
        calls.append((context,nodes,threshold))
        return {'route':'matched-objective','finalTitle':'Civil Engineer','occupationCode':'214201','status':'human-review-required'}
    monkeypatch.setattr(StrategicEngine,'analyze',analyze)
    return calls


def test_review_defaults_closed_and_expiry_is_enforced(env,monkeypatch):
    _,c,_,_=env;calls=setup(monkeypatch)
    for expiry in ['', 'invalid', '2026-01-01T00:00:00', '2020-01-01T00:00:00Z']:
        monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT',expiry)
        assert not c.get(PATH+'/status').json()['enabled']
        assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==410
    setup(monkeypatch);monkeypatch.delenv('MIYAR_ENABLE_EXPERT_REVIEW')
    assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==410
    assert not calls


def test_review_requires_consent_origin_and_bounded_inputs(env,monkeypatch):
    _,c,_,_=env;calls=setup(monkeypatch)
    assert c.post(PATH,json={**BODY,'consentExternalProcessing':False},headers=ORIGIN).status_code==422
    assert c.post(PATH,json=BODY,headers={'Origin':'https://unrelated.example'}).status_code==403
    assert c.post(PATH,json={**BODY,'text':'x'*2501},headers=ORIGIN).status_code==422
    assert c.post(PATH,json={**BODY,'organizationId':'org-b'},headers=ORIGIN).status_code==422
    assert not calls


def test_public_review_does_not_grant_organization_access_or_create_accounts(env,monkeypatch):
    app,c,_,_=env;calls=setup(monkeypatch)
    with app.state.sessions() as db:before=list(db.scalars(select(User.id)))
    r=c.post(PATH,json=BODY,headers=ORIGIN);assert r.status_code==200,r.text
    assert not r.json()['organizationAccess'] and r.json()['mode']=='expert-review'
    assert calls[0][1] is app.state.catalog.occupations['nodes']
    assert c.post('/api/v1/analyze/strategic',json=BODY).status_code==401
    assert c.get('/api/v1/positions').status_code==401
    assert c.get('/api/v1/me').status_code==401
    with app.state.sessions() as db:
        assert list(db.scalars(select(User.id)))==before
        assert not list(db.scalars(select(Position.id)))
        quotas=list(db.scalars(select(ExpertReviewQuota)))
        assert len(quotas)==2 and all(q.requests==1 for q in quotas)
        assert all('testclient' not in q.key for q in quotas)
    status=c.get(PATH+'/status');assert status.json()['remainingToday']==59
    assert 'private-provider-test-key' not in status.text


def test_persisted_global_and_network_limits_precede_provider(env,monkeypatch):
    app,c,_,_=env;calls=setup(monkeypatch)
    import server.expert_review as module
    stamp=int(module.time.time());monkeypatch.setattr(module.time,'time',lambda:stamp)
    assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==200
    assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==429
    assert len(calls)==1
    with app.state.sessions() as db:
        visitor=db.scalar(select(ExpertReviewQuota).where(ExpertReviewQuota.key!='global'))
        visitor.requests=12;visitor.last_request=stamp-21;db.commit()
    assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==429
    with app.state.sessions() as db:
        db.get(ExpertReviewQuota,'global').requests=60;db.commit()
    # A fresh client still sees the persisted reservation, not an in-memory count.
    from fastapi.testclient import TestClient
    with TestClient(app) as fresh:
        assert fresh.get(PATH+'/status').json()['remainingToday']==0
        assert fresh.post(PATH,json=BODY,headers=ORIGIN).status_code==429
    assert len(calls)==1


def test_provider_errors_are_redacted_and_consume_quota(env,monkeypatch):
    app,c,_,_=env;setup(monkeypatch)
    def fail(*args):raise Unavailable('private-provider-test-key')
    monkeypatch.setattr(StrategicEngine,'analyze',fail)
    r=c.post(PATH,json=BODY,headers=ORIGIN)
    assert r.status_code==503 and 'private-provider-test-key' not in r.text
    assert 'finalTitle' not in r.json()
    assert c.get(PATH+'/status').json()['remainingToday']==59


def test_status_reports_expiry_countdown_and_quota_usage(env,monkeypatch):
    _,c,_,_=env;setup(monkeypatch)
    monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT',(datetime.now(timezone.utc)+timedelta(days=5,hours=1)).isoformat())
    state=c.get(PATH+'/status').json()
    assert state['enabled'] and state['daysRemaining']==5 and state['expiringSoon']
    assert state['usagePercent']==0 and not state['nearLimit']
    monkeypatch.setenv('MIYAR_EXPERT_REVIEW_EXPIRES_AT',(datetime.now(timezone.utc)+timedelta(days=95)).isoformat())
    assert not c.get(PATH+'/status').json()['expiringSoon']
    assert c.post(PATH,json=BODY,headers=ORIGIN).status_code==200
    assert c.get(PATH+'/status').json()['usagePercent']==2
    assert c.get('/health').json()['services']['expertReview']['daysRemaining']>=94


def test_quota_limits_are_operator_configurable_within_bounds(monkeypatch):
    import importlib, server.expert_review as module
    monkeypatch.setenv('MIYAR_EXPERT_REVIEW_DAILY_LIMIT','300');monkeypatch.setenv('MIYAR_EXPERT_REVIEW_HOURLY_LIMIT','not-a-number')
    try:
        reloaded=importlib.reload(module)
        assert reloaded.DAILY_LIMIT==300 and reloaded.HOURLY_LIMIT==12
        monkeypatch.setenv('MIYAR_EXPERT_REVIEW_DAILY_LIMIT','999999')
        assert importlib.reload(module).DAILY_LIMIT==2000
    finally:
        monkeypatch.delenv('MIYAR_EXPERT_REVIEW_DAILY_LIMIT');monkeypatch.delenv('MIYAR_EXPERT_REVIEW_HOURLY_LIMIT');importlib.reload(module)
