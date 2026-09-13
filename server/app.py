"""Tenant-scoped API. Approval checks are enforced here, never by UI role selectors."""
import copy,json,os,re,secrets,time,math,csv,zipfile
from contextlib import asynccontextmanager
from typing import Annotated,Literal
from fastapi import FastAPI,Depends,HTTPException,UploadFile,File,Request,Header,Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel,Field,ConfigDict
from sqlalchemy import select,func
from sqlalchemy.exc import IntegrityError,SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from .models import Base,Organization,Department,User,Position,PositionVersion,AuditEvent,Approval,OutboxEvent,Evaluation,LoginWindow,TaxonomyRelease,IntegrationReceipt,database,uid,now
from .security import bearer,actor,require,position_for,scoped_positions,password_hash,verify_password,issue_token,hasher
from .domain import DEFAULT_WORKFLOW,DEFAULT_FRAMEWORK,ROLES,CORE,normalized,canonical,digest,required_content,validate_workflow,validate_framework,validate_regulatory,valid_date,grade
from .taxonomy import Catalog,read_rows,bulk_diagnosis

class Input(BaseModel):model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
class Login(Input):email:str=Field(min_length=3,max_length=254);password:str=Field(min_length=1,max_length=256)
class PasswordChange(Input):currentPassword:str=Field(min_length=1,max_length=256);newPassword:str=Field(min_length=12,max_length=256)
class NewUser(Input):email:str=Field(min_length=3,max_length=254);name:str=Field(min_length=1,max_length=200);password:str=Field(min_length=12,max_length=256);role:str;departmentId:str|None=None
class NewDepartment(Input):name:str=Field(min_length=1,max_length=200)
class NewPosition(Input):departmentId:str;content:dict;reason:str=Field(min_length=3,max_length=1000)
class ChangePosition(Input):revision:int=Field(ge=1);content:dict;reason:str=Field(min_length=3,max_length=1000)
class RevisionRequest(Input):revision:int=Field(ge=1);reason:str=Field(min_length=3,max_length=1000)
class RestoreRequest(RevisionRequest):restoreRevision:int=Field(ge=1)
class ApprovalRequest(Input):revision:int=Field(ge=1);decision:Literal['approve','return','reject'];comment:str=Field(min_length=3,max_length=2000);evidence:dict=Field(default_factory=dict)
class GradeRequest(Input):revision:int=Field(ge=1);answers:dict;evidence:dict
class AnalyzeRequest(Input):
    text:str=Field(min_length=3,max_length=12000)
    field:str=Field(default='',max_length=200)
    seniority:str=Field(default='',max_length=200)
    constraints:str=Field(default='',max_length=4000)
    def retrieval_text(self):
        return '\n'.join([self.text,*[name+': '+value for name,value in [('Field',self.field),('Seniority',self.seniority)] if value.strip()]])
class FrameworkRequest(Input):framework:dict;reason:str=Field(min_length=3,max_length=1000)
class WorkflowRequest(Input):steps:list[dict];reason:str=Field(min_length=3,max_length=1000)
class BrandingRequest(Input):nameAr:str=Field(max_length=200);nameEn:str=Field(max_length=200);color:str=Field(pattern=r'^#[0-9a-fA-F]{6}$');footer:str=Field(max_length=500)

CONTENT_FIELDS=set(CORE)|{'field','seniority','requestType','department','manager','effectiveDate','experience','certifications','occupationCode','occupationRelease','educationLevel','educationFieldCode','constraints','saudization','saudizationSource','saudizationDate','license','licenseSource','licenseDate','headcount','annualCost','directReports','raci','skillRequirements','mappingJustification','provisional','provisionalParent','sourceDecisionId','sourceDecisionInput','importNotes'}

