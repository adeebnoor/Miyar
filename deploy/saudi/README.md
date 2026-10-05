# Saudi hosting migration — prepared, not executed

The current Render service and free PostgreSQL database remain an expert-evaluation environment in Frankfurt. This repository update does not move data or purchase hosting. Do not onboard production payroll records there.

Concrete target: contracted compute plus paid PostgreSQL, backups, logs and keys in OCI **me-riyadh-1** or **me-jeddah-1**, or an organization-approved Saudi provider. Oracle's [region directory](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm) confirms both locations (checked 2026-10-05). Confirm service availability, contract, data processing, support, capacity and recovery requirements with the organization; a region name alone does not establish compliance.

## Deployment inputs and execution

1. Obtain the organization's cloud project, Saudi region, budget approval, domain and DNS control. Provision paid private-network PostgreSQL with TLS, encrypted storage and Saudi-located backups. Restrict database ingress to API compute. Do not expose PostgreSQL publicly.
2. Build the exact reviewed release with `npm ci && npm run build`. The Docker image includes that release. Pin the built image and proxy image by approved digest before production. The included Compose profile is a single-node pilot deployment, not a highly available topology.
3. In this directory create a protected `.env` (mode 600, never commit). Set `DATABASE_URL` (`postgresql+psycopg://...` with `sslmode=require`), `MIYAR_DOMAIN`, `MIYAR_PROXY_IMAGE` (reviewed Caddy image pinned by digest), a new `MIYAR_JWT_SECRET`, and a new signing key using the existing signing-key procedure. Disable public demo credentials and the expert-review AI endpoint. Enable external AI only after an approved processing arrangement; no inference endpoint is enabled by this profile.
4. Run `docker compose config --quiet`, then `docker compose build` and `docker compose up -d`. Only 80/443 should be public. Configure firewall, administrative access, OS patching and monitoring before importing data.
5. Before migration, verify encrypted backup and an actual restore on isolated Saudi infrastructure. Record achieved RPO/RTO, checksums, record counts, ownership, restore time and named acceptance. Preserve an encrypted export of the original database under the organization's approved retention policy.
6. Export at a scheduled write freeze, restore in Saudi PostgreSQL, migrate the application schema using the established server process, rotate keys where appropriate, and run tenant-isolation, MFA, role separation, signed-export and approval tests with synthetic records. Validate active revisions and audit/evaluation relationships by counts and sampled checksums.
7. Cut over DNS/API configuration only after release/build agreement, TLS, source-appropriate CSP/CORS, rollback and restore evidence are signed off. Serve both UI and API from the new origin under `/app/` with same-origin `/api/v1`; check `dist/config.js` host resolution. Keep rollback time-limited and avoid split writes. Retire the old environment only after acceptance and retention decisions.

## Outstanding prerequisites

No Saudi provider account/project or approved spend is available in this task. Therefore region residency, backups, paid capacity, restore and cutover are **not verified**. Fill `docs/expert-review/launch-readiness.json` with evidence and run the professional readiness check. Actual infrastructure migration and independent expert acceptance remain launch blockers.
