# معيار | MI’YĀR

A bilingual workforce architecture and position-management prototype by Prof. Adeeb Noor and Ahmad Raza Khan, King Abdulaziz University.

[Open Miyar](https://adeebnoor.github.io/Miyar/) · [Enterprise server](https://miyar-enterprise-api.onrender.com/) · [Architecture](docs/enterprise-architecture.md) · [Demo guide](docs/investor-demo.md) · [Product review](docs/product-investor-review.md) · [First login and operations](docs/render-activation.md) · [Checkpoint](docs/enterprise-progress.md)

The application opens as a working position-management service: create a request, import an existing draft, resume work, and inspect saved requests. Dashboard counts come from local drafts or the signed-in account’s scoped server records. **Field and Seniority accept free text**; values survive language changes, saving and export.

## Public browser workspace

- 5,041 occupations within 5,656 hierarchy nodes, from the supplied January 2019 edition. Four missing-parent records are flagged.
- 599 educational specializations and nine levels, edition 2020; leading zeros preserved.
- Position design: business need, alternatives, scope, qualifications, and directly editable RACI and competency tables.
- A searchable position register with status filters and pagination; department selection survives navigation and language changes.
- Local drafts, revision history, prior-version recovery and JSON import/export. Imported approvals and server identities are not trusted.
- Complete package preview, HTML and direct bilingual PDF downloads, including four unsigned digital-signature fields.
- Dictionary skill extraction, CSV structure diagnostics, illustrative custom point calculation and paired pilot measurement.
- A task dashboard, direct tool URLs, save-and-open continuation, and a user guide.
- Sign-in preserves an open draft; local drafts can be opened for explicit saving to the organization.
- Service status provides a public server check; institutional operations require the appropriate account roles.
- Organization administrators can inspect accounts, roles and department scope, and deactivate accounts through the existing permission checks.

Local drafts stay in the current browser/device. Download JSON for backup; clearing browser data removes them. Local drafts cannot grant institutional approval.

## Enterprise server

FastAPI/PostgreSQL implements tenant/department isolation, role-based access, four-stage approvals, immutable historical records, signed internal receipts, DOCX/XLSX/PDF exports, custom evaluation frameworks and HRIS exchange contracts.

The enterprise server is live on Render and GitHub Pages is configured to connect to it automatically. Institutional operations require organization accounts; the public references and local drafts remain available without login. The connection screen does not authenticate with ChatGPT or external HR systems. External systems need authorized endpoints and credentials.

Semantic retrieval uses a pinned multilingual MiniLM ONNX model and is disabled by default. A recorded development smoke run reached approximately 887 MiB peak RSS, exceeding the 512 MB free web-instance budget. No live E5/Gemini service or validated matching accuracy is claimed.

## Run and test

```sh
npm ci --ignore-scripts
npm test
python -m http.server 8000 --directory dist
```

For the API, use Python 3.12, install `server/requirements-lock.txt` and the native Pango libraries listed in the Dockerfile. Inject your database URL and secrets using `.env.example` as a reference.

```sh
python -m pytest server/tests -q
python -m server.cli bootstrap --email your-admin@example.org
python -m server.start
```

The Render Blueprint generates the bootstrap password and signing/session keys, then serves the UI and API from the same origin. Get the initial password privately from the service environment and change it inside Miyar. Existing accounts are not reset on redeploy. The local CLI prompts for a password if one is not supplied through the environment; no public passwords are seeded. Create distinct manager, OD, Rewards, Finance and final-authority accounts. Institutional grading requires an organization-approved custom framework.

GitHub Actions tests the API against PostgreSQL, including concurrent approvals, then tests the interface before deploying `dist`. Release 4.2.0 passed 55 interface tests and 24 server tests locally; the PostgreSQL concurrency case runs in CI, for 25 server cases there. The owner activated the Blueprint in My Workspace on 13 September 2026. Live checks confirmed PostgreSQL health, the signing public key, UI delivery and cross-origin access from GitHub Pages. First login and organization account/framework setup remain necessary for the live approval demonstration. Account for cold starts and the free database expiration on 13 October 2026 before a scheduled presentation.

The source editions do not establish current regulatory requirements. Reference counts are not market statistics; similarity is not calibrated confidence. Software tests do not establish novelty, ROI, legal compliance or patent protection. Original attachments, evaluation correspondence, credentials and organization data are not published. The font uses the [SIL Open Font License](dist/assets/OFL.txt).

## Service interface — 4.4

The primary link is https://adeebnoor.github.io/Miyar/. Earlier review links now open the service dashboard. Investor and innovation-center content is removed from primary navigation. New request creation begins with an empty form. The dashboard shows actual saved records and clear local-versus-organization storage context; it does not seed example data.

Local verification passed 63 JavaScript tests and the three deployment tests. The release workflow also gates publication on the full PostgreSQL API suite. Public-URL Render cloning currently lacks an authenticated Git-provider connection, so a successful GitHub push does not trigger a backend deploy; deploy the tested commit explicitly and verify `/health`. No paid resources are introduced.

## Refinements — 4.5

- Direct PDF from the public position form and saved local requests; the existing Render server renders a draft in memory. No sign-in or external PDF provider is required. Blank PDF signature fields do not constitute signed approvals. Institutional exports retain the server approval record and internal receipt.
- Editable 3–5 KPI suggestions tied to success outcomes, preserving explicit numerical targets; editable RACI suggestions from the entered duties and stakeholders. Changes to source inputs prompt re-review. Local generation uses documented rules, not a generative model.
- Optional organization AI endpoint: set `MIYAR_KPI_ENDPOINT` (HTTPS chat-completions endpoint), `MIYAR_KPI_MODEL`, and `MIYAR_KPI_API_KEY` on the server. Authenticated author roles can request a bounded JSON proposal; schema validation and human review remain required. No provider, credentials or paid resource is added by this release.
- SSCO-based alerts for engineering, accounting and health roles link to the relevant professional authority. They do not query individual license records or infer definitive legal eligibility. The authority reference was checked on 13 September 2026.
- Optional salary range, currency, period and source are linked to a calculated grade and preserved in the draft. Total Rewards evaluations use an organization-configured band where provided or an explicit reviewer proposal, attached to the evaluation revision. No market salary defaults are invented.
- PDF, HTML, JSON, DOCX and XLSX include the added performance and compensation data. Public PDF requests cannot claim organizational approval.

## Enterprise entrance — September 2026

The public root and `#home` open the bilingual product entrance. Existing `#enterprise/...` links still open the operational workspace directly. The interactive position preview is clearly illustrative and never creates a record or an approval. Its primary action loads an editable sample with three KPIs and three RACI rows; unsaved work requires confirmation before replacement.

The page presents corpus size, approval stages and export formats as capabilities. It does not claim measured savings, proprietary-method certification or automatic regulatory compliance. Local drafts, JSON import and account configuration remain in the workspace. The import chooser is localized and keyboard accessible.

Validation: 69 JavaScript tests pass, including the entrance-to-draft journey in both languages, preview isolation, keyboard tabs, language switching with unsaved content, direct workspace links, and existing persistence/export regressions. Live browser visual verification was unavailable because the connected browser timed out; responsive CSS covers narrow, tablet and desktop layouts, but this does not substitute for a device visual review.
