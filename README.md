# معيار | MI’YĀR

A bilingual workforce architecture and position-management prototype by Prof. Adeeb Noor and Ahmad Raza Khan, King Abdulaziz University.

[Open Miyar](https://adeebnoor.github.io/Miyar/) · [Architecture](docs/enterprise-architecture.md) · [Demo guide](docs/investor-demo.md) · [Render activation](docs/render-activation.md) · [Checkpoint](docs/enterprise-progress.md)

The public application starts with the enterprise workspace. The original five-role experience remains accessible for continuity. **Field and Seniority accept free text** in matching and position design. User-authored values stay intact through language switching, saving and export.

## Public browser workspace

- 5,041 occupations within 5,656 hierarchy nodes, from the supplied January 2019 edition. Four missing-parent records are flagged.
- 599 educational specializations and nine levels, edition 2020; leading zeros preserved.
- Position design: business need, alternatives, scope, qualifications, RACI and competencies.
- Local drafts, revision history, prior-version recovery and JSON import/export. Imported approvals and server identities are not trusted.
- Complete package preview and portable HTML download; use the browser print command on downloaded HTML for PDF.
- Dictionary skill extraction, CSV structure diagnostics, illustrative custom point calculation and paired pilot measurement.
- Bilingual seven-slide presentation and **Demo readiness** service table.

Local drafts stay in the current browser/device. Download JSON for backup; clearing browser data removes them. Local drafts cannot grant institutional approval.

## Enterprise server

FastAPI/PostgreSQL implements tenant/department isolation, role-based access, four-stage approvals, immutable historical records, signed internal receipts, DOCX/XLSX/PDF exports, custom evaluation frameworks and HRIS exchange contracts.

These require a deployed server and organization accounts. Publishing GitHub Pages does not deploy the API. The connection screen does not authenticate with ChatGPT or external HR systems. External systems need authorized endpoints and credentials.

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

GitHub Actions tests the API against PostgreSQL, including concurrent approvals, then tests the interface before deploying `dist`. The `render.yaml` is ready for evaluation deployment. The owner confirmed My Workspace and its PostgreSQL database is available; applying the Blueprint is still required to launch the Docker service and wire its internal database URL. Account for free database expiration and cold starts before a scheduled presentation.

The source editions do not establish current regulatory requirements. Reference counts are not market statistics; similarity is not calibrated confidence. Software tests do not establish novelty, ROI, legal compliance or patent protection. Original attachments, evaluation correspondence, credentials and organization data are not published. The font uses the [SIL Open Font License](dist/assets/OFL.txt).
