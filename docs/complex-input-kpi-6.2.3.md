# Compound KPI verification and source comparison — 6.2.3

## Technical repair

The exact synthetic Arabic planning request returned HTTP 503 on 6.2.0 at
2026-10-04T22:17:47Z. Typed percentage operands, strict formula validation and
one contextual correction were introduced in 6.2.1. The public contract remains
five nonempty strings per row; invalid repeated generations are withheld.

Four actual requests on the matching 6.2.2 API build `120a4039f5299d67` succeeded:

| Synthetic case | Request time (UTC, 2026-10-04) | HTTP | Rows | Strict formula check |
| --- | --- | --- | --- | --- |
| Workforce planning, Arabic | 22:54:16 | 200 | 3 | Passed |
| Workforce planning, English | 22:55:04 | 200 | 3 | Passed |
| Investment, Arabic | 22:56:14 | 200 | 3 | Passed |
| Investment, English | 22:58:20 | 200 | 3 | Passed |

All four responses required human review, denied organization access and reported
that trial input was not stored. These are real provider requests using synthetic
text, not offline fixtures or expert approval.

The exact Arabic planning case was rechecked on the published 6.2.3 build
`20c781e25aadcc06` at 23:12:10Z and returned HTTP 200 with three valid rows in
13.28 seconds. Generation from the real public website also succeeded, with the
original generation input displayed beside the editable result. The underlying
model output retained the semantic limitations described below.

## Meaning review

The planning input supplied a 30-day deadline, 95% monthly job-data completeness,
and an auditable register of gaps AND assumptions. Both outputs kept the 95%
monthly requirement, job-record scope and both documentation components, but
introduced unsupported clock/day assumptions or unmarked additional targets and
frequencies. The English output also expressed percentage targets as arithmetic
strings. The planning case therefore passed the transport/formula contract, not
complete semantic acceptance.

Both investment outputs preserved the stated 30 calendar days from receipt of ALL
required documents, the 95% target, and BOTH valuation-model and risk documentation.
Their denominators use cases with deadlines in the measurement period; only the
English output explicitly includes unfinished overdue cases. Neither numerator
explicitly restricts its completed cases to that same due-deadline cohort, so cohort
and period alignment still need confirmation. Inferred monthly measurement periods
also require explicit manager confirmation. The 100%
recommendation-coverage target is a quantification of the supplied “every”
requirement; it must not be confused with an independently supplied numeric target.

Release 6.2.3 adds a conservative source-comparison presentation in the editor and
position report. Original success requirements remain visible beside the proposal.
It distinguishes supplied obligations from inferred additions, asks for definition
of absent clock-start events and day bases, and avoids labeling every target as
proposed. It preserves the model's figures and formulas. It does not use keyword
matching to claim that a target or period belongs to a particular row.

## Compound-description scope

The 36 compound-input regression cases include the recorded expert Human Capital
example and its authored Arabic translation, full authored examples for the five
added families, and synthetic reporting/collaboration/exclusion boundaries. They
do not establish unrestricted language comprehension. Independent duties survive
recipient-first wording; reporting and collaboration are shown separately from
functional ownership. Genuine mixed duties remain subject to review.

The 6.2.2 CI run passed 365 backend, 284 UI and 84 browser tests (733 total).
Publication checks matched the API and frontend release. Offline provider fixtures
prove failure handling and formula contracts, not model accuracy. Full semantic
acceptance and the expert's requested explanatory meeting remain separate.
