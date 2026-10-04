# Expert review trial

## Current full-site review (6.1.3)

Use the main website at `https://adeebnoor.github.io/Miyar/` for the complete
expert journey. The separate `/review.html` page covers strategic analysis only.
The main site also exposes semantic matching under **Skill analysis**, and
validated AI KPI generation in **Position design**.

Semantic matching runs a locally hosted multilingual E5 model over 5,041 public
occupation labels and 37 authored/reference skill descriptions. It does not send
the description to Google. Occupation suggestions are bounded by the supplied
field/level and the limited authored source crosswalk; unsupported fields do not
receive invented occupation proposals. Similarity is not classification accuracy.

AI KPI generation uses Google Gemini after an explicit external-processing notice.
It returns three to five editable proposals, validates proportional percentage
formulas, and makes at most one corrective provider generation. A failed response
does not become a fabricated result. Targets and eligible cohorts need HR review.

The three public AI endpoints share the same persisted trial window, quotas and
concurrency guard. Check the live **Service status** before arranging a review;
the expiry is an operator setting, not a date embedded in the website. Local OD,
planning, compensation and drafting remain available after the AI window ends.
Institutional approvals and DOCX/XLSX need authorized organization accounts and
the organization's actual approved framework. Public review grants no such access.

Entry page: `/review.html`. This is a separate, optional trial of strategic
objective analysis. It requires no organization account and never grants access
to organization routes, users, positions, approvals or uploaded reference data.
The existing organization API still requires its original authenticated roles.

The operator must set both `MIYAR_ENABLE_EXPERT_REVIEW=true` and an explicit
timezone-aware ISO timestamp in `MIYAR_EXPERT_REVIEW_EXPIRES_AT`. It fails closed
when either setting is missing, malformed or expired. Disable the flag to end
the trial early. Nothing changes the billing plan or provider credentials.

Strategic and KPI requests require explicit external-processing consent. Local
semantic requests instead show a notice for processing on Miyar's own server.
Strategic inputs are limited
to 2,500 objective characters and 1,000 constraint characters. The same real
strategic pipeline and its global concurrency limit are used, but only with the
bundled public reference catalog, never an organization's custom release.

Quota reservations are committed before provider calls: at most 60 attempts per
UTC day overall and 12 per source network per UTC hour, with a 20-second minimum
interval per network. A PostgreSQL global row lock serializes reservations.
Failed provider attempts count toward the limits. Restarts do not reset quotas.
Only counters and keyed hashes of network addresses are stored; request text,
model output, evaluations and raw network addresses are not stored by this trial.
Google receives the consented text; its account terms still apply.

Reviewers can download their current example, result and evaluation locally.
The trial is for role design, not decisions about employees. Matching coverage
is the five original engineering objective examples. Generated titles and codes
remain proposals requiring professional review; low similarity is not proof
that a role is new or lacks a code in the complete occupation directory.

## Full website integration (5.0.6)

The main website now exposes **Try strategic-objective AI** on its homepage.
This opens the existing analysis screen with AI selected. Reviewers can load a
synthetic payroll example, consent to provider processing, run the same bounded
public expert endpoint and transfer the resulting title and source-linked codes
to OD. Generated unmapped roles carry empty codes into OD. The result card also
exports input, output and optional reviewer comments locally as JSON.

All existing site sections remain in the main navigation. Organization accounts
continue using the authenticated strategic endpoint. Public expert access does
not log users in or grant organizational approval privileges. Its expiry affects
only public AI requests, not the local OD, manpower or compensation tools.
