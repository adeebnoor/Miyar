# Enterprise architecture and technical evidence

Release 4.1.1, 13 September 2026. This document describes executable behavior and its limits.

## Six development axes

| Axis | Implemented | Dependency or outstanding evidence |
| --- | --- | --- |
| AI/NLP and classification | Versioned tree; free-text Field/Seniority; dictionary skills; multilingual retrieval; thresholds; deterministic rules; approved-library fallback | Model hosting, reviewed skill crosswalks and held-out expert labels |
| Governance | Tenant/department scope; OD → Rewards → Finance → CHRO; revision locks; return/withdraw/restore; active revision retained | Hosted PostgreSQL and separate reviewer accounts |
| Evaluation | Custom weights/bands/evidence; evaluation locked after Rewards approval; grade included in exports | Organization-approved framework; proprietary vendor calculators absent |
| Integration | OpenAPI; canonical draft import; idempotency; approved-version exports; signed outbox/retries | Authorized vendor endpoints; no live Qiwa/GOSI connection |
| Market intelligence | Sourced global skill-trend context; paired pilot comparison | No live market feed or salary-survey claim |
| UX/security/exports | Bilingual input, local revisions/import/preview, readiness table, HTML/JSON and server DOCX/XLSX/PDF | Public UI checked interactively; live server verification follows activation |

## Corpus and mapper

The supplied January 2019 occupation edition contains **5,041 occupations / 5,656 nodes**. The supplied 2020 education edition contains **599 specializations / nine levels**. Extraction retains code strings, parents, source pages and input PDF SHA-256. Four missing-parent records are flagged rather than repaired with invented parents.

`scripts/extract_classifications.py` reproduces the references using PyMuPDF, including the source's Arabic lam-alef glyph encoding. PyMuPDF is an extraction dependency separate from the server runtime. No new model was trained on these files.

`server/taxonomy.py` loads a fixed multilingual MiniLM ONNX repository revision (`faf4aa4225822f3bc6376869cb1164e8e3feedd0`). Model artifacts are hashed and fingerprinted. Occupation/parent titles are embedded with mean pooling into normalized 384-dimensional vectors. Retrieval returns three cosine-ranked references. Field and Seniority are retained as arbitrary text and included in retrieval context. Constraints remain explicit human-review requirements.

The original research prototype used E5 and Gemini. This implementation is explicitly different and does not claim equivalent performance. Two authored O*NET crosswalks require OD review; missing profiles return null skill/task overlap rather than invented percentages.

## Decision sequence

1. Check the leading cosine score and top-two margin against versioned thresholds. Defaults `0.75` and `0.03` are experimental.
2. Apply R01 code existence, R02 parent existence, R03 organization education requirement and R04 organization licensing evidence. These are internal rules, not proof of national compliance.
3. Route passing candidates to human review. On failure, restrict fallback to active approved positions in the same organization/source edition; each fallback must independently pass policy rules. Fallback is a review route, not automatic acceptance or proof of fit.
4. If no fallback exists, create a provisional internal definition with an existing candidate parent unit for review. An internal identifier never becomes a national SSCO code, including after institutional approval.
5. Record the input digest, model fingerprint, release, candidates, thresholds, rule outcomes, fallback reason, parent linkage, actor and previous hash.

General matching does not accept a requester-supplied licensing approval. OD verifies required licensing evidence during position approval; unavailable evidence fails closed.

## Storage and approval integrity

JWTs identify users and session versions. Roles and organization scope are read from server accounts, not trusted client claims. Managers see only their department. Requesters cannot approve or evaluate their own requests. Stale revisions return HTTP 409.

Submission snapshots the workflow and decision policy. OD precedes Rewards; Finance verifies headcount and budget; CHRO activates the position. Editing under review requires withdrawal/return. A returned request requires a new revision. Evaluation is writable only during the Rewards stage; subsequent approval and exports use its recorded evaluation. An existing active revision stays operational while amendments are pending.

Database triggers reject UPDATE/DELETE on audit events, position versions, approvals and evaluations. Audit records hash canonical decision fields plus the prior digest. PostgreSQL locks serialize concurrent decisions. Database owners can alter schema; external signed checkpoints remain necessary against owner-level rewriting.

Ed25519 receipts bind content/evaluation digests, revision, approval evidence and key identity. They are internal receipts, not qualified electronic signatures or PAdES PDF signatures. XLSX stores user text literally. PDF export denies external resource fetching. Matrices and imported data are validated before export.

## Evidence and remaining validation

Tests cover explicit behaviors: hierarchy, Arabic numerals, free text, local persistence, import safety, tenant isolation, forged state, workflow order, budgets, stale writes, evaluation locking, historical records, signing, exports and exchange idempotency. PostgreSQL concurrency is required in CI and skipped in SQLite-only runs.

`semantic-smoke-result.json` records an actual development model run, not an accuracy benchmark or production latency guarantee. Its peak memory exceeds the default free web-instance budget; inference remains disabled in that Blueprint.

Pilot measurement uses expert code labels and paired timings with explicit denominators and missing-time handling. No accuracy, savings or ROI is prefilled. Independent evaluation cases, expert agreement, threshold calibration and a Saudi/GCC partner pilot are still needed.

The implementation addresses concrete mapper/rule/fallback/audit enablement and narrows claims to observable behavior. Prior-art comparison, legal claim drafting and filing decisions remain outside this implementation record. No software check closes them.
