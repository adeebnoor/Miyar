"""Pure governance and evaluation rules; no proprietary grading tables."""
import copy,hashlib,json,math,re,unicodedata
from decimal import Decimal
from datetime import date
from urllib.parse import urlsplit

def validate_salary(value):
    minimum,maximum=value.get('salaryMin'),value.get('salaryMax')
    if minimum is None and maximum is None:return
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in (minimum,maximum)) or minimum<0 or maximum<minimum or maximum>1e12:raise ValueError('Enter a valid minimum and maximum salary')
    if value.get('salaryPeriod','monthly') not in ('monthly','annual'):raise ValueError('Choose monthly or annual salary')
    if not re.fullmatch(r'[A-Z]{3}',value.get('salaryCurrency','SAR')):raise ValueError('Use a three-letter currency code')

def compensation_result(framework,band,evidence):
    if 'salaryMin' in band or 'salaryMax' in band:
        c={k:band.get(k) for k in ('salaryMin','salaryMax')}
        c.update(salaryCurrency=framework.get('currency','SAR'),salaryPeriod=framework.get('salaryPeriod','monthly'),salarySource='Organization framework '+str(framework.get('id'))+' v'+str(framework.get('version')))
    else:c=copy.deepcopy(evidence.get('compensation',{}))
    if not isinstance(c,dict):raise ValueError('Invalid salary proposal')
    if c:
        if set(c)-{'salaryMin','salaryMax','salaryCurrency','salaryPeriod','salarySource'}:raise ValueError('Invalid salary proposal fields')
        validate_salary(c)
        if not isinstance(c.get('salarySource'),str) or not c['salarySource'].strip() or len(c['salarySource'])>1000:raise ValueError('Provide the salary range source or rationale')
        c.update(grade=band['id'],status='proposal-for-review')
    return c or None

def valid_date(value,verification=True):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):raise ValueError('Use a valid ISO date')
    parsed=date.fromisoformat(value)
    if parsed<date(1900,1,1) or (verification and parsed>date.today()):raise ValueError('Verification dates cannot be in the future')
    return value

def validate_regulatory(content):
    for key in ['saudizationSource','licenseSource']:
        if content.get(key):
            u=urlsplit(content[key])
            if u.scheme not in ['https','http'] or not u.hostname or u.username or u.password:raise ValueError('Use a valid HTTP or HTTPS source URL')
    for key in ['saudizationDate','licenseDate','effectiveDate']:
        if content.get(key):valid_date(content[key],key!='effectiveDate')

def external_evaluation(framework,answers,evidence):
    if set(answers)!={'score','band'}:raise ValueError('Record the report score and grade')
    value=answers['score']
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=1e7:raise ValueError('Invalid external report score')
    band=answers['band']
    if not isinstance(band,str) or not band.strip() or len(band)>80:raise ValueError('Enter the grade from the report')
    keys=['reportReference','assessor','evaluationDate','rationale','knowledge','problemSolving','accountability']
    if any(not isinstance(evidence.get(k),str) or not evidence[k].strip() or len(evidence[k])>4000 for k in keys) or evidence.get('reportConfirmed') is not True:raise ValueError('Provide the external report, assessor, date and evaluation rationale, and confirm authorized use')
    valid_date(evidence['evaluationDate'])
    return {'points':value,'band':{'id':band.strip()},'breakdown':[], 'frameworkId':framework['id'],'frameworkVersion':framework.get('version',1),'method':'external-korn-ferry-record','illustrative':False,'status':'specialist-report-recorded','computedBy':'external-specialist-report','externalReport':{k:evidence[k] for k in keys},'authorization':{k:framework[k] for k in ['licenseReference','approvedBy','approvedOn']},'warning':'Score and grade were supplied by the organization specialist from an external report. Miyar does not calculate or independently certify Korn Ferry results.'}

