const fs = require('node:fs');
const crypto = require('node:crypto');

const OUTCOMES = ['jdAccepted', 'gradeAccepted', 'salaryAccepted', 'scopeSafetyAccepted'];
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const dateMs = value => isText(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const list = value => Array.isArray(value) ? value : [];
const acceptedOutcome = value => OUTCOMES.every(key => value[key] === true);
const completeOutcome = value => [...OUTCOMES, 'criticalFailure'].every(key => typeof value[key] === 'boolean');
function canonical(value) {
 if (Array.isArray(value)) return value.map(canonical);
 if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
 return value;
}
function serializeManifest(value) {
 return JSON.stringify(canonical(value));
}
function sha256Manifest(value) {
 return crypto.createHash('sha256').update(serializeManifest(value)).digest('hex');
}
// Outcomes are deliberately excluded: this snapshot must be frozen before evaluation.
function freezeManifestFor(m) {
 const d = m?.professionalDataset || {}, f = d.freezeEvidence || {}, holdout = d.holdout || {};
 return {
  schema: 'miyar-professional-reference-freeze/1.0',
  sourceType: d.sourceType || null,
  independentReviewer: d.independentReviewer || null,
  frozenAt: f.frozenAt || null,
  acceptancePolicy: d.acceptancePolicy || null,
  holdoutDeclaredBeforeEvaluation: holdout.declaredBeforeEvaluation === true,
  holdoutCaseIds: list(holdout.caseIds),
  files: list(f.files).map(file => ({ reference: file?.reference || null, sha256: file?.sha256 || null })),
  cases: list(d.cases).map(c => ({
   id: c?.id || null, family: c?.family || null, sourceReference: c?.sourceReference || null,
   referenceJD: c?.referenceJD || null, referenceGrade: c?.referenceGrade || null,
   referenceSalary: c?.referenceSalary || null, reviewedBy: c?.reviewedBy || null
  }))
 };
}
function assess(m) {
 m = m && typeof m === 'object' ? m : {};
 const blockers = [], h = m.hosting || {}, d = m.professionalDataset || {}, p = d.acceptancePolicy || {};
 const cases = list(d.cases).map(c => c && typeof c === 'object' ? c : {});
 const f = d.freezeEvidence || {}, e = d.evaluation || {}, holdout = d.holdout || {};
 if (h.country !== 'SA' || h.backupCountry !== 'SA' || h.paidCapacity !== true || h.databasePaid !== true || !isText(h.restoreTestEvidence) || !isText(h.residencyReviewedBy) || !isText(h.contractReference)) blockers.push('Saudi paid hosting, residency review and restore evidence missing');
 if (d.sourceType !== 'real-anonymized-organization-jobs' || !isText(d.independentReviewer) || d.frozenBeforeEvaluation !== true || !isHash(d.sha256) || d.status !== 'expert-reviewed') blockers.push('Independent frozen real-job reference dataset missing');
 const evaluationStartedAt = dateMs(e.startedAt), frozenAt = dateMs(f.frozenAt), policyApprovedAt = dateMs(p.approvedAt);
 if (!isText(p.approvedBy) || p.approvedBeforeEvaluation !== true || !Number.isFinite(p.minimumAcceptedFraction) || p.minimumAcceptedFraction <= 0 || p.minimumAcceptedFraction > 1 || !isText(p.gradeTolerance) || !isText(p.salaryTolerance) || !Number.isFinite(policyApprovedAt) || !(policyApprovedAt <= frozenAt)) blockers.push('Pre-agreed professional acceptance policy missing');
 const validIds = cases.every(c => isText(c.id));
 const families = new Set(cases.filter(c => isText(c.family)).map(c => c.family));
 if (cases.length < 30 || cases.length > 50 || !validIds || new Set(cases.map(c => c.id)).size !== cases.length || !cases.every(c => isText(c.family)) || families.size < 6) blockers.push('Need 30–50 unique reviewed cases across at least six families');
 const files = list(f.files), fileReferences = new Set(files.map(file => file?.reference));
 if (!isText(f.manifestReference) || !isHash(f.manifestSha256) || !isText(f.approvalEvidenceReference) || !isHash(f.approvalEvidenceSha256) || !Number.isFinite(frozenAt) || !Number.isFinite(evaluationStartedAt) || !(frozenAt < evaluationStartedAt) || files.length === 0 || fileReferences.size !== files.length || files.some(file => !isText(file?.reference) || !isHash(file?.sha256)) || f.manifestSha256 !== sha256Manifest(freezeManifestFor(m)) || d.sha256 !== f.manifestSha256) blockers.push('Frozen reference checksum manifest and pre-evaluation freeze evidence missing or inconsistent');
 if (!isText(e.evidenceReference)) blockers.push('Recorded evaluation evidence missing');
 let accepted = 0;
 for (const c of cases) {
  const salary = c.referenceSalary || {};
  if (!isText(c.sourceReference) || !isText(c.referenceJD) || !isText(c.referenceGrade) || !isText(salary.source) || !isText(salary.period) || !isText(salary.currency) || !Number.isFinite(salary.amount) || salary.amount < 0 || !isText(c.reviewedBy) || !fileReferences.has(c.sourceReference) || !fileReferences.has(salary.source)) blockers.push('Incomplete independent reference evidence: ' + (c.id || '(missing ID)'));
  if (!completeOutcome(c)) blockers.push('Incomplete recorded case outcomes: ' + (c.id || '(missing ID)'));
  if (c.criticalFailure === true) blockers.push('Critical professional failure: ' + c.id);
  if (acceptedOutcome(c)) accepted++;
 }
 const acceptanceFraction = cases.length ? accepted / cases.length : null;
 if (acceptanceFraction === null || !Number.isFinite(p.minimumAcceptedFraction) || acceptanceFraction < p.minimumAcceptedFraction) blockers.push('Professional acceptance threshold not demonstrated');
 const holdoutIds = list(holdout.caseIds), results = list(holdout.results).map(r => r && typeof r === 'object' ? r : {});
 const caseIds = new Set(cases.map(c => c.id));
 if (holdout.declaredBeforeEvaluation !== true || holdoutIds.length === 0 || holdoutIds.length >= cases.length || new Set(holdoutIds).size !== holdoutIds.length || holdoutIds.some(id => !isText(id) || !caseIds.has(id))) blockers.push('Predeclared distinct holdout case IDs missing or invalid');
 const resultIds = new Set(results.map(result => result.caseId));
 if (results.length !== holdoutIds.length || resultIds.size !== results.length || holdoutIds.some(id => !resultIds.has(id)) || results.some(result => !holdoutIds.includes(result.caseId))) blockers.push('Actual results for every predeclared holdout case missing or inconsistent');
 let acceptedHoldout = 0;
 for (const result of results) {
  const evaluatedAt = dateMs(result.evaluatedAt), recordedCase = cases.find(c => c.id === result.caseId);
  if (!completeOutcome(result) || !isText(result.outputReference) || !isHash(result.outputSha256) || !isText(result.assessmentEvidenceReference) || !isHash(result.assessmentEvidenceSha256) || !Number.isFinite(evaluatedAt) || !Number.isFinite(evaluationStartedAt) || evaluatedAt < evaluationStartedAt) blockers.push('Incomplete recorded holdout evidence: ' + (result.caseId || '(missing ID)'));
  if (recordedCase && [...OUTCOMES, 'criticalFailure'].some(key => result[key] !== recordedCase[key])) blockers.push('Holdout outcome disagrees with recorded case: ' + result.caseId);
  if (result.criticalFailure === true) blockers.push('Critical professional failure: ' + result.caseId);
  if (acceptedOutcome(result)) acceptedHoldout++;
 }
 const holdoutAcceptanceFraction = holdoutIds.length ? acceptedHoldout / holdoutIds.length : null;
 if (holdoutAcceptanceFraction === null || !Number.isFinite(p.minimumAcceptedFraction) || holdoutAcceptanceFraction < p.minimumAcceptedFraction) blockers.push('Holdout professional acceptance threshold not demonstrated');
 if (m.frameworkCalibration?.approved !== true || !isText(m.frameworkCalibration?.evidence)) blockers.push('Illustrative job evaluation requires independent calibration');
 return {
  commercialReady: blockers.length === 0, acceptedCases: accepted, totalCases: cases.length, acceptanceFraction,
  acceptedHoldoutCases: acceptedHoldout, totalHoldoutCases: holdoutIds.length, holdoutAcceptanceFraction,
  familyCoverage: families.size, blockers: [...new Set(blockers)],
  notice: 'Evidence-completeness gate over recorded expert assessments and checksums. It does not read or authenticate the referenced files, establish reviewer identity, verify real-job provenance, or independently certify professional validity.'
 };
}
module.exports = { assess, freezeManifestFor, serializeManifest, sha256Manifest };
if (require.main === module) {
 const args = process.argv.slice(2), file = args.find(x => !x.startsWith('--')) || 'docs/expert-review/launch-readiness.json';
 const result = assess(JSON.parse(fs.readFileSync(file)));
 console.log(JSON.stringify(result, null, 2));
 if (args.includes('--require-commercial') && !result.commercialReady) process.exitCode = 1;
}
