"""Operator-only initialization and password reset. Never seed public demo passwords."""
import argparse,base64,getpass,os,secrets
from sqlalchemy import select
from .app import create_app
from .models import Organization,User,Department
from .security import password_hash

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['bootstrap','reset-password','warm-model']);parser.add_argument('--email');parser.add_argument('--name',default='Miyar Administrator');parser.add_argument('--organization',default='Miyar');args=parser.parse_args()
    if args.command=='warm-model':
        from .taxonomy import Catalog
        c=Catalog();c.load_semantic();print('Indexed',len(c.roles),'occupation references; fingerprint',c.model_fingerprint);return
    app=create_app()
    email=args.email or os.getenv('MIYAR_BOOTSTRAP_EMAIL','')
    if '@' not in email:raise SystemExit('Provide --email or MIYAR_BOOTSTRAP_EMAIL')
    password=os.getenv('MIYAR_BOOTSTRAP_PASSWORD') or getpass.getpass('New account password (12+ characters): ')
    with app.state.sessions() as db:
        user=db.scalar(select(User).where(User.email==email.lower()))
        if args.command=='reset-password':
            if not user:raise SystemExit('Account not found')
            user.password_hash=password_hash(password);user.session_version+=1
        else:
            if user:print('Bootstrap account already exists; no account was changed');return
            org=Organization(name=args.organization,settings={});db.add(org);db.flush();db.add(Department(org_id=org.id,name='General'));db.flush();user=User(org_id=org.id,email=email.lower(),name=args.name,role='admin',password_hash=password_hash(password));db.add(user)
        db.commit();print('Account initialized. Password was not printed.')
if __name__=='__main__':main()
