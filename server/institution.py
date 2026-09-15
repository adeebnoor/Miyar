"""Institution-level OD setup: approved organization structure and grade architecture.

This module is installed after create_app so it can extend the accepted position metadata
without changing the core position schema. The profile is organization-scoped and admin-managed.
"""
from datetime import date
import copy,re
from fastapi import Depends,HTTPException
from sqlalchemy import select
from .models import Organization,AuditEvent,uid,now
from .security import bearer,actor,require
from .domain import canonical,digest

OPTIONAL_OD_FIELDS={
    'strategyObjective','marketTitle','jobFamily','careerPath','recommendedLevel',
    'gradeRecommendationBasis','odGenerationBasis','orgUnitCode','orgUnitPath',
    'organizationProfileVersion','proposedGrade','gradeArchitectureName','gradeArchitectureVersion'
}
LEVELS={'entry','professional','senior','manager','director','executive','custom'}

def _text(value,name,limit=300,required=False):
    if value is None:value=''
    if not isinstance(value,str) or len(value)>limit or (required and not value.strip()):
        raise ValueError('Invalid '+name)
    return value.strip()

def validate_profile(value):
    if not isinstance(value,dict) or value.get('schema')!='miyar-institution-profile/1.0':
        raise ValueError('Use the miyar-institution-profile/1.0 schema')
    units=value.get('units',[]);grades=value.get('gradeStructure',{}).get('grades',[])
    if not isinstance(units,list) or len(units)>500:raise ValueError('Organization structure supports up to 500 units')
    if not isinstance(grades,list) or len(grades)>100:raise ValueError('Grade structure supports up to 100 grades')
    clean_units=[];codes=set()
    for raw in units:
        if not isinstance(raw,dict):raise ValueError('Invalid organization unit')
        code=_text(raw.get('code'),'organization unit code',40,True)
        if not re.fullmatch(r'[A-Za-z0-9._-]{1,40}',code) or code in codes:raise ValueError('Organization unit codes must be unique alphanumeric identifiers')
        codes.add(code)
        clean_units.append({'code':code,'nameAr':_text(raw.get('nameAr'),'Arabic unit name',200,True),'nameEn':_text(raw.get('nameEn'),'English unit name',200,True),'parentCode':_text(raw.get('parentCode'),'parent code',40),'leaderTitle':_text(raw.get('leaderTitle'),'leader title',200)})
    for unit in clean_units:
        if unit['parentCode'] and unit['parentCode'] not in codes:raise ValueError('Parent unit '+unit['parentCode']+' is not defined')
        if unit['parentCode']==unit['code']:raise ValueError('An organization unit cannot report to itself')
    parents={u['code']:u['parentCode'] for u in clean_units}
    for code in parents:
        seen=set();current=code
        while current:
            if current in seen:raise ValueError('Organization structure contains a reporting cycle')
            seen.add(current);current=parents.get(current,'')
    clean_grades=[];grade_ids=set();ranges=[]
    for raw in grades:
        if not isinstance(raw,dict):raise ValueError('Invalid grade')
        gid=_text(raw.get('id'),'grade id',40,True)
        if gid in grade_ids:raise ValueError('Grade identifiers must be unique')
        grade_ids.add(gid);level=_text(raw.get('level'),'grade level',40,True).lower()
        if level not in LEVELS:raise ValueError('Unsupported grade level '+level)
        row={'id':gid,'labelAr':_text(raw.get('labelAr'),'Arabic grade label',120,True),'labelEn':_text(raw.get('labelEn'),'English grade label',120,True),'level':level}
        minimum,maximum=raw.get('minPoints'),raw.get('maxPoints')
        if minimum is not None or maximum is not None:
            if not isinstance(minimum,int) or not isinstance(maximum,int) or not 0<=minimum<=maximum<=1000:raise ValueError('Grade point ranges must be integer values between 0 and 1000')
            row.update(minPoints=minimum,maxPoints=maximum);ranges.append((minimum,maximum,gid))
        clean_grades.append(row)
    ranges.sort()
    for first,second in zip(ranges,ranges[1:]):
        if first[1]>=second[0]:raise ValueError('Grade point ranges overlap')
    approved_on=_text(value.get('approvedOn'),'approval date',10)
    if approved_on:
        try:parsed=date.fromisoformat(approved_on)
        except ValueError:raise ValueError('Use a valid approval date')
        if parsed>date.today():raise ValueError('Approval date cannot be in the future')
    grade=value.get('gradeStructure',{})
    if not isinstance(grade,dict):raise ValueError('Invalid grade structure')
    return {
        'schema':'miyar-institution-profile/1.0',
        'organizationName':_text(value.get('organizationName'),'organization name',200),
        'units':clean_units,
        'gradeStructure':{
            'name':_text(grade.get('name'),'grade structure name',200),
            'methodology':_text(grade.get('methodology'),'grade methodology',200),
            'grades':clean_grades
        },
        'approvedBy':_text(value.get('approvedBy'),'approval authority',200),
        'approvedOn':approved_on
    }

