# Position Creation Workflow / رحلة إنشاء المنصب

Implementation coverage of the supplied **Position Creation Workflow** requirements.

| Requirement | Demo implementation | Institutional completion |
| --- | --- | --- |
| Business justification and capability gap | Required intake field | Business approval |
| Initial role purpose and responsibilities | Required fields; separate responsibility lines | Department validation |
| Department, reporting line and direct reports | Intake and analysis fields; live organization diagram | HRIS position hierarchy |
| Decision authority, budget exposure and impact | Required analysis fields | Evidence validation and scope calibration |
| Qualifications, experience, knowledge and skills | Structured analysis and JD fields | Approved job architecture and competency references |
| Technical and behavioral competencies | Separate JD sections | Validated competency framework |
| Internal and external stakeholders | Analysis and JD section | Business review |
| Job description, describing the role rather than a person | Structured draft with business-review name and date | Formal authorized approval |
| Korn Ferry methodology | Public know-how, problem-solving and accountability evidence fields | Authorized evaluation using the organization’s approved methodology |
| Evaluation score and grade | Fields supplied by a specialist; no calculation | Verified and approved score / grade |
| Documented evaluation rationale | Dedicated rationale, evaluator, methodology and date fields | Evidence review and durable audit record |
| Saudi occupation and academic codes | Suggestions from the supplied five-record sample; unmapped when evidence is insufficient | Current source verification and validated mapping |
| Saudization regulations | Requirement, applicability, source URL and check date | Specialist applicability review |
| Professional certificates and licenses | Requirement / regulator, source URL and check date | Verification against the applicable regulator |
| Output package | Printable report, standalone HTML and structured JSON | Retained official record and integrations |

## Output states / حالات المخرجات

- **draft**: structured description assembled from input.
- **business-review-recorded**: complete core inputs plus an acknowledged business review, name and date. This is a demo record, not approval.
- **reported-unverified**: evaluation or regulatory information has been entered with the required accompanying fields. It has not been independently verified.
- **pending**: required evidence or outcome is missing.
- **sample-suggestion-pending-verification**: title and codes are suggested from the supplied sample.
- **unmapped**: the sample does not support a mapping; no code is fabricated.
- **positionApproval** remains pending in every package.

The completeness chart counts the 18 required input fields. It does not measure job quality, evaluation score or the truth of entered information.

## Data handling / التعامل مع البيانات

Explicit Save stores drafts in this browser with an internal MJR ID and a revision number. Reopen drafts from the searchable saved-position library. Unsaved values and the session log clear on reload. Export JSON for transfer or backup; clearing browser data removes local drafts. Reports retain the current inputs and visibly mark missing fields. Scope changes require renewed business and evaluation review; imported review records also require renewed review.

The interface switches between Arabic and English. Built-in examples switch language while unedited; customized inputs preserve their original text. There is no translation service.

## Verification / التحقق

Behavior tests cover both sample languages, stable source codes, ambiguous and unknown roles, missing inputs, review prerequisites, unverified evaluation and regulatory states, and preservation of supplied evidence. The demo also receives interaction checks for language switching, stale results, the intake flow, output downloads, the presentation and catalog search.

Framework reference links and the current / future comparison are available in the **Global practices** screen and the repository README.

