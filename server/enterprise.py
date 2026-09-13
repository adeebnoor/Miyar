"""Export, release maintenance and canonical HRIS exchange contracts."""
import copy,json,os,re
from fastapi import Depends,HTTPException,Header,Query
from fastapi.responses import Response
from sqlalchemy import select
from .models import Position,PositionVersion,Approval,Evaluation,User,Organization,IntegrationReceipt,TaxonomyRelease,uid
from .security import require,position_for,scoped_positions
from .domain import canonical,digest
from . import exports

def validate_release(payload):
    if not isinstance(payload,dict) or payload.get('schema')!='miyar-taxonomy/1.0':raise ValueError('Use the miyar-taxonomy/1.0 schema')
    if not re.fullmatch(r'[a-zA-Z0-9._-]{3,80}',str(payload.get('id',''))):raise ValueError('Invalid release identifier')
    if not re.fullmatch(r'[0-9a-f]{64}',str(payload.get('sha256',''))) or not str(payload.get('edition','')).strip():raise ValueError('Provide source SHA256 and edition')
    nodes=payload.get('nodes',[])
    if not 1<=len(nodes)<=30000:raise ValueError('Release size must be 1–30,000 nodes')
    mapping={};lengths={1:'major',2:'submajor',3:'minor',4:'unit',6:'occupation'}
    for n in nodes:
        code=n.get('code','')
        if not isinstance(code,str) or not code.isascii() or not code.isdigit() or len(code) not in lengths or n.get('level')!=lengths[len(code)]:raise ValueError('Invalid code or hierarchy level')
        if code in mapping:raise ValueError('Duplicate code '+code)
        if not isinstance(n.get('titleAr'),str) or not n['titleAr'].strip() or len(n['titleAr'])>300:raise ValueError('Invalid title')
        expected=code[:4] if len(code)==6 else code[:-1] or None
        if n.get('parent')!=expected:raise ValueError('Unexpected parent code '+code)
        if not isinstance(n.get('sourcePage'),int) or n['sourcePage']<1:raise ValueError('Provide source page')
        mapping[code]=n
    missing=[{'code':n['code'],'parent':n['parent']} for n in nodes if n['parent'] and n['parent'] not in mapping]
    return {**copy.deepcopy(payload),'validation':{**payload.get('validation',{}),'missingParents':missing},'importVerification':'Schema validated; source authenticity and regulatory currency require OD review'}

