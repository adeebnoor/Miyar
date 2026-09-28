"""Minimal process metrics without request bodies, identities or query strings."""
import logging,time,uuid
from threading import Lock
logger=logging.getLogger('miyar.requests')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler=logging.StreamHandler();handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'));logger.addHandler(handler)
logger.propagate=False
def install(app):
    lock=Lock();stats={'started':time.time(),'requests':0,'serverErrors':0}
    def snapshot():
        with lock:return {'scope':'current-process-only','uptimeSeconds':int(time.time()-stats['started']),'requests':stats['requests'],'serverErrors':stats['serverErrors']}
    app.state.operational_snapshot=snapshot
    @app.middleware('http')
    async def observe(request,call_next):
        ident=uuid.uuid4().hex;start=time.monotonic();status=500
        try:
            response=await call_next(request);status=response.status_code
            if request.url.path=='/health':response.headers['Cache-Control']='no-store'
            response.headers.update({'X-Request-ID':ident,'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Strict-Transport-Security':'max-age=31536000; includeSubDomains','Content-Security-Policy-Report-Only':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"})
            return response
        finally:
            with lock:stats['requests']+=1;stats['serverErrors']+=int(status>=500)
            # Route templates omit identifiers; deliberately exclude raw path/query.
            route=getattr(request.scope.get('route'),'path','unmatched')
            logger.info('request id=%s method=%s route=%s status=%s ms=%s',ident,request.method,route,status,round((time.monotonic()-start)*1000))
