"""Database-enforced append-only records. Database owners can still alter DDL."""
from sqlalchemy import text
from .domain import digest

def protect(engine):
    with engine.begin() as connection:
        if engine.dialect.name=='sqlite':
            for table in ['audit_events','position_versions','approvals','evaluations']:
                for operation in ['UPDATE','DELETE']:
                    connection.execute(text(f"CREATE TRIGGER IF NOT EXISTS immutable_{table}_{operation.lower()} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT, 'Append-only record'); END"))
        elif engine.dialect.name=='postgresql':
            connection.execute(text("CREATE OR REPLACE FUNCTION miyar_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Append-only record'; END; $$"))
            for table in ['audit_events','position_versions','approvals','evaluations']:
                connection.execute(text(f"DROP TRIGGER IF EXISTS immutable_{table} ON {table}"))
                connection.execute(text(f"CREATE TRIGGER immutable_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION miyar_reject_history_mutation()"))
def verify(events):
    previous='';errors=[]
    for e in events:
        value={'id':e.id,'actorId':e.actor_id,'action':e.action,'positionId':e.position_id,'detail':e.detail,'createdAt':e.created_at,'previousHash':e.previous_hash}
        if e.previous_hash!=previous or digest(value)!=e.digest:errors.append(e.id)
        previous=e.digest
    return {'valid':not errors,'events':len(events),'invalidEventIds':errors,'headDigest':previous,'protection':'Database triggers reject UPDATE/DELETE; hash links detect modifications. A database owner can alter DDL; external signed checkpoints are required against administrator-level tampering.'}
