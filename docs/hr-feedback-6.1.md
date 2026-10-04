# HR expert feedback — Miyar 6.1.0

4 October 2026. Scope: function coverage, detailed input interpretation and explanations of manpower, compensation, skills and job evaluation.

The available conversation history, 28 September technical handoff, platform audit and repository release records for 5.2/6.0/6.0.1 informed this change. Conversation retrieval does not provide a guaranteed exhaustive transcript.

| Expert comment | Change | Boundary |
| --- | --- | --- |
| Project Development missing | Specialist/manager profiles with feasibility, business cases, sites/permits and development gates | Proposed business titles; adjacent SSCO references explicitly require scope review |
| Investment missing | Investment Analyst / Investment Manager, valuation, modelling, due diligence and risk | Does not execute transactions or supply financial advice |
| Internal Audit missing | Internal Auditor / Internal Audit Manager, risk-based planning, control testing, evidence and remediation | Separate from GRC and Finance; authority text preserves independent assurance rather than operating the audited controls |
| Strategy & PMO missing | Separate Strategy and PMO profiles with objectives, benchmarking, project governance, milestones and benefits | Mixed mandates remain visible for review; no invented percentage composition |
| Simple input only | Local input limit 12,000 characters, contextual clause handling, reporting-recipient and exclusion separation, editable field choice for mixed work | Local rules, not unrestricted natural-language understanding; public AI trial retains its 2,500-character limit |
| Manpower explanation | Inputs, demand/supply/gap equations, a worked FTE example, outputs and owners inside the tool | Scenario estimates depend on organization assumptions and approval |
| Compensation explanation | Sourced bands, compa-ratio, penetration, annual loaded cost example and approval responsibilities | No fabricated market salary or automatic pay reduction |
| Skills explanation | Dictionary matching with evidence, 14 added authored skill terms, working three-skill example | Role requirements do not establish employee proficiency or an employee skill gap |
| Job evaluation explanation | Factor/evidence method, illustrative 750-point example, institution grade and compensation handoff | Job size, not incumbent performance; no proprietary Hay/IPE calculation |

Both Quick Trial and OD use the same expanded role catalog. Source codes, titles and pages are checked against the bundled SSCO 2019 snapshot. Education links remain proposals from the 2020 snapshot. Domain-specific skills and KPIs are authored proposals, not empirically validated profiles.

## Professional references

- [CIPD: workforce planning](https://www.cipd.org/en/knowledge/factsheets/workforce-planning-factsheet/)
- [CIPD: pay structures](https://www.cipd.org/en/knowledge/factsheets/pay-structures-factsheet/)
- [CIPD: job evaluation and market pricing](https://www.cipd.org/en/knowledge/factsheets/market-pricing-factsheet/)
- [The IIA: Global Internal Audit Standards](https://www.theiia.org/en/standards/)

## Verification

The regression suite covers the five added families in Arabic and English at specialist and manager levels; reference identities; recipients and excluded duties; mixed-function inputs; example-to-OD handoff; all four service guides; a working skills example; and internal-audit authority boundaries. Two browser scenarios were added to the existing full release gate, including mobile overflow checks.

The expert's follow-up can now use concrete examples in the product. No meeting was scheduled and no message was sent.
