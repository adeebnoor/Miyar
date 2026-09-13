"""Authored bilingual skill labels; canonical O*NET identifiers checked 2026-09-13.
Not a reproduction of O*NET ratings or a validated SSCO↔O*NET crosswalk.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
rows=[
 ('2.A.1.b','الاستماع الفعال','Active Listening','transversal',['الإصغاء','استماع']),
 ('2.A.1.e','الرياضيات','Mathematics','technical',['رياضيات']),
 ('2.A.1.a','فهم المقروء','Reading Comprehension','transversal',['فهم النصوص']),
 ('2.A.1.f','العلوم','Science','technical',['علوم']),
 ('2.A.1.d','التحدث','Speaking','transversal',['العرض الشفهي']),
 ('2.A.1.c','الكتابة','Writing','transversal',['كتابة التقارير']),
 ('2.A.2.b','التعلم النشط','Active Learning','transversal',['التعلم المستمر']),
 ('2.A.2.a','التفكير النقدي','Critical Thinking','transversal',['تحليل الحجج']),
 ('2.A.2.c','استراتيجيات التعلم','Learning Strategies','transversal',[]),
 ('2.A.2.d','المراقبة','Monitoring','technical',['مراقبة الأداء']),
 ('2.B.2.i','حل المشكلات المعقدة','Complex Problem Solving','transversal',['حل المشكلات','problem solving']),
 ('2.B.3.e','البرمجة','Programming','technical',['برمجة','كتابة الشيفرة','coding','software development','تطوير البرمجيات']),
 ('2.B.4.g','تحليل النظم','Systems Analysis','technical',['تحليل الأنظمة','systems analysis','تحليل نظم']),
 ('2.B.4.h','تقييم النظم','Systems Evaluation','technical',['تقييم الأنظمة']),
 ('2.B.4.e','الحكم واتخاذ القرار','Judgment and Decision Making','transversal',['اتخاذ القرار','اتخاذ القرارات','decision making']),
 ('2.B.5.a','إدارة الوقت','Time Management','transversal',['تنظيم الوقت']),
 ('2.B.1.d','التفاوض','Negotiation','transversal',['تفاوض']),
 ('2.B.1.b','التنسيق','Coordination','transversal',['تنسيق']),
 ('2.B.3.k','استكشاف الأعطال','Troubleshooting','technical',['تشخيص الأعطال']),
]
skills=[dict(id='onet:'+id,labelAr=ar,labelEn=en,kind=kind,aliases=aliases,source='O*NET',sourceUrl='https://www.onetonline.org/find/descriptor/result/'+id,retrieved='2026-09-13',translation='Miyar-authored Arabic label; type grouping is local') for id,ar,en,kind,aliases in rows]
for id,ar,en,aliases in [('sql','استعلام قواعد البيانات','Database querying',['SQL','قواعد البيانات']),('python','لغة بايثون','Python',['بايثون']),('data-analysis','تحليل البيانات','Data analysis',['تحليل بيانات','analytics']),('ai','الذكاء الاصطناعي','Artificial intelligence',['AI','machine learning','تعلم الآلة'])]:
 skills.append(dict(id='miyar:'+id,labelAr=ar,labelEn=en,kind='technical',aliases=aliases,source='Miyar authored vocabulary',sourceUrl=None,retrieved='2026-09-13'))
profiles=[dict(code='251204',titleEn='Software engineer',onetCode='15-1252.00',sourceUrl='https://www.onetonline.org/link/details/15-1252.00',skills=['2.A.2.a','2.A.2.b','2.A.1.a','2.B.3.e','2.B.4.e','2.B.4.g'],tasks=[{'ar':'تحليل المتطلبات وتقدير جدوى الحل البرمجي','en':'Assess requirements and the feasibility of a software solution'},{'ar':'تصميم البرامج واختبارها وتصحيح أخطائها','en':'Design, test and debug software'},{'ar':'تنسيق تنفيذ الحل مع المحللين والمهندسين','en':'Coordinate solution delivery with analysts and engineers'}]),dict(code='251104',titleEn='Systems analyst',onetCode='15-1211.00',sourceUrl='https://www.onetonline.org/link/details/15-1211.00',skills=['2.B.4.g','2.B.4.h'],tasks=[{'ar':'جمع احتياجات المستخدمين وتحليل إجراءات معالجة المعلومات','en':'Gather user needs and examine information-processing procedures'},{'ar':'تقييم النظم وتشخيص مشاكلها واقتراح تحسينات','en':'Evaluate systems, diagnose issues and recommend improvements'},{'ar':'تقدير التكلفة والمنفعة لبدائل الأنظمة','en':'Compare costs and benefits of system alternatives'}])]
for p in profiles:p.update(skills=['onet:'+x for x in p['skills']],crosswalkStatus='authored-review-required',retrieved='2026-09-13',notice='Selected O*NET tasks paraphrased by Miyar; this SSCO crosswalk is proposed, not an official equivalence or a complete skill inventory.')
for name,value in [('skills',skills),('role-profiles',profiles)]:
 (ROOT/'dist/classifications'/f'{name}.json').write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')))