def create_app(db_url=None,jwt_secret=None,catalog=None):
    secret=jwt_secret or os.getenv('MIYAR_JWT_SECRET','');url=db_url or os.getenv('DATABASE_URL','sqlite:///./.runtime/miyar.db')
    if len(secret)<32:raise RuntimeError('Set MIYAR_JWT_SECRET to a random value of at least 32 characters')
    if os.getenv('MIYAR_ENV')=='production' and not url.startswith(('postgresql','postgres')):raise RuntimeError('Production requires persistent PostgreSQL')
    if url.startswith('postgres://'):url='postgresql+psycopg://'+url[len('postgres://'):]
    elif url.startswith('postgresql://'):url=url.replace('postgresql://','postgresql+psycopg://',1)
    engine,Session=database(url);Base.metadata.create_all(engine)
    from .audit import protect
    protect(engine);references=catalog or Catalog()
    app=FastAPI(title='Miyar Enterprise Workforce API',version='4.4.0',description='Tenant-scoped positions, revision-bound approvals, versioned classification references and explicit integration boundaries.')
    app.state.sessions=Session;app.state.catalog=references;app.state.secret=secret
    origins=[x.strip() for x in os.getenv('MIYAR_CORS_ORIGINS','https://adeebnoor.github.io').split(',') if x.strip()]
    app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type','Idempotency-Key'])
    @app.middleware('http')
    async def limits(request,call_next):
        length=request.headers.get('content-length')
        if length and (not length.isdigit() or int(length)>11_000_000):return JSONResponse({'detail':'Request exceeds 11 MB'},status_code=413)
        if request.method in {'POST','PATCH','PUT'}:
            total=0;chunks=[]
            async for chunk in request.stream():
                total+=len(chunk)
                if total>11_000_000:return JSONResponse({'detail':'Request exceeds 11 MB'},status_code=413)
                chunks.append(chunk)
            request._body=b''.join(chunks)
        response=await call_next(request);response.headers['X-Content-Type-Options']='nosniff';response.headers['Referrer-Policy']='no-referrer'
        if request.url.path.startswith('/api/'):response.headers['Cache-Control']='no-store'
        return response
    def session():
        with Session() as db:
            try:yield db
            except (IntegrityError,StaleDataError):db.rollback();raise HTTPException(409,'Record changed or duplicate operation; reload and retry')
    def current(credentials:Annotated[HTTPAuthorizationCredentials|None,Depends(bearer)],db=Depends(session)):
        if not credentials:raise HTTPException(401,'Sign in to use the organization workspace')
        return actor(credentials.credentials,db,secret)
    def organization(db,user):return db.get(Organization,user.org_id)
    def check_revision(position,revision):
        if position.revision!=revision:raise HTTPException(409,'A newer revision exists; reload before changing this position')
    def department(db,user,id):
        dep=db.scalar(select(Department).where(Department.id==id,Department.org_id==user.org_id))
        if not dep or (user.role=='line_manager' and user.department_id!=id):raise HTTPException(403,'Department access denied')
        return dep
    def audit(db,user,action,detail,position=None):
        # Serialize each organization's audit chain under a PostgreSQL row lock.
        db.scalar(select(Organization).where(Organization.id==user.org_id).with_for_update())
        prior=db.scalar(select(AuditEvent).where(AuditEvent.org_id==user.org_id).order_by(AuditEvent.created_at.desc(),AuditEvent.id.desc()).limit(1));ts=now();id=uid();previous=prior.digest if prior else ''
        value={'id':id,'actorId':user.id,'action':action,'positionId':position.id if position else None,'detail':detail,'createdAt':ts,'previousHash':previous}
        record=AuditEvent(id=id,org_id=user.org_id,position_id=position.id if position else None,actor_id=user.id,action=action,detail=detail,created_at=ts,previous_hash=previous,digest=digest(value));db.add(record);db.flush();return record
    release_cache={}
    def reference_for(db,user,release=None):
        selected=release or organization(db,user).settings.get('taxonomyRelease',references.occupations['id'])
        if selected==references.occupations['id']:return references
        key=(user.org_id,selected)
        if key not in release_cache:
            row=db.get(TaxonomyRelease,digest({'org':user.org_id,'release':selected}))
            if not row or row.org_id!=user.org_id:raise HTTPException(422,'Unsupported organization taxonomy release')
            release_cache[key]=Catalog(occupation_payload=row.payload)
        return release_cache[key]
    def content(value,db=None,user=None):
        selected=reference_for(db,user,value.get('occupationRelease') if isinstance(value,dict) else None) if user else references
        if not isinstance(value,dict) or len(canonical(value))>80000:raise HTTPException(422,'Invalid position content')
        extra=set(value)-CONTENT_FIELDS
        if extra:raise HTTPException(422,{'unsupportedFields':sorted(extra)})
        result=copy.deepcopy(value)
        for key,v in result.items():
            if key in {'raci','skillRequirements'}:
                if not isinstance(v,list) or len(v)>100:raise HTTPException(422,'Invalid matrix')
                allowed={'responsibility','R','A','C','I'} if key=='raci' else {'name','type','level','evidence'}
                if any(not isinstance(row,dict) or set(row)-allowed or any(not isinstance(cell,str) or len(cell)>4000 for cell in row.values()) for row in v):raise HTTPException(422,'Matrix entries must contain named text fields')
            elif key in {'headcount','annualCost','directReports'}:
                if not isinstance(v,(int,float)) or isinstance(v,bool) or not 0<=v<=1e12:raise HTTPException(422,'Invalid numeric scope')
            elif key=='provisional':
                if not isinstance(v,bool):raise HTTPException(422,'Invalid provisional flag')
            elif not isinstance(v,str) or len(v)>4000:raise HTTPException(422,'Invalid field value')
        if not isinstance(result.get('title'),str) or not result['title'].strip() or len(result['title'])>300:raise HTTPException(422,'A position title is required')
        if result.get('provisionalParent') and (result['provisionalParent'] not in selected.nodes or selected.nodes[result['provisionalParent']]['level']!='unit'):raise HTTPException(422,'Select an existing unit as provisional parent')
        code=result.get('occupationCode','')
        if code and code not in selected.roles:raise HTTPException(422,'Occupation code does not exist in the selected release')
        if result.get('occupationRelease',selected.occupations['id'])!=selected.occupations['id']:raise HTTPException(422,'Select a supported taxonomy release')
        if result.get('educationFieldCode') and result['educationFieldCode'] not in references.education_fields:raise HTTPException(422,'Unknown educational specialization code')
        if result.get('educationLevel') and result['educationLevel'] not in {str(x) for x in range(9)}:raise HTTPException(422,'Unknown educational level')
        if result.get('headcount',1)<=0 or int(result.get('headcount',1))!=result.get('headcount',1):raise HTTPException(422,'Headcount must be positive')
        if 'directReports' in result and int(result['directReports'])!=result['directReports']:raise HTTPException(422,'Direct reports must be a whole number')
        if result.get('provisional') and result.get('occupationCode'):raise HTTPException(422,'A provisional internal role cannot carry a final occupation code')
        try:validate_regulatory(result)
        except (ValueError,TypeError) as e:raise HTTPException(422,str(e))
        result['occupationRelease']=selected.occupations['id'];return result
    def snapshot(db,user,p,reason):
        db.add(PositionVersion(position_id=p.id,revision=p.revision,title=p.title,content=copy.deepcopy(p.content),actor_id=user.id,reason=reason))
    def present(p):return {'id':p.id,'internalCode':p.internal_code,'title':p.title,'departmentId':p.department_id,'state':p.state,'createdBy':p.created_by,'revision':p.revision,'activeRevision':p.active_revision,'content':p.content,'workflow':p.workflow,'approvalStage':p.approval_stage,'createdAt':p.created_at,'updatedAt':p.updated_at}
    def revise(db,user,p,value,reason,restored=None):
        if p.state=='in_review':raise HTTPException(409,'Return or withdraw the request before editing its reviewed content')
        old={'title':p.title,'revision':p.revision};p.content=content(value,db,user);p.title=p.content['title'];p.revision+=1;p.state='draft';p.approval_stage=0;p.workflow=[];p.updated_at=now();snapshot(db,user,p,reason)
        audit(db,user,'position.restored' if restored else 'position.changed',{'old':old,'newTitle':p.title,'newRevision':p.revision,'reason':reason,'restoredFromRevision':restored},p)
    @app.get('/health')
    def health():
        try:
            with engine.connect() as connection:connection.execute(select(1))
        except SQLAlchemyError:return JSONResponse({'status':'unavailable','database':'unreachable'},status_code=503)
        return {'status':'ok','version':app.version,'taxonomy':references.occupations['id'],'occupations':len(references.roles),'semanticModelReady':references.model is not None,'storage':'postgresql' if engine.dialect.name=='postgresql' else 'local-development-sqlite','services':service_capabilities()}
    @app.post('/api/v1/auth/login')
    def login(body:Login,request:Request,db=Depends(session)):
        email=body.email.strip().lower();key=digest({'email':email,'ip':request.client.host if request.client else ''});ts=int(time.time());window=db.get(LoginWindow,key)
        if window and ts-window.started<900 and window.failures>=5:raise HTTPException(429,'Too many failed attempts; try again in 15 minutes')
        user=db.scalar(select(User).where(User.email==email));valid=user and user.active and verify_password(body.password,user.password_hash)
        if not valid:
            # Match verification work for unknown users, reducing account-enumeration timing differences.
            if not user:verify_password(body.password,app.state.dummy_hash)
            if not window:window=LoginWindow(key=key,started=ts,failures=0);db.add(window)
            if ts-window.started>=900:window.started=ts;window.failures=0
            window.failures+=1;db.commit();raise HTTPException(401,'Invalid sign-in details')
        if window:db.delete(window)
        audit(db,user,'auth.login',{});db.commit();return {'accessToken':issue_token(user,secret),'tokenType':'Bearer','expiresIn':1800}
    app.state.dummy_hash=hasher.hash(secrets.token_urlsafe(32))
    @app.post('/api/v1/auth/logout-all')
    def logout(user=Depends(current),db=Depends(session)):
        user.session_version+=1;audit(db,user,'auth.sessions-revoked',{});db.commit();return {'revoked':True}
    @app.post('/api/v1/auth/password')
    def change_password(body:PasswordChange,user=Depends(current),db=Depends(session)):
        user=db.scalar(select(User).where(User.id==user.id).with_for_update().execution_options(populate_existing=True))
        key=digest({'action':'password-change','userId':user.id});ts=int(time.time());window=db.get(LoginWindow,key)
        if window and ts-window.started<900 and window.failures>=5:raise HTTPException(429,'Too many failed attempts; try again in 15 minutes')
        if not verify_password(body.currentPassword,user.password_hash):
            if not window:window=LoginWindow(key=key,started=ts,failures=0);db.add(window)
            if ts-window.started>=900:window.started=ts;window.failures=0
            window.failures+=1;db.commit();raise HTTPException(422,'Current password is incorrect')
        if body.currentPassword==body.newPassword:raise HTTPException(422,'Choose a different new password')
        if window:db.delete(window)
        user.password_hash=password_hash(body.newPassword);user.session_version+=1
        audit(db,user,'auth.password-changed',{'otherSessionsRevoked':True});db.commit()
        return {'accessToken':issue_token(user,secret),'tokenType':'Bearer','expiresIn':1800}
    @app.get('/api/v1/me')
    def me(user=Depends(current),db=Depends(session)):
        org=organization(db,user);return {'id':user.id,'name':user.name,'email':user.email,'role':user.role,'departmentId':user.department_id,'organization':{'id':org.id,'name':org.name},'capabilities':{'approveAs':user.role if user.role in ['od_specialist','total_rewards','finance','chro'] else None,'configure':user.role=='admin'}}
    def service_capabilities():
        from importlib.util import find_spec
        from .exports import public_key
        signing=False
        try:public_key();signing=True
        except (ValueError,TypeError):pass
        return {'version':app.version,'storage':engine.dialect.name,'approvals':True,'semanticEnabled':os.getenv('MIYAR_ENABLE_EMBEDDINGS')=='true','semanticModelReady':references.model is not None,'signingConfigured':signing,'exports':[{'format':kind,'available':find_spec(module) is not None} for kind,module in [('DOCX','docx'),('XLSX','openpyxl'),('PDF','weasyprint')]],'externalConnectors':'Require organization-authorized endpoint configuration'}
    @app.get('/api/v1/capabilities')
    def capabilities(user=Depends(current)):
        return service_capabilities()
    @app.get('/api/v1/departments')
    def departments(user=Depends(current),db=Depends(session)):
        query=select(Department).where(Department.org_id==user.org_id)
        if user.role=='line_manager':query=query.where(Department.id==user.department_id)
        return [{'id':d.id,'name':d.name} for d in db.scalars(query)]
    @app.post('/api/v1/departments',status_code=201)
    def add_department(body:NewDepartment,user=Depends(current),db=Depends(session)):
        require(user,'admin');dep=Department(org_id=user.org_id,name=body.name);db.add(dep);db.flush();audit(db,user,'department.created',{'departmentId':dep.id,'name':dep.name});db.commit();return {'id':dep.id,'name':dep.name}
    @app.get('/api/v1/users')
    def users(user=Depends(current),db=Depends(session)):
        require(user,'admin');return [{'id':u.id,'email':u.email,'name':u.name,'role':u.role,'departmentId':u.department_id,'active':u.active} for u in db.scalars(select(User).where(User.org_id==user.org_id))]
    @app.post('/api/v1/users',status_code=201)
    def add_user(body:NewUser,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        if body.role not in ROLES or '@' not in body.email:raise HTTPException(422,'Invalid role or email')
        if body.role=='line_manager' and not body.departmentId:raise HTTPException(422,'Line managers require a department')
        if body.departmentId:department(db,user,body.departmentId)
        u=User(org_id=user.org_id,email=body.email.strip().lower(),name=body.name,role=body.role,department_id=body.departmentId,password_hash=password_hash(body.password));db.add(u);db.flush();audit(db,user,'user.created',{'userId':u.id,'role':u.role,'departmentId':u.department_id});db.commit();return {'id':u.id,'role':u.role}
    @app.post('/api/v1/users/{id}/deactivate')
    def deactivate(id:str,user=Depends(current),db=Depends(session)):
        require(user,'admin');target=db.scalar(select(User).where(User.id==id,User.org_id==user.org_id))
        if not target:raise HTTPException(404,'User not found')
        if target.id==user.id:raise HTTPException(409,'Cannot deactivate your own administrative account')
        target.active=False;target.session_version+=1;audit(db,user,'user.deactivated',{'userId':id});db.commit();return {'active':False}
    @app.get('/api/v1/settings')
    def settings(user=Depends(current),db=Depends(session)):
        org=organization(db,user);return {'workflow':org.settings.get('workflow',DEFAULT_WORKFLOW),'framework':org.settings.get('framework',DEFAULT_FRAMEWORK),'branding':org.settings.get('branding',{'nameAr':org.name,'nameEn':org.name,'color':'#146954','footer':''}),'taxonomyRelease':org.settings.get('taxonomyRelease',references.occupations['id']),'integrations':'Configured by environment; no credentials exposed in the browser'}
    @app.post('/api/v1/settings/workflow')
    def workflow(body:WorkflowRequest,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        try:steps=validate_workflow(body.steps)
        except (ValueError,TypeError,KeyError) as e:raise HTTPException(422,str(e))
        org=organization(db,user);org.settings={**org.settings,'workflow':steps};audit(db,user,'workflow.configured',{'steps':steps,'reason':body.reason});db.commit();return {'steps':steps,'appliesTo':'New submissions; existing requests retain their stage snapshot'}
    @app.post('/api/v1/settings/framework')
    def framework(body:FrameworkRequest,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        try:f=validate_framework(body.framework)
        except (ValueError,TypeError,KeyError,ArithmeticError) as e:raise HTTPException(422,str(e))
        org=organization(db,user);previous=org.settings.get('framework',DEFAULT_FRAMEWORK);f['version']=int(previous.get('version',0))+1;org.settings={**org.settings,'framework':f};audit(db,user,'framework.configured',{'frameworkId':f.get('id'),'version':f['version'],'reason':body.reason});db.commit();return f
    @app.post('/api/v1/settings/branding')
    def branding(body:BrandingRequest,user=Depends(current),db=Depends(session)):
        require(user,'admin');org=organization(db,user);org.settings={**org.settings,'branding':body.model_dump()};audit(db,user,'branding.configured',body.model_dump());db.commit();return body
    @app.get('/api/v1/positions')
    def positions(user=Depends(current),db=Depends(session),q:str='',state:str|None=None,offset:int=Query(0,ge=0),limit:int=Query(50,ge=1,le=100)):
        query=scoped_positions(user)
        if q:query=query.where(Position.title.ilike('%'+q.replace('%','\\%').replace('_','\\_')+'%',escape='\\'))
        if state:query=query.where(Position.state==state)
        total=db.scalar(select(func.count()).select_from(query.subquery()));return {'total':total,'items':[present(p) for p in db.scalars(query.order_by(Position.updated_at.desc()).offset(offset).limit(limit))]}
    @app.post('/api/v1/positions',status_code=201)
    def create_position(body:NewPosition,user=Depends(current),db=Depends(session)):
        require(user,'line_manager','od_specialist','admin');department(db,user,body.departmentId);value=content(body.content,db,user);id=uid();p=Position(id=id,org_id=user.org_id,department_id=body.departmentId,internal_code='MJR-'+id[:8].upper(),title=value['title'],content=value,created_by=user.id,revision=1);db.add(p);db.flush();snapshot(db,user,p,body.reason);audit(db,user,'position.created',{'title':p.title,'revision':1,'reason':body.reason},p);db.commit();return present(p)
    @app.get('/api/v1/positions/{id}')
    def get_position(id:str,user=Depends(current),db=Depends(session)):return present(position_for(db,user,id))
    @app.patch('/api/v1/positions/{id}')
    def update_position(id:str,body:ChangePosition,user=Depends(current),db=Depends(session)):
        require(user,'line_manager','od_specialist','admin');p=position_for(db,user,id,True);check_revision(p,body.revision);revise(db,user,p,body.content,body.reason);db.commit();return present(p)
    @app.get('/api/v1/positions/{id}/versions')
    def versions(id:str,user=Depends(current),db=Depends(session)):
        p=position_for(db,user,id);return [{'revision':v.revision,'title':v.title,'content':v.content,'actorId':v.actor_id,'reason':v.reason,'createdAt':v.created_at} for v in db.scalars(select(PositionVersion).where(PositionVersion.position_id==p.id).order_by(PositionVersion.revision.desc()))]
    @app.post('/api/v1/positions/{id}/restore')
    def restore(id:str,body:RestoreRequest,user=Depends(current),db=Depends(session)):
        require(user,'line_manager','od_specialist','admin');p=position_for(db,user,id,True);check_revision(p,body.revision);v=db.scalar(select(PositionVersion).where(PositionVersion.position_id==p.id,PositionVersion.revision==body.restoreRevision))
        if not v:raise HTTPException(404,'Revision not found')
        revise(db,user,p,v.content,body.reason,v.revision);db.commit();return present(p)
    @app.post('/api/v1/positions/{id}/submit')
    def submit(id:str,body:RevisionRequest,user=Depends(current),db=Depends(session)):
        require(user,'line_manager','od_specialist','admin');p=position_for(db,user,id,True);check_revision(p,body.revision)
        if p.state!='draft':raise HTTPException(409,'Only drafts can be submitted')
        missing=required_content(p.content)
        if missing:raise HTTPException(422,{'missing':missing})
        if not p.content.get('occupationCode') and not (p.content.get('provisional') and p.content.get('mappingJustification')):raise HTTPException(422,'An unmapped position needs a provisional-code justification')
        p.workflow=copy.deepcopy(organization(db,user).settings.get('workflow',DEFAULT_WORKFLOW));p.policy_snapshot=copy.deepcopy(organization(db,user).settings.get('decisionPolicy',{}));p.approval_stage=0;p.state='in_review';p.updated_at=now();audit(db,user,'position.submitted',{'revision':p.revision,'reason':body.reason,'workflow':p.workflow},p);db.commit();return present(p)
    @app.post('/api/v1/positions/{id}/withdraw')
    def withdraw(id:str,body:RevisionRequest,user=Depends(current),db=Depends(session)):
        require(user,'line_manager','od_specialist','admin');p=position_for(db,user,id,True);check_revision(p,body.revision)
        if p.state!='in_review':raise HTTPException(409,'Only requests in review can be withdrawn')
        p.state='changes_requested';audit(db,user,'position.withdrawn',{'revision':p.revision,'reason':body.reason},p);db.commit();return present(p)
    @app.post('/api/v1/positions/{id}/evaluation')
    def evaluate(id:str,body:GradeRequest,user=Depends(current),db=Depends(session)):
        require(user,'total_rewards');p=position_for(db,user,id,True);check_revision(p,body.revision)
        if p.state!='in_review' or p.approval_stage>=len(p.workflow) or p.workflow[p.approval_stage]['role']!='total_rewards':raise HTTPException(409,'Evaluation is only open during the Total Rewards review stage')
        if p.created_by==user.id:raise HTTPException(403,'The requester cannot evaluate their own request')
        f=organization(db,user).settings.get('framework',DEFAULT_FRAMEWORK)
        try:result=grade(f,body.answers,body.evidence)
        except (ValueError,TypeError,KeyError,ArithmeticError) as e:raise HTTPException(422,str(e))
        record=Evaluation(position_id=p.id,revision=p.revision,actor_id=user.id,result=result,answers=body.answers,evidence=body.evidence);db.add(record);db.flush();audit(db,user,'position.evaluated',{'revision':p.revision,'evaluationId':record.id,'frameworkId':result['frameworkId'],'points':result['points']},p);db.commit();return {'id':record.id,'revision':p.revision,'result':result}
    @app.get('/api/v1/positions/{id}/evaluations')
    def evaluations(id:str,user=Depends(current),db=Depends(session)):
        p=position_for(db,user,id);return [{'id':x.id,'revision':x.revision,'actorId':x.actor_id,'createdAt':x.created_at,'result':x.result} for x in db.scalars(select(Evaluation).where(Evaluation.position_id==p.id).order_by(Evaluation.created_at.desc()))]
    @app.post('/api/v1/positions/{id}/decisions')
    def decide(id:str,body:ApprovalRequest,user=Depends(current),db=Depends(session)):
        p=position_for(db,user,id,True);check_revision(p,body.revision)
        if p.state!='in_review' or p.approval_stage>=len(p.workflow):raise HTTPException(409,'No pending approval stage')
        expected=p.workflow[p.approval_stage]['role'];require(user,expected)
        if p.created_by==user.id:raise HTTPException(403,'The requester cannot approve their own request')
        evidence=copy.deepcopy(body.evidence)
        if body.decision=='approve':
            if expected=='od_specialist':
                if evidence.get('scopeReviewed') is not True or evidence.get('mappingReviewed') is not True:raise HTTPException(422,'OD must review scope and occupation mapping')
                if evidence.get('businessValidated') is not True or evidence.get('roleNotPerson') is not True or not isinstance(evidence.get('businessReviewer'),str) or not 1<=len(evidence['businessReviewer'].strip())<=160:raise HTTPException(422,'Record department consultation and confirm the description defines the role')
                try:valid_date(evidence.get('businessReviewDate'))
                except ValueError:raise HTTPException(422,'Use a valid department review date')
                if any(p.content.get(k) for k in ['certifications','saudization','license']):
                    if evidence.get('regulatoryReviewed') is not True:raise HTTPException(422,'Review the recorded certificates and regulatory requirements')
                    for prefix in ['saudization','license']:
                        if p.content.get(prefix) and not (p.content.get(prefix+'Source') and p.content.get(prefix+'Date')):raise HTTPException(422,'Recorded regulatory requirements need a source URL and verification date')
                if p.content.get('occupationCode') in reference_for(db,user,p.content.get('occupationRelease')).flagged:raise HTTPException(422,'Source parent is missing. Import a corrected verified edition or use a provisional internal role before approval.')
                rule=p.policy_snapshot.get('rules',{}).get(p.content.get('occupationCode'),{})
                if rule.get('minimumEducationLevel') and (not str(p.content.get('educationLevel','')).isdigit() or int(p.content['educationLevel'])<int(rule['minimumEducationLevel'])):raise HTTPException(422,'Education level fails the organization policy captured at submission')
                if rule.get('licenseRequired') and evidence.get('licenseVerifiedByOD') is not True:raise HTTPException(422,'OD-verified licensing evidence is required by the organization policy')
            if expected=='total_rewards':
                evaluation=db.scalar(select(Evaluation).where(Evaluation.position_id==p.id,Evaluation.revision==p.revision).order_by(Evaluation.created_at.desc()).limit(1))
                if not evaluation:raise HTTPException(422,'Record an evaluation for this revision first')
                if evaluation.result.get('illustrative') and not organization(db,user).settings.get('demoMode',False):raise HTTPException(422,'Illustrative framework cannot approve an institutional grade; configure the organization framework')
                if evidence.get('payFrameworkReviewed') is not True:raise HTTPException(422,'Confirm the pay framework review')
                evidence['evaluationId']=evaluation.id
            if expected=='finance':
                cost=p.content.get('annualCost');budget=evidence.get('approvedAnnualBudget');count=evidence.get('approvedHeadcount')
                if evidence.get('vacancyConfirmed') is not True or evidence.get('budgetConfirmed') is not True or any(not isinstance(n,(int,float)) or isinstance(n,bool) or not math.isfinite(n) or n<0 for n in [cost,budget,count]) or int(count)!=count or budget<cost or count<p.content.get('headcount',1):raise HTTPException(422,'Confirm vacancy, headcount and sufficient annual budget against the request')
            if expected=='chro' and not p.content.get('occupationCode') and evidence.get('internalOnlyAccepted') is not True:raise HTTPException(422,'Confirm the unmapped role is internal only; national-code verification remains pending')
        row=Approval(position_id=p.id,revision=p.revision,stage=p.approval_stage,actor_id=user.id,role=user.role,decision=body.decision,comment=body.comment,evidence=evidence);db.add(row)
        if body.decision=='return':p.state='changes_requested'
        elif body.decision=='reject':p.state='rejected'
        else:
            p.approval_stage+=1
            if p.approval_stage==len(p.workflow):
                p.state='active';p.active_revision=p.revision
                db.add(OutboxEvent(org_id=user.org_id,event_type='position.activated',payload={'positionId':p.id,'revision':p.revision,'internalCode':p.internal_code}))
        p.updated_at=now();audit(db,user,'position.'+body.decision,{'revision':p.revision,'stage':row.stage,'role':user.role,'comment':body.comment,'evidence':evidence},p);db.commit();return present(p)
    @app.get('/api/v1/positions/{id}/audit')
    def history(id:str,user=Depends(current),db=Depends(session)):
        p=position_for(db,user,id);return [{'id':e.id,'actorId':e.actor_id,'action':e.action,'detail':e.detail,'createdAt':e.created_at,'previousHash':e.previous_hash,'digest':e.digest} for e in db.scalars(select(AuditEvent).where(AuditEvent.position_id==p.id).order_by(AuditEvent.created_at))]
    @app.get('/api/v1/positions/{id}/approvals')
    def approvals(id:str,user=Depends(current),db=Depends(session)):
        p=position_for(db,user,id);return [{'id':a.id,'revision':a.revision,'stage':a.stage,'actorId':a.actor_id,'role':a.role,'decision':a.decision,'comment':a.comment,'evidence':a.evidence,'createdAt':a.created_at} for a in db.scalars(select(Approval).where(Approval.position_id==p.id).order_by(Approval.created_at))]
    @app.get('/api/v1/taxonomy')
    def taxonomy(q:str='',parent:str|None=None,limit:int=Query(50,ge=1,le=500)):return references.search(q,parent,limit)
    @app.get('/api/v1/organization/taxonomy/export')
    def organization_taxonomy_export(user=Depends(current),db=Depends(session)):
        return reference_for(db,user).occupations
    @app.get('/api/v1/organization/taxonomy')
    def organization_taxonomy(q:str='',parent:str|None=None,limit:int=Query(50,ge=1,le=500),user=Depends(current),db=Depends(session)):
        return reference_for(db,user).search(q,parent,limit)
    @app.get('/api/v1/taxonomy/releases')
    def releases():return [{'id':references.occupations['id'],'edition':references.occupations['edition'],'sha256':references.occupations['sha256'],'nodes':len(references.nodes),'occupations':len(references.roles),'sourceIssues':len(references.flagged)},{'id':references.education['id'],'edition':references.education['edition'],'sha256':references.education['sha256'],'specializations':len(references.education_fields)}]
    @app.get('/api/v1/education')
    def education(q:str='',limit:int=Query(50,ge=1,le=500)):
        parts=normalized(q).split();values=[x for x in references.education_fields.values() if all(t in normalized(x['titleAr']+' '+x['code']) for t in parts)];return {'levels':references.education['levels'],'fields':values[:limit],'total':len(values),'release':references.education['id']}
    @app.get('/api/v1/audit/verify')
    def verify_audit(user=Depends(current),db=Depends(session)):
        require(user,'admin','chro')
        from .audit import verify
        return verify(list(db.scalars(select(AuditEvent).where(AuditEvent.org_id==user.org_id).order_by(AuditEvent.created_at,AuditEvent.id))))
    @app.post('/api/v1/settings/decision-policy')
    def decision_policy(body:dict,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        from .governed import route,DEFAULT_POLICY
        policy=body.get('policy',{})
        if not isinstance(policy,dict) or not isinstance(policy.get('rules',{}),dict):raise HTTPException(422,'Invalid decision policy')
        try:route([],references,set(),policy)
        except (ValueError,TypeError) as e:raise HTTPException(422,str(e))
        if not isinstance(policy.get('rules',{}),dict):raise HTTPException(422,'Rules must be keyed by occupation code')
        for code,rule in policy.get('rules',{}).items():
            if not isinstance(rule,dict) or set(rule)-{'minimumEducationLevel','licenseRequired'} or str(rule.get('minimumEducationLevel','0')) not in list('012345678') or not isinstance(rule.get('licenseRequired',False),bool):raise HTTPException(422,'Invalid deterministic rule')
        org=organization(db,user);policy={**policy,'version':int(org.settings.get('decisionPolicy',{}).get('version',0))+1,'calibration':'organization-supplied; validate against held-out expert labels'}
        org.settings={**org.settings,'decisionPolicy':policy};audit(db,user,'decision-policy.configured',policy);db.commit();return policy
    @app.post('/api/v1/analyze/governed')
    def governed(body:AnalyzeRequest,user=Depends(current),db=Depends(session)):
        from .governed import route,DEFAULT_POLICY
        reference=reference_for(db,user)
        try:result=reference.semantic(body.retrieval_text())
        except (RuntimeError,OSError,ValueError):raise HTTPException(503,'Semantic model is not ready; no scores were fabricated')
        approved=set()
        for p in db.scalars(scoped_positions(user).where(Position.active_revision.is_not(None))):
            v=db.scalar(select(PositionVersion).where(PositionVersion.position_id==p.id,PositionVersion.revision==p.active_revision))
            if v.content.get('occupationRelease')==reference.occupations['id']:approved.add(v.content.get('occupationCode'))
        fallback_candidates=reference.semantic(body.retrieval_text(),candidate_codes=approved)['candidates'] if approved else []
        decision=route(result['candidates'],reference,approved,organization(db,user).settings.get('decisionPolicy',DEFAULT_POLICY),fallback_candidates=fallback_candidates)
        record=audit(db,user,'classification.routed',{'inputDigest':digest(body.model_dump()),'model':result['model'],'modelFingerprint':result['modelFingerprint'],'release':result['release'],'candidates':result['candidates'],'decision':decision});db.commit()
        return {**result,'request':body.model_dump(),'constraintsReviewRequired':bool(body.constraints.strip()),'decision':decision,'auditEventId':record.id,'auditDigest':record.digest}
    @app.post('/api/v1/analyze/skills')
    def skills(body:AnalyzeRequest,user=Depends(current)):return {'skills':references.extract_skills(body.text),'method':'dictionary-extraction','reviewRequired':True}
    @app.post('/api/v1/analyze/semantic')
    def semantic(body:AnalyzeRequest,user=Depends(current),db=Depends(session)):
        try:return {**reference_for(db,user).semantic(body.retrieval_text()),'request':body.model_dump(),'constraintsReviewRequired':bool(body.constraints.strip())}
        except (RuntimeError,OSError,ValueError) as e:raise HTTPException(503,'Semantic model is not ready; see server model configuration. No similarity values were fabricated.')
    @app.post('/api/v1/organization/diagnose')
    async def diagnose(file:UploadFile=File(...),user=Depends(current),db=Depends(session)):
        require(user,'od_specialist','finance','chro','admin')
        try:rows=read_rows(await file.read(10_000_001),file.filename or '');result=bulk_diagnosis(rows,reference_for(db,user))
        except (ValueError,UnicodeError,KeyError,csv.Error,zipfile.BadZipFile) as e:raise HTTPException(422,str(e))
        audit(db,user,'organization.diagnosed',{'rows':result['totalRows'],'release':result['release'],'rawFileRetained':False});db.commit();return result
    @app.get('/api/v1/analytics')
    def analytics(user=Depends(current),db=Depends(session)):
        require(user,'od_specialist','total_rewards','finance','chro','admin');rows=list(db.scalars(scoped_positions(user)));states={s:sum(p.state==s for p in rows) for s in ['draft','in_review','changes_requested','rejected','active']};active=[p for p in rows if p.active_revision is not None];cost=0;headcount=0;missing_cost=0;growth={}
        for p in active:
            v=db.scalar(select(PositionVersion).where(PositionVersion.position_id==p.id,PositionVersion.revision==p.active_revision));amount=v.content.get('annualCost');cost+=amount if isinstance(amount,(int,float)) else 0;missing_cost+=int(not isinstance(amount,(int,float)));headcount+=v.content.get('headcount',1)
        for p in rows:month=p.created_at[:7];growth[month]=growth.get(month,0)+1
        return {'positions':len(rows),'states':states,'activePositions':len(active),'activeHeadcount':headcount,'annualPositionCost':cost,'activePositionsMissingCost':missing_cost,'creationByMonth':growth,'currency':'SAR','scope':'Current organization; active revision remains the approved version while amendments are pending'}
    @app.get('/api/v1/integrations/status')
    def integration_status(user=Depends(current)):
        from .worker import configuration
        return {'outboundWebhookConfigured':bool(configuration(user.org_id)),'connectors':[{'name':name,'status':'requires-authorized-endpoint-and-credentials'} for name in ['SAP SuccessFactors','Oracle HCM','Workday','Qiwa','GOSI']],'notice':'No vendor or national service is claimed to be connected by default.'}
    @app.get('/api/v1/integrations/outbox')
    def outbox(user=Depends(current),db=Depends(session)):
        require(user,'admin');return [{'id':x.id,'eventType':x.event_type,'status':x.status,'attempts':x.attempts,'createdAt':x.created_at,'lastError':x.last_error} for x in db.scalars(select(OutboxEvent).where(OutboxEvent.org_id==user.org_id).order_by(OutboxEvent.created_at.desc()).limit(100))]
    from .enterprise import install
    install(app,session,current,organization,audit,present,content,department,snapshot,revise)
    if os.getenv('MIYAR_SERVE_UI')=='true':
        @app.get('/config.js',include_in_schema=False)
        def browser_configuration():
            return Response('window.MIYAR_CONFIG = {apiBase: window.location.origin};',media_type='application/javascript',headers={'Cache-Control':'no-store'})
        app.mount('/',StaticFiles(directory=Path(__file__).resolve().parent.parent/'dist',html=True),name='website')
    return app
