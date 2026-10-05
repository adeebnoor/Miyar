"""Pure governance and evaluation rules; no proprietary grading tables."""
import copy,hashlib,json,math,re,unicodedata
from decimal import Decimal,ROUND_HALF_UP
from datetime import date
from urllib.parse import urlsplit

def validate_salary(value):
    minimum,maximum=value.get('salaryMin'),value.get('salaryMax')
    if minimum is None and maximum is None:return
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in (minimum,maximum)) or minimum<=0 or maximum<minimum or maximum>1e12:raise ValueError('Enter a valid minimum and maximum salary')
    if value.get('salaryPeriod','monthly') not in ('monthly','annual'):raise ValueError('Choose monthly or annual salary')
    if value.get('salaryCurrency','SAR') not in CURRENCY_CODES:raise ValueError('Use a recognized currency code')

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

ROLES={'line_manager','department_manager','hrbp','od_specialist','total_rewards','finance','chro','admin','integration'}
DEFAULT_WORKFLOW=[{'role':'department_manager','nameAr':'مدير الإدارة / شريك الموارد البشرية','nameEn':'Department Manager / HRBP','slaHours':48,'escalationRole':'chro'}, {'role':'od_specialist','nameAr':'التطوير التنظيمي','nameEn':'Organization Development','slaHours':72,'escalationRole':'chro'}, {'role':'total_rewards','nameAr':'التعويضات والمزايا','nameEn':'Total Rewards','slaHours':72,'escalationRole':'chro'}, {'role':'finance','nameAr':'المالية وتخطيط القوى العاملة','nameEn':'Finance & Workforce Planning','slaHours':48,'escalationRole':'chro'}, {'role':'chro','nameAr':'صاحب الصلاحية','nameEn':'Final authority','slaHours':48,'escalationRole':'admin'}]
CORE=['title','businessNeed','alternatives','successMeasures','purpose','responsibilities','team','budget','authority','impact','stakeholders','qualifications','experience','skills','behaviors']
REQUEST_TYPES={'additional-headcount','proposed-role','redesign','replacement'}
from pathlib import Path
DEFAULT_FRAMEWORK=json.loads((Path(__file__).resolve().parents[1]/'dist/classifications/framework-example.json').read_text(encoding='utf-8'))
CURRENCY_CODES=set(json.loads((Path(__file__).resolve().parents[1]/'dist/classifications/currencies.json').read_text(encoding='utf-8')))

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
    if not any(all(isinstance(row.get(k),str) and row[k].strip() for k in ['outcome','metric','baseline','target','duration']) for row in content.get('kpis',[])):missing.append('kpi_baseline_target_duration')
    if any(not all(isinstance(row.get(k),str) and row[k].strip() for k in ['outcome','metric','baseline','target','duration']) for row in content.get('kpis',[])):missing.append('complete_every_kpi')
    for key in ['jobFamily','salaryGrade','costBasis']:
        if not str(content.get(key,'')).strip():missing.append(key)
    if not all(isinstance(content.get(k),(int,float)) and not isinstance(content.get(k),bool) and math.isfinite(content[k]) and content[k]>0 for k in ['annualCost','annualCostMin','annualCostMax']):missing.append('annual_cost_and_range')
    return missing

def validate_workflow(steps):
    if not isinstance(steps,list) or not 5<=len(steps)<=12:raise ValueError('Workflow requires 5–12 approval stages, beginning with Department Manager / HRBP')
    allowed={'department_manager','hrbp','od_specialist','total_rewards','finance','chro'};roles=[s.get('role') for s in steps]
    if any(x not in allowed for x in roles) or roles[-1]!='chro' or not {'od_specialist','total_rewards','finance'}.issubset(roles):raise ValueError('Keep OD, Rewards, Finance and final CHRO review')
    if roles[0] not in {'department_manager','hrbp'}:raise ValueError('Department Manager / HRBP must review the budget owner request before OD')
    if len(roles)!=len(set(roles)):raise ValueError('Approval roles cannot repeat in a workflow')
    if roles.index('od_specialist')>roles.index('total_rewards') or roles.index('total_rewards')>roles.index('finance'):raise ValueError('OD must precede Rewards and Finance')
    for s in steps:
        if type(s.get('slaHours',72)) is not int or not 1<=s.get('slaHours',72)<=720:raise ValueError('Each stage SLA must be 1–720 hours')
        if s.get('escalationRole','chro') not in {'chro','admin'}:raise ValueError('Stage escalation goes to CHRO or administrator')
    return [{'role':s['role'],'nameAr':str(s.get('nameAr',s['role']))[:100],'nameEn':str(s.get('nameEn',s['role']))[:100],'slaHours':s.get('slaHours',72),'escalationRole':s.get('escalationRole','admin' if s['role']=='chro' else 'chro')} for s in steps]

