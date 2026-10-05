'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../dist/role-recommender.js');
const C = require('../dist/compensation-engine.js');
const nodes = require('../dist/classifications/ssco-2019.json').nodes;
const education = require('../dist/classifications/education-2020.json').fields;
require('../dist/od-engine.js');
require('../dist/od-engine-priority.js');
require('../dist/qa-od-v5.js');
const E = globalThis.MiyarODEngine;

// Cases 1–14 come from the attached Oct 5 expert report. English translations
// and the further counterexamples below are authored regression checks, not an
// independent golden set or evidence of expert-approved production accuracy.
// Keep objectives neutral so a strategic slogan cannot invent role ownership.
function input(domain, responsibilities, locale = 'en', extra = {}) {
  return {
    department: domain,
    strategyObjective: locale === 'ar' ? 'تحقيق أهداف الإدارة من خلال المسؤوليات المحددة.' : 'Deliver department objectives through the assigned responsibilities.',
    responsibilities,
    ...extra
  };
}

function recommendation(value) {
  return R.recommend(value, nodes, education);
}

function assertRole(value, expected, locale = 'en') {
  const r = recommendation(value);
  assert.ok(r, 'supported duties must produce a reviewable recommendation');
  assert.equal(r.status, 'proposed-for-review');
  assert.ok(r.finalTitle, 'the title must survive all blocking checks');
  if (expected.family) assert.equal(r.candidate.family, expected.family);
  if (expected.level) assert.equal(r.candidate.level, expected.level);
  const title = locale === 'ar' ? r.candidate.titleAr : r.candidate.titleEn;
  if (expected.title) assert.match(title, expected.title);
  if (expected.notTitle) assert.doesNotMatch(title, expected.notTitle);
  if (expected.directReports !== undefined) assert.equal(r.directReports, expected.directReports);
  const p = E.generate(value, locale);
  assert.equal(p.family.id, r.candidate.family, 'Quick Trial and OD must retain the same home family');
  assert.equal(p.gradeRecommendation.level, r.candidate.level, 'OD must retain the shared evidence-based level');
  assert.equal(p.gradeRecommendation.status, 'pre-evaluation');
  assert.equal(p.content.title, title, 'OD must not replace the validated title with a specialist template');
  assert.equal(p.content.finalProposedTitle, title);
  if (expected.conflict !== undefined) {
    assert.equal(Boolean(r.detection.conflict), expected.conflict);
    assert.equal(r.checks.find(c => c.id === 'domain').status, expected.conflict ? 'warn' : 'pass');
    if (!expected.conflict) assert.equal(p.notices.some(n => /Domain conflict|تعارض مجال/.test(n)), false);
  }
  return {r, p};
}

function assertRejected(value, locale = 'en', reason) {
  let r, failure;
  try { r = recommendation(value); } catch (error) { failure = error; }
  assert.ok(failure || r === null || (r.status === 'blocked' && r.finalTitle === null),
    'rejected input must not expose a usable job recommendation');
  if (reason && failure) assert.match(failure.message, reason);
  assert.throws(() => E.generate(value, locale), reason,
    'OD must reject the same input instead of generating a fallback job');
}

const reportRoles = [
  {id: 1, locale: 'ar', department: 'المالية', duties: 'يقود 25 محاسبًا، يعتمد القوائم الموحدة، يعرض الميزانية على المجلس', expected: {family: 'finance', level: 'director', directReports: 25, title: /مدير|رئيس/, notTitle: /أخصائي|محلل/}},
  {id: 2, locale: 'ar', department: 'المالية', duties: 'قيادة فريق من ٢٥ محاسبًا، اعتماد القوائم، عرض الميزانية على المجلس', expected: {family: 'finance', level: 'director', directReports: 25, title: /مدير|رئيس/, notTitle: /أخصائي|محلل/}},
  {id: 3, locale: 'ar', department: 'الموارد البشرية', duties: 'قيادة إدارة من 40 موظفًا، اعتماد سياسات التعويضات، الرفع للرئيس التنفيذي', expected: {family: 'hc', level: 'director', directReports: 40, title: /مدير.*موارد|رئيس.*موارد/, notTitle: /أخصائي/}},
  {id: 4, locale: 'en', department: 'الهندسة', duties: 'Manage a team of 10 engineers، مراجعة التصاميم، اعتماد المخططات', expected: {level: 'manager', directReports: 10, title: /Manager/i, notTitle: /Specialist|Analyst/i}},
  {id: 5, locale: 'ar', department: 'المالية', duties: 'مسؤول عن قيادة فريق من 6 محاسبين، اعتماد القيود', expected: {family: 'finance', level: 'manager', directReports: 6, title: /مدير|رئيس/, notTitle: /أخصائي|محلل/}},
  {id: 6, locale: 'ar', department: 'المالية', duties: 'إدخال فواتير الموردين، مطابقتها بأوامر الشراء، أرشفة المستندات', expected: {family: 'finance', level: 'assistant', title: /محاسب|حسابات دائنة/, notTitle: /محلل|مدير/}},
  {id: 9, locale: 'ar', department: 'المرافق', duties: 'صيانة وقائية للتكييف، إصلاح الأعطال الكهربائية، تسجيل أوامر العمل', expected: {family: 'maintenance', title: /فني.*صيانة/, notTitle: /مهندس/}},
  {id: 10, locale: 'ar', department: 'الموارد البشرية', duties: 'إعداد الرواتب الشهرية، تسوية التأمينات، حساب نهاية الخدمة', expected: {family: 'hc', level: 'specialist', title: /أخصائي.*رواتب/, conflict: false}}
];
for (const row of reportRoles) test(`expert report mandatory case ${row.id}`, () => {
  assertRole(input(row.department, row.duties, row.locale), row.expected, row.locale);
});

