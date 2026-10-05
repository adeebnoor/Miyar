"""Acceptance gates reproduced from the 5 October HR/OD review; synthetic organization only."""
import copy
from datetime import datetime,timedelta,timezone
from sqlalchemy import select
from server.domain import DEFAULT_FRAMEWORK,DEFAULT_WORKFLOW,validate_workflow
from server.models import Position,User,OutboxEvent,Approval,Organization
from .conftest import submit,decide,activate

DEPARTMENT={'businessValidated':True,'budgetOwnerConfirmed':True,'headcountConfirmed':True}
OD={'scopeReviewed':True,'mappingReviewed':True,'businessValidated':True,'roleNotPerson':True,'businessReviewer':'Synthetic budget owner','businessReviewDate':'2026-09-01'}
def raw_submit(c,auth,p):return c.post('/api/v1/positions/'+p['id']+'/submit',headers=auth(),json={'revision':p['revision'],'reason':'Expert acceptance submission'})
def evaluation_body(p,**answers):
    return {'revision':p['revision'],'answers':{**{f['id']:'2' for f in DEFAULT_FRAMEWORK['factors']},**answers},'evidence':{f['id']:'Specific responsibility evidence: analyze requirements, develop code, test releases and document delegated decisions.' for f in DEFAULT_FRAMEWORK['factors']}}
def reach_rewards(c,auth,p):submit(c,auth,p);assert decide(c,auth,p,'od_specialist',OD).status_code==200

def test_new_request_starts_with_budget_owner_and_department_scope(env):
    app,c,auth,create=env;p=create();r=raw_submit(c,auth,p);assert r.status_code==200
    value=r.json();assert value['workflow'][0]['role']=='department_manager' and len(value['workflow'])==5
    assert value['pendingStage']['dueAt'] and value['pendingStage']['slaHours']==48
    assert decide(c,auth,p,'od_specialist',OD).status_code==403
    assert decide(c,auth,p,'department_manager',{}).status_code==422
    assert decide(c,auth,p,'department_manager',DEPARTMENT).status_code==200
    with app.state.sessions() as db:db.get(User,'org-a-hrbp').department_id='org-a-two';db.commit()
    assert c.get('/api/v1/positions/'+p['id'],headers=auth('hrbp')).status_code==404

def test_requester_and_same_actor_cannot_approve_or_evaluate_two_stages(env):
    app,c,auth,create=env;p=create();raw_submit(c,auth,p)
    with app.state.sessions() as db:db.get(User,p['createdBy']).role='department_manager';db.commit()
    assert decide(c,auth,p,'line_manager',DEPARTMENT).status_code==403
    assert decide(c,auth,p,'department_manager',DEPARTMENT).status_code==200
    with app.state.sessions() as db:db.get(User,'org-a-department_manager').role='od_specialist';db.commit()
    blocked=decide(c,auth,p,'department_manager',OD);assert blocked.status_code==403 and 'two stages' in blocked.text
    assert decide(c,auth,p,'od_specialist',OD).status_code==200
    with app.state.sessions() as db:db.get(User,'org-a-od_specialist').role='total_rewards';db.commit()
    assert c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth('od_specialist'),json=evaluation_body(p)).status_code==403

def test_reject_and_return_require_substantive_reason(env):
    _,c,auth,create=env
    for decision in ['return','reject']:
        p=create();raw_submit(c,auth,p);url='/api/v1/positions/'+p['id']+'/decisions'
        for reason in ['   ','no','         x  ']:
            r=c.post(url,headers=auth('department_manager'),json={'revision':1,'decision':decision,'comment':reason,'evidence':{}});assert r.status_code==422
        r=c.post(url,headers=auth('department_manager'),json={'revision':1,'decision':decision,'comment':'Business need has no supporting demand evidence','evidence':{}});assert r.status_code==200

