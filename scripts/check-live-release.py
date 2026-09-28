"""Fail publishing when API and UI identities differ; no secrets are needed."""
import json,time,urllib.request,sys
from pathlib import Path
expected=json.loads(Path('dist/release.json').read_text())
for attempt in range(20):
    try:
        with urllib.request.urlopen('https://miyar-enterprise-api.onrender.com/health',timeout=90) as r:health=json.load(r)
        if health.get('status')=='ok' and all(health.get(k)==expected[k] for k in ['version','buildId']):
            print('Live API matches release',expected['version'],expected['buildId']);sys.exit(0)
        print('Waiting for matching API release; attempt',attempt+1,flush=True)
    except Exception as e:print('Health check not ready:',type(e).__name__,flush=True)
    if attempt<19:time.sleep(30)
raise SystemExit('API release differs: deploy the tested API commit, then rerun Pages publishing.')