for (const [phrase, expected] of [
  ['Lead a team of 25 accountants', 'manager'],
  ['Manage a team of 10 engineers', 'manager'],
  ['مسؤول عن قيادة فريق من 10 محاسبين', 'manager'],
  ['Director of accounting', 'director'],
  ['Head of Finance', 'director'],
  ['Prepare accounting entries and report to the Finance Director', 'specialist'],
  ['Prepare bank reconciliations and present financial statements to the board', 'specialist']
]) test(`expert root-cause seniority evidence: ${phrase}`, () => {
  assert.equal(R.level({responsibilities: phrase}), expected,
    'people leadership, own title and reporting recipient must be interpreted separately');
});

test('expert report mandatory case 7: financial department cannot generate a nursing job', () => {
  assertRejected(input('المالية', 'إعطاء الأدوية، مراقبة العلامات الحيوية، توثيق خطط الرعاية', 'ar'), 'ar', /conflict|تعارض|صحح|صحّح|تشير/i);
});
test('expert report mandatory case 8: kitchen cost does not establish an accounting family', () => {
  assertRejected(input('الأغذية والمشروبات', 'تحضير الأطباق، إدارة مخزون المطبخ وتكلفة الطعام، الإشراف على الطهاة', 'ar'), 'ar', /supported|خارج|غير مدعوم|تعذر/i);
});

function privacyError(rosterCsv, forbiddenValue, expectedKind) {
  let failure;
  try { C.evaluate({...C.example, rosterCsv}); } catch (error) { failure = error; }
  assert.ok(failure, 'sensitive roster data must be rejected before returning results');
  assert.match(failure.message, /row\s+2|السطر\s+2|الصف\s+2/i, 'validation identifies the CSV row');
  assert.match(failure.message, expectedKind, 'validation identifies the sensitive pattern type');
  assert.equal(failure.message.includes(forbiddenValue), false, 'validation must not repeat the sensitive value');
}
test('expert report mandatory case 11: national identifier is rejected and redacted', () => {
  privacyError('id,currentSalary\n1012345678,25000', '1012345678', /national|iqama|هوية|إقامة/i);
});
test('expert report mandatory case 12: personal name masquerading as an identifier is rejected', () => {
  privacyError('id,currentSalary\nMohammed_Alharbi,25000', 'Mohammed_Alharbi', /name|اسم/i);
});
test('expert report mandatory case 13: personal name in progression evidence is rejected', () => {
  privacyError('id,currentSalary,progressionEvidence\nE17,25000,Mohammed Alharbi', 'Mohammed Alharbi', /name|اسم/i);
});

const saudi = {
  mode: 'saudi', regime: 'saudi-new', applicabilityConfirmed: true,
  sanedEligible: true, housingMonthly: 0, otherMonthly: 0,
  contributoryExtraMonthly: 0, medicalAnnual: 0, serviceYears: 2
};
test('expert report mandatory case 14: August 2027 uses the published 10.5% pension phase', () => {
  const value = C.saudiCost(10000, 'monthly', {...saudi, asOf: '2027-08-01'});
  assert.equal(value.pensionRate, 10.5);
  assert.equal(value.employerRatePercent, 13.25, 'pension, SANED and occupational contributions are distinct components');
  assert.equal(value.annualGosi, 15900);
});