def test_sla_escalation_is_durable_scoped_and_once_per_stage(env):
    app,c,auth,create=env;p=create();raw_submit(c,auth,p)
    with app.state.sessions() as db:
        row=db.get(Position,p['id']);workflow=copy.deepcopy(row.workflow);workflow[0]['dueAt']=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat();row.workflow=workflow;db.commit()
    assert c.get('/api/v1/governance/escalations',headers=auth('admin','org-b')).json()['items']==[]
    assert c.post('/api/v1/governance/escalations',headers=auth()).status_code==403
    status=c.get('/api/v1/governance/escalations',headers=auth('chro')).json();assert status['items'][0]['overdue']
    assert c.post('/api/v1/governance/escalations',headers=auth('admin')).json()['count']==1
    assert c.post('/api/v1/governance/escalations',headers=auth('admin')).json()['count']==0
    with app.state.sessions() as db:
        events=list(db.scalars(select(OutboxEvent).where(OutboxEvent.event_type=='approval.overdue')));assert len(events)==1 and events[0].payload['escalationRole']=='chro'
    assert c.get('/api/v1/positions/'+p['id'],headers=auth()).json()['pendingStage']['escalationStatus']=='escalated'
    assert decide(c,auth,p,'department_manager',DEPARTMENT).json()['pendingStage']['escalationStatus']=='within-sla'

def test_impossible_cost_and_individual_contributor_are_blocked_before_save(env):
    _,c,auth,create=env;p=create();url='/api/v1/positions'
    for changes in [{'headcount':25,'annualCost':1000},{'team':'Individual contributor','directReports':40},{'team':'مساهم فردي','directReports':1},{'annualCost':100000,'annualCostMin':120000,'annualCostMax':180000}]:
        r=c.post(url,headers=auth(),json={'departmentId':p['departmentId'],'content':{**p['content'],**changes},'reason':'Reproduce the expert invalid draft'});assert r.status_code==422,r.text
    r=c.post(url,headers=auth(),json={'departmentId':p['departmentId'],'content':{**p['content'],'directReports':16,'team':'Lead delivery teams'},'reason':'Review wide span of control'});assert r.status_code==201 and r.json()['scopeWarnings'][0]['code']=='wide-span'
    manual={**p['content'],'annualCost':100000,'annualCostMin':120000,'annualCostMax':180000,'costBasis':'manual-exception','costExceptionReason':'Fixed-term specialist working reduced annual hours; finance must review the exception.'}
    assert c.post(url,headers=auth(),json={'departmentId':p['departmentId'],'content':manual,'reason':'Document a meaningful cost exception'}).status_code==201

def test_submission_requires_every_kpi_baseline_target_duration_and_linked_band(env):
    _,c,auth,create=env
    for changes in [{'kpis':[]},{'kpis':[{'outcome':'Faster releases','metric':'Lead time','target':'20% reduction','baseline':'10 days'}]},{'jobFamily':''},{'salaryGrade':''},{'costBasis':''}]:
        p=create(**changes);assert raw_submit(c,auth,p).status_code==422
    p=create();assert raw_submit(c,auth,p).status_code==200

def test_factor_conflict_needs_reason_and_weak_evidence_is_rejected(env):
    _,c,auth,create=env;p=create();reach_rewards(c,auth,p);url='/api/v1/positions/'+p['id']+'/evaluation';body=evaluation_body(p,people='6',autonomy='1',impact='1')
    r=c.post(url,headers=auth('total_rewards'),json=body);assert r.status_code==422 and 'consistency justification' in r.text
    body['evidence']['consistencyJustification']='Matrix executive accountability is retained while specialist operational decisions require formal board authorization.'
    r=c.post(url,headers=auth('total_rewards'),json=body);assert r.status_code==200 and len(r.json()['result']['consistencyWarnings'])==2
    assert r.json()['result']['positionId']==p['id'] and r.json()['result']['positionRevision']==1
    body=evaluation_body(p);body['evidence']['knowledge']='Documented evidence 1'
    assert c.post(url,headers=auth('total_rewards2'),json=body).status_code==422

def test_committee_requires_two_actual_identities_and_records_differences(env):
    _,c,auth,create=env;p=create();reach_rewards(c,auth,p);url='/api/v1/positions/'+p['id']+'/evaluation';body=evaluation_body(p)
    body['evidence']['committee']=[{'evaluatorId':'spoof-a'},{'evaluatorId':'spoof-b'}]
    r=c.post(url,headers=auth('total_rewards'),json=body);assert r.status_code==200 and r.json()['result']['committee']['count']==1
    assert decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True}).status_code==422
    assert c.post(url,headers=auth('total_rewards'),json=body).json()['result']['committee']['count']==1
    second=evaluation_body(p,knowledge='3');r=c.post(url,headers=auth('total_rewards2'),json=second);assert r.status_code==200
    committee=r.json()['result']['committee'];assert committee['count']==2 and committee['differences'][0]['pointsDifference']>0
    assert committee['differences'][0]['factorDifferences'][0]['factor']=='knowledge'
    assert decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True}).status_code==422
    r=decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True,'committeeDifferenceReason':'Both reviewers reconciled the evidence against the position scope and adopted the independently reviewed specialist level.'});assert r.status_code==200

