# Functional acceptance scope — Miyar 6.1.2

This is a test specification and coverage map, not a claim of expert-validated recommendation accuracy. Release approval requires a successful matching GitHub Actions run, a matching API/UI build, and the live checks. Synthetic users and organizations exist only in disposable fixtures.

| Function | Required acceptance evidence | Test entry points |
|---|---|---|
| Public start and value proposition | Hero, examples, service links, direct route, mobile/desktop, two languages | `miyar-360-value`, `miyar-guided-start` |
| Direct occupation/education lookup | Arabic/English aliases, Arabic digits, leading zeros, hierarchy, pagination, source page | `miyar-360`, `enterprise.test`, `qa-core` |
| Complex role recommendation | Tasks, recipients and exclusions separated; project development, investment, internal audit, strategy, PMO; level/scope conflict review | `miyar-hr-feedback`, `hr-feedback-6-1` |
| Strategic AI | Consent, configured provider, thresholds, failure/expiry/quota behavior, no invented official code; live synthetic smoke | `test_strategic`, `test_expert_review`, `miyar-review` |
| OD workbench | Purpose, responsibilities, competencies, RACI, KPIs, source handoff, escaped free text, provisional role | `od-engine`, `hr-feedback-6-1`, `miyar-expert-handoff` |
| Draft lifecycle | Save, reopen, amend, import JSON, restore a prior revision, unsaved draft confirmation | `ui`, `enterprise`, `miyar-functional-acceptance` |
| Position documents | JSON exact values, HTML content, preview, real PDF header, DOCX parsed title/signers, XLSX opened with four sheets | `miyar-functional-acceptance`, `test_governance`, `test_refinements` |
| Approvals | Separate manager/OD/rewards/finance/CHRO users, required consultation, locked review, budget/headcount constraints, requester cannot approve | `miyar-functional-acceptance`, `test_governance`, `test_od_requirements` |
| Negative workflow | Withdraw, return, reject; amendment requires a new revision; no unsigned receipt | `miyar-functional-acceptance`, `test_governance` |
| Version integrity | Approved export survives a pending amendment; restore produces a new revision; concurrent approvals advance once | `miyar-functional-acceptance`, `test_governance` |
| Evidence and signing | Four approval records, audit chain, Ed25519 receipt verifies, tampered receipt fails | `miyar-functional-acceptance`, `test_governance`, `test_reference_integrations` |
| Job evaluation | Evidence per factor, weighted points/band, institution point ranges, framework preview/activation, external specialist record, no proprietary score claim | `functional-acceptance`, `expert-review-5-2`, `test_od_requirements`, `test_audit_remediation` |
| Manpower planning | Three scenarios, raw/rounded boundaries, demand/supply bridge, growth/backfill, exits, optional localization, Buy/Build/Borrow/Bind/Bot alternatives | `manpower`, `expert-review-5-2`, `miyar-regressions` |
| Manpower persistence/handoff | Save/update/reload/import/recompute/export; positive gap to OD and compensation | `miyar-functional-acceptance`, `miyar-regressions` |
| Compensation | Source band, zero/unknown inputs, salary position/compa-ratio/quartiles, annual/monthly, basic/total cash, allowances, no automatic pay reduction | `compensation`, `functional-acceptance`, `expert-review-5-2` |
| Compensation persistence/bands | Save/update/reload/import/recompute/export; institution grade and CSV salary band handling | `miyar-functional-acceptance`, `miyar-regressions`, `audit-remediation` |
| Skills | Dictionary evidence, no-match state, invalidate changed inputs; semantic matching correctly disabled when unconfigured | `miyar-functional-acceptance`, `functional-acceptance`, `hr-feedback-6-1` |
| Structure health check | CSV template/parse/report/export, duplicates, title/code denominator, scope and spans; real XLSX upload, zeros/formulas/malformed file | `miyar-functional-acceptance`, `test_reference_integrations` |
| Pilot measurement | Paired expert agreement and time saving; exact denominator; duplicate/invalid cases reject and clear old report | `miyar-functional-acceptance`, `functional-acceptance` |
| Business case | Editable assumptions, recalculation, sourced scenario labels and export | `product`, `qa-review`, `audit-remediation` |
| Demo and tour | Labelled synthetic organization/grades/scenarios, guided navigation, reset preserves unrelated user data | `release-6`, `test_demo_tenant` |
| Institution profile | Admin save/version/import/export, cycles and overlapping grades reject, manager cannot edit, org switch clears state | `institution-setup`, `test_institution`, `miyar-authenticated` |
| Accounts/admin | Real sign-in, department/account creation, branding persistence, framework activation, deactivation, tenant and department scope | `miyar-functional-acceptance`, `miyar-authenticated`, `test_360_surface` |
| Authentication recovery | MFA enrollment/login/replay, password change revokes sessions, recovery single use/expiry/tenant scope, admin MFA reset | `miyar-authenticated`, `test_mfa`, `test_deployment`, `test_audit_remediation` |
| Integration contracts | Idempotent canonical import, approved snapshot export, taxonomy staging/activation, signed outbox retry | `test_reference_integrations` (real external vendor credentials are not configured) |
| Governance/trust | Privacy, retention, methodology, status, recovery, changes, language controls and first-party documents | `miyar-360-value`, `360-audit-6-1`, `test_deployment` |
| Runtime operation | Matching release IDs, no-store public PDF, anonymous protected access returns 401, dependency and secret checks | Deploy gate, `check-live-services`, pinned dependency audit |
| Third-party links | Bounded GET checks record reachable/broken/unconfirmed separately; no bypass of denials | `check-external-links.py`; retained JSON artifact |

## Changes triggered by acceptance testing

- Corrected calculations clear earlier error messages and recalculation hints.
- Manpower and compensation sidebar links remain present after a language switch replaces the page shell.
- Framework preview inserts its panel after the actual file control; the control has no enclosing label.
- The public expert feedback download attaches its link to the document before clicking.
- Editing skill inputs removes prior skill/candidate evidence.
- Selecting a replacement bulk or pilot file removes its previous report/export; an invalid file cannot leave a stale successful report.
- A malformed scenario import removes the computed output while preserving saved records.
- Finance must enter budget and headcount explicitly; an empty budget is not converted into an approval of zero.
- Arabic and English route tests use independent browser pages and assert the actual document language.
- Export inspection opens the temporary XLSX as bytes; browser downloads have no guaranteed extension.
- API pins update urllib3 to 2.8.0, PyJWT to 2.15.1, pypdf to 6.19.0; the pipeline audits them.

## Production acceptance boundaries

The signed-in workflow is tested against the real API/database in isolated fixtures, plus PostgreSQL tests. This does not establish that an unspecified production user's permissions or organization configuration are correct. Production organization approvals and authenticated exports need an authorized account for live tenant acceptance.

Strategic AI has a time-limited public expert window ending 2026-10-06 23:59:59 Asia/Riyadh and a shared daily quota. Skills semantic matching and organization AI KPI generation are not configured in production; dictionary skills and authored KPI proposals remain available. They must not be presented as working AI services.

External reference reachability and source editions do not establish current Saudi regulatory compliance. References from 2019/2020 require current professional verification before employment/pay/regulatory decisions. No recommendation-accuracy percentage is inferred from automated test counts.