const translations = [
  ['finance director', 'Finance', 'Lead 25 accountants; approve consolidated financial statements; present the budget to the board.', {family: 'finance', level: 'director', directReports: 25, title: /Director|Head/i}],
  ['HR director', 'Human Resources', 'Lead a department of 40 employees; approve compensation policies; report to the Chief Executive.', {family: 'hc', level: 'director', directReports: 40, title: /Director|Head/i}],
  ['engineering manager', 'Engineering', 'Manage a team of 10 engineers; review engineering designs; approve drawings.', {level: 'manager', directReports: 10, title: /Manager/i}],
  ['accounting manager', 'Finance', 'Responsible for leading a team of 6 accountants; approve accounting entries.', {family: 'finance', level: 'manager', directReports: 6, title: /Manager|Chief Accountant/i}],
  ['invoice clerk', 'Finance', 'Enter supplier invoices; match invoices to purchase orders; archive supporting documents.', {family: 'finance', level: 'assistant', title: /Accountant|Accounts Payable Clerk/i, notTitle: /Analyst|Manager/i}],
  ['maintenance technician', 'Facilities', 'Perform preventive maintenance on air conditioning; repair electrical faults; record work orders.', {family: 'maintenance', title: /Maintenance Technician/i, notTitle: /Engineer/i}],
  ['payroll specialist', 'Human Resources', 'Prepare monthly payroll; reconcile social insurance contributions; calculate end of service benefits.', {family: 'hc', level: 'specialist', title: /Payroll Specialist/i, conflict: false}]
];
for (const [name, domain, duties, expected] of translations) test(`authored English translation: ${name}`, () => {
  assertRole(input(domain, duties), expected);
});

for (const [name, domain, duties, reason] of [
  ['nursing work conflicts with finance', 'Finance', 'Administer medication; monitor vital signs; document patient care plans.', /conflict|correct|indicate/i],
  ['food-cost phrase cannot promote a chef to accountant', 'Food and Beverage', 'Prepare meals; manage kitchen inventory and food cost; supervise chefs.', /supported|outside/i]
]) test(`authored English rejection: ${name}`, () => assertRejected(input(domain, duties), 'en', reason));

for (const [locale, domain, duties, reports] of [
  ['ar', 'المالية', 'يشرف على ٨ محاسبين مباشرين؛ يعتمد التسويات البنكية؛ يوزع المهام اليومية على الفريق.', 8],
  ['en', 'Finance', 'Supervise 8 direct reports in accounting; sign off bank reconciliations; allocate daily team assignments.', 8],
  ['ar', 'المالية', 'يدير فريقًا من ١٢ محاسبًا؛ يعتمد القيود المحاسبية؛ يراجع إقفال الحسابات.', 12],
  ['en', 'Finance', 'Manage a team of 12 accountants; approve accounting entries; review the financial close.', 12]
]) test(`authored unseen team-and-authority evidence ${locale} ${reports}`, () => {
  assertRole(input(domain, duties, locale), {family: 'finance', level: 'manager', directReports: reports}, locale);
});

for (const [locale, domain, duties] of [
  ['ar', 'المالية', 'إعداد القيود المحاسبية؛ تسوية الحسابات البنكية؛ رفع التقارير للمدير المالي دون إدارة فريق أو صلاحية اعتماد.'],
  ['en', 'Finance', 'Prepare accounting entries; reconcile bank accounts; report results to the Finance Director without managing a team or approval authority.']
]) test(`authored reporting recipient and excluded leadership are not own seniority ${locale}`, () => {
  assertRole(input(domain, duties, locale), {family: 'finance', level: 'specialist', notTitle: /Director|Manager|مدير|رئيس/i}, locale);
});

for (const [locale, domain, duties] of [
  ['ar', 'المشتريات', 'يدير تدفق أوامر الشراء؛ يتابع طلبات العروض وعقود الموردين؛ لا يتولى إدارة فريق.'],
  ['en', 'Procurement', 'Manage the purchase order workflow; follow up supplier contracts and RFPs; does not manage a team.']
]) test(`authored managing a workflow does not establish people leadership ${locale}`, () => {
  assertRole(input(domain, duties, locale), {family: 'procurement', level: 'specialist', notTitle: /Manager|Director|مدير|رئيس/i}, locale);
});

for (const [locale, domain, duties] of [
  ['ar', 'الموارد البشرية', 'أرشفة ملفات الموظفين؛ إدخال طلبات الإجازة؛ تنفيذ إجراءات شؤون الموظفين المعتمدة.'],
  ['en', 'Human Resources', 'Archive employee records; enter leave requests; execute approved personnel administration procedures.']
]) test(`authored routine HR processing retains a coordinator or assistant title ${locale}`, () => {
  assertRole(input(domain, duties, locale), {family: 'hc', level: 'assistant', title: locale === 'ar' ? /منسق|مساعد/ : /Coordinator|Assistant/i, notTitle: /Analyst|Manager|محلل|مدير/i}, locale);
});

