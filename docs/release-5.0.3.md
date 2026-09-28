# Miyar 5.0.3 — reliable upgrade for returning reviewers

5.0.3 includes every fix documented in [5.0.2](release-5.0.2.md).

Live verification after publication exposed one further release defect: an existing browser continued executing 5.0.1 scripts after opening the 5.0.2 page, even though HTTP inspection confirmed the new deployment. A version parameter on the document alone did not change the asset cache keys.

The entry page now versions every local JavaScript and CSS URL with `v=5.0.3`. The final reviewer URL also uses the new document version. Existing caches therefore cannot substitute older scripts or styles. Frontend labels, package metadata and API health share version 5.0.3. The DOM test harness resolves URL query parameters to their underlying filesystem paths; browser asset checks still request the complete real URLs.

The release gate remains 114 JavaScript tests, 39 Chromium journeys and 58 PostgreSQL API tests. Live verification additionally uses the existing browser that previously loaded 5.0.1.

## Existing Render deployment constraint

Render build logs report that it lacks linked access to the repository and clones the public URL. This service has not been auto-deploying even though its metadata says `autoDeploy=yes`. For this release, deploy the latest main commit manually only after all CI checks pass, then verify the live commit and `/health` version. Do not equate publication to Pages with updating the API. Git-provider linking is a separate account configuration change.

The existing free PostgreSQL expiry remains **13 October 2026**. No paid plan, database access-list change or production test account is introduced.
