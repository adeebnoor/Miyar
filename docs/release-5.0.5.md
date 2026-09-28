# Miyar 5.0.5 — hosted strategic AI preparation

- Adds a one-key Gemini embedding adapter, with authenticated server-side batch requests, real vector normalization, count validation, and no provider key in a URL, frontend bundle or repository.
- Preserves the E5-compatible adapter. Gemini embeddings are a different model; the original 0.85 cutoff is a provisional threshold requiring calibration.
- Shows embedding and generation model IDs in each AI result. Reports live provider completion separately from configuration, with the last successful request timestamp for this server process.
- Raises service-readiness timeout to account for the observed Render free-instance cold start. Adds an explicit Miyar sign-in link when AI access requires authentication. It does not substitute rule results on AI failures.
- Rebuilds cache-busted frontend/API version 5.0.5. The existing PostgreSQL data and approval permissions are preserved.

## Activation boundary

The owner must add a fresh Gemini API key directly to the Render environment. Existing credentials in the supplied prototype are not reused. No actual Gemini inference or team readiness is claimed until a real authenticated match and generation request succeed. See [setup and verification](strategic-ai.md).

## Reviewer cases

| Case | Inputs | Check |
| --- | --- | --- |
| Original corpus match | Original Civil Engineer objective; Engineering; Professional | Actual similarity, final title, SSCO 214201 if title remains the source title |
| Novel proposal | Define a genuinely different fictional set of responsibilities outside the five examples; relevant field and level | Actual similarity decides route; a generated title does not inherit an unrelated code |
| Level constraint | Payroll preparation and reports to the finance director; HR; Specialist | Reporting recipient does not promote the role to manager |
| Provider failure | Missing/invalid key or exhausted quota | Explicit incomplete state; no fabricated embedding score or generated title |

Passing deterministic tests establishes branch and access-control behavior; it is not a model accuracy result. The original corpus still contains five engineering objective examples, not full occupational coverage.
