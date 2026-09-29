"""Isolated investor demonstration tenant built only from synthetic data.

The tenant is created through the same API routes, validation and audit trail as real
organizations. Re-seeding archives the previous demo tenant (accounts deactivated,
sessions revoked, e-mail released) instead of deleting it, so immutable audit history
is preserved. Production organizations are never read or modified.
"""
import copy
from fastapi.testclient import TestClient
from sqlalchemy import select
from .models import Organization, Department, User, uid
from .security import password_hash, issue_token
from .domain import CORE

DOMAIN = 'demo.miyar.invalid'
ROLES = [('admin', 'Demo Administrator'), ('line_manager', 'Demo Requester — Human Capital'),
         ('od_specialist', 'Demo OD Reviewer'), ('total_rewards', 'Demo Total Rewards Reviewer'),
         ('finance', 'Demo Finance Reviewer'), ('chro', 'Demo Final Authority')]
PROFILE = {
    'schema': 'miyar-institution-profile/1.0', 'organizationName': 'Miyar Demo Organization (synthetic)',
    'units': [
        {'code': 'CORP', 'nameAr': 'المؤسسة', 'nameEn': 'Corporate', 'parentCode': '', 'leaderTitle': 'Chief Executive Officer'},
        {'code': 'HC', 'nameAr': 'رأس المال البشري', 'nameEn': 'Human Capital', 'parentCode': 'CORP', 'leaderTitle': 'Director, Human Capital'},
        {'code': 'OPS', 'nameAr': 'العمليات', 'nameEn': 'Operations', 'parentCode': 'CORP', 'leaderTitle': 'Director, Operations'},
    ],
    'gradeStructure': {'name': 'Synthetic grade architecture', 'methodology': 'Illustrative point ranges for demonstration only', 'grades': [
        {'id': 'G7', 'labelAr': 'أخصائي', 'labelEn': 'Professional', 'level': 'professional', 'minPoints': 300, 'maxPoints': 449},
        {'id': 'G9', 'labelAr': 'أخصائي أول', 'labelEn': 'Senior Professional', 'level': 'senior', 'minPoints': 450, 'maxPoints': 599},
        {'id': 'G11', 'labelAr': 'مدير', 'labelEn': 'Manager', 'level': 'manager', 'minPoints': 600, 'maxPoints': 749},
        {'id': 'G13', 'labelAr': 'مدير إدارة', 'labelEn': 'Director', 'level': 'director', 'minPoints': 750, 'maxPoints': 899},
    ]},
    'approvedBy': 'Synthetic data — not an institutional approval', 'approvedOn': '2026-09-29',
}
# (title, SSCO code, department, annual cost, target state)
POSITIONS = [
    ('مدير عمليات الموارد البشرية', '121214', 'HC', 420000, 'active'),
    ('أخصائي رواتب وبدلات', '242322', 'HC', 216000, 'active'),
    ('أخصائي تعيين مهني', '242301', 'HC', 204000, 'active'),
    ('أخصائي علاقات الموظفين', '242302', 'HC', 198000, 'finance'),
    ('محاسب', '241101', 'HC', 180000, 'total_rewards'),
    ('مدير محاسبة', '121101', 'HC', 390000, 'od_specialist'),
    ('أخصائي حاسب آلي', '251101', 'HC', 222000, 'draft'),
    ('مهندس برمجيات', '251204', 'OPS', 276000, 'active'),
    ('مهندس مدني', '214201', 'OPS', 264000, 'active'),
    ('مهندس ميكانيكي', '214401', 'OPS', 258000, 'chro'),
    ('اختصاصي شبكات نظم المعلومات', '252301', 'OPS', 240000, 'finance'),
    ('مهندس تخطيط مصانع', '214101', 'OPS', 252000, 'total_rewards'),
    ('مشرف مباني', '311201', 'OPS', 144000, 'od_specialist'),
    ('أخصائي علاقات المستثمرين', '243203', 'OPS', 234000, 'draft'),
]
STAGES = ['od_specialist', 'total_rewards', 'finance', 'chro']
EVIDENCE = {
    'od_specialist': {'scopeReviewed': True, 'mappingReviewed': True, 'businessValidated': True, 'roleNotPerson': True,
                      'businessReviewer': 'Synthetic department reviewer', 'businessReviewDate': '2026-09-20'},
    'total_rewards': {'payFrameworkReviewed': True},
    'finance': {'vacancyConfirmed': True, 'budgetConfirmed': True, 'approvedHeadcount': 1},
    'chro': {},
}


def _content(title, code, cost):
    value = {k: 'Synthetic ' + k + ' for the demonstration tenant' for k in CORE}
    value.update(title=title, requestType='additional-headcount', occupationCode=code, annualCost=cost, headcount=1,
                 responsibilities='Plan the work programme\nDeliver agreed outcomes\nReport progress and risks',
                 raci=[{'responsibility': 'Deliver outcomes', 'R': title, 'A': 'Department director', 'C': 'Human Capital', 'I': 'Finance'}])
    return value


