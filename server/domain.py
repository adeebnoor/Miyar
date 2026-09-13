"""Pure governance and evaluation rules; no proprietary grading tables."""
import copy,hashlib,json,math,re,unicodedata
from decimal import Decimal

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
        if 'salaryMin' in band and (band['salaryMin']<0 or band.get('salaryMax',-1)<band['salaryMin']):raise ValueError('Invalid salary range')
        previous=band['max']
    if previous!=1000:raise ValueError('Bands must cover 0–1000 custom points')
    f['bands']=ordered;return f

def grade(framework,answers,evidence):
    f=validate_framework(framework);breakdown=[];score=Decimal(0)
    if set(answers)!={x['id'] for x in f['factors']}:raise ValueError('Answer every configured factor')
    for factor in f['factors']:
        level=next((x for x in factor['levels'] if x['id']==str(answers[factor['id']])),None)
        if not level or not str(evidence.get(factor['id'],'')).strip():raise ValueError('Each factor requires a valid level and evidence')
        weighted=Decimal(str(level['points']))*Decimal(str(factor['weight']))/10;score+=weighted
        breakdown.append({'factor':factor['id'],'level':level['id'],'weightedPoints':float(weighted),'evidence':evidence[factor['id']]})
    rounded=int(score.quantize(Decimal('1')));band=next(x for x in f['bands'] if x['min']<=rounded<=x['max'])
    return {'points':rounded,'band':band,'breakdown':breakdown,'frameworkId':f.get('id'),'frameworkVersion':f.get('version'),'method':f['method'],'illustrative':f.get('illustrative',False),'status':'specialist-review-required','currency':f.get('currency'),'computedBy':'configured-point-factor-formula','warning':f.get('notice')}
