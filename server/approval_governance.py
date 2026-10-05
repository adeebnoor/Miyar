"""Revision-bound committee records and approval timing. Existing signed snapshots stay intact."""
import copy
from datetime import datetime,timedelta,timezone
from sqlalchemy import select
from .models import Position,PositionVersion,Evaluation,Approval,OutboxEvent,User

def timestamp(value):
    parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed

def start_stage(workflow,index,at):
    value=copy.deepcopy(workflow)
    if index<len(value):
        value[index]['enteredAt']=at
        value[index]['dueAt']=(timestamp(at)+timedelta(hours=value[index].get('slaHours',72))).isoformat()
    return value

def pending_stage(position,at=None):
    if position.state!='in_review' or position.approval_stage>=len(position.workflow):return None
    item=copy.deepcopy(position.workflow[position.approval_stage]);due=item.get('dueAt')
    current=at or datetime.now(timezone.utc)
    item.update(stage=position.approval_stage,overdue=bool(due and timestamp(due)<current),legacyWorkflow=not position.workflow or position.workflow[0].get('role') not in {'department_manager','hrbp'})
    item['escalationStatus']='escalated' if item.get('escalatedAt') else 'overdue' if item['overdue'] else 'within-sla'
    return item

def escalate_overdue(db,org_id=None,at=None):
    """Idempotent under position row locks; deliverable escalation outbox events are durable."""
    current=at or datetime.now(timezone.utc);query=select(Position).where(Position.state=='in_review').with_for_update(skip_locked=True)
    if org_id:query=query.where(Position.org_id==org_id)
    items=[]
    for position in db.scalars(query):
        item=pending_stage(position,current)
        if not item or not item['overdue'] or item.get('escalatedAt'):continue
        workflow=copy.deepcopy(position.workflow);workflow[position.approval_stage]['escalatedAt']=current.isoformat();position.workflow=workflow
        payload={'positionId':position.id,'revision':position.revision,'stage':position.approval_stage,'role':item['role'],'dueAt':item['dueAt'],'escalationRole':item.get('escalationRole','chro'),'escalatedAt':current.isoformat()}
        db.add(OutboxEvent(org_id=position.org_id,event_type='approval.overdue',payload=payload));items.append(payload)
    if items:db.commit()
    return items

def committee_summary(db,position,revision=None):
    revision=revision or position.revision
    approved=db.scalar(select(Approval).where(Approval.position_id==position.id,Approval.revision==revision,Approval.role=='total_rewards',Approval.decision=='approve'))
    if approved and approved.evidence.get('committee'):return {**copy.deepcopy(approved.evidence['committee']),'status':'approved-committee-record','snapshotBasis':'immutable-rewards-approval-evidence'}
    latest={}
    for row in db.scalars(select(Evaluation).where(Evaluation.position_id==position.id,Evaluation.revision==revision).order_by(Evaluation.created_at,Evaluation.id)):
        user=db.get(User,row.actor_id)
        if user and user.org_id==position.org_id and user.active and user.role=='total_rewards' and row.actor_id!=position.created_by:latest[row.actor_id]=row
    records=list(latest.values());differences=[]
    for i,first in enumerate(records):
        for second in records[i+1:]:
            factors=[{'factor':key,'firstLevel':str(first.answers.get(key,'')),'secondLevel':str(second.answers.get(key,''))} for key in first.answers if first.answers.get(key)!=second.answers.get(key)]
            differences.append({'firstEvaluationId':first.id,'secondEvaluationId':second.id,'firstEvaluatorId':first.actor_id,'secondEvaluatorId':second.actor_id,'pointsDifference':abs(first.result['points']-second.result['points']),'factorDifferences':factors,'gradeDifference':first.result['band']['id']!=second.result['band']['id']})
    return {'status':'ready-for-committee-review' if len(records)>=2 else 'awaiting-second-authenticated-evaluator','count':len(records),'minimumEvaluators':2,'evaluations':[{'id':r.id,'evaluatorId':r.actor_id,'points':r.result['points'],'grade':r.result['band']['id']} for r in records],'differences':differences,'identityBasis':'authenticated-organization-users'}

