/* Role codes and English titles are transcribed from the supplied data.xlsx.
 * Arabic explanations, term lists and scenarios are authored for this demo.
 * The five records are a sample, not a complete or independently validated taxonomy.
 */
window.MIYAR_DATA = {
  version: 'demo-1.0',
  source: 'عينة مشروع معيار — data.xlsx',
  roles: [
    {
      id: 'industrial', title: 'مهندس صناعي', titleEn: 'Industrial Engineer', code: '214101', educationCode: '71903', icon: 'chart',
      summary: 'تحسين أداء العمليات، وتوظيف الموارد، وتطوير مؤشرات الأداء وأساليب العمل.',
      reason: 'يجمع هذا الدور بين تحليل العمليات وتحسين استخدام الموارد وقياس الأداء؛ وهي مهام تتقاطع مع الاحتياج المدخل.',
      groups: [
        {label:'كفاءة العمليات', terms:['كفاءة','الكفاءة','التشغيل','تشغيلية','التشغيلية','العمليات','عمليات','تحسين العمليات','operations','organizational','performance','efficiency','industrial']},
        {label:'تقليل الهدر والازدواجية',terms:['الهدر','هدر','ازدواجية','الازدواجية','تكرار المهام','duplication','waste','utilization']},
        {label:'قياس الأداء',terms:['مؤشرات','المؤشرات','الأداء','kpi','kpis','standards']},
        {label:'تطوير أساليب العمل',terms:['الموارد','موارد','إنتاجية','الإنتاجية','توزيع المهام','العمل','methods','resources','personnel']}
      ],
      scenario:'تحسين كفاءة التشغيل وتقليل ازدواجية المهام، وتطوير مؤشرات الأداء وتوزيع الموارد لرفع الإنتاجية.',
      taxonomyUnit:'2141',taxonomyLabel:'المهندسون الصناعيون ومهندسو الإنتاج'
    },
    {
      id:'civil',title:'مهندس مدني',titleEn:'Civil Engineer',code:'214201',educationCode:'73201',icon:'building',
      summary:'تقييم الموقع والتربة، ومراجعة التصاميم والمواصفات، ومتابعة جودة التنفيذ.',
      reason:'يتمحور هذا الدور حول تقييم الموقع ومراجعة التصميم والإشراف على التنفيذ؛ وهي صلة مباشرة بمهام المشروع الإنشائي.',
      groups:[
        {label:'تصميم المشاريع',terms:['تصاميم','التصاميم','إنشاء','إنشائي','إنشائية','الإنشائية','مباني','المباني','البناء','civil','construction','buildings']},
        {label:'تقييم الموقع والتربة',terms:['التربة','تربة','موقع','الموقع','soil','site']},
        {label:'المواصفات والمواد',terms:['المواصفات','مواصفات','المواد','الخرسانة','materials','specs','specifications']},
        {label:'متابعة التنفيذ',terms:['التنفيذ','تنفيذ','تشييد','التشييد','project delivery','execution']}
      ],
      scenario:'ضمان جودة تنفيذ مشروع إنشائي، من فحص الموقع والتربة إلى مراجعة التصاميم والمواصفات ومتابعة التنفيذ.',
      taxonomyUnit:'2142',taxonomyLabel:'المهندسون المدنيون'
    },
    {
      id:'mechanical',title:'مهندس ميكانيكي',titleEn:'Mechanical Engineer',code:'214401',educationCode:'71501',icon:'gear',
      summary:'تصميم الأنظمة الميكانيكية، وتخطيط تركيبها وتشغيلها وصيانتها الوقائية.',
      reason:'يرتبط هذا الدور باعتمادية الأنظمة الميكانيكية وتشغيل المعدات وصيانتها، بما ينسجم مع الاحتياج إلى أداء تشغيلي مستقر.',
      groups:[
        {label:'أنظمة ميكانيكية',terms:['ميكانيكي','ميكانيكية','الميكانيكية','ميكانيك','mechanical','mechanics']},
        {label:'الصيانة الوقائية',terms:['صيانة','الصيانة','وقائية','الوقائية','preventive','maintenance']},
        {label:'المعدات والتركيب',terms:['معدات','المعدات','آلات','الآلات','تركيب','التركيب','assembly','installation','equipment']},
        {label:'الاعتمادية',terms:['اعتمادية','الاعتمادية','موثوقية','الأعطال','تعطل','التوقفات','reliability','reliable','downtime','failure']}
      ],
      scenario:'رفع اعتمادية الأنظمة الميكانيكية وتقليل توقف المعدات، عبر تخطيط الصيانة الوقائية وتحسين إجراءات التركيب والتشغيل.',
      taxonomyUnit:'2144',taxonomyLabel:'المهندسون الميكانيكيون'
    },
    {
      id:'chemical',title:'مهندس كيميائي',titleEn:'Chemical Engineer',code:'214501',educationCode:'71101',icon:'flask',
      summary:'تطوير عمليات الإنتاج الكيميائي، وتحسين وحدات التشغيل ومتابعة الأداء الفني.',
      reason:'يركز هذا الدور على عمليات التصنيع الكيميائي ووحدات التشغيل، مع توثيق الأداء وتحسين سلامة الإنتاج وكفاءته.',
      groups:[
        {label:'الإنتاج الكيميائي',terms:['كيميائي','كيميائية','الكيميائية','كيمياء','الكيمياء','chemical','chemicals']},
        {label:'وحدات التشغيل',terms:['وحدات التشغيل','وحدات الإنتاج','unit operations','reactor','reactors','تفاعلات','التفاعلات','مفاعلات','المفاعلات']},
        {label:'عمليات التصنيع',terms:['تصنيع','التصنيع','المصنع','الإنتاج','manufacturing','production','plant']},
        {label:'سلامة الإنتاج',terms:['سلامة','السلامة','المعالجة','معالجة','chemical safety','processing','process safety']}
      ],
      scenario:'تحسين كفاءة الإنتاج الكيميائي وتطوير وحدات التشغيل، مع متابعة عمليات التصنيع وسلامة المعالجة في المصنع.',
      taxonomyUnit:'2145',taxonomyLabel:'المهندسون الكيميائيون'
    },
    {
      id:'mining',title:'مهندس تعدين',titleEn:'Mining Engineer',code:'214601',educationCode:'72401',icon:'mountain',
      summary:'تحديد مكامن الخام، وتخطيط الاستخراج، وتحسين جودة الخام وتوثيق عمليات التعدين.',
      reason:'يجمع هذا الدور بين دراسة مكامن الخام وتخطيط الاستخراج وتحسين عمليات التعدين؛ وهي المهام الأساسية للاحتياج المحدد.',
      groups:[
        {label:'عمليات التعدين',terms:['تعدين','التعدين','مناجم','المناجم','منجم','المنجم','mining','mine','mines']},
        {label:'مكامن الخام',terms:['خام','الخام','مكامن','ore','mineral','minerals']},
        {label:'تخطيط الاستخراج',terms:['استخراج','الاستخراج','استخلاص','الاستخلاص','استخراج المعادن','extraction','explosives','متفجرات','المتفجرات']},
        {label:'جودة الخام',terms:['جودة الخام','نقاوة','التنقيب','ore quality','ore bodies','exploration']}
      ],
      scenario:'تخطيط استخراج المعادن من مكامن الخام، وتحسين جودة الخام وتطوير عمليات التعدين مع توثيق البيانات التشغيلية.',
      taxonomyUnit:'2146',taxonomyLabel:'مهندسو التعدين'
    }
  ],
  scenarios:[
    {id:'industrial',title:'كفاءة التشغيل',subtitle:'موارد أفضل، ازدواجية أقل',icon:'chart'},
    {id:'civil',title:'جودة المشاريع',subtitle:'من التصميم إلى التنفيذ',icon:'building'},
    {id:'mechanical',title:'اعتمادية المعدات',subtitle:'صيانة وتوقفات أقل',icon:'gear'},
    {id:'emerging',title:'دور خارج العينة',subtitle:'متى نُحيل للمراجعة؟',icon:'spark'}
  ],
  emergingObjective:'تصميم حلول الذكاء الاصطناعي التوليدي، وبناء تطبيقات النماذج اللغوية وحوكمتها وتقييم مخرجاتها.',
  seniority:{professional:'ممارس مهني',junior:'بداية المسار',senior:'خبرة متقدمة',leadership:'قيادي / إداري'}
};