ROLES={'line_manager','od_specialist','total_rewards','finance','chro','admin','integration'}
DEFAULT_WORKFLOW=[{'role':'od_specialist','nameAr':'التطوير التنظيمي','nameEn':'Organization Development'}, {'role':'total_rewards','nameAr':'التعويضات والمزايا','nameEn':'Total Rewards'}, {'role':'finance','nameAr':'المالية وتخطيط القوى العاملة','nameEn':'Finance & Workforce Planning'}, {'role':'chro','nameAr':'صاحب الصلاحية','nameEn':'Final authority'}]
CORE=['title','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors']
REQUEST_TYPES={'additional-headcount','proposed-role','redesign'}
DEFAULT_FRAMEWORK={'id':'miyar-example-v1','name':'Illustrative organization point-factor framework','method':'custom','version':1,'illustrative':True,'currency':'SAR','factors':[
 {'id':'knowledge','labelAr':'المعرفة التطبيقية','labelEn':'Applied knowledge','weight':40,'levels':[{'id':'1','labelAr':'مهام محددة بإرشادات واضحة','labelEn':'Defined work with clear guidance','points':25},{'id':'2','labelAr':'تطبيق تخصص وتحليل مستقل','labelEn':'Specialist application and independent analysis','points':50},{'id':'3','labelAr':'تكامل تخصصات وحلول مؤسسية','labelEn':'Cross-disciplinary organizational solutions','points':75},{'id':'4','labelAr':'قيادة معرفة وسياسات على مستوى الجهة','labelEn':'Organization-wide expertise and policy leadership','points':100}]},
 {'id':'complexity','labelAr':'تعقيد القرارات','labelEn':'Decision complexity','weight':30,'levels':[{'id':'1','labelAr':'اختيار من إجراءات معروفة','labelEn':'Choose among established procedures','points':25},{'id':'2','labelAr':'حل مسائل متنوعة ضمن إطار معلوم','labelEn':'Solve varied problems within a known framework','points':50},{'id':'3','labelAr':'تصميم بدائل في ظروف غير مؤكدة','labelEn':'Design alternatives under uncertainty','points':75},{'id':'4','labelAr':'قرارات استراتيجية متعددة الآثار','labelEn':'Strategic decisions with multiple consequences','points':100}]},
 {'id':'impact','labelAr':'نطاق الأثر والمساءلة','labelEn':'Impact and accountability','weight':30,'levels':[{'id':'1','labelAr':'مخرجات مهمة محددة','labelEn':'Defined task outputs','points':25},{'id':'2','labelAr':'مخرجات عملية أو فريق','labelEn':'Process or team outcomes','points':50},{'id':'3','labelAr':'نتائج إدارة أو برنامج','labelEn':'Department or programme results','points':75},{'id':'4','labelAr':'نتائج المؤسسة ومواردها','labelEn':'Organization-wide results and resources','points':100}]}],
 'bands':[{'id':'B1','min':0,'max':399},{'id':'B2','min':400,'max':599},{'id':'B3','min':600,'max':799},{'id':'B4','min':800,'max':1000}],
 'notice':'Illustrative custom framework. Not Hay/Korn Ferry or Mercer IPE; do not use for pay decisions without organizational approval.'}

def normalized(text):
    text=unicodedata.normalize('NFKC',str(text or '')).lower();text=''.join(str(unicodedata.digit(c)) if c.isdigit() else c for c in text)
    text=re.sub('[\u064b-\u065f\u0670\u0640]','',text);text=re.sub('[أإآٱ]','ا',text).replace('ى','ي')
    return ' '.join(re.sub(r'[^\w\s]',' ',text).split())
