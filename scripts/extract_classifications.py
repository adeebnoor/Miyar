"""Reproduce taxonomy data from the user-supplied 2019/2020 PDF editions.
Never treats either edition as proof of current regulatory applicability.
"""
import argparse,hashlib,json,re,unicodedata
from pathlib import Path
import fitz

def clean(text):
    text=unicodedata.normalize('NFKC',text).replace('\u0640','')
    return re.sub(r'\s+',' ',text).strip()

def glyph_text(span):
    chars=span.get('chars',[]);out='';i=0
    while i<len(chars):
        c=chars[i]
        # These PDFs expose lam-alef ligatures as a zero-width alef followed by lam.
        if c['c'] in 'اأإآ' and abs(c['bbox'][2]-c['bbox'][0])<0.01 and i+1<len(chars) and chars[i+1]['c']=='ل':
            out+='ل'+c['c'];i+=2
        else:out+=c['c'];i+=1
    return out

def native_text(page):
    return '\n'.join(''.join(glyph_text(s) for s in line['spans']) for b in page.get_text('rawdict')['blocks'] for line in b.get('lines',[]))

def cell_text(page,rect):
    spans=[]
    for b in page.get_text('rawdict',clip=fitz.Rect(rect))['blocks']:
        for line in b.get('lines',[]):
            for s in line['spans']:s['text']=glyph_text(s);spans.append(s)
    lines=[]
    for span in sorted(spans,key=lambda s:(round(s['origin'][1],1),-s['bbox'][2])):
        group=next((g for g in lines if abs(g[0]['origin'][1]-span['origin'][1])<2),None)
        if group is None:lines.append([span])
        else:group.append(span)
    result=[]
    for group in lines:
        group.sort(key=lambda s:-s['bbox'][2]);out='';previous=None
        for span in group:
            gap=previous['bbox'][0]-span['bbox'][2] if previous else 0
            if previous and gap>1 and not out.endswith(' ') and not span['text'].startswith(' '):out+=' '
            out+=span['text'];previous=span
        result.append(out)
    return clean(' '.join(result))

def occupations(path):
    doc=fitz.open(path);nodes={};duplicates=[];missed=[];raw_count=0
    for page_index in range(7,len(doc)):
        page=doc[page_index];tables=page.find_tables().tables
        seen=set()
        for table in tables:
            for row in table.rows:
                texts=[cell_text(page,c) for c in row.cells if c]
                codes=[t for t in texts if re.fullmatch(r'(?:\d{1,4}|\d{6})',t)]
                labels=[t for t in texts if re.search(r'[\u0600-\u06ff]',t)]
                if len(codes)!=1 or not labels:continue
                code=codes[0];label=clean(' '.join(labels));seen.add(code);raw_count+=1
                item={'code':code,'titleAr':label,'level':{1:'major',2:'submajor',3:'minor',4:'unit',6:'occupation'}[len(code)],'parent':code[:4] if len(code)==6 else code[:-1] or None,'sourcePage':page_index+1}
                if code in nodes and nodes[code]['titleAr']!=label:duplicates.append({'code':code,'first':nodes[code],'other':item})
                else:nodes[code]=item
        for word in page.get_text('words'):
            if re.fullmatch(r'\d{6}',word[4]) and word[4] not in seen:missed.append({'code':word[4],'page':page_index+1})
    missing_parents=[n for n in nodes.values() if n['parent'] and n['parent'] not in nodes]
    return {'schema':'miyar-taxonomy/1.0','id':'ssco-2019-supplied','titleAr':'التصنيف السعودي للمهن — إصدار يناير 2019 المرفق','titleEn':'Saudi occupation classification — supplied January 2019 edition','publisher':'General Authority for Statistics','edition':'2019-01','sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourcePages':len(doc),'scope':'All extractable taxonomy rows in the supplied edition; current applicability requires verification','nodes':list(nodes.values()),'validation':{'tableRows':raw_count,'uniqueNodes':len(nodes),'occupations':sum(n['level']=='occupation' for n in nodes.values()),'duplicates':duplicates,'unmatchedSixDigitTokens':missed,'missingParents':missing_parents}}

def education(path):
    doc=fitz.open(path);fields={};details=[]
    for i,page in enumerate(doc):
        if not (74<=i<=703):continue
        text=native_text(page);lines=text.splitlines();matches=list(re.finditer(r'[)(]\s*(\d{6})\s*[)(]\s*([^\n]+)',text))
        for m in matches:
            code=m.group(1);name=clean(m.group(2)).replace('اسم التخصص','').strip()
            if not re.search('[\u0600-\u06ff]',name):continue
            # Definition headings are on individual specification pages.
            if 'التعريف' not in text or 'المجال' not in text:continue
            full=clean(text);start=re.search(r'(?:يهدف|يتناول|يعنى|يركز|يهتم|يشمل) هذا التخصص',full);desc=full[start.start():] if start else '';desc=re.split('أهم المقررات|ملحوظ',desc)[0]
            item={'code':code,'titleAr':name,'sourcePage':i+1,'parent':code[:4],'descriptionAr':desc[:4500]}
            if code in fields and fields[code]['titleAr']!=name:details.append({'code':code,'page':i+1,'label':name})
            else:fields[code]=item
    names=['تعليم الطفولة المبكرة','التعليم الابتدائي','التعليم المتوسط','التعليم الثانوي','الدبلوم المشارك','الدبلوم المتوسط','البكالوريوس أو ما يعادلها','الماجستير أو ما يعادلها','الدكتوراه أو ما يعادلها']
    en=['Early childhood education','Primary education','Intermediate education','Secondary education','Associate diploma','Intermediate diploma','Bachelor or equivalent','Master or equivalent','Doctorate or equivalent']
    levels=[{'code':str(i),'titleAr':ar,'titleEn':en[i],'sourcePage':28} for i,ar in enumerate(names)]
    return {'schema':'miyar-education/1.0','id':'saudi-education-2020-supplied','edition':'2020','publisher':'Saudi Ministry of Education','sourceFile':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourcePages':len(doc),'levels':levels,'fields':list(fields.values()),'validation':{'specializations':len(fields),'duplicates':details},'mappingRule':'Educational level and specialization codes are distinct from occupation codes. This source does not establish a mandatory occupation-to-education crosswalk.'}

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--occupations',type=Path,required=True);a.add_argument('--education',type=Path,required=True);a.add_argument('--output',type=Path,default=Path('dist/classifications'));args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    for name,value in [('ssco-2019',occupations(args.occupations)),('education-2020',education(args.education))]:
        (args.output/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')))
        print(name,json.dumps(value['validation'],ensure_ascii=False)[:3500])
