# Phase 2 — Manpower Planning

## Purpose

Phase 2 converts an approved or reviewable strategic workforce need into a transparent capacity-and-supply scenario. It does **not** claim to predict a uniquely correct headcount with AI. The planner exposes the business inputs, formulas, scenario adjustments and uncertainty so Human Capital, Finance and the business owner can review the decision.

## Inputs

- Strategic objective
- Role / reference position
- Department and job family
- Workload unit
- Current workload
- Target workload at the planning horizon
- Current capacity per FTE
- Current FTE
- Planning horizon (1–10 years)
- Annual attrition assumption
- Committed hires during the horizon
- Internal mobility / reskilling supply
- Cumulative productivity or automation improvement
- Optional annual cost per FTE

Missing annual cost remains `null`; the system does not display zero when no cost was provided.

## Calculation

For each scenario and year:

1. Calculate the annual compound demand path from current workload to the scenario-adjusted target workload.
2. Phase the cumulative productivity assumption across the horizon.
3. `capacity_per_FTE = baseline_capacity × (1 + realized_productivity)`.
4. `required_FTE = projected_demand / capacity_per_FTE`.
5. Forecast retained current supply using annual attrition.
6. Phase committed hires and internal supply additions across the horizon.
7. `forecast_supply = retained_current_FTE + phased_committed_hires + phased_internal_supply`.
8. `gap_FTE = required_FTE - forecast_supply`.
9. Positive gaps can be handed to Phase 1 OD as a proposed headcount need. Responsibilities are deliberately not invented during this handoff.

The current public scenarios are:

- Lower demand: target demand × 0.90, productivity assumption +5 percentage points, attrition −1 percentage point.
- Base: organization inputs unchanged.
- Higher demand: target demand × 1.10, productivity assumption −5 percentage points, attrition +2 percentage points.

These are sensitivity scenarios, not probabilities.

## Output

- Required FTE by year
- Recommended integer headcount by year
- Forecast supply FTE by year
- Workforce gap / surplus by year
- Optional annual cost of a positive gap
- Low / Base / High demand comparison
- Suggested review route: hire/build when a positive gap exists, redeploy/natural attrition when surplus exists, or monitor when close to balance
- JSON export and local plan record
- Handoff to Phase 1 OD for a positive workforce gap

## Governance

The plan status is `scenario-estimate-not-approved`. Approval requires business and Finance review of demand, capacity, attrition, timing, productivity and budget. The planner does not silently replace unknown values with zero, except where the organization explicitly enters zero (for example, zero committed hires).

Phase 1 remains authoritative for job design, SSCO/education linkage and job evaluation. Phase 3 will use approved grades and organization compensation architecture; the Phase 2 planner does not invent salary bands.
