# Miyar 5.0.2 — reviewer readiness

This patch responds to the independent 5.0.1 audit and the available project conversation history. It preserves free-text Field/Seniority, the reviewer payroll/recruitment/HR-manager examples, source-linked occupation codes, visible abstention and the boundaries around licensed evaluation, market salary data and regulatory references.

## Audit closure

| Finding | Change | Regression evidence |
| --- | --- | --- |
| Institution A remained visible after signing into B | Explicit session lifecycle, memory-only server profiles, stale-response rejection; local trial profile separated from legacy shared storage | Two real API organizations in Chromium; delayed-response unit case; expiry case |
| Managers did not load institution setup | Profile loads for every authenticated role; editing stays administrator-only | Manager login → OD → organization grade |
| Empty numeric fields became zero | Required numbers reject blank, null, boolean and nonnumeric values; optional salary/cost remains unknown | Engine boundary tests and invalid browser forms |
| Invalid/edited forms retained actionable old results | Every form edit invalidates the result and removes save/export/handoff actions | Arabic/English browser journeys |
| Language switching reset the scenario | In-memory form, result and error state survives re-render and route changes | AR → EN → AR with typed data and results |
| Saved plans could not be retrieved | Saved list, open/update, validated JSON import/export; account/API-scoped local storage | Save → reload → open → edit → update → JSON round trip |
| Rounded FTE understated hiring | Raw decision values and one headcount calculation feed actions, OD and compensation; display rounding is separate | 1.04 FTE → 2 headcount in both handoffs |
| Surplus fabricated a compensation hire | No hiring handoff for balanced/surplus scenarios | Surplus browser case |
| Finance matched labor inspection | Family fallback requires token-prefix relevance, preventing مالي from matching عمالي | Original Arabic financial-reporting input |
| Local setup accepted invalid hierarchy/grades | Validation before normalization/save, including cycles, unknown parents, duplicate IDs, dates and overlaps | Local editor and unit cases |
| Malformed grade structures caused 500 | Validate shape before accessing nested fields; return 422 without changing saved version | Eight negative API payload cases |

Integrated testing additionally uncovered and fixed two races: an authenticated dashboard response overwriting a manpower/compensation page, and delayed Arabic example translation overwriting new user input. The phase routes now belong to the enterprise router, and example localization completes within the click action. The redundant compensation handoff repair script is no longer loaded.

## Release verification

The release gate runs 114 JavaScript tests, 39 Chromium journeys (including real local API authentication), and 58 API tests against PostgreSQL 17. GitHub Actions is authoritative for results on the released commit. Local API tests use an isolated SQLite database and skip only the PostgreSQL concurrency case. All accounts and institutions created for browser tests are synthetic and isolated; they are not production users.

## Operational scope

- Suitable for a controlled reviewer test of the prototype after the release gate and deployment checks pass; this does not certify every possible input or production readiness.
- Institution profiles are read from the authenticated server and discarded on logout/expiry. Legacy shared browser profile data is not automatically imported because its organization ownership cannot be established. Local examples can be configured again; the organization profile remains on the server.
- Manpower and compensation scenarios are explicitly local to the current account/browser. JSON is the portable export. Clearing browser storage removes local scenarios.
- Public reference data remains the supplied 2019 occupation and 2020 education editions. No new official-data ingestion or external AI/HRIS activation is claimed.
- Render reports the existing free PostgreSQL database expires on **13 October 2026**. Continued institutional testing beyond that date needs a persistence decision before expiry. This release does not purchase an upgrade or change the database access list.
- Conversation retrieval and repository/Render logs were reviewed where available. Exact original screenshots or every historical conversation were not all retrievable; existing reviewer examples already committed to browser tests were retained and rerun.
