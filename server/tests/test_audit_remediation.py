import copy,time,jwt
from sqlalchemy import select
from server.models import AuditEvent
from server.domain import DEFAULT_FRAMEWORK

def test_release_headers_and_canonical_redirect(env):
    app,c,auth,_=env
    r=c.get('/health');body=r.json()
    assert body['version']==body['frontendVersion']=='6.1.1'
    assert len(body['buildId'])==16
    assert body['services']['strategicAI']['purpose']=='strategic-objective-to-role'
    assert body['services']['skillsSemantic']['purpose']=='occupation-skill-matching'
    assert r.headers['cache-control']=='no-store'
    for h in ['strict-transport-security','x-frame-options','permissions-policy','content-security-policy-report-only','x-request-id']:assert h in r.headers
    assert r.headers['x-frame-options']=='DENY'
    root=c.get('/',follow_redirects=False)
    assert root.status_code==307 and 'adeebnoor.github.io/Miyar/?v=6.1.1#home' in root.headers['location']
    assert c.get('/missing').headers['x-frame-options']=='DENY'

def test_framework_preview_does_not_activate_and_enforces_roles(env):
    app,c,auth,_=env
    body={'framework':copy.deepcopy(DEFAULT_FRAMEWORK),'reason':'Framework audit preview'}
    before=c.get('/api/v1/settings',headers=auth('admin')).json()['framework']
    assert c.post('/api/v1/settings/framework/preview',json=body,headers=auth()).status_code==403
    preview=c.post('/api/v1/settings/framework/preview',json=body,headers=auth('admin'))
    assert preview.status_code==200 and preview.json()['activated'] is False
    assert c.get('/api/v1/settings',headers=auth('admin')).json()['framework']==before
    body['framework']['factors'][0]['weight']=1
    assert c.post('/api/v1/settings/framework/preview',json=body,headers=auth('admin')).status_code==422

def recovery(c,auth,role='line_manager'):
    return c.post('/api/v1/users/org-a-'+role+'/recovery',headers=auth('admin'),json={'reason':'User identity independently verified'})

def test_recovery_single_use_revokes_sessions_and_audits_no_secret(env):
    app,c,auth,_=env
    issue=recovery(c,auth);assert issue.status_code==200,issue.text
    token=issue.json()['token'];password='replacement-password-for-test-56789'
    body={'token':token,'newPassword':password}
    r=c.post('/api/v1/auth/recovery/complete',json=body);assert r.status_code==200,r.text
    assert c.get('/api/v1/positions',headers=auth()).status_code==401
    assert c.post('/api/v1/auth/recovery/complete',json=body).status_code==422
    old=c.post('/api/v1/auth/login',json={'email':'org-a-line_manager@example.test','password':'test-only-password-012345'});assert old.status_code==401
    new=c.post('/api/v1/auth/login',json={'email':'org-a-line_manager@example.test','password':password});assert new.status_code==200
    with app.state.sessions() as db:
        events=db.scalars(select(AuditEvent).where(AuditEvent.action.like('auth.%'))).all()
        assert {'auth.recovery-issued','auth.password-recovered'}.issubset({e.action for e in events})
        assert all(token not in str(e.detail) and password not in str(e.detail) for e in events)

def test_recovery_rejects_other_tenant_non_admin_self_and_unsigned(env):
    app,c,auth,_=env;body={'reason':'User identity independently verified'}
    assert c.post('/api/v1/users/org-a-line_manager/recovery',headers=auth(),json=body).status_code==403
    assert c.post('/api/v1/users/org-b-line_manager/recovery',headers=auth('admin'),json=body).status_code==422
    assert c.post('/api/v1/users/org-a-admin/recovery',headers=auth('admin'),json=body).status_code==422
    token=recovery(c,auth).json()['token'];claims=jwt.decode(token,options={'verify_signature':False});claims['exp']=int(time.time())-1
    expired=jwt.encode(claims,app.state.secret,algorithm='HS256')
    assert c.post('/api/v1/auth/recovery/complete',json={'token':expired,'newPassword':'replacement-password-12345'}).status_code==422
    claims['exp']=int(time.time())+900;claims['aud']='wrong-purpose'
    wrong=jwt.encode(claims,app.state.secret,algorithm='HS256')
    assert c.post('/api/v1/auth/recovery/complete',json={'token':wrong,'newPassword':'replacement-password-12345'}).status_code==422
    assert c.get('/api/v1/positions',headers={'Authorization':'Bearer '+token}).status_code==401

def test_recovery_limits_guesses(env):
    app,c,auth,_=env;body={'token':'invalid-recovery-token-0123456789abcdef','newPassword':'replacement-password-12345'}
    for _ in range(5):assert c.post('/api/v1/auth/recovery/complete',json=body).status_code==422
    assert c.post('/api/v1/auth/recovery/complete',json=body).status_code==429
