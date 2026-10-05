const fs=require('node:fs');
function assess(m){
 const blockers=[],h=m.hosting||{},d=m.professionalDataset||{},p=d.acceptancePolicy||{},cases=d.cases||[];
 if(h.country!=='SA'||h.backupCountry!=='SA'||h.paidCapacity!==true||h.databasePaid!==true||!h.restoreTestEvidence||!h.residencyReviewedBy||!h.contractReference)blockers.push('Saudi paid hosting, residency review and restore evidence missing');
 if(d.sourceType!=='real-anonymized-organization-jobs'||!d.independentReviewer||d.frozenBeforeEvaluation!==true||!/^([a-f0-9]{64})$/.test(d.sha256||'')||d.status!=='expert-reviewed')blockers.push('Independent frozen real-job reference dataset missing');
 if(!p.approvedBy||!p.approvedBeforeEvaluation||!Number.isFinite(p.minimumAcceptedFraction)||p.minimumAcceptedFraction<=0||p.minimumAcceptedFraction>1||!p.gradeTolerance||!p.salaryTolerance)blockers.push('Pre-agreed professional acceptance policy missing');
 if(cases.length<30||cases.length>50||new Set(cases.map(x=>x.id)).size!==cases.length||new Set(cases.map(x=>x.family)).size<6)blockers.push('Need 30–50 unique reviewed cases across at least six families');
 let accepted=0;for(const c of cases){if(!c.sourceReference||!c.referenceJD||!c.referenceGrade||!c.referenceSalary?.source||!c.referenceSalary?.period||!c.referenceSalary?.currency||!c.reviewedBy)blockers.push('Incomplete independent reference evidence: '+c.id);if(c.criticalFailure===true)blockers.push('Critical professional failure: '+c.id);if(c.jdAccepted===true&&c.gradeAccepted===true&&c.salaryAccepted===true&&c.scopeSafetyAccepted===true)accepted++;}
 const acceptanceFraction=cases.length?accepted/cases.length:null;if(acceptanceFraction===null||acceptanceFraction<p.minimumAcceptedFraction)blockers.push('Professional acceptance threshold not demonstrated');
 if(m.frameworkCalibration?.approved!==true||!m.frameworkCalibration?.evidence)blockers.push('Illustrative job evaluation requires independent calibration');
 return {commercialReady:blockers.length===0,acceptedCases:accepted,totalCases:cases.length,acceptanceFraction,blockers:[...new Set(blockers)],notice:'Evidence-completeness gate over recorded expert assessments. It does not authenticate a reviewer or independently certify professional validity.'};
}
module.exports={assess};
if(require.main===module){const result=assess(JSON.parse(fs.readFileSync(process.argv[2]||'docs/expert-review/launch-readiness.json')));console.log(JSON.stringify(result,null,2));if(process.argv.includes('--require-commercial')&&!result.commercialReady)process.exitCode=1;}
