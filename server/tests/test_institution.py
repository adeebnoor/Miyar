from server.institution import install_institution


def profile():
    return {
        'schema':'miyar-institution-profile/1.0',
        'organizationName':'Example Organization',
        'units':[
            {'code':'CORP','nameAr':'المؤسسة','nameEn':'Corporate','parentCode':'','leaderTitle':'Chief Executive Officer'},
            {'code':'HC','nameAr':'رأس المال البشري','nameEn':'Human Capital','parentCode':'CORP','leaderTitle':'Director, Human Capital'}
        ],
        'gradeStructure':{
            'name':'Approved Grade Architecture',
            'methodology':'Organization approved point-factor architecture',
            'grades':[
                {'id':'G11','labelAr':'مدير','labelEn':'Manager','level':'manager','minPoints':600,'maxPoints':749},
                {'id':'G13','labelAr':'مدير إدارة','labelEn':'Director','level':'director','minPoints':750,'maxPoints':899}
            ]
        },
        'approvedBy':'CHRO',
        'approvedOn':'2026-09-01'
    }


def test_institution_profile_is_admin_managed_versioned_and_tenant_scoped(env):
    app,c,auth,_=env;install_institution(app)
    r=c.get('/api/v1/settings/institution-profile',headers=auth());assert r.status_code==200;assert r.json()['profile']['version']==0
    r=c.post('/api/v1/settings/institution-profile',headers=auth(),json={'profile':profile(),'reason':'Attempt by non administrator'});assert r.status_code==403
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':profile(),'reason':'Approved organization structure and grades'});assert r.status_code==200,r.text;assert r.json()['profile']['version']==1
    saved=c.get('/api/v1/settings/institution-profile',headers=auth('od_specialist')).json()['profile'];assert saved['units'][1]['code']=='HC';assert saved['gradeStructure']['grades'][0]['id']=='G11'
    other=c.get('/api/v1/settings/institution-profile',headers=auth('admin','org-b')).json()['profile'];assert other['version']==0
    changed=profile();changed['gradeStructure']['grades'][0]['labelEn']='Manager / Lead'
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':changed,'reason':'Approved revised grade labels'});assert r.status_code==200;assert r.json()['profile']['version']==2


def test_institution_profile_rejects_cycles_overlaps_and_future_approval(env):
    app,c,auth,_=env;install_institution(app)
    bad=profile();bad['units'][0]['parentCode']='HC'
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':bad,'reason':'Testing invalid structure cycle'});assert r.status_code==422
    bad=profile();bad['gradeStructure']['grades'][1]['minPoints']=700
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':bad,'reason':'Testing overlapping grade ranges'});assert r.status_code==422
    bad=profile();bad['approvedOn']='2099-01-01'
    r=c.post('/api/v1/settings/institution-profile',headers=auth('admin'),json={'profile':bad,'reason':'Testing future approval date'});assert r.status_code==422


def test_od_generated_metadata_is_accepted_by_enterprise_positions(env):
    app,c,auth,position=env;install_institution(app)
    p=position(strategyObjective='Cascade HC strategy into prioritized initiatives',marketTitle='Human Capital Projects & Operations Manager',jobFamily='Human Capital',careerPath='Senior Manager > Director > CHRO',recommendedLevel='Manager level',gradeRecommendationBasis='Pre-evaluation recommendation; formal review required',odGenerationBasis='Rule-based OD proposal with human review',orgUnitCode='HC',orgUnitPath='Corporate / Human Capital',organizationProfileVersion='1',proposedGrade='G11 · Manager',gradeArchitectureName='Approved Grade Architecture',gradeArchitectureVersion='1')
    assert p['content']['jobFamily']=='Human Capital';assert p['content']['orgUnitCode']=='HC';assert p['content']['proposedGrade'].startswith('G11')