def evaluation_comparisons(db,position,result):
    """Compare only approved revisions evaluated under the same framework and version."""
    import statistics
    peers=[];warnings=[];parent_comparison=None
    for other in db.scalars(select(Position).where(Position.org_id==position.org_id,Position.active_revision.is_not(None),Position.id!=position.id)):
        version=db.scalar(select(PositionVersion).where(PositionVersion.position_id==other.id,PositionVersion.revision==other.active_revision))
        reward=db.scalar(select(Approval).where(Approval.position_id==other.id,Approval.revision==other.active_revision,Approval.role=='total_rewards',Approval.decision=='approve'))
        evaluation=db.get(Evaluation,reward.evidence.get('evaluationId')) if reward else None
        if not version or not evaluation or any(evaluation.result.get(k)!=result.get(k) for k in ['frameworkId','frameworkVersion']):continue
        summary={'positionId':other.id,'revision':other.active_revision,'title':version.title,'points':evaluation.result['points'],'grade':evaluation.result['band']['id']}
        if position.content.get('jobFamily') and version.content.get('jobFamily')==position.content['jobFamily']:peers.append(summary)
        if position.content.get('parentPositionId')==other.id:
            parent_comparison={**summary,'subordinatePoints':result['points'],'subordinateGrade':result['band']['id']}
            if result['points']>=evaluation.result['points']:warnings.append({'code':'subordinate-grade-review','message':'Subordinate points equal or exceed the approved manager; review grade inversion','parentPositionId':other.id})
    median=statistics.median(p['points'] for p in peers) if peers else None
    if len(peers)>=2 and median and abs(result['points']-median)/median>.3:warnings.append({'code':'family-outlier','message':'Points differ by more than 30% from the same-family approved median; review role scope','medianPoints':median})
    return {'family':position.content.get('jobFamily',''),'peerCount':len(peers),'peerMedianPoints':median,'peers':peers,'parentComparison':parent_comparison,'warnings':warnings,'basis':'approved-revisions-under-the-same-framework-version'}