def submission_workflow(steps):
    """Upgrade legacy organization configuration only; never re-number signed stages."""
    value=copy.deepcopy(steps)
    if value and value[0].get('role') not in {'department_manager','hrbp'}:value.insert(0,copy.deepcopy(DEFAULT_WORKFLOW[0]))
    return validate_workflow(value)

def validate_position_scope(value):
    count=value.get('headcount',1);cost=value.get('annualCost');reports=value.get('directReports',0)
    scope=normalized(' '.join(str(value.get(k,'')) for k in ['team','seniority','recommendedLevel']))
    individual=any(x in scope for x in ['individual contributor','independent contributor','مساهم فردي','ممارس مستقل','دور تخصصي','لا يوجد مرؤوسون مباشرون'])
    if individual and reports>0:raise ValueError('Individual contributor positions must have zero direct reports')
    if cost is not None and cost/count<1000:raise ValueError('Annual employer cost below SAR 1,000 per person is blocked even with a manual exception')
    low,high=value.get('annualCostMin'),value.get('annualCostMax')
    if low is not None or high is not None:
        if not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>0 for v in [low,high]) or high<low:raise ValueError('Annual per-person cost range must be positive and ordered')
    basis=value.get('costBasis')
    if basis and basis not in {'grade-band','manual-exception'}:raise ValueError('Choose grade-band or manual-exception cost basis')
    if basis=='manual-exception' and len(str(value.get('costExceptionReason','')).strip())<30:raise ValueError('A manual cost exception requires a rationale of at least 30 characters')
    if cost is not None and cost/count<12000 and basis!='manual-exception':raise ValueError('Annual cost is below the illustrative SAR 12,000 review threshold; document a manual exception. This is not a statutory wage minimum.')
    if cost is not None and low is not None and high is not None and not low*count<=cost<=high*count and basis!='manual-exception':raise ValueError('Total annual cost must fall within the per-person grade range multiplied by headcount')

def validate_submission(content,position_id,revision):
    """A proposed grade starts review; it never substitutes for the authenticated Rewards committee."""
    validate_position_scope(content)
    claimed=any(content.get(key) not in (None,'') for key in ['evaluatedPositionId','evaluatedPositionRevision','evaluationSummary'])
    if claimed and (content.get('evaluatedPositionId')!=position_id or content.get('evaluatedPositionRevision')!=revision):raise ValueError('A claimed assessment must identify this exact position and revision; a preliminary grade proposal does not require an assessment claim')
    return required_content(content)

def evaluation_consistency(framework,answers,evidence):
    factors={f['id']:f for f in framework.get('factors',[])};flags=[]
    from collections import Counter
    counts=Counter(normalized(str(evidence.get(key,''))) for key in factors)
    if any(text and count>2 for text,count in counts.items()):raise ValueError('Provide distinct job-specific evidence for each factor; the same text is repeated in more than two factors')
    if {'people','autonomy','impact'}.issubset(factors):
        for other in ['autonomy','impact']:
            p=next((i for i,x in enumerate(factors['people']['levels']) if x['id']==str(answers.get('people'))),None)
            o=next((i for i,x in enumerate(factors[other]['levels']) if x['id']==str(answers.get(other))),None)
            if p is not None and o is not None and abs(p-o)>2:flags.append({'factor':'people','comparedWith':other,'levelDifference':abs(p-o)})
    if flags and len(str(evidence.get('consistencyJustification','')).strip())<40:raise ValueError('People responsibility differs from autonomy or impact by more than two levels; provide a consistency justification of at least 40 characters')
    return flags

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
    rounded=int(score.quantize(Decimal('1'),rounding=ROUND_HALF_UP));band=next(x for x in f['bands'] if x['min']<=rounded<=x['max'])
    return {'points':rounded,'compensation':compensation_result(f,band,evidence),'band':band,'breakdown':breakdown,'frameworkId':f.get('id'),'frameworkVersion':f.get('version'),'method':f['method'],'illustrative':f.get('illustrative',False),'status':'specialist-review-required','currency':f.get('currency'),'computedBy':'configured-point-factor-formula','warning':f.get('notice')}