def install(app,session,current,organization,audit,present,content,department,snapshot,revise):
    def card(db,user,id,revision,lang):
        p=position_for(db,user,id);rev=revision or p.active_revision or p.revision
        v=db.scalar(select(PositionVersion).where(PositionVersion.position_id==p.id,PositionVersion.revision==rev))
        if not v:raise HTTPException(404,'Revision not found')
        approved=p.active_revision==rev
        approvals=[];evaluation_id=None
        for a in db.scalars(select(Approval).where(Approval.position_id==id,Approval.revision==rev,Approval.decision=='approve').order_by(Approval.stage)):
            actor=db.get(User,a.actor_id);approvals.append({'id':a.id,'actorId':a.actor_id,'actorName':actor.name,'role':a.role,'createdAt':a.created_at,'decision':a.decision,'comment':a.comment,'evidence':copy.deepcopy(a.evidence),'evidenceDigest':digest(a.evidence)})
            if a.role=='total_rewards':evaluation_id=a.evidence.get('evaluationId')
        evaluation=db.get(Evaluation,evaluation_id) if evaluation_id else db.scalar(select(Evaluation).where(Evaluation.position_id==id,Evaluation.revision==rev).order_by(Evaluation.created_at.desc()).limit(1))
        return {'id':p.id,'internalCode':p.internal_code,'revision':rev,'content':v.content,'approved':approved,'approvals':approvals,'evaluation':{'id':evaluation.id,'result':evaluation.result,'createdAt':evaluation.created_at} if evaluation else None,'lang':lang}
    @app.get('/api/v1/signing/public-key')
    def signing_public_key():
        try:return exports.public_key()
        except (ValueError,TypeError):raise HTTPException(503,'Organization signing key is not configured')
    @app.get('/api/v1/positions/{id}/export/{format}')
    def export(id:str,format:str,revision:int|None=Query(None,ge=1),lang:str=Query('ar',pattern='^(ar|en)$'),user=Depends(current),db=Depends(session)):
        value=card(db,user,id,revision,lang);brand=organization(db,user).settings.get('branding',{'nameAr':organization(db,user).name,'nameEn':organization(db,user).name})
        if format=='json':return value
        if format=='receipt':
            try:return exports.receipt(value)
            except ValueError as e:raise HTTPException(409,str(e))
        if format not in ['pdf','docx','xlsx']:raise HTTPException(404,'Supported formats: json, receipt, pdf, docx, xlsx')
        if value['approved'] and os.getenv('MIYAR_SIGNING_KEY'):value['receipt']=exports.receipt(value)
        if format=='xlsx':data=exports.xlsx(value);mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        elif format=='docx':data=exports.docx(value,brand);mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        else:data=exports.pdf(value,brand);mime='application/pdf'
        audit(db,user,'position.exported',{'revision':value['revision'],'format':format,'approved':value['approved']},position_for(db,user,id));db.commit()
        return Response(data,media_type=mime,headers={'Content-Disposition':f'attachment; filename="{value["internalCode"]}-v{value["revision"]}.{format}"'})
    @app.get('/api/v1/integrations/approved-positions')
    def approved_positions(offset:int=Query(0,ge=0),limit:int=Query(100,ge=1,le=500),user=Depends(current),db=Depends(session)):
        require(user,'integration','od_specialist','admin')
        rows=db.scalars(scoped_positions(user).where(Position.active_revision.is_not(None)).order_by(Position.id).offset(offset).limit(limit))
        return {'items':[card(db,user,p.id,p.active_revision,'en') for p in rows],'offset':offset,'limit':limit,'contract':'miyar-approved-position/1.0'}
    @app.post('/api/v1/integrations/positions/import')
    def inbound(body:dict,idempotency_key:str=Header(alias='Idempotency-Key',min_length=8,max_length=100),user=Depends(current),db=Depends(session)):
        require(user,'integration','admin');rows=body.get('positions')
        if not isinstance(rows,list) or not 1<=len(rows)<=1000:raise HTTPException(422,'Send 1–1,000 positions in the canonical import schema')
        prior=db.scalar(select(IntegrationReceipt).where(IntegrationReceipt.org_id==user.org_id,IntegrationReceipt.idempotency_key==idempotency_key));hash=digest(body)
        if prior:
            if prior.payload_hash!=hash:raise HTTPException(409,'Idempotency key was already used for different content')
            return prior.result
        output=[]
        for row in rows:
            code=row.get('externalId','');source=body.get('source','')
            if not re.fullmatch(r'[A-Za-z0-9._-]{1,50}',code) or source not in ['sap','oracle','workday','generic']:raise HTTPException(422,'Use a supported source name and stable alphanumeric externalId')
            internal='ERP-'+source+'-'+code;department(db,user,row.get('departmentId'));p=db.scalar(select(Position).where(Position.org_id==user.org_id,Position.internal_code==internal).with_for_update());reason='HRIS import '+source+' '+code
            if p:revise(db,user,p,row.get('content'),reason)
            else:
                value=content(row.get('content'),db,user);p=Position(id=uid(),org_id=user.org_id,department_id=row['departmentId'],internal_code=internal,title=value['title'],content=value,created_by=user.id,revision=1);db.add(p);db.flush();snapshot(db,user,p,reason);audit(db,user,'position.imported',{'externalId':code,'source':source,'revision':1},p)
            output.append({'externalId':code,'positionId':p.id,'revision':p.revision,'state':p.state})
        result={'items':output,'notice':'Imported records are drafts and follow the organization approval workflow. No external active flag bypasses review.'};db.add(IntegrationReceipt(org_id=user.org_id,idempotency_key=idempotency_key,payload_hash=hash,result=result));db.commit();return result
    @app.post('/api/v1/taxonomy/releases/import')
    def import_release(body:dict,user=Depends(current),db=Depends(session)):
        require(user,'admin')
        try:payload=validate_release(body)
        except (ValueError,KeyError,TypeError) as e:raise HTTPException(422,str(e))
        if payload['id']==app.state.catalog.occupations['id']:raise HTTPException(409,'Bundled editions cannot be overwritten')
        id=digest({'org':user.org_id,'release':payload['id']})
        if db.get(TaxonomyRelease,id):raise HTTPException(409,'Release exists; import a new version identifier')
        db.add(TaxonomyRelease(id=id,org_id=user.org_id,payload=payload));audit(db,user,'taxonomy.imported',{'release':payload['id'],'nodes':len(payload['nodes']),'sourceSha256':payload['sha256'],'issues':payload['validation']['missingParents']});db.commit();return {'id':payload['id'],'issues':payload['validation']['missingParents'],'state':'staged'}
    @app.get('/api/v1/organization/taxonomy/releases')
    def org_releases(user=Depends(current),db=Depends(session)):
        values=[app.state.catalog.occupations]+[r.payload for r in db.scalars(select(TaxonomyRelease).where(TaxonomyRelease.org_id==user.org_id))]
        return {'active':organization(db,user).settings.get('taxonomyRelease',app.state.catalog.occupations['id']),'items':[{k:r.get(k) for k in ['id','edition','sha256','validation']} for r in values]}
    @app.post('/api/v1/organization/taxonomy/activate')
    def activate_release(body:dict,user=Depends(current),db=Depends(session)):
        require(user,'od_specialist');release=body.get('release');reason=body.get('reason','')
        if body.get('sourceReviewed') is not True or len(reason.strip())<10:raise HTTPException(422,'OD source verification and a documented reason are required')
        if release!=app.state.catalog.occupations['id'] and not db.get(TaxonomyRelease,digest({'org':user.org_id,'release':release})):raise HTTPException(404,'Release not staged for this organization')
        org=organization(db,user);org.settings={**org.settings,'taxonomyRelease':release};audit(db,user,'taxonomy.activated',{'release':release,'reason':reason,'sourceReviewed':True});db.commit();return {'active':release,'existingPositions':'Keep their stored source edition; migration requires a new reviewed revision'}
