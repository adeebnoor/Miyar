import os,subprocess,sys
from pathlib import Path
Path('.runtime').mkdir(exist_ok=True)
if os.getenv('MIYAR_BOOTSTRAP_EMAIL') and os.getenv('MIYAR_BOOTSTRAP_PASSWORD'):
    subprocess.run([sys.executable,'-m','server.cli','bootstrap'],check=True)
os.execvp('uvicorn',['uvicorn','server.asgi:app','--host','0.0.0.0','--port',os.getenv('PORT','8000'),'--workers','1','--no-access-log'])
