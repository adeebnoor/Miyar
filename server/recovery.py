"""Administrator-assisted recovery; no account enumeration or automatic email."""
import secrets,time,jwt
from fastapi import Depends,HTTPException,Request
from pydantic import BaseModel,ConfigDict,Field
from sqlalchemy import select
from .models import User,LoginWindow
from .security import require,password_hash
from .domain import digest

class IssueRecovery(BaseModel):
    model_config=ConfigDict(extra='forbid')
    reason:str=Field(min_length=10,max_length=500)
class CompleteRecovery(BaseModel):
    model_config=ConfigDict(extra='forbid')
    token:str=Field(min_length=30,max_length=3000)
    newPassword:str=Field(min_length=12,max_length=256)

def install(app,session,current,audit,secret):
    @app.post('/api/v1/users/{id}/recovery')
    def issue(id:str,body:IssueRecovery,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        target=db.scalar(select(User).where(User.id==id,User.org_id==user.org_id,User.active.is_(True)))
        if not target or target.id==user.id:raise HTTPException(422,'Use password change for your account; recovery requires another active organization account')
        stamp=int(time.time())
        token=jwt.encode({'sub':target.id,'org':target.org_id,'ver':target.session_version,'iat':stamp,'exp':stamp+900,'jti':secrets.token_hex(24),'iss':'miyar-recovery','aud':'miyar-password-reset'},secret,algorithm='HS256')
        audit(db,user,'auth.recovery-issued',{'userId':target.id,'reason':body.reason,'expiresIn':900});db.commit()
        return {'token':token,'expiresIn':900,'delivery':'Administrator must verify identity and deliver privately. No email is sent.'}
    @app.post('/api/v1/auth/recovery/complete')
    def complete(body:CompleteRecovery,request:Request,db=Depends(session)):
        stamp=int(time.time());key=digest({'recovery':request.client.host if request.client else 'unknown'})
        window=db.get(LoginWindow,key)
        if window and stamp-window.started<900 and window.failures>=5:raise HTTPException(429,'Too many recovery attempts; try again in 15 minutes')
        if not window:window=LoginWindow(key=key,started=stamp,failures=0);db.add(window)
        if stamp-window.started>=900:window.started=stamp;window.failures=0
        window.failures+=1;db.commit()
        try:claims=jwt.decode(body.token,secret,algorithms=['HS256'],issuer='miyar-recovery',audience='miyar-password-reset',options={'require':['sub','org','ver','iat','exp','jti']})
        except jwt.InvalidTokenError:raise HTTPException(422,'Recovery link is invalid or expired; request a new link from your administrator')
        target=db.scalar(select(User).where(User.id==claims['sub']).with_for_update().execution_options(populate_existing=True))
        if not target or not target.active or target.org_id!=claims['org'] or target.session_version!=claims['ver']:raise HTTPException(422,'Recovery link has been used or revoked')
        target.password_hash=password_hash(body.newPassword);target.session_version+=1
        audit(db,target,'auth.password-recovered',{'allSessionsRevoked':True,'delivery':'administrator-assisted'})
        db.delete(window);db.commit()
        return {'recovered':True,'signInRequired':True}