for (const [locale, domain, duties] of [
  ['ar', 'التسويق', 'تسوية الحسابات البنكية؛ تسجيل القيود المحاسبية؛ إقفال الحسابات المالية.'],
  ['en', 'Marketing', 'Reconcile bank accounts; record accounting entries; close the financial accounts.']
]) test(`authored severe conflict outside finance-nursing example ${locale}`, () => {
  assertRejected(input(domain, duties, locale), locale, /conflict|correct|indicate|تعارض|صحح|صحّح|تشير/i);
});

for (const [locale, domain, duties] of [
  ['ar', 'المالية', 'إعداد الرواتب الشهرية؛ تسوية اشتراكات التأمينات؛ حساب مكافأة نهاية الخدمة.'],
  ['en', 'Finance', 'Prepare monthly payroll; reconcile social insurance contributions; calculate end of service benefits.']
]) test(`authored payroll in finance remains reviewable with domain warning ${locale}`, () => {
  assertRole(input(domain, duties, locale), {conflict: true}, locale);
});

test('authored generic cost/budget/report words cannot establish an unsupported family', () => {
  assertRejected(input('Food and Beverage', 'Prepare a cost report; update the budget report; monitor monthly cost.'), 'en', /supported|outside/i);
});
test('authored routine invoice entry remains a clerk even when it includes a monthly report', () => {
  assertRole(input('Finance', 'Enter supplier invoices; match invoices to purchase orders; archive documents; prepare a monthly report.'),
    {family: 'finance', level: 'assistant', title: /Accountant|Accounts Payable Clerk/i, notTitle: /Financial Analyst|Manager/i});
});

for (const [locale, domain, duties] of [
  ['ar', 'تقنية المعلومات', 'تدريب نماذج تعلم الآلة للتنبؤ؛ هندسة الخصائص للبيانات؛ تقييم دقة النماذج وانحرافها.'],
  ['en', 'Data Science', 'Train predictive machine learning models; engineer data features; evaluate model accuracy and drift.']
]) test(`expert narrative: data science retains a specialized title and relevant measures ${locale}`, () => {
  const {p} = assertRole(input(domain, duties, locale), {
    family: 'it', level: 'specialist', title: locale === 'ar' ? /عالم.*بيانات|أخصائي.*علم.*بيانات/ : /Data Scientist/i
  }, locale);
  assert.ok(p.content.kpis.length >= 2, 'data science needs more than a single generic service KPI');
  assert.ok(p.content.kpis.filter(k => /model|accuracy|precision|drift|prediction|rmse|auc|f1|نموذج|نماذج|دقة|انحراف|تنبؤ/i.test(k.metric)).length >= 2,
    'at least two measures must describe model or prediction quality');
});

for (const [locale, domain, duties] of [
  ['ar', 'الهندسة', 'تصميم الأنظمة الهندسية؛ حساب الأحمال الهندسية؛ مراجعة المخططات ضمن ترخيص هندسي مهني.'],
  ['en', 'Engineering', 'Design engineering systems; calculate engineering loads; review engineering drawings under a professional engineering licence.']
]) test(`authored engineering design and licensed calculations justify an engineer title ${locale}`, () => {
  assertRole(input(domain, duties, locale), {
    level: 'specialist', title: locale === 'ar' ? /مهندس/ : /Engineer/i,
    notTitle: /Technician|فني/i
  }, locale);
});

for (const [value, kind] of [
  ['2456789012', /national|iqama|هوية|إقامة/i],
  ['EMP-1012345678', /national|iqama|هوية|إقامة/i],
  ['١٠١٢٣٤٥٦٧٨', /national|iqama|هوية|إقامة/i],
  ['0501234567', /phone|mobile|هاتف|جوال/i],
  ['966501234567', /phone|mobile|هاتف|جوال/i],
  ['person@example.test', /email|بريد/i]
]) test(`authored roster sensitive-pattern rejection ${value}`, () => {
  privacyError(`id,currentSalary\n${value},25000`, value, kind);
});
test('authored Arabic personal name in evidence is rejected', () => {
  privacyError('id,currentSalary,progressionEvidence\nE17,25000,محمد الحربي', 'محمد الحربي', /name|اسم/i);
});
test('authored sensitive identifier inside evidence is also rejected', () => {
  privacyError('id,currentSalary,progressionEvidence\nE17,25000,Assessment ref 2456789012 approved', '2456789012', /national|iqama|هوية|إقامة/i);
});
test('expert allowed aliases and ordinary professional evidence remain usable', () => {
  const value = C.evaluate({...C.example, rosterCsv: 'id,currentSalary,progressionEvidence\nEMP-0001,25000,Documented full role proficiency\nE17,25000,Approved annual assessment completed'});
  assert.deepEqual(value.incumbents.map(row => row.id), ['EMP-0001', 'E17']);
  assert.equal(value.result.annualBasePayroll, 600000);
});