def test_approved_funded_replacement_reuses_evaluation_only_when_scope_unchanged(env):
    app,c,auth,create=env;source=activate(c,auth,create());replacement=create(**{**source['content'],'requestType':'replacement','replacementPositionId':source['id']});r=raw_submit(c,auth,replacement);assert r.status_code==200,r.text
    assert decide(c,auth,replacement,'department_manager',DEPARTMENT).status_code==200
    assert decide(c,auth,replacement,'od_specialist',OD).status_code==200
    assert c.post('/api/v1/positions/'+replacement['id']+'/evaluation',headers=auth('total_rewards'),json=evaluation_body(replacement)).status_code==409
    r=decide(c,auth,replacement,'total_rewards',{'payFrameworkReviewed':True});assert r.status_code==200,r.text
    approval=c.get('/api/v1/positions/'+replacement['id']+'/approvals',headers=auth()).json()[-1];assert approval['evidence']['evaluationReuse']['sourceRevision']==1
    changed=create(**{**source['content'],'requestType':'replacement','replacementPositionId':source['id'],'responsibilities':'Develop a different architecture\nLead department restructuring\nApprove major capital investments'})
    r=raw_submit(c,auth,changed);assert r.status_code==422 and 'scope changed' in r.text
    too_costly=create(**{**source['content'],'requestType':'replacement','replacementPositionId':source['id'],'annualCost':300000});assert raw_submit(c,auth,too_costly).status_code==422

def test_legacy_pending_workflow_is_held_without_rewriting_signed_stage_identity(env):
    app,c,auth,create=env;p=create();submit(c,auth,p)
    with app.state.sessions() as db:
        row=db.get(Position,p['id']);row.workflow=copy.deepcopy(DEFAULT_WORKFLOW[1:]);row.approval_stage=0;db.commit()
    r=decide(c,auth,p,'od_specialist',OD);assert r.status_code==409 and 'Legacy request' in r.text
    with app.state.sessions() as db:assert db.get(Position,p['id']).workflow[0]['role']=='od_specialist'
    assert c.post('/api/v1/positions/'+p['id']+'/withdraw',headers=auth(),json={'revision':1,'reason':'Upgrade legacy approval workflow'}).status_code==200
    changed=c.patch('/api/v1/positions/'+p['id'],headers=auth(),json={'revision':1,'content':p['content'],'reason':'Submit a fresh revision with budget owner review'}).json();assert raw_submit(c,auth,changed).json()['workflow'][0]['role']=='department_manager'

def test_workflow_configuration_cannot_remove_owner_duplicate_roles_or_disable_sla():
    for changed in [DEFAULT_WORKFLOW[1:],[{**s,'slaHours':0} for s in DEFAULT_WORKFLOW],[DEFAULT_WORKFLOW[0],*DEFAULT_WORKFLOW]]:
        try:validate_workflow(changed);assert False,'Invalid workflow accepted'
        except ValueError:pass

def test_parent_position_cycle_is_rejected_and_new_metadata_roundtrips(env):
    _,c,auth,create=env;parent=create(title='Engineering Manager');child=create(parentPositionId=parent['id'],educationLevel='6',experienceYears=5,experienceType='Software delivery',employmentType='contract',location='Jeddah',workMode='hybrid')
    assert child['content']['experienceYears']==5
    r=c.patch('/api/v1/positions/'+parent['id'],headers=auth(),json={'revision':1,'content':{**parent['content'],'parentPositionId':child['id']},'reason':'Reproduce reporting loop'});assert r.status_code==422
    from server.exports import display_value
    assert display_value('educationLevel','6','en')=='Bachelor or equivalent'
    assert 'البكالوريوس' in display_value('educationLevel','6','ar')

