# Miyar Phase 1 — Organization Development Engine

Status: working public Phase 1 prototype, September 2026.

## Product purpose

Phase 1 turns a business request into an editable, governed position package before institutional approval.

**Business input → OD proposal → reference checks → job evaluation → approval**

The public OD workbench accepts:

- strategic objective / business need;
- roles and responsibilities;
- department;
- optional business-requested level;
- constraints;
- an optional organization-provided Saudization rule.

Organization structure and grading structure are treated as organization foundations. The public prototype does not infer an approved organization chart or vendor-owned grading tables.

## Generated Phase 1 proposal

The transparent rules engine proposes and applies to the existing Position Design workflow:

- a market-aligned job-title **proposal**;
- position purpose and business need;
- responsibilities preserved from the business input;
- qualifications and experience proposal;
- technical and behavioral competencies;
- department / job-family proposal;
- 3–5 editable KPI rows;
- career-path proposal;
- pre-evaluation level recommendation and its rationale;
- SSCO reference candidates from the supplied 2019 Saudi occupation classification;
- education-field candidates from the supplied 2020 Saudi education classification;
- bachelor level 6 as a reviewable proposal where the role profile calls for a bachelor degree;
- the existing regulatory/licensing review path, position form, evaluation, approval workflow and exports.

The expert-provided Human Capital example is included as a one-click test case. Its home domain remains Human Capital even when responsibilities include procurement, contracts, OPEX and reporting. Supporting activities do not redefine the job family.

## Controls and non-claims

- The OD generator is deterministic and rule-based in the public deployment. It does not claim live generative-AI inference.
- “Market-aligned title” means a naming proposal, not a live salary/title market survey.
- The pre-evaluation level is not an approved grade. The final grade is produced only through the organization-approved evaluation framework and review stage.
- Miyar does **not** calculate Korn Ferry, Mercer IPE or WTW proprietary scores without an authorized vendor implementation. It can retain an organization custom framework and can record an authorized external specialist result where configured.
- The supplied SSCO and education editions are reference corpora. A suggested code requires OD review.
- A Saudization percentage supplied by the organization is retained as reported and remains unverified until an official current source and verification date are recorded.
- Professional-requirement alerts are reference prompts, not verification of an individual license or a legal-compliance guarantee.
- Missing information stays missing; the engine must not invent occupation codes, education codes, approval status, headcount, salary, reporting lines or regulatory percentages.

## Expert HC acceptance case

Input scope includes:

- coordinate and monitor HC projects;
- RFP / PR / PO, vendor contracts and invoice follow-up;
- daily through annual reporting;
- HC OPEX preparation and monitoring;
- HC process improvement;
- cascade HC strategy into prioritized action plans.

Expected Phase 1 behavior:

- identify the home family as **Human Capital**;
- propose **Human Capital Projects & Operations Manager** for review;
- recommend **Manager level — pre-evaluation**, not an approved grade;
- preserve the supplied duties;
- propose HR/business qualification, relevant experience, competencies, KPIs and a career path;
- query SSCO and education references;
- preserve the expert-provided “100% Saudi” example only as an unverified organization-provided requirement until source evidence is added;
- hand the editable package to the existing job-evaluation and approval workflow.

## Roadmap boundary

### Phase 1 — current

Job design, JD package, job family, career path proposal, KPI/competency proposal, SSCO/education reference checks, evaluation handoff, approvals and exports.

### Phase 2 — next

Manpower planning: demand/workload assumptions, current supply, productivity, attrition, required FTE ranges, workforce gaps, timing and build/buy/borrow/automate scenarios.

### Phase 3 — later

Compensation architecture: grade-linked salary structures, market survey integration where licensed, compa-ratios, internal equity, total reward scenarios and approved compensation governance.
