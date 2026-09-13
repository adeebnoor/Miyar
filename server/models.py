from datetime import datetime,timezone
from uuid import uuid4
from sqlalchemy import String,Text,Integer,Boolean,JSON,UniqueConstraint,ForeignKey,create_engine,event
from sqlalchemy.orm import DeclarativeBase,Mapped,mapped_column,sessionmaker

def uid():return str(uuid4())
def now():return datetime.now(timezone.utc).isoformat()
class Base(DeclarativeBase):pass
class Organization(Base):
    __tablename__='organizations'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    name:Mapped[str]=mapped_column(String(200))
    settings:Mapped[dict]=mapped_column(JSON,default=dict)
class Department(Base):
    __tablename__='departments'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    name:Mapped[str]=mapped_column(String(200))
class User(Base):
    __tablename__='users'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    email:Mapped[str]=mapped_column(String(254),unique=True)
    name:Mapped[str]=mapped_column(String(200))
    role:Mapped[str]=mapped_column(String(40))
    department_id:Mapped[str|None]=mapped_column(ForeignKey('departments.id'),nullable=True)
    password_hash:Mapped[str]=mapped_column(Text)
    active:Mapped[bool]=mapped_column(Boolean,default=True)
    session_version:Mapped[int]=mapped_column(Integer,default=1)
class Position(Base):
    __tablename__='positions'
    __table_args__=(UniqueConstraint('org_id','internal_code'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    department_id:Mapped[str]=mapped_column(ForeignKey('departments.id'),index=True)
    internal_code:Mapped[str]=mapped_column(String(80))
    title:Mapped[str]=mapped_column(String(300))
    content:Mapped[dict]=mapped_column(JSON)
    state:Mapped[str]=mapped_column(String(30),default='draft')
    revision:Mapped[int]=mapped_column(Integer,default=1)
    active_revision:Mapped[int|None]=mapped_column(Integer,nullable=True)
    workflow:Mapped[list]=mapped_column(JSON,default=list)
    policy_snapshot:Mapped[dict]=mapped_column(JSON,default=dict)
    approval_stage:Mapped[int]=mapped_column(Integer,default=0)
    created_by:Mapped[str]=mapped_column(ForeignKey('users.id'))
    created_at:Mapped[str]=mapped_column(String(40),default=now)
    updated_at:Mapped[str]=mapped_column(String(40),default=now)
    __mapper_args__={'version_id_col':revision,'version_id_generator':False}
class PositionVersion(Base):
    __tablename__='position_versions'
    __table_args__=(UniqueConstraint('position_id','revision'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    position_id:Mapped[str]=mapped_column(ForeignKey('positions.id'),index=True)
    revision:Mapped[int]=mapped_column(Integer)
    title:Mapped[str]=mapped_column(String(300))
    content:Mapped[dict]=mapped_column(JSON)
    actor_id:Mapped[str]=mapped_column(ForeignKey('users.id'))
    reason:Mapped[str]=mapped_column(String(1000))
    created_at:Mapped[str]=mapped_column(String(40),default=now)
class AuditEvent(Base):
    __tablename__='audit_events'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    position_id:Mapped[str|None]=mapped_column(ForeignKey('positions.id'),nullable=True,index=True)
    actor_id:Mapped[str]=mapped_column(ForeignKey('users.id'))
    action:Mapped[str]=mapped_column(String(60))
    detail:Mapped[dict]=mapped_column(JSON)
    created_at:Mapped[str]=mapped_column(String(40),default=now)
    previous_hash:Mapped[str]=mapped_column(String(64),default='')
    digest:Mapped[str]=mapped_column(String(64))
class Approval(Base):
    __tablename__='approvals'
    __table_args__=(UniqueConstraint('position_id','revision','stage'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    position_id:Mapped[str]=mapped_column(ForeignKey('positions.id'),index=True)
    revision:Mapped[int]=mapped_column(Integer)
    stage:Mapped[int]=mapped_column(Integer)
    actor_id:Mapped[str]=mapped_column(ForeignKey('users.id'))
    role:Mapped[str]=mapped_column(String(40))
    decision:Mapped[str]=mapped_column(String(20))
    comment:Mapped[str]=mapped_column(String(2000))
    evidence:Mapped[dict]=mapped_column(JSON,default=dict)
    created_at:Mapped[str]=mapped_column(String(40),default=now)
class OutboxEvent(Base):
    __tablename__='outbox_events'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    event_type:Mapped[str]=mapped_column(String(60))
    payload:Mapped[dict]=mapped_column(JSON)
    status:Mapped[str]=mapped_column(String(30),default='pending')
    attempts:Mapped[int]=mapped_column(Integer,default=0)
    created_at:Mapped[str]=mapped_column(String(40),default=now)
    next_attempt:Mapped[int]=mapped_column(Integer,default=0)
    last_error:Mapped[str|None]=mapped_column(String(500),nullable=True)
class TaxonomyRelease(Base):
    __tablename__='taxonomy_releases'
    id:Mapped[str]=mapped_column(String(100),primary_key=True)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    payload:Mapped[dict]=mapped_column(JSON)
    created_at:Mapped[str]=mapped_column(String(40),default=now)
class IntegrationReceipt(Base):
    __tablename__='integration_receipts'
    __table_args__=(UniqueConstraint('org_id','idempotency_key'),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    org_id:Mapped[str]=mapped_column(ForeignKey('organizations.id'),index=True)
    idempotency_key:Mapped[str]=mapped_column(String(100))
    payload_hash:Mapped[str]=mapped_column(String(64))
    result:Mapped[dict]=mapped_column(JSON)

def database(url):
    engine=create_engine(url,connect_args={'check_same_thread':False} if url.startswith('sqlite') else {},pool_pre_ping=True)
    if url.startswith('sqlite'):
        @event.listens_for(engine,'connect')
        def sqlite_foreign_keys(conn,record):conn.execute('PRAGMA foreign_keys=ON')
    return engine,sessionmaker(engine,expire_on_commit=False)

class Evaluation(Base):
    __tablename__='evaluations'
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=uid)
    position_id:Mapped[str]=mapped_column(ForeignKey('positions.id'),index=True)
    revision:Mapped[int]=mapped_column(Integer)
    actor_id:Mapped[str]=mapped_column(ForeignKey('users.id'))
    result:Mapped[dict]=mapped_column(JSON)
    answers:Mapped[dict]=mapped_column(JSON)
    evidence:Mapped[dict]=mapped_column(JSON)
    created_at:Mapped[str]=mapped_column(String(40),default=now)
class LoginWindow(Base):
    __tablename__='login_windows'
    key:Mapped[str]=mapped_column(String(64),primary_key=True)
    started:Mapped[int]=mapped_column(Integer)
    failures:Mapped[int]=mapped_column(Integer,default=0)
