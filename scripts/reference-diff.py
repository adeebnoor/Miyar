"""Compare supplied reference snapshots without activating or asserting authority."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('previous');p.add_argument('candidate');a=p.parse_args()
def load(file):
    data=json.loads(Path(file).read_text());rows=data.get('nodes',data.get('fields',[]));codes=[str(r['code']) for r in rows]
    if not rows or len(set(codes))!=len(codes):raise ValueError('Empty reference or duplicate codes')
    nodes=dict(zip(codes,rows));missing=[r['code'] for r in rows if r.get('parent') and str(r['parent']) not in nodes]
    return data,nodes,missing
old,o,_=load(a.previous);new,n,missing=load(a.candidate)
print(json.dumps({'previous':old.get('id'),'candidate':new.get('id'),'activated':False,'added':sorted(n.keys()-o.keys()),'removed':sorted(o.keys()-n.keys()),'changed':[{'code':c,'before':o[c],'after':n[c]} for c in sorted(o.keys()&n.keys()) if o[c]!=n[c]],'missingParents':missing,'reviewRequired':['official provenance and reuse permission','effective date','code removals and remapping','department and expert approval']},ensure_ascii=False,indent=2))