def test_horizontal_and_parent_grade_comparisons_use_approved_revisions(env):
    _,c,auth,create=env;parent=activate(c,auth,create(title='Approved Engineering Manager'));activate(c,auth,create(title='Approved same-family peer'))
    child=create(title='Subordinate engineer',parentPositionId=parent['id']);reach_rewards(c,auth,child)
    r=c.post('/api/v1/positions/'+child['id']+'/evaluation',headers=auth('total_rewards'),json=evaluation_body(child,knowledge='3'));assert r.status_code==200,r.text
    comparisons=r.json()['result']['comparisons'];assert comparisons['peerCount']==2 and comparisons['peerMedianPoints'] is not None
    assert comparisons['parentComparison']['positionId']==parent['id']
    assert any(w['code']=='subordinate-grade-review' for w in comparisons['warnings'])

def test_approved_committee_identity_snapshot_survives_deactivation(env):
    app,c,auth,create=env;p=activate(c,auth,create())
    with app.state.sessions() as db:db.get(User,'org-a-total_rewards2').active=False;db.commit()
    exported=c.get('/api/v1/positions/'+p['id']+'/export/json',headers=auth()).json()
    committee=exported['evaluation']['result']['committee'];assert committee['count']==2 and committee['status']=='approved-committee-record'
    assert committee['snapshotBasis']=='immutable-rewards-approval-evidence'

def test_od_revision_author_cannot_review_their_own_amendment(env):
    _,c,auth,create=env;p=create();r=c.patch('/api/v1/positions/'+p['id'],headers=auth('od_specialist'),json={'revision':1,'content':{**p['content'],'purpose':'Amended scope written by the OD reviewer'},'reason':'OD authored a revised request scope'});assert r.status_code==200
    p=r.json();submit(c,auth,p);r=decide(c,auth,p,'od_specialist',OD);assert r.status_code==403 and 'revision author' in r.text

def test_preliminary_grade_proposal_can_start_review_but_does_not_approve_a_grade(env):
    _,c,auth,create=env;p=create(salaryGrade='G12',salaryMin=10000,salaryMax=30000,salaryCurrency='SAR',salaryPeriod='monthly',salarySource='Explicit illustrative proposal for committee review',annualCostMin=120000,annualCostMax=360000)
    assert not p['content'].get('evaluatedPositionId') and not p['content'].get('evaluationSummary')
    submitted=raw_submit(c,auth,p);assert submitted.status_code==200,submitted.text
    assert decide(c,auth,p,'department_manager',DEPARTMENT).status_code==200
    assert decide(c,auth,p,'od_specialist',OD).status_code==200
    assert decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True}).status_code==422
    body=evaluation_body(p);assert c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth('total_rewards'),json=body).status_code==200
    assert decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True}).status_code==422
    assert c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth('total_rewards2'),json=body).status_code==200
    assert decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True}).status_code==200
    assert decide(c,auth,p,'finance',{'vacancyConfirmed':True,'budgetConfirmed':True,'approvedAnnualBudget':240000,'approvedHeadcount':1}).status_code==200
    assert decide(c,auth,p,'chro',{}).status_code==200
    exported=c.get('/api/v1/positions/'+p['id']+'/export/json',headers=auth()).json()
    assert exported['proposedGrade']['grade']=='G12' and exported['proposedGrade']['status']=='preliminary-proposal'
    assert exported['evaluatedGrade']['grade']=='G04' and exported['evaluatedGrade']['status']=='approved-by-organization'
    assert exported['evaluatedGrade']['positionId']==p['id'] and exported['evaluatedGrade']['revision']==1 and exported['evaluatedGrade']['committee']['count']==2
    assert exported['content']['salaryGrade']=='G12'  # immutable authored proposal remains distinguishable from approved assessment
    assert exported['evaluation']['positionId']==p['id'] and exported['evaluation']['revision']==1

def test_claimed_assessment_is_bound_to_exact_position_and_revision(env):
    _,c,auth,create=env
    for claims in [{'evaluatedPositionId':'unrelated-position','evaluatedPositionRevision':1},{'evaluationSummary':'Claimed evaluation without an identified position'},{'evaluatedPositionRevision':99}]:
        p=create(**claims);r=raw_submit(c,auth,p);assert r.status_code==422 and 'exact position and revision' in r.text
    from server.domain import validate_submission
    p=create();claimed={**p['content'],'evaluatedPositionId':p['id'],'evaluatedPositionRevision':1,'evaluationSummary':'A preliminary local assessment declared for this exact revision'}
    assert validate_submission(claimed,p['id'],1)==[]
    try:validate_submission(claimed,p['id'],2);assert False,'Stale assessment accepted'
    except ValueError:pass

