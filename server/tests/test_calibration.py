import json, runpy, subprocess, sys
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/'scripts'/'calibrate-thresholds.py'


def write(path,rows,header='caseId,similarity,expertMatch,expertA,expertB'):
    path.write_text(header+'\n'+'\n'.join(rows)+'\n',encoding='utf-8');return path


def test_recommends_lowest_threshold_meeting_target_precision(tmp_path):
    rows=['c%d,%.2f,%d,%d,%d'%(i,0.6+i*0.01,1 if i>=15 else 0,1 if i>=15 else 0,1 if i>=14 else 0) for i in range(30)]
    report=tmp_path/'r.json';result=subprocess.run([sys.executable,str(SCRIPT),str(write(tmp_path/'j.csv',rows)),'--target-precision','1.0','--out',str(report)],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    data=json.loads(report.read_text());assert data['recommended']['threshold']==0.75 and data['recommended']['precision']==1.0 and data['recommended']['recall']==1.0
    assert data['cases']==30 and len(data['datasetSha256'])==64 and 0<data['interRaterKappa']<1


def test_rejects_small_or_invalid_datasets(tmp_path):
    assert subprocess.run([sys.executable,str(SCRIPT),str(write(tmp_path/'small.csv',['a,0.9,1,,']))],capture_output=True).returncode==2
    rows=['c%d,%.2f,1,,'%(i,0.9) for i in range(25)]+['c1,0.5,0,,']
    assert subprocess.run([sys.executable,str(SCRIPT),str(write(tmp_path/'dup.csv',rows))],capture_output=True).returncode==2
    rows=['c%d,1.5,1,,'%i for i in range(25)]
    assert subprocess.run([sys.executable,str(SCRIPT),str(write(tmp_path/'range.csv',rows))],capture_output=True).returncode==2
