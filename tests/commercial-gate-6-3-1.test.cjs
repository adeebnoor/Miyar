const test = require('node:test');
const assert = require('node:assert/strict');
const { assess, freezeManifestFor, sha256Manifest } = require('../scripts/check-professional-readiness.cjs');

const hash = 'a'.repeat(64);
const pass = { jdAccepted: true, gradeAccepted: true, salaryAccepted: true, scopeSafetyAccepted: true, criticalFailure: false };
// Synthetic unit-test records only. This fixture is never launch or expert evidence.
function fixture() {
 const cases = Array.from({ length: 30 }, (_, i) => ({
  id: `unit-test-${i}`, family: `unit-test-family-${i % 6}`,
  sourceReference: 'unit-test-job-file', referenceJD: 'Unit-test reference text', referenceGrade: 'Unit-test grade',
  referenceSalary: { amount: 10000, source: 'unit-test-pay-file', period: 'monthly', currency: 'SAR' },
  reviewedBy: 'unit-test-reviewer', ...pass
 }));
 const m = {
  hosting: { country: 'SA', backupCountry: 'SA', paidCapacity: true, databasePaid: true, restoreTestEvidence: 'unit-test-restore', residencyReviewedBy: 'unit-test-reviewer', contractReference: 'unit-test-contract' },
  professionalDataset: {
   sourceType: 'real-anonymized-organization-jobs', independentReviewer: 'unit-test-reviewer', frozenBeforeEvaluation: true, status: 'expert-reviewed',
   acceptancePolicy: { approvedBy: 'unit-test-reviewer', approvedBeforeEvaluation: true, approvedAt: '2026-10-01T09:00:00Z', minimumAcceptedFraction: 0.8, gradeTolerance: 'Exact grade', salaryTolerance: 'Within recorded tolerance' },
   freezeEvidence: { frozenAt: '2026-10-01T10:00:00Z', manifestReference: 'unit-test-manifest', approvalEvidenceReference: 'unit-test-freeze-approval', approvalEvidenceSha256: hash, files: [{ reference: 'unit-test-job-file', sha256: hash }, { reference: 'unit-test-pay-file', sha256: hash }] },
   evaluation: { startedAt: '2026-10-02T10:00:00Z', evidenceReference: 'unit-test-evaluation-log' },
   holdout: { declaredBeforeEvaluation: true, caseIds: cases.slice(-6).map(c => c.id), results: cases.slice(-6).map(c => ({ caseId: c.id, evaluatedAt: '2026-10-02T11:00:00Z', outputReference: `unit-test-output-${c.id}`, outputSha256: hash, assessmentEvidenceReference: `unit-test-assessment-${c.id}`, assessmentEvidenceSha256: hash, ...pass })) },
   cases
  },
  frameworkCalibration: { approved: true, evidence: 'unit-test-calibration' }
 };
 seal(m);
 return m;
}
function seal(m) {
 const digest = sha256Manifest(freezeManifestFor(m));
 m.professionalDataset.sha256 = digest;
 m.professionalDataset.freezeEvidence.manifestSha256 = digest;
}
function expectBlocked(m, message) {
 const result = assess(m);
 assert.equal(result.commercialReady, false);
 assert.ok(result.blockers.some(blocker => blocker.includes(message)), JSON.stringify(result.blockers));
}

test('a complete recorded-evidence fixture reports separate holdout coverage without certifying referenced evidence', () => {
 const r = assess(fixture());
 assert.equal(r.commercialReady, true);
 assert.equal(r.totalCases, 30);
 assert.equal(r.familyCoverage, 6);
 assert.equal(r.totalHoldoutCases, 6);
 assert.equal(r.holdoutAcceptanceFraction, 1);
 assert.match(r.notice, /does not read or authenticate/);
});

test('current launch manifest remains blocked including missing calibration', () => {
 const r = assess(require('../docs/expert-review/launch-readiness.json'));
 assert.equal(r.commercialReady, false);
 assert.ok(r.blockers.some(x => x.includes('independent calibration')));
 assert.equal(r.totalHoldoutCases, 0);
});

test('the independent real-job pool requires 30–50 unique IDs and at least six named families', () => {
 for (const mutate of [m => m.professionalDataset.cases.pop(), m => { m.professionalDataset.cases.push(...Array.from({ length: 21 }, (_, i) => ({ ...m.professionalDataset.cases[0], id: `extra-${i}` }))); }, m => { m.professionalDataset.cases[0].id = m.professionalDataset.cases[1].id; }, m => m.professionalDataset.cases.forEach(c => { c.family = 'only-one'; })]) {
  const m = fixture(); mutate(m); seal(m); expectBlocked(m, '30–50');
 }
 const m = fixture(); m.professionalDataset.sourceType = 'authored-test-fixtures-only'; seal(m); expectBlocked(m, 'Independent');
});