def test_approved_grade_context_uses_actual_committee_and_pay_for_this_revision(env):
    app,c,auth,create=env;p=create(salaryGrade='G12',salaryMin=30000,salaryMax=40000,salaryCurrency='SAR',salaryPeriod='monthly',salarySource='Preliminary input only')
    assert p['approvedEvaluation'] is None and p['approvedRewards'] is None
    reach_rewards(c,auth,p);body=evaluation_body(p);body['evidence']['compensation']={'salaryMin':10000,'salaryMax':15000,'salaryCurrency':'SAR','salaryPeriod':'monthly','salarySource':'Committee reviewed compensation proposal for the actual evaluated grade'}
    for reviewer in ['total_rewards','total_rewards2']:assert c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth(reviewer),json=body).status_code==200
    assert c.get('/api/v1/positions/'+p['id'],headers=auth()).json()['approvedEvaluation'] is None
    approved=decide(c,auth,p,'total_rewards',{'payFrameworkReviewed':True});assert approved.status_code==200,approved.text
    context=approved.json()['approvedEvaluation'];assert context['result']['committee']['status']=='approved-committee-record' and context['result']['committee']['count']==2
    assert context['positionId']==p['id'] and context['revision']==1 and context['result']['positionId']==p['id'] and context['result']['positionRevision']==1
    assert context['organizationId']=='org-a' and context['legacyApprovedRecord'] is False
    assert context['approval']==approved.json()['approvedRewards'] and context['approval']['evaluationId']==context['id']
    assert context['linked']['salaryGrade']=='G04' and context['linked']['salaryMin']==10000 and context['linked']['salaryMax']==15000
    assert approved.json()['content']['salaryGrade']=='G12' and approved.json()['content']['salaryMin']==30000
    assert len(context['bindingDigest'])==64
    assert decide(c,auth,p,'finance',{'vacancyConfirmed':True,'budgetConfirmed':True,'approvedAnnualBudget':240000,'approvedHeadcount':1}).status_code==200
    assert decide(c,auth,p,'chro',{}).status_code==200
    changed=c.patch('/api/v1/positions/'+p['id'],headers=auth(),json={'revision':1,'content':{**p['content'],'purpose':'Changed scope with a new revision'},'reason':'A new revision must not inherit an approved assessment'});assert changed.status_code==200
    assert changed.json()['revision']==2 and changed.json()['approvedEvaluation'] is None and changed.json()['approvedRewards'] is None
    historical=c.get('/api/v1/positions/'+p['id']+'/export/json',headers=auth()).json();assert historical['revision']==1 and historical['evaluatedGrade']['grade']=='G04'

def test_historical_active_four_stage_authority_is_preserved_with_an_explicit_legacy_label(env):
    from server.models import Evaluation
    from server.domain import grade
    app,c,auth,create=env;p=create(salaryGrade='G12')
    with app.state.sessions() as db:
        position=db.get(Position,p['id']);position.workflow=copy.deepcopy(DEFAULT_WORKFLOW[1:]);position.approval_stage=4;position.state='active';position.active_revision=1
        body=evaluation_body(p);record=Evaluation(position_id=p['id'],revision=1,actor_id='org-a-total_rewards',result=grade(DEFAULT_FRAMEWORK,body['answers'],body['evidence']),answers=body['answers'],evidence=body['evidence']);db.add(record);db.flush()
        for index,role in enumerate(['od_specialist','total_rewards','finance','chro']):
            evidence={'evaluationId':record.id} if role=='total_rewards' else {'budgetConfirmed':True,'approvedAnnualBudget':240000,'approvedHeadcount':1} if role=='finance' else {}
            db.add(Approval(position_id=p['id'],revision=1,stage=index,actor_id='org-a-'+role,role=role,decision='approve',comment='Historical authenticated approval preserved for a migration test',evidence=evidence))
        db.commit()
    value=c.get('/api/v1/positions/'+p['id'],headers=auth()).json();context=value['approvedEvaluation'];assert context['legacyApprovedRecord'] is True
    assert context['result']['committee']['status']=='legacy-approved-record' and context['result']['committee']['count']==1
    assert context['result']['committee']['legacyDoesNotMeetCurrentCommitteePolicy'] is True
    assert context['linked']['salaryGrade']=='G04' and value['content']['salaryGrade']=='G12'
    with app.state.sessions() as db:position=db.get(Position,p['id']);position.active_revision=None;db.commit()
    assert c.get('/api/v1/positions/'+p['id'],headers=auth()).json()['approvedEvaluation'] is None

