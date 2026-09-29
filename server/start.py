import os,subprocess,sys
from pathlib import Path
Path('.runtime').mkdir(exist_ok=True)
if os.getenv('MIYAR_BOOTSTRAP_EMAIL') and os.getenv('MIYAR_BOOTSTRAP_PASSWORD'):
    subprocess.run([sys.executable,'-m','server.cli','bootstrap'],check=True)
if len(os.getenv('MIYAR_DEMO_PASSWORD',''))>=12:
    # A failed demo build must never keep the API from starting.
    subprocess.run([sys.executable,'-m','server.cli','ensure-demo'],check=False)
if os.getenv('MIYAR_STRATEGIC_STARTUP_CHECK') == 'true':
    from .strategic_check import REPORT
    REPORT.unlink(missing_ok=True)
    subprocess.Popen([sys.executable, '-m', 'server.strategic_check'])
os.execvp('uvicorn',['uvicorn','server.asgi:app','--host','0.0.0.0','--port',os.getenv('PORT','8000'),'--workers','1','--no-access-log'])