def approved_evaluation_context(db,position):
    """Read-only bridge from a current-revision Rewards approval to its actual evaluation and pay range."""
    from .domain import digest
    approval=db.scalar(select(Approval).where(Approval.position_id==position.id,Approval.revision==position.revision,Approval.role=='total_rewards',Approval.decision=='approve'))
    if not approval:return None
    record=db.get(Evaluation,approval.evidence.get('evaluationId'))
    if not record:return None
    reuse=approval.evidence.get('evaluationReuse')
    if reuse:
        if record.position_id!=reuse.get('sourcePositionId') or record.revision!=reuse.get('sourceRevision') or record.id!=reuse.get('evaluationId'):return None
        source=db.get(Position,record.position_id)
        if not source or source.org_id!=position.org_id:return None
        committee=committee_summary(db,source,record.revision)
    else:
        if record.position_id!=position.id or record.revision!=position.revision:return None
        committee=committee_summary(db,position,position.revision)
    legacy=False
    if committee.get('count',0)<2 or committee.get('status')!='approved-committee-record' or committee.get('identityBasis')!='authenticated-organization-users':
        stages=list(db.scalars(select(Approval).where(Approval.position_id==position.id,Approval.revision==position.revision,Approval.decision=='approve').order_by(Approval.stage)))
        legacy=not reuse and position.active_revision==position.revision and len(stages)==4 and [a.stage for a in stages]==[0,1,2,3] and [a.role for a in stages]==['od_specialist','total_rewards','finance','chro'] and len({a.actor_id for a in stages})==4 and position.created_by not in {a.actor_id for a in stages} and all(db.get(User,a.actor_id).org_id==position.org_id for a in stages)
        if not legacy:return None
        committee={'status':'legacy-approved-record','count':1,'minimumEvaluators':2,'evaluations':[{'id':record.id,'evaluatorId':record.actor_id,'points':record.result['points'],'grade':record.result['band']['id']}],'differences':[],'identityBasis':'historical-authenticated-approval-record','legacyDoesNotMeetCurrentCommitteePolicy':True,'notice':'This active revision was approved under the prior four-stage workflow. It does not claim the current two-evaluator committee standard.'}
    proof={'id':approval.id,'positionId':position.id,'revision':position.revision,'role':approval.role,'decision':approval.decision,'evaluationId':record.id,'actorId':approval.actor_id,'createdAt':approval.created_at}
    if reuse:proof['evaluationReuse']=copy.deepcopy(reuse)
    result={**copy.deepcopy(record.result),'positionId':record.position_id,'positionRevision':record.revision,'committee':committee}
    linked={'salaryGrade':record.result['band']['id'],'evaluatedPositionId':position.id,'evaluatedPositionRevision':position.revision,'jobFamily':position.content.get('jobFamily',''),'evaluationSummary':str(record.result['points'])+' points / '+record.result['band']['id']+' / '+str(record.result['frameworkId'])+' v'+str(record.result['frameworkVersion'])}
    compensation=record.result.get('compensation')
    if isinstance(compensation,dict):linked.update({k:compensation[k] for k in ['salaryMin','salaryMax','salaryCurrency','salaryPeriod','salarySource'] if k in compensation})
    binding={'positionId':position.id,'revision':position.revision,'approvalId':approval.id,'evaluationId':record.id,'evaluationPositionId':record.position_id,'evaluationRevision':record.revision,'grade':linked['salaryGrade'],'compensation':compensation,'committee':committee}
    return {'id':record.id,'organizationId':position.org_id,'positionId':record.position_id,'revision':record.revision,'createdAt':record.created_at,'result':result,'approval':proof,'linked':linked,'bindingDigest':digest(binding),'source':'authenticated-server-rewards-approval','legacyApprovedRecord':legacy,'status':'rewards-approved-awaiting-final-authorization' if position.active_revision!=position.revision else 'active-revision-approved'}

REPLACEMENT_SCOPE=['title','occupationCode','occupationRelease','headcount','responsibilities','purpose','team','directReports','authority','impact','qualifications','educationLevel','educationFieldCode','experience','experienceYears','experienceType','skills','behaviors','parentPositionId','jobFamily','salaryGrade','salaryMin','salaryMax','salaryCurrency','salaryPeriod','employmentType','location','workMode']
def replacement_reuse(db,position,source,source_content):
    if source.active_revision is None:raise ValueError('Replacement must reference an approved position revision')
    differences=[key for key in REPLACEMENT_SCOPE if position.content.get(key)!=source_content.get(key)]
    if differences:raise ValueError('Replacement scope changed; submit a redesigned position and obtain a new evaluation: '+', '.join(differences))
    finance=db.scalar(select(Approval).where(Approval.position_id==source.id,Approval.revision==source.active_revision,Approval.role=='finance',Approval.decision=='approve').order_by(Approval.created_at.desc()).limit(1))
    if not finance or finance.evidence.get('budgetConfirmed') is not True or finance.evidence.get('approvedAnnualBudget',0)<position.content.get('annualCost',0) or finance.evidence.get('approvedHeadcount',0)<position.content.get('headcount',1):raise ValueError('Replacement needs unchanged headcount and sufficient approved funding')
    rewards=db.scalar(select(Approval).where(Approval.position_id==source.id,Approval.revision==source.active_revision,Approval.role=='total_rewards',Approval.decision=='approve').order_by(Approval.created_at.desc()).limit(1))
    evaluation=db.get(Evaluation,rewards.evidence.get('evaluationId')) if rewards else None
    if not evaluation or evaluation.position_id!=source.id or evaluation.revision!=source.active_revision:raise ValueError('The approved source position has no bound evaluation to reuse')
    return {'sourcePositionId':source.id,'sourceRevision':source.active_revision,'evaluationId':evaluation.id,'reason':'approved-funded-replacement-with-unchanged-scope'}
