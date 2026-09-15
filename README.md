# معيار | MI’YĀR 5.0

A bilingual strategy-to-workforce intelligence platform by Prof. Adeeb Noor and Ahmad Raza Khan, King Abdulaziz University.

[Open Miyar](https://adeebnoor.github.io/Miyar/) · [Enterprise API](https://miyar-enterprise-api.onrender.com/) · [Architecture](docs/enterprise-architecture.md) · [OD Phase 1](docs/phase-1-od-engine.md) · [Manpower Phase 2](docs/phase-2-manpower-planning.md) · [Compensation Phase 3](docs/phase-3-compensation.md)

## What Miyar 5.0 does

Miyar connects the workforce decision from strategy to execution:

**Strategy → OD → Job Evaluation → Manpower Planning → Compensation → Approval**

### Phase 1 — Organization Development & Job Architecture

Business inputs begin with strategic/business objectives and roles & responsibilities. Miyar produces a reviewable OD package with a proposed job title, job purpose, responsibilities, qualifications, experience, technical and behavioral competencies, KPIs, job family and career path. The package then links into the supplied Saudi occupation and education references, job evaluation and the institutional approval workflow.

The public OD engine is transparent and rule-based. It does not claim live market-title intelligence, proprietary Korn Ferry/Mercer/WTW scoring or automatic regulatory compliance. Final grades require the organization-approved evaluation framework and human review.

### One-time institution setup

An administrator can configure the approved organization structure and grade architecture once. The OD engine then reuses this context for new requests: organization unit, reporting line, grade proposal and provenance are retained with the draft. Institution profiles are versioned and audited on the enterprise server.

### Phase 2 — Manpower Planning

The manpower workspace calculates workforce demand and supply from explicit assumptions:

- projected demand/workload;
- capacity per FTE;
- current FTE;
- attrition and retirements;
- committed hires and internal moves;
- productivity assumptions;
- optional annual cost per FTE.

It produces Lower / Base / Higher-demand scenarios with **Required FTE**, **Forecast Supply** and **Workforce Gap** by year. Positive gaps can be handed to Phase 1 as a new OD request. Missing cost inputs stay visibly unknown; they are never converted to zero.

### Phase 3 — Compensation

The compensation workspace links an evaluated grade to an **organization-provided salary band**. It calculates midpoint positioning, compa-ratio, range penetration, target adjustment and annual employer cost impact where the required inputs exist. No market salary default is invented and no external survey is claimed unless the organization supplies an authorized source.

## Saudi reference and governance layer

- 5,041 occupations within 5,656 hierarchy nodes from the supplied January 2019 Saudi occupation edition; source issues remain flagged.
- 599 educational specializations and nine levels from the supplied 2020 education edition; leading zeros are preserved.
- SSCO-based professional-license review signals for engineering, accounting and health families; these are review alerts, not individual-license verification.
- Saudization requirements remain unverified until a source URL and verification date are recorded.
- Four-stage institutional workflow: OD → Total Rewards → Finance → Final Authority.
- Tenant/department isolation, role-based access, immutable audit history, versioned position records, signed internal receipts and DOCX/XLSX/PDF exports.
- Imported approvals and external identities do not grant authority in Miyar.

## Public and enterprise modes

The GitHub Pages site provides the bilingual public product and local drafting experience. The Render enterprise API adds organization accounts, PostgreSQL persistence, approval permissions, institutional settings, exports, audit and integration contracts.

Enterprise API: `https://miyar-enterprise-api.onrender.com`

External HR systems such as SAP SuccessFactors, Oracle HCM, Workday, Qiwa and GOSI are **not claimed as connected by default**. They require organization-authorized endpoints and credentials.

Semantic matching is available only when the server model is explicitly enabled. Similarity values are not calibrated confidence. No live E5/Gemini service or validated matching accuracy is claimed.

## Run and test

```sh
npm ci --ignore-scripts
npm test
python -m http.server 8000 --directory dist
```

API:

```sh
pip install -r server/requirements-lock.txt
python -m pytest server/tests -q
python -m server.start
```

GitHub Actions gates publication on the complete browser suite and the PostgreSQL-backed server suite. The Render service is configured on `main` with auto-deploy after checks pass.

## Release 5.0 — September 2026

This release changes Miyar from a position-management prototype into a connected strategy-to-workforce platform:

1. Phase 1 OD Engine with the HC expert case, job family/career path, KPI and competency generation, SSCO/education handoff and one-time institutional structure/grade setup.
2. Phase 2 scenario-based manpower planning with transparent demand, supply and gap calculations plus direct Gap → OD handoff.
3. Phase 3 organization-band compensation analysis with explicit unknown-state handling and no fabricated market pay data.
4. Homepage and navigation updated to make the three-phase product journey visible immediately.
5. Existing governance, export, persistence, security and classification regression tests remain in the release gate.

The supplied reference editions do not establish current regulatory requirements. Reference counts are not market statistics. Software tests do not establish legal compliance, ROI, novelty or patent protection. Proprietary organization documents, credentials and confidential data are not published.
