import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const skill=process.env.MIYAR_PRESENTATIONS_SKILL||'/root/.codex/skills/builtins/presentations';
const python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON;
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
for(const lang of (process.argv.includes('--ar-only')?['ar']:['ar','en'])){
 const input=path.join(root,'tmp/pitch-build',lang,'candidate.pptx');
 const candidate=path.join(root,'tmp/pitch-build',lang,'direction-corrected.pptx');
 // Preserve logical Unicode text and declare Arabic paragraph direction in OOXML.
 const fix=spawnSync(python,['-c',`import sys,zipfile,re
from lxml import etree as E
src,dst,lang=sys.argv[1:]
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(src) as zi,zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED) as zo:
 for entry in zi.infolist():
  blob=zi.read(entry.filename)
  if re.fullmatch(r'ppt/slides/slide\\d+\\.xml',entry.filename):
   tree=E.fromstring(blob)
   for p in tree.findall('.//a:p',ns):
    text=''.join(p.itertext())
    if re.search(r'[\\u0600-\\u06ff]',text):
     pr=p.find('a:pPr',ns)
     if pr is None:pr=E.Element('{'+ns['a']+'}pPr');p.insert(0,pr)
     pr.set('rtl','1')
     for r in p.findall('a:r/a:rPr',ns):
      r.set('lang','ar-SA')
      cs=r.find('a:cs',ns)
      if cs is None:cs=E.SubElement(r,'{'+ns['a']+'}cs')
      cs.set('typeface','DejaVu Sans')
   blob=E.tostring(tree,xml_declaration=True,encoding='UTF-8',standalone=True)
  zo.writestr(entry,blob)
`,input,candidate,lang],{encoding:'utf8'});
 if(fix.status!==0)throw Error(fix.stderr);
 const dest=path.join(root,'dist/pitch',`Miyar-Pitch-${lang.toUpperCase()}${process.env.MIYAR_PITCH_REVISION||''}.pptx`);
 await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:dest,pythonExecutable:python,
  integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','15249525,9525000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','6'],
  explicitTotalSlideCount:18,requiredNativeTableOwnerSlides:[6],fontPolicy:{basis:'design',families:[lang==='ar'?'DejaVu Sans':'Nimbus Sans']},
  verifyArtifactToolImport:true,receiptPath:path.join(root,'tmp/pitch-build',lang,`validation${process.env.MIYAR_PITCH_REVISION||''}.json`)});
 console.log('Finalized '+dest);
}
