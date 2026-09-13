import json
from fastapi.testclient import TestClient
from sqlalchemy import select
from server.app import create_app
from server.models import AuditEvent


def test_hosted_ui_resolves_assets_without_exposing_server_files(tmp_path,monkeypatch):
    monkeypatch.setenv('MIYAR_SERVE_UI','true')
    monkeypatch.delenv('MIYAR_ENV',raising=False)
    app=create_app('sqlite:///'+str(tmp_path/'web.db'),'deployment-test-secret-not-for-production')
    with TestClient(app) as c:
        health=c.get('/health').json()
        assert health['status']=='ok'
        assert health['version']=='4.4.0'
        assert health['services']['approvals'] is True
        assert {item['format'] for item in health['services']['exports']}=={'DOCX','XLSX','PDF'}
        assert set(health['services'])=={'version','storage','approvals','semanticEnabled','semanticModelReady','signingConfigured','exports','externalConnectors'}
        page=c.get('/');assert page.status_code==200;assert './config.js' in page.text
        config=c.get('/config.js');assert 'window.location.origin' in config.text
        assert config.headers['cache-control']=='no-store'
        assert c.get('/classifications/ssco-2019.json').json()['validation']['occupations']==5041
        assert c.get('/assets/arabic.ttf').status_code==200
        assert c.get('/api/v1/positions').status_code==401
        for path in ['/server/app.py','/.env','/%2e%2e/server/security.py']:
            assert c.get(path).status_code==404


def test_password_change_requires_current_password_revokes_sessions_and_redacts_audit(env):
    app,c,auth,_=env;path='/api/v1/auth/password'
    old='test-only-password-012345';new='new-test-only-password-987654'
    body={'currentPassword':old,'newPassword':new}
    assert c.post(path,json=body).status_code==401
    assert c.post(path,headers=auth(),json={**body,'newPassword':'short'}).status_code==422
    assert c.post(path,headers=auth(),json={**body,'currentPassword':'wrong'}).status_code==422
    assert c.get('/api/v1/me',headers=auth()).status_code==200
    r=c.post(path,headers=auth(),json=body);assert r.status_code==200,r.text
    assert c.get('/api/v1/me',headers=auth()).status_code==401
    assert c.get('/api/v1/me',headers={'Authorization':'Bearer '+r.json()['accessToken']}).status_code==200
    email='org-a-line_manager@example.test'
    assert c.post('/api/v1/auth/login',json={'email':email,'password':old}).status_code==401
    assert c.post('/api/v1/auth/login',json={'email':email,'password':new}).status_code==200
    with app.state.sessions() as db:
        events=list(db.scalars(select(AuditEvent).where(AuditEvent.action=='auth.password-changed')))
        assert len(events)==1
        record=json.dumps(events[0].detail)
        assert old not in record and new not in record
    assert c.get('/api/v1/audit/verify',headers=auth('admin')).json()['valid'] is True


def test_password_change_rate_limit_preserves_existing_credentials(env):
    _,c,auth,_=env;body={'currentPassword':'incorrect-current-value','newPassword':'unaccepted-new-password'}
    for _ in range(5):assert c.post('/api/v1/auth/password',headers=auth(),json=body).status_code==422
    assert c.post('/api/v1/auth/password',headers=auth(),json=body).status_code==429
    assert c.post('/api/v1/auth/login',json={'email':'org-a-line_manager@example.test','password':'test-only-password-012345'}).status_code==200
