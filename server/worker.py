"""At-least-once webhook delivery; consumers deduplicate by event ID.
Destinations and signing secrets are operator-configured per organization.
"""
import hashlib,hmac,ipaddress,json,os,socket,time
from urllib.parse import urlsplit
import httpx
from sqlalchemy import select
from .models import Base,OutboxEvent,database
from .domain import canonical

def configuration(org_id):return json.loads(os.getenv('MIYAR_WEBHOOKS_JSON','{}')).get(org_id)
def validate_target(config):
    parsed=urlsplit(config.get('url',''))
    if parsed.scheme!='https' or parsed.username or parsed.password or parsed.fragment or parsed.port not in [None,443]:raise ValueError('Webhook requires a public HTTPS URL on port 443')
    if parsed.hostname!=config.get('allowedHost') or len(config.get('secret',''))<32:raise ValueError('Configure an explicit allowedHost and a signing secret of 32+ characters')
    answers=socket.getaddrinfo(parsed.hostname,443,type=socket.SOCK_STREAM)
    if not answers or any(not ipaddress.ip_address(item[4][0]).is_global for item in answers):raise ValueError('Private or special destination addresses are forbidden')
    return config['url']
def deliver_one(db,transport=None):
    now=int(time.time());event=db.scalar(select(OutboxEvent).where(OutboxEvent.status.in_(['pending','retry']),OutboxEvent.next_attempt<=now).order_by(OutboxEvent.created_at).with_for_update(skip_locked=True).limit(1))
    if not event:return False
    config=configuration(event.org_id)
    if not config:event.next_attempt=now+300;db.commit();return False
    event.attempts+=1
    try:
        url=validate_target(config);body=canonical({'id':event.id,'type':event.event_type,'createdAt':event.created_at,'organizationId':event.org_id,'data':event.payload}).encode();stamp=str(now)
        signature=hmac.new(config['secret'].encode(),stamp.encode()+b'.'+body,hashlib.sha256).hexdigest()
        with httpx.Client(timeout=10,follow_redirects=False,transport=transport) as client:
            response=client.post(url,content=body,headers={'Content-Type':'application/json','X-Miyar-Event-Id':event.id,'X-Miyar-Timestamp':stamp,'X-Miyar-Signature':'sha256='+signature})
        if not 200<=response.status_code<300:raise ValueError('Destination returned HTTP '+str(response.status_code))
        event.status='delivered';event.last_error=None
    except (ValueError,httpx.HTTPError,OSError):
        # Never retain remote response bodies, credentials or URL query strings in logs.
        event.status='dead-letter' if event.attempts>=8 else 'retry';event.last_error='Delivery failed; check destination configuration and endpoint logs';event.next_attempt=now+min(3600,30*2**min(event.attempts,7))
    db.commit();return True
if __name__=='__main__':
    url=os.environ['DATABASE_URL'].replace('postgres://','postgresql+psycopg://',1).replace('postgresql://','postgresql+psycopg://',1);engine,Session=database(url)
    while True:
        with Session() as db:processed=deliver_one(db)
        if not processed:time.sleep(5)
