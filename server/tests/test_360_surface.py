import pytest
from .conftest import submit,decide

def test_360_admin_department_user_branding_and_institution_profile_surface(env):
    app,c,auth,position=env
    # Departments are organization scoped and line managers only see their own department.
    admin_departments=c.get('/api/v1/departments',headers=auth('admin'))
    assert admin_departments.status_code==200
    assert {x['id'] for x in admin_departments.json()}=={'org-a-one','org-a-two'}
    own=c.get('/api/v1/departments',headers=auth('line_manager')).json()
    assert [x['id'] for x in own]==['org-a-one']

    created=c.post('/api/v1/departments',headers=auth('admin'),json={'name':'Audit 360 department'})
    assert created.status_code==201,created.text
    department_id=created.json()['id']
    assert c.post('/api/v1/departments',headers=auth('line_manager'),json={'name':'Forbidden'}).status_code==403

    user=c.post('/api/v1/users',headers=auth('admin'),json={
        'email':'audit360.manager@example.test','name':'Audit 360 Manager',
        'password':'audit-only-password-012345','role':'line_manager','departmentId':department_id
    })
    assert user.status_code==201,user.text
    user_id=user.json()['id']
    users=c.get('/api/v1/users',headers=auth('admin'))
    assert users.status_code==200
    assert any(x['id']==user_id and x['departmentId']==department_id and x['active'] for x in users.json())
    assert c.get('/api/v1/users',headers=auth('line_manager')).status_code==403
    disabled=c.post('/api/v1/users/'+user_id+'/deactivate',headers=auth('admin'))
    assert disabled.status_code==200 and disabled.json()['active'] is False
    assert c.post('/api/v1/users/org-a-admin/deactivate',headers=auth('admin')).status_code==409

    brand={'nameAr':'معيار للتدقيق','nameEn':'Miyar Audit','color':'#146954','footer':'360 release gate'}
    saved=c.post('/api/v1/settings/branding',headers=auth('admin'),json=brand)
    assert saved.status_code==200 and saved.json()['nameEn']=='Miyar Audit'
    settings=c.get('/api/v1/settings',headers=auth('line_manager')).json()
    assert settings['branding']['footer']=='360 release gate'
    assert c.post('/api/v1/settings/branding',headers=auth('line_manager'),json=brand).status_code==403

    profile={
      'schema':'miyar-institution-profile/1.0','organizationName':'Audit Organization',
      'units':[
        {'code':'CORP','nameAr':'المؤسسة','nameEn':'Corporate','parentCode':'','leaderTitle':'CEO'},
        {'code':'HC','nameAr':'رأس المال البشري','nameEn':'Human Capital','parentCode':'CORP','leaderTitle':'CHRO'}
      ],
      'gradeStructure':{
        'name':'Audit Grade Architecture','methodology':'Organization approved audit framework',
        'grades':[{'id':'G11','labelAr':'مدير','labelEn':'Manager','level':'manager','minPoints':600,'maxPoints':749}]
      },
      'approvedBy':'Audit authority','approvedOn':'2026-09-01'
    }
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':profile,'reason':'Configure the organization structure for the 360 release audit'})
    assert r.status_code==200,r.text
    assert r.json()['profile']['version']==1
    read=c.get('/api/v1/settings/institution-profile',headers=auth('line_manager'))
    assert read.status_code==200
    assert read.json()['profile']['units'][1]['code']=='HC'
    assert c.post('/api/v1/settings/institution-profile',headers=auth('line_manager'),json={'profile':profile,'reason':'Unauthorized institutional change attempt'}).status_code==403


def test_360_withdraw_evaluation_history_and_skill_extraction(env):
    app,c,auth,position=env

    p=position()
    submitted=submit(c,auth,p)
    url='/api/v1/positions/'+p['id']
    withdrawn=c.post(url+'/withdraw',headers=auth(),json={'revision':submitted['revision'],'reason':'Audit requester withdrew this review'})
    assert withdrawn.status_code==200,withdrawn.text
    assert withdrawn.json()['state']=='changes_requested'
    assert c.post(url+'/withdraw',headers=auth(),json={'revision':submitted['revision'],'reason':'Duplicate withdrawal'}).status_code==409
    audit=c.get(url+'/audit',headers=auth()).json()
    assert any(x['action']=='position.withdrawn' for x in audit)

    p2=position(title='Evaluation history audit role')
    submit(c,auth,p2)
    od=decide(c,auth,p2,'od_specialist',{
        'scopeReviewed':True,'mappingReviewed':True,'businessValidated':True,'roleNotPerson':True,
        'businessReviewer':'Audit department reviewer','businessReviewDate':'2026-09-01'
    })
    assert od.status_code==200,od.text
    evaluation=c.post('/api/v1/positions/'+p2['id']+'/evaluation',headers=auth('total_rewards'),json={
        'revision':p2['revision'],
        'answers':{'knowledge':'2','complexity':'2','impact':'2'},
        'evidence':{'knowledge':'Audit knowledge scope','complexity':'Audit complexity scope','impact':'Audit impact scope'}
    })
    assert evaluation.status_code==200,evaluation.text
    history=c.get('/api/v1/positions/'+p2['id']+'/evaluations',headers=auth('line_manager'))
    assert history.status_code==200
    assert len(history.json())==1
    assert history.json()[0]['id']==evaluation.json()['id']

    skills=c.post('/api/v1/analyze/skills',headers=auth('line_manager'),json={
        'text':'Analyze data using Python and SQL, document findings and communicate results.',
        'field':'Data','seniority':'Specialist','constraints':''
    })
    assert skills.status_code==200,skills.text
    payload=skills.json()
    assert payload['method']=='dictionary-extraction'
    assert payload['reviewRequired'] is True
    assert isinstance(payload['skills'],list)
    assert c.post('/api/v1/analyze/skills',json={'text':'Python and SQL analysis'}).status_code==401


@pytest.mark.parametrize('path',[
    '/api/v1/me','/api/v1/capabilities','/api/v1/departments','/api/v1/users',
    '/api/v1/settings','/api/v1/positions',
    '/api/v1/analytics','/api/v1/integrations/status','/api/v1/integrations/outbox',
    '/api/v1/settings/institution-profile'
])
def test_360_protected_get_surfaces_reject_anonymous_access(env,path):
    app,c,auth,position=env
    assert c.get(path).status_code==401


def test_360_health_reports_real_storage_and_does_not_claim_unconfigured_ai(env):
    app,c,auth,position=env
    health=c.get('/health')
    assert health.status_code==200
    body=health.json()
    assert body['status']=='ok'
    assert body['version']=='6.1.0'
    assert body['services']['version']==body['version']
    assert body['occupations']==5041
    assert body['semanticModelReady'] is False
    assert body['services']['approvals'] is True
    assert body['services']['semanticEnabled'] is False
    assert any(x['format']=='PDF' for x in body['services']['exports'])


def test_360_public_reference_catalogs_are_intentionally_readable_without_sign_in(env):
    app,c,auth,position=env
    taxonomy=c.get('/api/v1/taxonomy',params={'q':'مهندس مدني','limit':5})
    assert taxonomy.status_code==200
    assert any(str(row.get('code'))=='214201' for row in taxonomy.json()['items'])
    education=c.get('/api/v1/education',params={'limit':5})
    assert education.status_code==200
    assert education.json()['release']
    releases=c.get('/api/v1/taxonomy/releases')
    assert releases.status_code==200
    assert any(row.get('id')=='ssco-2019-supplied' for row in releases.json())
