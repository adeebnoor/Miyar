# Release and operations runbook

The canonical full UI is GitHub Pages. The API root redirects to it. `VERSION` is the release authority; `npm run build` creates a common version/build identity, content-named assets, and a compressed initial-asset budget estimate. The budget is not a network/LCP measurement. Reference files load on first entry to enterprise tools.

## Publish

1. Edit source files in `dist`, the template in `web`, and server source. Increment VERSION for a release; run `npm run build`, UI/API tests and browser CI. Commit the generated manifest and index together. Content-named bundles are rebuilt in CI from the committed sources; do not edit them directly.
2. Deploy that commit to the existing Render service. The free service can cold-start. Do not provision paid infrastructure without owner budget approval.
3. Pages publishing checks live `/health` against the committed release manifest and blocks on disagreement. If Render automatic deployment is waiting for all GitHub checks, deploy the tested commit in Render before the Pages gate completes. No deployment-hook secret is bundled in the repository.
4. Open the full site, the live status page, a reference, salary-band import, and a strategic run. Validate both versions/build IDs; a configured provider is not a successful provider request. Check the unchanged authenticated approval/export flow using authorized test accounts.
5. Roll back both UI and API to the same prior release if verification fails. Never force-push or restore an old database over current approvals to roll back code.

## Recovery

An administrator verifies identity outside the application, records a reason and generates a private reset link for another active account in the same organization. Deliver privately using an authorized channel. The link expires after 15 minutes, becomes invalid on password/session-version change, and cannot authenticate to other APIs. Completion revokes prior sessions. No email is sent. For the only administrator, use the existing controlled server bootstrap/password-change procedure; do not expose bootstrap secrets or create a public recovery bypass. MFA/SSO and mail self-service remain unconfigured.

## Key rotation

- JWT: schedule a short sign-in interruption; generate a fresh high-entropy value in the provider secret manager, replace the environment secret, redeploy, and verify old sessions fail and new sign-in works. Do not log or commit either value. The current single-secret verifier intentionally invalidates old sessions; there is no overlapping JWT key ring.
- Ed25519 receipts: export and retain the current **public** verification key, key identifier and receipt format in the approved verification archive before rotation. Keep previously issued receipts and old public keys for historical verification. Generate the new private key securely and replace only the private secret. Verify a new receipt and an archived receipt with their respective public keys. The application currently serves one active public key, so historical verification requires that archive; an automatic multi-key endpoint remains future work.
- Gemini/provider key: create a replacement scoped key with appropriate restrictions in the provider console, set it through secure provider environment settings, redeploy, run a synthetic request, then revoke the old key. Never inspect or copy secret values into chat, screenshots, issue reports or logs.

## Monitoring and incident handling

`/health` checks database connectivity and exposes release identity, process-lifetime request/error counts and distinct strategic/skills capabilities. Logs contain request ID, method, route template, status and elapsed time; no raw query, body, identity or recovery token. Counters reset on process restart. The scheduled GitHub check provides individual observations, not an uptime SLA or incident paging system. Investigate errors by request ID. Data-restoration drills, provider data locations/retention and production incident contacts require organization approval before real employee data.

## Reference and expert acceptance

`python scripts/reference-diff.py old.json candidate.json` emits a non-activating added/removed/changed-code report and missing-parent checks. A successful diff does not verify official origin. Obtain authorized current official files, document edition/source/effective date, review changes, then use the existing organization taxonomy import/activation workflow. The current bundled references remain 2019/2020.

Use expert-labeled representative goals (existing, ambiguous and genuinely new roles), measure precision/recall and proposal rejection separately, and keep payroll/manager-recipient cases in the review set. Strategic threshold 0.85 is separate from skills thresholds. Do not fabricate calibration metrics, customer counts or regulatory accreditation.

## Demonstration

Use synthetic examples and separate named test roles in an isolated organization: line manager → OD → Total Rewards evaluation → Finance → final authority → export and verify. CI creates isolated database schemas/accounts and tests this flow without accessing production employee data. Public expert review is a temporary quota-limited synthetic-data trial, not the approval sandbox. Provider outage fallback is the explicitly labeled local rules/manual workflow; do not display it as successful AI.
