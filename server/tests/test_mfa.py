import time
from server.mfa import current_code, matching_step
from server.models import UserMfa

PASSWORD='test-only-password-012345'


def enroll(c,auth,role='finance'):
    setup=c.post('/api/v1/auth/mfa/setup',headers=auth(role),json={'currentPassword':PASSWORD});assert setup.status_code==200,setup.text
    secret=setup.json()['secret'];assert setup.json()['otpauthUri'].startswith('otpauth://totp/Miyar')
    ok=c.post('/api/v1/auth/mfa/confirm',headers=auth(role),json={'code':current_code(secret)});assert ok.status_code==200,ok.text
    return secret,{'Authorization':'Bearer '+ok.json()['accessToken']}


def test_rfc6238_reference_vector_and_replay_window():
    secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'  # RFC 6238 SHA1 seed "12345678901234567890", a public test vector gitleaks:allow
    assert current_code(secret,59)=='287082' and current_code(secret,1111111109)=='081804'
    step=matching_step(secret,'287082',0,at=59);assert step==1
    assert matching_step(secret,'287082',step,at=59) is None  # a used code cannot be replayed
    assert matching_step(secret,'12345',0,at=59) is None and matching_step(secret,'abcdef',0,at=59) is None


def test_enrolled_account_needs_a_valid_code_to_sign_in(env):
    app,c,auth,_=env;secret,_=enroll(c,auth)
    login={'email':'org-a-finance@example.test','password':PASSWORD}
    missing=c.post('/api/v1/auth/login',json=login);assert missing.status_code==401 and missing.json()['detail']['mfaRequired']
    assert c.post('/api/v1/auth/login',json={**login,'otp':'000000'}).status_code==401
    time.sleep(0)  # the confirm step consumed the current window; the next window is accepted once
    with app.state.sessions() as db:db.get(UserMfa,'org-a-finance').last_step-=2;db.commit()
    good=c.post('/api/v1/auth/login',json={**login,'otp':current_code(secret)});assert good.status_code==200
    assert c.post('/api/v1/auth/login',json={**login,'otp':current_code(secret)}).status_code==401  # replay
    me=c.get('/api/v1/me',headers={'Authorization':'Bearer '+good.json()['accessToken']}).json();assert me['mfaEnabled']


def test_enrollment_revokes_old_sessions_and_secret_is_encrypted_at_rest(env):
    app,c,auth,_=env;old=auth('finance');secret,fresh=enroll(c,auth)
    assert c.get('/api/v1/me',headers=old).status_code==401 and c.get('/api/v1/me',headers=fresh).status_code==200
    with app.state.sessions() as db:assert secret not in db.get(UserMfa,'org-a-finance').secret
    assert c.post('/api/v1/auth/mfa/setup',headers=fresh,json={'currentPassword':PASSWORD}).status_code==409
    assert c.post('/api/v1/auth/mfa/setup',headers=auth('chro'),json={'currentPassword':'wrong-password-000'}).status_code==422


def test_disable_needs_password_and_code_and_admin_reset_is_audited(env):
    app,c,auth,_=env;secret,fresh=enroll(c,auth)
    with app.state.sessions() as db:db.get(UserMfa,'org-a-finance').last_step-=2;db.commit()
    assert c.post('/api/v1/auth/mfa/disable',headers=fresh,json={'currentPassword':PASSWORD,'code':'000000'}).status_code==422
    off=c.post('/api/v1/auth/mfa/disable',headers=fresh,json={'currentPassword':PASSWORD,'code':current_code(secret)});assert off.status_code==200 and not off.json()['enabled']
    secret,_=enroll(c,auth,'chro')
    assert c.post('/api/v1/users/org-a-chro/mfa/reset',headers=auth('total_rewards'),json={'reason':'Lost device verified by HR'}).status_code==403
    assert c.post('/api/v1/users/org-b-chro/mfa/reset',headers=auth('admin'),json={'reason':'Lost device verified by HR'}).status_code==422
    assert c.post('/api/v1/users/org-a-chro/mfa/reset',headers=auth('admin'),json={'reason':'Lost device verified by HR'}).status_code==200
    assert c.post('/api/v1/auth/login',json={'email':'org-a-chro@example.test','password':PASSWORD}).status_code==200
    users=c.get('/api/v1/users',headers=auth('admin')).json();assert all(not u['mfaEnabled'] for u in users if u['id']=='org-a-chro')
    assert c.get('/health').json()['services']['mfa']=={'method':'totp','available':True,'sso':False}
