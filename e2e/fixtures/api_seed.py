import os,tempfile,copy
os.environ['MIYAR_SERVE_UI']='true'
from server.app import create_app
from server.models import Organization,Department,User
from server.security import password_hash
from server.tests.test_institution import profile
_directory=tempfile.TemporaryDirectory(prefix='miyar-browser-')
app=create_app('sqlite:///'+_directory.name+'/test.db','isolated-audit-key-not-for-production-928')
with app.state.sessions() as db:
 for suffix in ['a','b']:
  p=profile();p['organizationName']='Audit Organization '+suffix.upper();p['version']=7 if suffix=='a' else 19;p['gradeStructure']['grades'][0]['id']='G11-A' if suffix=='a' else 'G19-B';p['updatedAt']='2026-09-28T00:00:00Z'
  db.add(Organization(id='org-'+suffix,name=p['organizationName'],settings={'demoMode':True,'institutionProfile':p}));db.flush();db.add(Department(id='dep-'+suffix,org_id='org-'+suffix,name='Human Capital'));db.flush()
  for role in ['admin','line_manager','department_manager','hrbp','od_specialist','total_rewards','total_rewards2','finance','chro']:
   db.add(User(id=suffix+'-'+role,org_id='org-'+suffix,email=suffix+'-'+role+'@audit.test',name='Synthetic '+suffix+' '+role,role='total_rewards' if role=='total_rewards2' else role,department_id='dep-'+suffix if role in ['line_manager','department_manager','hrbp'] else None,password_hash=password_hash('isolated-test-password-928')))
 db.commit()
