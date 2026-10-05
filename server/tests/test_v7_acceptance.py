import asyncio,copy
from datetime import datetime,timedelta,timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from server.domain import DEFAULT_FRAMEWORK,evaluation_consistency
from server.models import Position,OutboxEvent
from .conftest import submit,decide

def test_factor_evidence_repetition_is_rejected_by_api(env):
    app,c,auth,create=env;p=create();submit(c,auth,p)
    reviewed=decide(c,auth,p,'od_specialist',{'scopeReviewed':True,'mappingReviewed':True,'businessValidated':True,'roleNotPerson':True,'businessReviewer':'Independent HR reviewer','businessReviewDate':'2026-10-05'})
    assert reviewed.status_code==200,reviewed.text
    repeated='Documented responsibility for software release approval and controlled access to systems'
    body={'revision':p['revision'],'answers':{f['id']:'2' for f in DEFAULT_FRAMEWORK['factors']},'evidence':{f['id']:repeated for f in DEFAULT_FRAMEWORK['factors']}}
    response=c.post('/api/v1/positions/'+p['id']+'/evaluation',headers=auth('total_rewards'),json=body)
    assert response.status_code==422 and 'more than two factors' in response.text

def test_sla_escalates_from_application_lifespan_without_manual_escalation_request(env):
    app,c,auth,create=env;p=create();submit(c,auth,p)
    with app.state.sessions() as db:
        position=db.get(Position,p['id']);workflow=copy.deepcopy(position.workflow)
        workflow[position.approval_stage]['dueAt']=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat()
        position.workflow=workflow;db.commit()
    async def verify():
        async with app.router.lifespan_context(app):
            for _ in range(30):
                with app.state.sessions() as db:
                    event=db.scalar(select(OutboxEvent).where(OutboxEvent.event_type=='approval.overdue'))
                    if event:
                        assert event.payload['positionId']==p['id'];return
                await asyncio.sleep(.05)
            raise AssertionError('Application lifecycle did not automatically escalate overdue stage')
    asyncio.run(verify())
