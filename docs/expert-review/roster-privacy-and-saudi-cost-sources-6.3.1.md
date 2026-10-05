# Roster privacy and Saudi cost review — 6.3.1

Reviewed on 2026-10-05 against the remaining-issues report for 6.3.0.

## Roster data minimization

CSV parsing and direct roster evaluation reject national-ID/iqama patterns, Saudi mobile patterns, email addresses, multiword name-like IDs, and common Arabic/English personal names in narrative evidence. Arabic-Indic and Persian digits, full-width text and invisible formatting characters are normalized for pattern detection. Embedded sensitive values are screened across every textual CSV column and nested direct-row fields before calculation. Unknown row fields cannot survive in the exported scenario.

Errors contain only the row number and pattern type. They expose `code: ROSTER_PRIVACY`, `row` and `pattern`, never the rejected value. CSV errors count the header as row 1. Direct-array errors count the first incumbent as row 1. Results contain copied, validated roster fields and omit the raw CSV.

`rosterIdPolicy: {prefix: 'EMP-', digits: 4}` optionally restricts aliases to an organization format and is retained in the exported input. The supported configuration has no administrator exception. The current local-browser application cannot authorize such an exception or produce a tamper-resistant organizational audit; that would require authenticated server-side controls.

Pattern screening does not recognize every possible person's name or anonymize a roster. Users must remove names and identifying context before import. Name screening uses recognizable patterns and a common-name list so ordinary proficiency and experience narratives remain usable; it is not a general person-entity classifier or legal-compliance certification. Pseudonymous salary records remain confidential.

## Official GOSI source

Primary source: [GOSI business journey — new social-insurance system](https://awareness.gosi.gov.sa/businessJourney.html), retrieved and checked 2026-10-05. Relevant sections are the new system's covered categories, contribution proportions, gradual increase mechanism, and first implementation date. The page explicitly gives the eligibility date as **2024-07-03**, the first pension-rate increase as **2025-07-01**, and an annual increase of **0.5 percentage points for each of employee and employer** until each reaches **11%**. It states employer occupational-hazard contributions of 2% and employer SANED of 0.75% where applicable.

The 2027 and 2028 dates below follow the annual sequence described by GOSI; they are the implementation of that published mechanism, not new empirical measurements.

| Applicable calculation date, new system | Employer pension share |
| --- | ---: |
| 2024-07-03–2025-06-30 | 9% |
| 2025-07-01–2026-06-30 | 9.5% |
| 2026-07-01–2027-06-30 | 10% |
| 2027-07-01–2028-06-30 | 10.5% |
| 2028-07-01–2028-12-31, reviewed planning horizon | 11% |

The expert report simultaneously requests the July 2028 stage and a cutoff of June 2028. Those instructions conflict. The implemented horizon is **2028-12-31**, covering both announced phases and all of calendar 2028. The cutoff is a bounded source-review policy, not a statement that the statutory rate expires. Later calculation dates are explicitly blocked pending source review. New rates do not apply to an existing-regime registration, and non-Saudi occupational-hazard-only coverage has no pension/SANED added by this model. Registration and applicability still require confirmation from the employee record.

The annual cost multiplies the selected month's wage and rate by 12. It is an annualized scenario, **not** a calendar-year budget that blends the pre-July and post-July rates. Medical and one-year EOS service accrual retain the existing separate assumptions and limitations.

Other retained primary-source links: [GOSI employer FAQ](https://www.gosi.gov.sa/GOSIOnline/FAQ_Employer) and [HRSD end-of-service explanation](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317-0). These existing cost assumptions were not expanded into new coverage or actuarial calculations in this correction.

## Verification

`tests/roster-privacy-cost-6-3-1.test.cjs` covers sensitive and embedded patterns, Arabic/Persian digits, redacted errors, direct/nested input, ordinary evidence, alias-policy round trips, all announced July boundaries, unchanged other regimes, malformed and unsupported dates, and explicit annualization limits.
