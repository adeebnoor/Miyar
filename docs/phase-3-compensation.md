# Phase 3 — organization-band compensation

The user supplies the salary band, source, salary basis (basic or total cash pay), target position, current salary, FTE and employer on-cost. The band and salary must use the same basis.

The target is a point within the band; recommended salary is the greater of current salary and target. Above-target salaries are held, and above-maximum cases are marked red-circle for review. No automatic salary reduction is proposed. Below-minimum cases are flagged.

`annualBaseAdjustmentCost` excludes on-cost. `annualAdjustmentCost` and `annualEmployerCost` both include the entered on-cost percentage. This is not an automatic GOSI calculation or a market benchmark. Unknown current salary leaves adjustment unknown. Approval requires the organization's Total Rewards process.

The loaded `compensation-workbench.js` owns gap-to-compensation handoff. The historical `compensation-handoff-fix.js` is intentionally not loaded because it would duplicate that behavior.