def archive(db):
    """Deactivate every earlier demo tenant; its audit history stays intact."""
    archived = 0
    for org in db.scalars(select(Organization)).all():
        if not (org.settings or {}).get('demoTenant') or (org.settings or {}).get('demoArchived'):
            continue
        for user in db.scalars(select(User).where(User.org_id == org.id)):
            user.active = False
            user.session_version += 1
            user.email = 'archived-' + uid() + '@' + DOMAIN
        org.settings = {**org.settings, 'demoArchived': True}
        archived += 1
    return archived


def seed(app, password):
    """Create a fresh demo tenant and return a summary. The password is never stored in clear text or printed."""
    password_hash(password)  # validates the length policy before anything changes
    with app.state.sessions() as db:
        archived = archive(db)
        db.flush()  # release archived e-mail addresses before the new accounts are inserted
        org = Organization(name=PROFILE['organizationName'], settings={'demoMode': True, 'demoTenant': True, 'institutionProfile': {**copy.deepcopy(PROFILE), 'version': 1, 'updatedAt': '2026-09-29T00:00:00Z'}})
        db.add(org)
        db.flush()
        departments = {}
        for code, name in [('HC', 'Human Capital'), ('OPS', 'Operations')]:
            d = Department(org_id=org.id, name=name)
            db.add(d)
            db.flush()
            departments[code] = d.id
        tokens, emails = {}, {}
        for role, name in ROLES:
            email = role.replace('_', '-') + '@' + DOMAIN
            u = User(org_id=org.id, email=email, name=name, role=role, password_hash=password_hash(password),
                     department_id=departments['HC'] if role == 'line_manager' else None)
            db.add(u)
            db.flush()
            tokens[role], emails[role] = issue_token(u, app.state.secret), email
        db.commit()
        org_id = org.id
    counts = {}
    with TestClient(app) as client:
        auth = lambda role: {'Authorization': 'Bearer ' + tokens[role]}
        for title, code, dept, cost, target in POSITIONS:
            creator = 'line_manager' if dept == 'HC' else 'admin'
            r = client.post('/api/v1/positions', headers=auth(creator), json={'departmentId': departments[dept], 'content': _content(title, code, cost), 'reason': 'Synthetic demonstration request'})
            r.raise_for_status()
            p = r.json()
            if target != 'draft':
                r = client.post('/api/v1/positions/' + p['id'] + '/submit', headers=auth(creator), json={'revision': p['revision'], 'reason': 'Submitted for the demonstration workflow'})
                r.raise_for_status()
                p = r.json()
                for stage in STAGES:
                    if stage == target:
                        break
                    if stage == 'total_rewards':
                        client.post('/api/v1/positions/' + p['id'] + '/evaluation', headers=auth(stage), json={'revision': p['revision'], 'answers': {'knowledge': '3', 'complexity': '2', 'impact': '2'},
                                    'evidence': {'knowledge': 'Synthetic evidence', 'complexity': 'Synthetic evidence', 'impact': 'Synthetic evidence'}}).raise_for_status()
                    evidence = {**EVIDENCE[stage], **({'approvedAnnualBudget': cost} if stage == 'finance' else {})}
                    r = client.post('/api/v1/positions/' + p['id'] + '/decisions', headers=auth(stage), json={'revision': p['revision'], 'decision': 'approve', 'comment': 'Synthetic approval for the demonstration', 'evidence': evidence})
                    r.raise_for_status()
                    p = r.json()
            counts[target] = counts.get(target, 0) + 1
    return {'organizationId': org_id, 'archivedTenants': archived, 'accounts': emails, 'positions': len(POSITIONS), 'byStage': counts}


def install(app):
    """Operator-only remote trigger for hosts without a shell (disabled unless MIYAR_DEMO_SEED_TOKEN is set)."""
    import hmac
    import os
    from fastapi import Header, HTTPException
    from pydantic import BaseModel, ConfigDict, Field
    from threading import Lock
    guard = Lock()

    class DemoSeed(BaseModel):
        model_config = ConfigDict(extra='forbid')
        password: str = Field(min_length=12, max_length=256)

    @app.post('/api/v1/operator/demo-tenant', include_in_schema=False)
    def demo_tenant(body: DemoSeed, x_operator_token: str = Header(default='')):
        expected = os.getenv('MIYAR_DEMO_SEED_TOKEN', '')
        if len(expected) < 32:
            raise HTTPException(404, 'Not found')
        if not hmac.compare_digest(x_operator_token.encode(), expected.encode()):
            raise HTTPException(403, 'Operator token required')
        if not guard.acquire(blocking=False):
            raise HTTPException(429, 'A demo reset is already running')
        try:
            return seed(app, body.password)
        finally:
            guard.release()
