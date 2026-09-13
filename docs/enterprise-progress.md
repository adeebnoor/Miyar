# Enterprise implementation checkpoint

Updated 13 September 2026, release 4.1.1.

The continuation preserves all six enterprise axes and the source editions (occupations 2019, education 2020).

Recovered work included the expanded taxonomy, FastAPI service, revision-bound approvals, governed matching and audit records. This continuation completes free-text Field/Seniority, portable draft recovery, package previews, evaluation locking after Rewards approval, matrix/bulk validation, the bundled font, and the updated investor presentation and readiness table.

GitHub Pages publishes the browser application after checks. The owner activated the Blueprint in My Workspace on 13 September 2026. The Docker service is live at https://miyar-enterprise-api.onrender.com, serving the complete UI and API from the same origin. GitHub Pages is configured to use that API automatically. The free PostgreSQL 17 instance is available in Frankfurt (expires 13 October 2026); secrets and the internal database URL were generated/wired by Render. Semantic inference remains disabled in the default free-resource configuration. HRIS/national-platform connectors need authorized organization access. No unrelated application resources are used.

See the architecture document for evidence boundaries and the demo guide for the presentation path. Independent validation, partner-pilot evidence, prior-art comparison and filing decisions are not marked complete by software tests.

Release 4.1.1 passed 47 interface tests and 25 server tests in GitHub Actions (run 34760611202), including PostgreSQL concurrency checks. This continuation adds same-origin UI hosting, private generated bootstrap credentials, a password-change flow with session revocation and rate limiting, and a database-aware health check. The complete suite remains a mandatory deployment gate.

The published Arabic interface was inspected interactively, including unrestricted input, the package dialog and draft persistence. The earlier three-page Arabic PDF was visually inspected. After activation, live checks confirmed PostgreSQL health, the Ed25519 public key, same-origin UI/configuration/font, GitHub Pages CORS, and rejection of unauthenticated position access. No runtime errors appeared in the queried logs. The bootstrap account was created without printing its password. The owner must complete first login privately and configure distinct reviewers and an approved framework before demonstrating the authenticated institutional approval flow on this live instance.
