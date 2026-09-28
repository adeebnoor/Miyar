# Miyar frontend 5.0.4 — expert handoff fixes

Based on the 28 September technical handoff and the 5.0.3 source at `c995b82`.

## Implemented

- Arabic definite articles no longer break HR detection. Explicit seniority takes precedence over a report recipient. Intent scoring uses matched phrases rather than the first keyword.
- Shared catalog and recommendation engine for Quick Trial and OD: 79 proposed role/level records across 15 families, including HR subroles, finance, marketing, maintenance, quality, customer service, technology, governance, procurement, supply chain, legal, administration, sales, health and operations.
- Field priority, visible Finance/payroll conflict and a switch action. Matched anchors explain the proposal; no calibrated confidence or embedding score is invented.
- Recommendation checklist, source SSCO label, proposed education codes and final proposed title awaiting human approval. Missing reference code blocks the final proposal. Free-text constraints have bounded checks and remain subject to review.
- One directory fallback owner; removed the competing QA fallback and its timer script from the load sequence. Failed directory fetches display a retry state; stale asynchronous responses cannot replace a newer run.
- OD uses intent-specific HR skills and metrics (payroll accuracy, time to fill, offer acceptance, workforce variance and learning transfer). General templates are visibly labelled. Specialist careers start at a specialist progression. Mixed HC portfolio example retains its separate scope.
- Compensation holds above-target pay, flags above-/below-band cases, and includes employer on-cost consistently. Band pay basis is explicit; GOSI is not calculated automatically.
- Manpower gaps inside ±0.5 FTE are monitoring cases with zero additional headcount. Outside the tolerance, signed whole-headcount rounding is unchanged. Demand, productivity and attrition scenario changes are independently editable; only demand varies by default.
- Fixed README document links and corrected the Render auto-deploy claim. Versioned all entry-page assets for returning reviewers.

## Scope and remaining external dependencies

- Frontend and API source are 5.0.4. The strategic AI route requires a separate API deployment; no database migration is needed. CI gates Pages on PostgreSQL API tests and Chromium journeys.
- The original objective-embedding → generation → validation → final-title path is restored in server source and selectable in Quick Trial. It remains opt-in and requires a separately configured embedding service and a new Gemini credential. See [the setup and live verification boundaries](strategic-ai.md). No real-provider inference has been verified. The catalog is a reviewable proposal, not a validated occupational prediction dataset. Domain experts should approve titles, education mappings and any broad fallback references before institutional use.
- The supplied report names legacy `miyar.py` / Colab credentials. The subsequently attached original code contains credentials; they were not reused or copied into this repository. This does not prove that exposed credentials were revoked; the owner must revoke them in the originating provider accounts.
- The prior release records a free PostgreSQL expiry of 13 October 2026. A paid upgrade/migration and Render workspace administration are separate actions; this frontend release makes no billing or database changes.
- Historical priority/fallback files remain in git for traceability but are no longer loaded. Wider legacy UI-module consolidation and replacement of the old pitch PDFs are separate follow-ups; they are not represented as completed here.

## Verification

See the CI run for this release's exact counts and outcomes. Local tests include the real index script order, 42 HR intent/level cases, six cross-domain cases, negative constraints, offline retry, stale-response isolation, OD handoff and compensation/manpower boundary checks. Passing tests establish those cases, not universal domain accuracy.
