"""Disposable authenticated records for v7 browser evidence; no production access."""
import copy
from datetime import datetime,timedelta,timezone
from fastapi.testclient import TestClient
from e2e.fixtures.api_seed import app
from server.models import Position,User
from server.security import issue_token,password_hash
from server.domain import CORE,DEFAULT_FRAMEWORK

with app.state.sessions() as db:
    for name,role in [('self','line_manager'),('creator','line_manager'),('approver','department_manager')]:
        db.add(User(id='a-v7-'+name,org_id='org-a',email='a-v7-'+name+'@audit.test',name='V7 isolated '+name,role=role,department_id='dep-a',password_hash=password_hash('isolated-test-password-928')))
    db.commit()

def auth(name):
    with app.state.sessions() as db:
        return {'Authorization':'Bearer '+issue_token(db.get(User,'a-'+name),app.state.secret)}

client=TestClient(app)
def checked(response,status=200):
    assert response.status_code==status,response.text
    return response.json()
def create(title,actor='v7-creator',content=None):
    value={k:'Documented '+k+' for the software delivery role' for k in CORE}
    value.update(title=title,requestType='proposed-role',responsibilities='Analyze system requirements\nDevelop production code\nTest software releases',occupationCode='251204',annualCost=240000,headcount=1,jobFamily='Information Technology',salaryGrade='G04',salaryMin=15000,salaryMax=25000,salaryCurrency='SAR',salaryPeriod='monthly',salarySource='Isolated reviewed organization range',costBasis='grade-band',annualCostMin=180000,annualCostMax=300000,kpis=[{'outcome':'Reliable releases','metric':'Failed release rate','baseline':'10% of releases','target':'Below 2%','duration':'90 days','frequency':'Monthly','deliverable':'Release report'}],raci=[{'responsibility':'Build software','R':'Engineer','A':'Manager','C':'Security','I':'Owner'}],skillRequirements=[{'name':'Programming','type':'technical','level':'Independent','evidence':'Practical test'}])
    if content:value.update(content)
    return checked(client.post('/api/v1/positions',headers=auth(actor),json={'departmentId':'dep-a','content':value,'reason':'Isolated v7 browser acceptance seed'}),201)
def submit(p,actor='v7-creator'):
    return checked(client.post('/api/v1/positions/'+p['id']+'/submit',headers=auth(actor),json={'revision':p['revision'],'reason':'Isolated v7 workflow test'}))
department={'businessValidated':True,'budgetOwnerConfirmed':True,'headcountConfirmed':True}
od={'scopeReviewed':True,'mappingReviewed':True,'businessValidated':True,'roleNotPerson':True,'businessReviewer':'Independent department reviewer','businessReviewDate':'2026-10-05'}
def decide(p,actor,evidence):
    return checked(client.post('/api/v1/positions/'+p['id']+'/decisions',headers=auth(actor),json={'revision':p['revision'],'decision':'approve','comment':'Isolated independent stage review','evidence':evidence}))

self_request=submit(create('V7 overdue creator request','v7-self'),'v7-self')
repeat=submit(create('V7 repeated approver request'))
decide(repeat,'v7-approver',department)
source=submit(create('Software Engineer'))
decide(source,'department_manager',department)
decide(source,'od_specialist',od)
evaluation={'revision':source['revision'],'answers':{f['id']:'2' for f in DEFAULT_FRAMEWORK['factors']},'evidence':{f['id']:'Documented role responsibilities and delegated authority supporting the '+f['id']+' factor' for f in DEFAULT_FRAMEWORK['factors']}}
evaluation['evidence']['compensation']={key:source['content'][key] for key in ['salaryMin','salaryMax','salaryCurrency','salaryPeriod','salarySource']}
for actor in ['total_rewards','total_rewards2']:
    checked(client.post('/api/v1/positions/'+source['id']+'/evaluation',headers=auth(actor),json=evaluation))
decide(source,'total_rewards',{'payFrameworkReviewed':True})
decide(source,'finance',{'vacancyConfirmed':True,'budgetConfirmed':True,'approvedAnnualBudget':240000,'approvedHeadcount':1})
source=decide(source,'chro',{'internalOnlyAccepted':True})
replacement=submit(create(source['title'],content={**source['content'],'requestType':'replacement','replacementPositionId':source['id']}))
decide(replacement,'department_manager',department)
replacement=decide(replacement,'od_specialist',od)
with app.state.sessions() as db:
    db.get(User,'a-v7-self').role='department_manager'
    db.get(User,'a-v7-approver').role='od_specialist'
    position=db.get(Position,self_request['id']);workflow=copy.deepcopy(position.workflow)
    workflow[position.approval_stage]['dueAt']=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()
    position.workflow=workflow;db.commit()
client.close()