test('reference salaries reject missing, nonnumeric, nonfinite and negative amounts', () => {
 for (const amount of [undefined, null, '10000', NaN, Infinity, -1]) {
  const m = fixture(); m.professionalDataset.cases[0].referenceSalary.amount = amount; seal(m); expectBlocked(m, 'Incomplete independent reference');
 }
 const m = fixture(); m.professionalDataset.cases[0].referenceSalary.amount = 0; seal(m); assert.equal(assess(m).commercialReady, true);
});

test('the frozen reference manifest detects altered references and altered holdout IDs', () => {
 const salary = fixture(); salary.professionalDataset.cases[0].referenceSalary.amount += 1; expectBlocked(salary, 'checksum manifest');
 const holdout = fixture(); holdout.professionalDataset.holdout.caseIds[0] = 'unit-test-0'; expectBlocked(holdout, 'checksum manifest');
 const files = fixture(); files.professionalDataset.freezeEvidence.files[0].sha256 = 'b'.repeat(64); expectBlocked(files, 'checksum manifest');
});

test('a freeze needs artifact checksums, reference-file coverage and chronological approval', () => {
 for (const mutate of [m => { m.professionalDataset.freezeEvidence.approvalEvidenceSha256 = null; }, m => { m.professionalDataset.freezeEvidence.files = []; }, m => { m.professionalDataset.freezeEvidence.frozenAt = m.professionalDataset.evaluation.startedAt; }, m => { m.professionalDataset.acceptancePolicy.approvedAt = '2026-10-03T00:00:00Z'; }]) {
  const m = fixture(); mutate(m); seal(m); assert.equal(assess(m).commercialReady, false);
 }
 const m = fixture(); m.professionalDataset.cases[0].referenceSalary.source = 'unhashed-file'; seal(m); expectBlocked(m, 'Incomplete independent reference');
});

test('holdout IDs must be predeclared, nonempty, unique, in the pool and a proper subset', () => {
 for (const mutate of [m => { m.professionalDataset.holdout.declaredBeforeEvaluation = false; }, m => { m.professionalDataset.holdout.caseIds = []; }, m => { m.professionalDataset.holdout.caseIds[0] = m.professionalDataset.holdout.caseIds[1]; }, m => { m.professionalDataset.holdout.caseIds[0] = 'outside-pool'; }, m => { m.professionalDataset.holdout.caseIds = m.professionalDataset.cases.map(c => c.id); }]) {
  const m = fixture(); mutate(m); seal(m); expectBlocked(m, 'holdout case IDs');
 }
});

test('actual holdout outputs and independent assessment evidence are mandatory for every ID', () => {
 for (const mutate of [m => m.professionalDataset.holdout.results.pop(), m => { m.professionalDataset.holdout.results[0].outputSha256 = null; }, m => { m.professionalDataset.holdout.results[0].assessmentEvidenceReference = ''; }, m => { m.professionalDataset.holdout.results[0].evaluatedAt = '2026-10-01T11:00:00Z'; }, m => { delete m.professionalDataset.holdout.results[0].salaryAccepted; }, m => { m.professionalDataset.holdout.results[0].caseId = m.professionalDataset.holdout.results[1].caseId; }]) {
  const m = fixture(); mutate(m); assert.equal(assess(m).commercialReady, false);
 }
});

test('good aggregate performance cannot mask a failed holdout threshold', () => {
 const m = fixture();
 for (const result of m.professionalDataset.holdout.results.slice(0, 2)) {
  result.jdAccepted = false;
  m.professionalDataset.cases.find(c => c.id === result.caseId).jdAccepted = false;
 }
 const r = assess(m);
 assert.ok(r.acceptanceFraction > 0.8);
 assert.ok(r.holdoutAcceptanceFraction < 0.8);
 expectBlocked(m, 'Holdout professional acceptance');
});

test('contradictory outcomes and any critical failure veto commercial readiness', () => {
 const disagreement = fixture(); disagreement.professionalDataset.holdout.results[0].salaryAccepted = false; expectBlocked(disagreement, 'disagrees');
 const critical = fixture(); critical.professionalDataset.cases[0].criticalFailure = true; expectBlocked(critical, 'Critical professional failure');
});
