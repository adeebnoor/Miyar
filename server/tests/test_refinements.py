import copy,io
import pytest
from pypdf import PdfReader
from server.domain import DEFAULT_FRAMEWORK,grade,validate_framework
from server.performance import validate_kpis
from server.tests.conftest import activate

KPI={'outcome':'Reduce processing time by 20% in 90 days','metric':'Median working days to completion','target':'20% below baseline in 90 days','frequency':'Monthly','deliverable':'Time-stamped service report'}

def test_public_pdf_is_draft_bilingual_with_four_unsigned_signature_fields(env):
    app,c,auth,position=env
    p=position(kpis=[KPI]*3,salaryMin=10000,salaryMax=14000,salaryCurrency='SAR',salaryPeriod='monthly',salaryGrade='B2',salarySource='Internal proposal')
    for lang in ['ar','en']:
        r=c.post('/api/v1/public/position-pdf',json={'content':p['content'],'lang':lang})
        assert r.status_code==200,r.text[:300]
        assert r.headers['content-type']=='application/pdf';assert r.headers['cache-control']=='no-store'
        pdf=PdfReader(io.BytesIO(r.content));fields=pdf.get_fields()
        assert len(fields)==4
        assert all(f['/FT']=='/Sig' and '/V' not in f for f in fields.values())
        widgets=[a.get_object() for page in pdf.pages for a in page.get('/Annots',[]) if a.get_object().get('/Subtype')=='/Widget']
        assert len(widgets)==4
        assert all(float(w['/Rect'][2])>float(w['/Rect'][0]) and float(w['/Rect'][3])>float(w['/Rect'][1]) for w in widgets)
        assert all(any(w.indirect_reference==x for x in pdf.trailer['/Root']['/AcroForm']['/Fields']) for w in widgets)
        assert '20%' in ''.join(page.extract_text() for page in pdf.pages)
    assert c.post('/api/v1/public/position-pdf',json={'content':p['content'],'approved':True}).status_code==422
    assert c.post('/api/v1/public/position-pdf',json={'content':{**p['content'],'approvals':[{'role':'chro'}]}}).status_code==422

def test_performance_and_salary_roundtrip_in_official_exports(env):
    app,c,auth,position=env
    p=position(kpis=[KPI]*3,salaryMin=10000,salaryMax=14000,salaryCurrency='SAR',salaryPeriod='monthly',salarySource='Internal proposal')
    assert p['content']['kpis'][0]==KPI
    active=activate(c,auth,p)
    exported=c.get('/api/v1/positions/'+p['id']+'/export/json',headers=auth()).json()
    assert exported['approved'] is True
    assert len(exported['approvals'])==4
    for format in ['pdf','docx','xlsx']:
        r=c.get('/api/v1/positions/'+p['id']+'/export/'+format,headers=auth());assert r.status_code==200,r.text[:300]

def test_salary_band_validation_and_evaluation_binding():
    f=copy.deepcopy(DEFAULT_FRAMEWORK);f['bands'][1].update(salaryMin=10000,salaryMax=15000)
    evidence={k:'Specific duties and authority' for k in ['knowledge','complexity','impact']}
    r=grade(f,dict.fromkeys(evidence,'2'),evidence)
    assert r['compensation']['grade']=='B2';assert r['compensation']['salaryMin']==10000
    assert r['compensation']['salaryPeriod']=='monthly'
    for invalid in [{'salaryMin':float('nan'),'salaryMax':15000},{'salaryMax':15000},{'salaryMin':10000,'salaryMax':9000},{'salaryMin':True,'salaryMax':15000}]:
        broken=copy.deepcopy(DEFAULT_FRAMEWORK);broken['bands'][1].update(invalid)
        with pytest.raises(ValueError):validate_framework(broken)
    f=copy.deepcopy(DEFAULT_FRAMEWORK);evidence['compensation']={'salaryMin':9000,'salaryMax':11000,'salaryPeriod':'monthly','salaryCurrency':'SAR','salarySource':'Rewards proposal'}
    r=grade(f,{'knowledge':'2','complexity':'2','impact':'2'},evidence);assert r['compensation']['salaryMax']==11000

def test_ai_requires_config_and_rejects_malformed_rows(env,monkeypatch):
    app,c,auth,position=env;p=position()
    monkeypatch.delenv('MIYAR_KPI_ENDPOINT',raising=False)
    r=c.post('/api/v1/performance/kpis',headers=auth(),json={'content':p['content'],'lang':'en'})
    assert r.status_code==422;assert 'not configured' in r.text
    assert c.post('/api/v1/performance/kpis',json={'content':p['content']}).status_code==401
    assert validate_kpis([KPI]*3)==[KPI]*3
    for invalid in [[],[KPI]*6,[{**KPI,'approval':'approved'}]*3,[{**KPI,'target':10}]*3]:
        with pytest.raises(ValueError):validate_kpis(invalid)