def test_department_approvers_can_refresh_scoped_analytics_after_a_decision(env):
    app,c,auth,create=env;p=create();raw_submit(c,auth,p)
    # A second department and another tenant cannot enter the budget owner's counts.
    assert c.post('/api/v1/positions',headers=auth('admin'),json={'departmentId':'org-a-two','content':p['content'],'reason':'Separate department fixture'}).status_code==201
    assert c.post('/api/v1/positions',headers=auth('admin','org-b'),json={'departmentId':'org-b-one','content':p['content'],'reason':'Separate tenant fixture'}).status_code==201
    r=decide(c,auth,p,'department_manager',DEPARTMENT);assert r.status_code==200 and r.json()['approvalStage']==1
    for role in ['department_manager','hrbp']:
        metrics=c.get('/api/v1/analytics',headers=auth(role));assert metrics.status_code==200,metrics.text
        assert metrics.json()['positions']==1 and metrics.json()['states']['in_review']==1
    assert c.get('/api/v1/analytics',headers=auth('admin')).json()['positions']==2
    assert c.get('/api/v1/analytics',headers=auth()).status_code==403

def test_exact_browser_api_seed_approver_can_decide_then_refresh_workspace(monkeypatch):
    from fastapi.testclient import TestClient
    # Restore the environment after importing the disposable browser fixture.
    monkeypatch.setenv('MIYAR_SERVE_UI','true')
    from e2e.fixtures.api_seed import app
    with TestClient(app) as c:
        def login(role):
            response=c.post('/api/v1/auth/login',json={'email':'a-'+role+'@audit.test','password':'isolated-test-password-928'});assert response.status_code==200,response.text
            headers={'Authorization':'Bearer '+response.json()['accessToken']};me=c.get('/api/v1/me',headers=headers).json();return headers,me
        requester,owner=login('line_manager');approver,manager=login('department_manager')
        assert owner['id']!=manager['id'] and owner['departmentId']==manager['departmentId']=='dep-a'
        content={k:'Synthetic fixture '+k for k in ['title','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors']}
        content.update(title='Browser seed department approval integration',requestType='proposed-role',occupationCode='251204',responsibilities='Analyze requirements\nDevelop software\nTest releases',headcount=1,directReports=0,annualCost=240000,costBasis='grade-band',jobFamily='Software Development',salaryGrade='G04',salaryMin=10000,salaryMax=30000,salaryCurrency='SAR',salaryPeriod='monthly',annualCostMin=120000,annualCostMax=360000,kpis=[{'outcome':'Faster service','metric':'Processing time','baseline':'10 days','target':'8 days','duration':'90 days'}])
        created=c.post('/api/v1/positions',headers=requester,json={'departmentId':'dep-a','content':content,'reason':'Exact browser fixture integration reproduction'});assert created.status_code==201,created.text;p=created.json()
        assert c.post('/api/v1/positions/'+p['id']+'/submit',headers=requester,json={'revision':1,'reason':'Submit the fixture request'}).status_code==200
        decided=c.post('/api/v1/positions/'+p['id']+'/decisions',headers=approver,json={'revision':1,'decision':'approve','comment':'Department budget owner explicitly endorses the fixture request','evidence':DEPARTMENT});assert decided.status_code==200,decided.text
        assert c.get('/api/v1/analytics',headers=approver).status_code==200
        listed=c.get('/api/v1/positions',headers=approver);assert listed.status_code==200
        detail=c.get('/api/v1/positions/'+p['id'],headers=approver);assert detail.status_code==200 and detail.json()['workflow'][detail.json()['approvalStage']]['role']=='od_specialist'
