# Strategic objective → occupation: original AI pipeline

## Location and status

The author-supplied prototype is `miyar.py`. Its objective embeddings, cosine threshold, generation, validation and final-title stages are now implemented in `server/strategic.py`, exposed by `POST /api/v1/analyze/strategic` and selectable under **Quick Trial → Analysis method → Semantic pipeline — Embedding then LLM**.

This source restoration is not evidence that the hosted API has deployed it or that model inference works in production. Check `GET /api/v1/analyze/strategic/status`. A 404 means the API release is absent; `configured: false` means required configuration is absent. `configured: true` checks configuration only, not inference. A successful authenticated request against real providers is required for live verification. The rule-based default is a separate method and is never silently substituted on an AI error.

## How it works

1. Embed **strategic objective examples**, not just occupation titles. The five nonempty engineering examples from the original workbook are preserved in `server/data/strategic-objectives.json` without its credentials or unrelated notebook content.
2. Embed the submitted objective and calculate actual cosine similarity. The prototype threshold is 0.85. This score is not a calibrated confidence probability.
3. At or above threshold, pass the matching title to Gemini validation. Below threshold, generate a candidate title first, then validate it.
4. Finalize the title with the validation notes, requested field, seniority and constraints. A rejected unchanged title, unsatisfied constraints or a managerial final title for a requested specialist/professional is blocked.
5. Return source-linked SSCO and education codes only when the final title equals a source title or its exact Arabic reference title and that occupation code exists in the active taxonomy. Changed/generated titles otherwise remain unmapped proposals. The model cannot create official occupation codes.

No strong match in five examples does **not** establish that a job is new or has no official classification. Broad coverage needs expert-reviewed objective/job pairs and an evaluation set. Neither this release nor its synthetic tests establish model accuracy.

## Server configuration

### One-key hosted setup (5.0.5)

The prepared Render setup uses Google Gemini for both embeddings and generation. This preserves the objective → semantic match → generate/validate/finalize workflow, but **changes the embedding model from the prototype's E5**. The model IDs are visible in each result. It avoids downloading a large E5 model into a free 512 MB API instance.

```text
MIYAR_ENABLE_STRATEGIC_AI=true
MIYAR_STRATEGIC_EMBEDDING_MODE=gemini
MIYAR_STRATEGIC_EMBEDDING_MODEL=gemini-embedding-001
MIYAR_STRATEGIC_GEMINI_MODEL=gemini-2.5-flash
MIYAR_STRATEGIC_GEMINI_KEY=<new project-scoped key entered directly in Render>
MIYAR_STRATEGIC_THRESHOLD=0.85
```

Only the last secret is required from the owner once the nonsecret settings are saved. A key is never requested from team reviewers or accepted in a public Miyar form. Keep testing to fictional role requirements; Google free-tier terms may permit input use for service improvement. No paid plan is enabled by this setup.

The prototype threshold is retained as an explicit starting point, **not a validated threshold for the changed model**. Calibrate it with independently labeled Arabic/English examples before institutional deployment. The five original examples are insufficient to claim domain-wide accuracy.

A successful provider-backed API request updates `liveVerified` and `lastSuccessfulRunAt` for the current server process. Configuration alone leaves `liveVerified: false`. A restart resets this observation. A blocked but completed pipeline still establishes provider connectivity, not acceptance of the proposed title.

### E5-compatible alternative

Default API dependencies support a remote OpenAI-compatible embeddings endpoint. Add these environment variables using the hosting provider's secure secret controls, not the frontend, git or a chat message:

```text
MIYAR_ENABLE_STRATEGIC_AI=true
MIYAR_STRATEGIC_EMBEDDING_MODE=remote
MIYAR_STRATEGIC_EMBEDDING_ENDPOINT=<authorized HTTPS endpoint ending in /v1/embeddings>
MIYAR_STRATEGIC_EMBEDDING_KEY=<new scoped server-side credential>
MIYAR_STRATEGIC_EMBEDDING_MODEL=intfloat/multilingual-e5-large
MIYAR_STRATEGIC_GEMINI_KEY=<new server-side Gemini credential>
MIYAR_STRATEGIC_GEMINI_MODEL=<available Gemini generateContent model ID>
MIYAR_STRATEGIC_THRESHOLD=0.85
```

The embeddings server must actually serve the selected model. Substituting a different embedding model changes the original algorithm and requires threshold evaluation. E5 input uses `query: ` / `passage: ` prefixes, L2 normalization and cosine similarity. There is no bundled remote embeddings subscription or automatic resource purchase.

Alternatively, a sufficiently sized inference host can use `MIYAR_STRATEGIC_EMBEDDING_MODE=local-e5`, install a reviewed/pinned compatible `sentence-transformers`/PyTorch stack, and set `MIYAR_E5_REVISION` to a reviewed 40-character model commit. This optional heavy stack is not installed or enabled in the free API image. Do not enable local E5 on an undersized instance. No provider credential from the original attachment has been reused or committed; previously exposed credentials must be revoked by their owner.

## Verification and access

Deploy the API commit separately from GitHub Pages; the Pages workflow does not deploy Render. Check `/health` and `/api/v1/analyze/strategic/status`, sign in to an authorized Miyar organization as a line manager, OD specialist or administrator, select the original pipeline, and accept the displayed provider processing notice. The UI sends the objective, domain, level and constraints only after consent. Model calls are server-side, concurrency-limited and per-user rate-limited. Audit records contain an input digest and result metadata, not the submitted objective or provider keys.

Test a known corpus objective (expect `matched-objective`) and an out-of-corpus need (may produce `generated-proposal`; actual route depends on actual similarity). Review titles, constraints and classification before accepting a proposal. Record provider model IDs and test outcomes before telling a partner the original engine is live.

Automated tests cover both branches with deterministic injected embeddings and LLM responses, malformed vectors, threshold boundary, code clearing, Arabic source aliases, blocked final titles, authentication, consent, audit redaction and explicit provider-failure handling. These tests do not contact Gemini or an embedding provider.
# Operator live provider check

For a diagnostic deployment, set `MIYAR_STRATEGIC_STARTUP_CHECK=true`.
The server runs two fixed examples once per process startup, using the configured
real embedding and generation providers: the original civil-engineering objective
and a synthetic Arabic payroll objective. The read-only strategic status endpoint
includes `providerSelfTest` with actual results and redacted failure codes.
Requests to that endpoint do not initiate provider calls. The check creates no
accounts, reads no organization records, and does not change authentication.
Disable the flag after collecting the result to avoid calls on future restarts.
Passing this check verifies these provider cases only; it does not verify user
login, browser submission, broad job coverage, or model accuracy.
