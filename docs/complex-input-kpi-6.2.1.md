# Compound descriptions and KPI repair — 6.2.1

## Problem and resulting behavior

The exact synthetic Arabic workforce-planning case returned HTTP 503 on 6.2.0 during the 2026-10-04T22:17:47Z retest. The third row still had no proportional formula after the single regeneration. The supplied obligations were: complete the approved plan within 30 days, achieve 95% monthly job-data completeness, and document gaps AND assumptions in an auditable register.

Gemini now provides typed direct measurements or explicit percentage operands. The server renders the supplied operands as `(numerator / denominator) × 100`, then applies the existing strict validator. Every typed percentage is checked even without a percentage word in its label. Missing operands are never inferred. A single correction receives the bounded rejected JSON as model data, the original job data and static feedback. System rules remain fixed. Repeated invalidity is withheld; public responses remain five nonempty strings per row and require human review.

Compound descriptions retain independently stated duties after reporting recipients and exclusions. Named collaborators stay visible in a separate context and do not create unsupported functional ownership. Genuine overlapping duties still require review, and exclusion of an audited operation does not itself prohibit managing an audit team.

## Evidence and scope

- `tests/composite-inputs.test.cjs` checks the recorded expert Human Capital example and its authored Arabic translation, full authored examples for the five added families, recipient-first duties, stakeholder collaboration, excluded operations, actual finance/payroll ownership and real three-function overlap.
- `server/tests/test_kpi_complex_repair.py` checks the compound planning input in both languages, typed formula rendering, contextual correction, repeated failures, empty operands, extra division, unbalanced parentheses and raw-field limits.
- The recorded Human Capital case is expert-provided. The five service examples and boundary/overlap cases are authored synthetic tests. The HR function list supplied by the expert is not an exhaustive test dataset.
- Offline provider fixtures establish the contract and failure handling, not live-model accuracy. Production verification requires the matching API/UI build and actual public synthetic requests; their output remains a proposal for professional review.
- Consent, shared persisted quotas, organization isolation and redacted diagnostics are unchanged.