def canonical(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def digest(value):return hashlib.sha256(canonical(value).encode()).hexdigest()
def required_content(content):
    missing=[k for k in CORE if not str(content.get(k,'')).strip()]
    if content.get('requestType') not in REQUEST_TYPES:missing.append('requestType')
    if len([x for x in str(content.get('responsibilities','')).splitlines() if x.strip()])<3:missing.append('three_responsibilities')
    return missing

def validate_workflow(steps):
    if not isinstance(steps,list) or not 4<=len(steps)<=12:raise ValueError('Workflow requires 4–12 approval stages')
    allowed={'od_specialist','total_rewards','finance','chro'};roles=[s.get('role') for s in steps]
    if any(x not in allowed for x in roles) or roles[-1]!='chro' or not {'od_specialist','total_rewards','finance'}.issubset(roles):raise ValueError('Keep OD, Rewards, Finance and final CHRO review')
    if roles.index('od_specialist')>roles.index('total_rewards') or roles.index('total_rewards')>roles.index('finance'):raise ValueError('OD must precede Rewards and Finance')
    return [{'role':s['role'],'nameAr':str(s.get('nameAr',s['role']))[:100],'nameEn':str(s.get('nameEn',s['role']))[:100]} for s in steps]

def validate_framework(framework):
    f=copy.deepcopy(framework);method=f.get('method')
    if method=='external-korn-ferry-record':
        keys=['id','name','licenseReference','approvedBy','approvedOn']
        if any(not isinstance(f.get(k),str) or not f[k].strip() or len(f[k])>500 for k in keys) or f.get('authorizedUseConfirmed') is not True:raise ValueError('External evaluation requires an organization authorization reference and approval')
        valid_date(f['approvedOn'])
        return {**{k:f[k].strip() for k in keys},'method':method,'version':f.get('version',1),'authorizedUseConfirmed':True,'illustrative':False}
    if method not in ['custom','korn-ferry-licensed','mercer-ipe-licensed']:raise ValueError('Unknown methodology')
    if method!='custom':
        raise ValueError('Korn Ferry and Mercer calculators require an authorized vendor implementation. Import a validated organization custom framework; generic weighted points cannot be labeled Hay or IPE.')
    factors=f.get('factors',[]);bands=f.get('bands',[])
    if not 1<=len(factors)<=12 or not 1<=len(bands)<=40:raise ValueError('Invalid factors or bands')
    if len({x.get('id') for x in factors})!=len(factors):raise ValueError('Duplicate factors')
    total=Decimal(0)
    for factor in factors:
        weight=Decimal(str(factor.get('weight',0)))
        if not weight.is_finite() or weight<=0 or weight>100:raise ValueError('Invalid factor weight')
        total+=weight;levels=factor.get('levels',[])
        if not 2<=len(levels)<=12 or len({x.get('id') for x in levels})!=len(levels):raise ValueError('Invalid levels')
        for level in levels:
            points=Decimal(str(level.get('points',-1)))
            if not points.is_finite() or not 0<=points<=100:raise ValueError('Level points must be 0–100')
    if total!=100:raise ValueError('Weights must total 100')
    ordered=sorted(bands,key=lambda x:x['min']);previous=-1
    for band in ordered:
        if not isinstance(band.get('min'),int) or not isinstance(band.get('max'),int) or band['min']!=previous+1 or band['max']<band['min']:raise ValueError('Bands must cover consecutive integer points without overlaps')
        validate_salary({**band,'salaryCurrency':f.get('currency','SAR'),'salaryPeriod':f.get('salaryPeriod','monthly')})
        previous=band['max']
    if previous!=1000:raise ValueError('Bands must cover 0–1000 custom points')
    f['bands']=ordered;return f

def grade(framework,answers,evidence):
    f=validate_framework(framework);breakdown=[];score=Decimal(0)
    if f['method']=='external-korn-ferry-record':return external_evaluation(f,answers,evidence)
    if set(answers)!={x['id'] for x in f['factors']}:raise ValueError('Answer every configured factor')
    for factor in f['factors']:
        level=next((x for x in factor['levels'] if x['id']==str(answers[factor['id']])),None)
        if not level or not str(evidence.get(factor['id'],'')).strip():raise ValueError('Each factor requires a valid level and evidence')
        weighted=Decimal(str(level['points']))*Decimal(str(factor['weight']))/10;score+=weighted
        breakdown.append({'factor':factor['id'],'level':level['id'],'weightedPoints':float(weighted),'evidence':evidence[factor['id']]})
    rounded=int(score.quantize(Decimal('1')));band=next(x for x in f['bands'] if x['min']<=rounded<=x['max'])
    return {'points':rounded,'compensation':compensation_result(f,band,evidence),'band':band,'breakdown':breakdown,'frameworkId':f.get('id'),'frameworkVersion':f.get('version'),'method':f['method'],'illustrative':f.get('illustrative',False),'status':'specialist-review-required','currency':f.get('currency'),'computedBy':'configured-point-factor-formula','warning':f.get('notice')}