def install_institution(app):
    # create_app validates position fields through this module-level set at request time.
    from . import app as app_module
    app_module.CONTENT_FIELDS.update(OPTIONAL_OD_FIELDS)
    Session=app.state.sessions;secret=app.state.secret
    def session():
        with Session() as db:yield db
    def current(credentials=Depends(bearer),db=Depends(session)):
        if not credentials:raise HTTPException(401,'Sign in to use the organization workspace')
        return actor(credentials.credentials,db,secret)
    def audit(db,user,action,detail):
        db.scalar(select(Organization).where(Organization.id==user.org_id).with_for_update())
        prior=db.scalar(select(AuditEvent).where(AuditEvent.org_id==user.org_id).order_by(AuditEvent.created_at.desc(),AuditEvent.id.desc()).limit(1));ts=now();event_id=uid();previous=prior.digest if prior else ''
        value={'id':event_id,'actorId':user.id,'action':action,'positionId':None,'detail':detail,'createdAt':ts,'previousHash':previous}
        db.add(AuditEvent(id=event_id,org_id=user.org_id,position_id=None,actor_id=user.id,action=action,detail=detail,created_at=ts,previous_hash=previous,digest=digest(value)))
    @app.get('/api/v1/settings/institution-profile')
    def get_profile(user=Depends(current),db=Depends(session)):
        org=db.get(Organization,user.org_id);profile=copy.deepcopy(org.settings.get('institutionProfile'))
        if not profile:profile={'schema':'miyar-institution-profile/1.0','version':0,'organizationName':org.name,'units':[],'gradeStructure':{'name':'','methodology':'','grades':[]},'approvedBy':'','approvedOn':'','updatedAt':''}
        framework=org.settings.get('framework',{})
        return {'profile':profile,'evaluationFramework':{k:framework.get(k) for k in ['id','name','version','method','illustrative']},'frameworkBands':copy.deepcopy(framework.get('bands',[]))}
    @app.post('/api/v1/settings/institution-profile')
    def save_profile(body:dict,user=Depends(current),db=Depends(session)):
        require(user,'admin');reason=body.get('reason','')
        if not isinstance(reason,str) or len(reason.strip())<10 or len(reason)>1000:raise HTTPException(422,'Document the reason for changing the institutional profile')
        try:profile=validate_profile(body.get('profile'))
        except (ValueError,TypeError,KeyError) as error:raise HTTPException(422,str(error))
        org=db.get(Organization,user.org_id);prior=org.settings.get('institutionProfile',{});version=int(prior.get('version',0))+1
        profile.update(version=version,updatedAt=now());org.settings={**org.settings,'institutionProfile':profile}
        audit(db,user,'institution-profile.configured',{'version':version,'units':len(profile['units']),'grades':len(profile['gradeStructure']['grades']),'reason':reason,'approvedBy':profile['approvedBy'],'approvedOn':profile['approvedOn']});db.commit()
        return {'profile':profile,'appliesTo':'New OD proposals and future position revisions; existing approved revisions remain unchanged'}
