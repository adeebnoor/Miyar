import time
from sqlalchemy import select
from server.demo import seed, DOMAIN, POSITIONS
from server.models import Organization, User, Position, AuditEvent

PASSWORD='synthetic-demo-password-928'


def login(c,email):return c.post('/api/v1/auth/login',json={'email':email,'password':PASSWORD})


def test_demo_tenant_runs_the_real_workflow_and_stays_isolated(env):
    app,c,auth,position=env
    production=position()
    started=time.time();summary=seed(app,PASSWORD);assert time.time()-started<600
    assert summary['positions']==len(POSITIONS) and summary['byStage']['active']==5 and summary['byStage']['draft']==2
    token=login(c,'admin@'+DOMAIN).json()['accessToken'];demo={'Authorization':'Bearer '+token}
    listed=c.get('/api/v1/positions',headers=demo,params={'limit':100}).json()
    assert listed['total']==len(POSITIONS) and production['id'] not in {p['id'] for p in listed['items']}
    assert {p['state'] for p in listed['items']}=={'draft','in_review','active'}
    assert c.get('/api/v1/positions/'+production['id'],headers=demo).status_code==404
    own=c.get('/api/v1/positions',headers=auth('admin'),params={'limit':100}).json()
    assert all(p['id']!=x['id'] for p in own['items'] for x in listed['items'])
    profile=c.get('/api/v1/settings/institution-profile',headers=demo)
    assert profile.status_code==200 and profile.json()['profile']['gradeStructure']['grades'][-1]['id']=='G13'
    requester=login(c,'line-manager@'+DOMAIN).json()['accessToken']
    mine=c.get('/api/v1/positions',headers={'Authorization':'Bearer '+requester},params={'limit':100}).json()['items']
    assert mine and len(mine)<len(POSITIONS)
    pending=next(p for p in mine if p['state']=='in_review')
    assert c.post('/api/v1/positions/'+pending['id']+'/decisions',headers={'Authorization':'Bearer '+requester},json={'revision':pending['revision'],'decision':'approve','comment':'self approval attempt','evidence':{}}).status_code in (403,409)


def test_reseed_archives_previous_tenant_without_deleting_audit(env):
    app,c,_,_=env
    first=seed(app,PASSWORD);old=login(c,'admin@'+DOMAIN).json()['accessToken']
    with app.state.sessions() as db:before=db.scalar(select(AuditEvent).where(AuditEvent.org_id==first['organizationId']).limit(1))
    second=seed(app,PASSWORD);assert second['archivedTenants']==1 and second['organizationId']!=first['organizationId']
    assert c.get('/api/v1/me',headers={'Authorization':'Bearer '+old}).status_code==401
    assert login(c,'admin@'+DOMAIN).status_code==200
    with app.state.sessions() as db:
        assert db.get(AuditEvent,before.id) is not None
        assert not any(u.active for u in db.scalars(select(User).where(User.org_id==first['organizationId'])))
        assert db.get(Organization,first['organizationId']).settings['demoArchived']


def test_demo_seed_rejects_a_weak_password_before_changing_anything(env):
    app,_,_,_=env
    try:seed(app,'short');assert False
    except ValueError:pass
    with app.state.sessions() as db:assert not any((o.settings or {}).get('demoTenant') for o in db.scalars(select(Organization)))


def test_remote_demo_reset_is_disabled_without_a_strong_operator_token(env,monkeypatch):
    _,c,_,_=env;path='/api/v1/operator/demo-tenant'
    assert c.post(path,json={'password':PASSWORD}).status_code==404
    monkeypatch.setenv('MIYAR_DEMO_SEED_TOKEN','short');assert c.post(path,json={'password':PASSWORD},headers={'X-Operator-Token':'short'}).status_code==404
    monkeypatch.setenv('MIYAR_DEMO_SEED_TOKEN','o'*40)
    assert c.post(path,json={'password':PASSWORD},headers={'X-Operator-Token':'x'*40}).status_code==403
    r=c.post(path,json={'password':PASSWORD},headers={'X-Operator-Token':'o'*40});assert r.status_code==200 and r.json()['positions']==len(POSITIONS)
    assert PASSWORD not in r.text


def test_ensure_builds_once_and_rebuilds_only_when_the_password_changes(env):
    from server.demo import ensure
    app,c,_,_=env
    first=ensure(app,PASSWORD);assert first and first['positions']==len(POSITIONS)
    assert ensure(app,PASSWORD) is None
    changed=ensure(app,PASSWORD+'-new');assert changed and changed['archivedTenants']==1
    assert login(c,'admin@'+DOMAIN).status_code==401
    assert c.post('/api/v1/auth/login',json={'email':'admin@'+DOMAIN,'password':PASSWORD+'-new'}).status_code==200
