from server.domain import DEFAULT_FRAMEWORK
import copy,os
from uuid import uuid4
from sqlalchemy import create_engine,text
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from server.app import create_app
from server.models import Organization,Department,User
from server.security import password_hash,issue_token
from server.domain import CORE,DEFAULT_FRAMEWORK

@pytest.fixture()
def env(tmp_path,monkeypatch):
    monkeypatch.delenv('MIYAR_ENV',raising=False);pg=os.getenv('MIYAR_TEST_POSTGRES_URL');schema='test_'+uuid4().hex
    url='sqlite:///'+str(tmp_path/'test.db')
    if pg:
        admin_engine=create_engine(pg)
        with admin_engine.begin() as conn:conn.execute(text('CREATE SCHEMA '+schema))
        url=pg+'?options=-csearch_path%3D'+schema
    app=create_app(url,'test-only-secret-longer-than-thirty-two-characters')
    users={};deps={}
    with app.state.sessions() as db:
        for org_id in ['org-a','org-b']:
            org=Organization(id=org_id,name=org_id,settings={'demoMode':True});db.add(org);db.flush()
            for suffix in ['one','two']:
                d=Department(id=org_id+'-'+suffix,org_id=org_id,name=suffix);db.add(d);deps[d.id]=d.id
            db.flush()
            for role in ['admin','line_manager','department_manager','hrbp','od_specialist','total_rewards','total_rewards2','finance','chro','integration']:
                key=org_id+'-'+role;u=User(id=key,org_id=org_id,email=key+'@example.test',name=key,role='total_rewards' if role=='total_rewards2' else role,department_id=org_id+'-one' if role in {'line_manager','department_manager','hrbp'} else None,password_hash=password_hash('test-only-password-012345'));db.add(u);db.flush();users[key]=issue_token(u,app.state.secret)
        db.commit()
    c=TestClient(app)
    def auth(role='line_manager',org='org-a'):return {'Authorization':'Bearer '+users[org+'-'+role]}
    def position(**overrides):
        content={k:'Sample '+k for k in CORE};content.update(title='مهندس برمجيات',requestType='proposed-role',responsibilities='Analyze requirements\nDevelop code\nTest releases',occupationCode='251204',annualCost=240000,headcount=1,jobFamily='Information Technology',salaryGrade='G04',costBasis='grade-band',annualCostMin=120000,annualCostMax=1200000,kpis=[{'outcome':'Reliable releases','metric':'Failed release rate','baseline':'10% of releases','target':'Below 2%','duration':'90 days','frequency':'Monthly','deliverable':'Release quality report'}],raci=[{'responsibility':'Build','R':'Engineer','A':'Manager','C':'Security','I':'Owner'}],skillRequirements=[{'name':'Programming','type':'technical','level':'Independent','evidence':'Practical test'}]);content.update(overrides)
        r=c.post('/api/v1/positions',headers=auth(),json={'departmentId':'org-a-one','content':content,'reason':'Test position creation'});assert r.status_code==201,r.text;return r.json()
    yield app,c,auth,position
    c.close()
    if pg:
        with admin_engine.begin() as conn:conn.execute(text('DROP SCHEMA '+schema+' CASCADE'))
        admin_engine.dispose()

def submit(c,auth,p):
    r=c.post('/api/v1/positions/'+p['id']+'/submit',headers=auth(),json={'revision':p['revision'],'reason':'Test workflow submission'});assert r.status_code==200,r.text
    # Existing OD-focused scenarios start after the new budget-owner stage; its own gates are tested separately.
    r=decide(c,auth,p,'department_manager',{'businessValidated':True,'budgetOwnerConfirmed':True,'headcountConfirmed':True});assert r.status_code==200,r.text;return r.json()
def decide(c,auth,p,role,evidence,decision='approve'):
    return c.post('/api/v1/positions/'+p['id']+'/decisions',headers=auth(role),json={'revision':p['revision'],'decision':decision,'comment':'Reviewed evidence for test','evidence':evidence})
def activate(c,auth,p):
    submit(c,auth,p);r=decide(c,auth,p,'od_specialist',{'scopeReviewed':True,'mappingReviewed':True,'businessValidated':True,'roleNotPerson':True,'businessReviewer':'Department reviewer for test','businessReviewDate':'2026-09-01'});assert r.status_code==200,r.text
    body={'revision':p['revision'],'answers':{factor['id']:'2' for factor in DEFAULT_FRAMEWORK['factors']},'evidence':{k:'Specific test scope evidence quoting reviewed responsibilities and delegated decision authority'+" — "+str(k) for k in [factor['id'] for factor in DEFAULT_FRAMEWORK['factors']]}}
    for reviewer in ['total_rewards','total_rewards2']:
        r=c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth(reviewer),json=body);assert r.status_code==200,r.text
    r=decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True});assert r.status_code==200,r.text
    r=decide(c,auth,p,'finance',{'vacancyConfirmed':True,'budgetConfirmed':True,'approvedAnnualBudget':240000,'approvedHeadcount':1});assert r.status_code==200,r.text
    r=decide(c,auth,p,'chro',{'internalOnlyAccepted':True});assert r.status_code==200,r.text;return r.json()
